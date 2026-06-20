import { App, PluginSettingTab, Setting } from "obsidian";
import type AIMemoryBridgePlugin from "../main";

export class AIMemoryBridgeSettingTab extends PluginSettingTab {
  private plugin: AIMemoryBridgePlugin;

  constructor(app: App, plugin: AIMemoryBridgePlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl("h2", { text: "AI Memory Bridge 设置" });

    // MCP Port
    new Setting(containerEl)
      .setName("MCP 端口")
      .setDesc("MCP Bridge 数据文件的存放位置。默认为插件数据目录。")
      .addText((text) =>
        text
          .setPlaceholder("自动")
          .setValue(this.plugin.store.mcpPort === 0 ? "" : String(this.plugin.store.mcpPort))
          .onChange(async (value) => {
            const port = parseInt(value) || 0;
            this.plugin.store.mcpPort = port;
          })
      );

    // Auto-start toggle
    new Setting(containerEl)
      .setName("自动启动 MCP Bridge")
      .setDesc("打开 Obsidian 时自动激活 MCP Bridge 数据同步")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.store.mcpAutoStart)
          .onChange(async (value) => {
            this.plugin.store.mcpAutoStart = value;
          })
      );

    // Bridge script path
    new Setting(containerEl)
      .setName("MCP Bridge 脚本路径")
      .setDesc("mcp-bridge.js 的完整路径，用于生成 Claude Code 配置")
      .addText((text) =>
        text
          .setPlaceholder("mcp-bridge.js (相对路径) 或完整路径")
          .setValue(this.plugin.getBridgeScriptPath())
          .onChange(async (value) => {
            await this.plugin.setBridgeScriptPath(value);
          })
      );

    // Claude Code config display
    containerEl.createEl("h3", { text: "连接 Claude Code" });
    const descDiv = containerEl.createDiv("setting-item-description");
    descDiv.createEl("p", {
      text: "将以下内容添加到 Claude Code 的 MCP 配置中以连接此插件：",
    });

    const vaultPath = (this.app.vault.adapter as any)?.getBasePath?.()
      ?? (this.app.vault.adapter as any)?.basePath
      ?? "你的 vault 路径";
    const scriptPath =
      this.plugin.getBridgeScriptPath() || "mcp-bridge.js";

    const configBlock = descDiv.createEl("pre", {
      cls: "ai-memory-config-block",
      text: JSON.stringify(
        {
          mcpServers: {
            "ai-memory-bridge": {
              command: "node",
              args: [scriptPath, "--vault", vaultPath],
            },
          },
        },
        null,
        2
      ),
    });
    configBlock.style.cssText =
      "background: var(--background-primary-alt); padding: 12px; border-radius: 6px; font-size: 12px; overflow-x: auto; user-select: all;";

    descDiv.createEl("p", {
      text: "在 Claude Code 中添加此配置后，重启 Claude Code，即可在对话中使用 list_memories、get_memory、search_memories、write_memory 工具访问你的 Obsidian 记忆笔记。",
    });
  }
}
