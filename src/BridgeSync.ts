import { Vault, Notice, TFile, TFolder } from "obsidian";
import * as fs from "fs";
import * as path from "path";
import { MemoryStore, MemoryItem } from "./MemoryStore";
import { getVaultBasePath, isPathSafe, parseFrontmatter, MCP_TOOL_DEFINITIONS } from "./utils";

/**
 * BridgeSync writes memory data to a JSON file that the standalone
 * mcp-bridge.js process reads to serve MCP tools to Claude Code.
 *
 * This is NOT an MCP server — it's a file-based sync bridge.
 * The actual MCP protocol is handled by mcp-bridge.js.
 */
export class BridgeSync {
  private store: MemoryStore;
  private vault: Vault;
  private pluginDataDir: string;
  private running: boolean = false;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly DEBOUNCE_MS = 500;
  // Auto-discovery cache to avoid scanning entire vault on every sync
  private autoDiscoveryCache: Partial<MemoryItem>[] | null = null;
  private autoDiscoveryLastScan: number = 0;
  private readonly AUTO_DISCOVERY_INTERVAL_MS = 5 * 60 * 1000; // Rescan every 5 minutes
  private readonly MAX_FILE_SIZE = 512 * 1024; // 512KB — must match mcp-bridge.js MAX_FILE_SIZE

  constructor(store: MemoryStore, vault: Vault, pluginDataDir: string) {
    this.store = store;
    this.vault = vault;
    this.pluginDataDir = pluginDataDir;
  }

  get isRunning(): boolean {
    return this.running;
  }

  /**
   * Start the bridge — processes pending writes and writes current memory data.
   * The external mcp-bridge.js process reads this file.
   */
  async start(): Promise<void> {
    this.running = true;
    // Force immediate sync to process any pending writes from previous sessions
    await this.syncNow();
    new Notice("MCP Bridge 已就绪 — 在 Claude Code 中配置连接即可");
  }

  /**
   * Stop the bridge.
   */
  async stop(): Promise<void> {
    this.running = false;
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    new Notice("MCP Bridge 已停止");
  }

  /**
   * Sync memory data to the bridge file (debounced).
   * Called whenever memory items change.
   */
  async syncBridgeData(): Promise<void> {
    if (!this.running) return;

    // Debounce: batch rapid calls into a single write
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    this.debounceTimer = setTimeout(async () => {
      this.debounceTimer = null;
      await this.writeBridgeFile();
    }, this.DEBOUNCE_MS);
  }

  /**
   * Force an immediate sync (bypasses debounce).
   */
  async syncNow(): Promise<void> {
    if (!this.running) return;
    // Force rescan of auto-discovered memories on explicit sync
    this.autoDiscoveryCache = null;
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    await this.writeBridgeFile();
  }

