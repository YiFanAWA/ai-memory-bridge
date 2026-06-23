import { Plugin, WorkspaceLeaf } from "obsidian";
import { MemoryPanel, VIEW_TYPE_MEMORY_PANEL } from "./src/MemoryPanel";
import { MemoryStore, MemoryStoreData } from "./src/MemoryStore";
import { BridgeSync } from "./src/BridgeSync";
import { AIMemoryBridgeSettingTab } from "./src/settings";
import { getVaultBasePath } from "./src/utils";

const DEFAULT_BRIDGE_SCRIPT_PATH = "mcp-bridge.js";

export default class AIMemoryBridgePlugin extends Plugin {
  store: MemoryStore;
  bridgeSync: BridgeSync;
  private bridgeScriptPath: string = DEFAULT_BRIDGE_SCRIPT_PATH;

  async onload(): Promise<void> {
    console.log("AI Memory Bridge: Loading plugin");

    // Load persisted data once
    const data = (await this.loadData()) as (MemoryStoreData & { bridgeScriptPath?: string }) | null;

    // Initialize MemoryStore
    this.store = new MemoryStore(data, this.app.vault, async () => {
      await this.saveData(this.store.getData());
      // Sync bridge data when store changes
      if (this.bridgeSync?.isRunning) {
        await this.bridgeSync.syncBridgeData();
      }
    });

    // Initialize Bridge Sync
    const vaultBasePath = getVaultBasePath(this.app.vault);
    if (!vaultBasePath) {
      console.error("AI Memory Bridge: Vault not backed by filesystem. Plugin requires desktop Obsidian.");
      // Bridge sync disabled — MCP server won't have data to serve
    }
    const pluginDataDir = vaultBasePath
      ? `${vaultBasePath}/.obsidian/ai-memory-bridge`
      : "";
    this.bridgeSync = new BridgeSync(this.store, this.app.vault, pluginDataDir);

    // Restore saved bridge script path
    if (data?.bridgeScriptPath) {
      this.bridgeScriptPath = data.bridgeScriptPath;
    }

    // Register the Memory Panel view
    this.registerView(
      VIEW_TYPE_MEMORY_PANEL,
      (leaf: WorkspaceLeaf) =>
        new MemoryPanel(leaf, this.store, this.app.vault)
    );

    // Add ribbon icon
    this.addRibbonIcon("brain", "AI Memory Bridge", async (_evt: MouseEvent) => {
      await this.activateView();
    });

    // Add command to open memory panel
    this.addCommand({
      id: "open-memory-panel",
      name: "打开 AI 记忆面板",
      callback: async () => {
        await this.activateView();
      },
    });

    // Add command to toggle MCP bridge
    this.addCommand({
      id: "toggle-mcp-bridge",
      name: "启动/停止 MCP Bridge",
      callback: async () => {
        await this.toggleBridgeSync();
      },
    });

    // Add settings tab
    this.addSettingTab(new AIMemoryBridgeSettingTab(this.app, this));

    // Auto-start MCP if configured
    if (this.store.mcpAutoStart) {
      await this.bridgeSync.start();
      this.updatePanelStatus();
    }

    console.log("AI Memory Bridge: Plugin loaded");
  }

  async onunload(): Promise<void> {
    console.log("AI Memory Bridge: Unloading plugin");
    if (this.bridgeSync?.isRunning) {
      await this.bridgeSync.stop();
    }
    this.app.workspace.detachLeavesOfType(VIEW_TYPE_MEMORY_PANEL);
  }

  /**
   * Activate the memory panel view (open in sidebar).
   */
  async activateView(): Promise<void> {
    const { workspace } = this.app;

    let leaf = workspace.getLeavesOfType(VIEW_TYPE_MEMORY_PANEL)[0];

    if (!leaf) {
      const rightLeaf = workspace.getRightLeaf(false);
      if (rightLeaf) {
        await rightLeaf.setViewState({
          type: VIEW_TYPE_MEMORY_PANEL,
          active: true,
        });
        leaf = rightLeaf;
      }
    }

    if (leaf) {
      workspace.revealLeaf(leaf);
      const panel = leaf.view as MemoryPanel;
      panel.setToggleServerCallback(async () => {
        await this.toggleBridgeSync();
      });
      this.updatePanelStatus();
    }
  }

  /**
   * Toggle the bridge sync on/off.
   */
  async toggleBridgeSync(): Promise<void> {
    if (this.bridgeSync.isRunning) {
      await this.bridgeSync.stop();
    } else {
      await this.bridgeSync.start();
    }
    await this.bridgeSync.syncBridgeData();
    this.updatePanelStatus();
  }

  /**
   * Update the panel's server status display.
   */
  private updatePanelStatus(): void {
    const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_MEMORY_PANEL);
    for (const leaf of leaves) {
      const panel = leaf.view as MemoryPanel;
      if (panel?.setServerStatus) {
        panel.setServerStatus(
          this.bridgeSync.isRunning,
          this.store.mcpPort || undefined
        );
      }
    }
  }

  /**
   * Get the bridge script path.
   */
  getBridgeScriptPath(): string {
    return this.bridgeScriptPath;
  }

  /**
   * Set the bridge script path.
   */
  async setBridgeScriptPath(filePath: string): Promise<void> {
    this.bridgeScriptPath = filePath;
    const data = await this.loadData();
    await this.saveData({ ...data, bridgeScriptPath: filePath });
  }
}