  /**
   * Internal: write the bridge index file with FULL metadata.
   */
  private async writeBridgeFile(): Promise<void> {
    const items = this.store.items;

    // Auto-discover notes (cached, rescans every 5 minutes)
    const now = Date.now();
    if (!this.autoDiscoveryCache || (now - this.autoDiscoveryLastScan) > this.AUTO_DISCOVERY_INTERVAL_MS) {
      this.autoDiscoveryCache = await this.discoverAutoMemories();
      this.autoDiscoveryLastScan = now;
    }
    const autoItems = this.autoDiscoveryCache;
    const allItems = this.mergeItems(items, autoItems);

    // Read existing bridge file to preserve pending writes
    let existingData: any = { pendingWrites: [] };
    const bridgeFile = path.join(this.pluginDataDir, "memory-bridge.json");
    try {
      if (fs.existsSync(bridgeFile)) {
        const raw = await fs.promises.readFile(bridgeFile, "utf-8");
        existingData = JSON.parse(raw);
      }
    } catch {
      // Ignore read errors
    }

    // Process pending writes from Claude Code
    const pendingWrites: any[] = existingData.pendingWrites || [];
    const processedIds: string[] = [];
    // Pending deletes queue (mcp-bridge.js handleDeleteMemory appends here instead of
    // mutating the memories array directly). Consumed below.
    const pendingDeletes: any[] = existingData.pendingDeletes || [];
    // Access log queue (mcp-bridge.js handleGetMemory appends {path, timestamp} here).
    const accessLog: any[] = existingData.accessLog || [];

    for (const write of pendingWrites) {
      if (write.status !== "pending") continue;
      try {
        await this.executeWrite(write);
        write.status = "done";
        processedIds.push(write.id);
      } catch (err) {
        write.status = "failed";
        write.error = String(err);
      }
    }

    // Process pending deletes: remove from store.items (manual) and persist path
    // to deletedPaths so auto-discovery does not re-add it on next scan.
    const processedDeleteIds: string[] = [];
    for (const del of pendingDeletes) {
      if (del.status !== "pending") continue;
      try {
        await this.store.removeMemory(del.path);
        this.store.addToDeletedPaths(del.path);
        del.status = "done";
        processedDeleteIds.push(del.id);
      } catch (err) {
        del.status = "failed";
        del.error = String(err);
      }
    }

    // Consume access log: update lastAccessedAt on matching MemoryItems.
    // Note: lastAccessedAt is updated in-memory; persistence happens on next store
    // mutation. Acceptable because it's an auxiliary field.
    let accessLogUpdated = false;
    for (const entry of accessLog) {
      if (!entry.path || typeof entry.timestamp !== "number") continue;
      const item = this.store.items.find((i) => i.path === entry.path);
      if (item) {
        const prev = item.lastAccessedAt || 0;
        if (entry.timestamp > prev) {
          item.lastAccessedAt = entry.timestamp;
          accessLogUpdated = true;
        }
      }
    }

    // Write FULL metadata (not just path+name)
    const bridgeData = {
      version: "0.3.0",
      updatedAt: new Date().toISOString(),
      vaultName: this.vault.getName(),
      memoryCount: allItems.length,
      memories: allItems.map((item) => ({
        path: item.path,
        name: item.name,
        isFolder: item.isFolder,
        tags: item.tags || [],
        priority: item.priority ?? 0,
        addedAt: item.addedAt,
        source: item.source || "manual",
      })),
      pendingWrites: pendingWrites.filter((w: any) => w.status === "pending"),
      pendingDeletes: pendingDeletes.filter((d: any) => d.status === "pending"),
      accessLog: [],  // Cleared after consumption
    };

    try {
      if (!fs.existsSync(this.pluginDataDir)) {
        fs.mkdirSync(this.pluginDataDir, { recursive: true });
      }
      // Atomic write: temp file + rename to prevent corruption from concurrent access
      const tmpPath = bridgeFile + ".tmp." + Date.now();
      await fs.promises.writeFile(tmpPath, JSON.stringify(bridgeData, null, 2), { encoding: "utf-8", mode: 0o600 });
      await fs.promises.rename(tmpPath, bridgeFile);
      if (processedIds.length > 0) {
        new Notice(`已处理 ${processedIds.length} 条 AI 写入请求`);
      }
      if (processedDeleteIds.length > 0) {
        new Notice(`已处理 ${processedDeleteIds.length} 条 AI 删除请求`);
      }
      if (accessLogUpdated) {
        console.log("AI Memory Bridge: accessLog consumed, lastAccessedAt updated in-memory");
      }
    } catch (err) {
      console.error("AI Memory Bridge: Failed to sync bridge data:", err);
    }
  }

  /**
   * Scan vault for .md files with ai_memory: true in frontmatter.
   * Skips paths in store.deletedPaths (prevents deleted memories from being
   * re-added by the next auto-discovery scan).
   */
  private async discoverAutoMemories(): Promise<Partial<MemoryItem>[]> {
    const results: Partial<MemoryItem>[] = [];
    const deleted = new Set(this.store.deletedPaths);
    const allMdFiles = this.vault.getMarkdownFiles();
    for (const file of allMdFiles) {
      if (deleted.has(file.path)) continue;
      try {
        const content = await this.vault.read(file);
        if (content.startsWith("---") && content.includes("ai_memory")) {
          const fm = parseFrontmatter(content);
          if (fm.ai_memory === true || fm.ai_memory === "true") {
            results.push({
              path: file.path,
              name: file.basename,
              isFolder: false,
              tags: Array.isArray(fm.tags) ? fm.tags : (typeof fm.tags === "string" ? [fm.tags] : []),
              priority: 0,
              source: "auto",
              addedAt: Date.now(),
            });
          }
        }
      } catch {
        // Skip unreadable files
      }
    }
    return results;
  }

  /**
   * Merge manual + auto items, manual takes precedence on conflict.
   */
  private mergeItems(
    manual: MemoryItem[],
    auto: Partial<MemoryItem>[]
  ): Array<{ path: string; name: string; isFolder: boolean; tags: string[]; priority: number; addedAt: number; source: string }> {
    const seen = new Set<string>();
    const merged: Array<any> = [];

    // Manual items first (higher priority)
    for (const item of manual) {
      if (seen.has(item.path)) continue;
      seen.add(item.path);
      merged.push({
        path: item.path,
        name: item.name,
        isFolder: item.isFolder,
        tags: item.tags || [],
        priority: item.priority ?? 0,
        addedAt: item.addedAt,
        source: item.source || "manual",
      });
    }

    // Auto items — skip if already in manual list
    for (const item of auto) {
      if (!item.path || seen.has(item.path)) continue;
      seen.add(item.path);
      merged.push({
        path: item.path,
        name: item.name || "",
        isFolder: item.isFolder || false,
        tags: item.tags || [],
        priority: item.priority ?? 0,
        addedAt: item.addedAt || Date.now(),
        source: "auto",
      });
    }

    return merged;
  }

  /**
   * Execute a single write request from Claude Code.
   */
  private async executeWrite(write: {
    name: string;
    content: string;
    mode: "create" | "append";
    folder: string;
    id: string;
  }): Promise<void> {
    // Defense-in-depth: re-validate even though mcp-bridge.js already checks at entry.
    // Prevents malicious pendingWrites injected directly into bridge file.
    const folder = write.folder || "AI记忆";
    if (!isPathSafe(folder)) {
      throw new Error(`不安全的 folder 路径: ${folder}`);
    }
    if (!isPathSafe(write.name)) {
      throw new Error(`不安全的 name: ${write.name}`);
    }
    if (write.content.length > this.MAX_FILE_SIZE) {
      throw new Error(`content 过大 (${write.content.length} 字符)，超过 ${this.MAX_FILE_SIZE} 限制`);
    }
    const folderPath = folder;
    const fileName = `${write.name}.md`;
    const filePath = `${folderPath}/${fileName}`;

    // Ensure folder exists (create nested folders if needed)
    const existingFolder = this.vault.getAbstractFileByPath(folderPath);
    if (!existingFolder) {
      // Create parent folders first
      const parts = folderPath.split("/").filter(Boolean);
      let currentPath = "";
      for (const part of parts) {
        currentPath = currentPath ? `${currentPath}/${part}` : part;
        if (!this.vault.getAbstractFileByPath(currentPath)) {
          await this.vault.createFolder(currentPath);
        }
      }
    }

    const existingFile = this.vault.getAbstractFileByPath(filePath);

    if (write.mode === "append" && existingFile instanceof TFile) {
      // Append to existing file
      const content = await this.vault.read(existingFile);
      const newContent = content + "\n\n---\n\n" + write.content;
      await this.vault.modify(existingFile, newContent);
    } else {
      // Create new file (frontmatter + content)
      const fullContent = `---\nai_generated: true\ncreated: ${new Date().toISOString()}\n---\n\n# ${write.name}\n\n${write.content}`;
      if (existingFile instanceof TFile) {
        // File exists and mode is create: overwrite
        await this.vault.modify(existingFile, fullContent);
      } else {
        await this.vault.create(filePath, fullContent);
      }

      // Auto-add the new file to memory store
      const file = this.vault.getAbstractFileByPath(filePath);
      if (file) {
        await this.store.addMemory(file as TFile | TFolder);
      }
    }
  }

  /**
   * Generate the MCP configuration for Claude Code.
   */
  generateClaudeCodeConfig(bridgeScriptPath: string): object {
    const vaultBasePath = getVaultBasePath(this.vault);
    return {
      mcpServers: {
        "ai-memory-bridge": {
          command: "node",
          args: [bridgeScriptPath, "--vault", vaultBasePath],
        },
      },
    };
  }

  /**
   * Get the tool descriptions from the shared definition.
   */
  static getToolDescriptions(): Array<{ name: string; description: string }> {
    return MCP_TOOL_DEFINITIONS;
  }
}
