import { TFile, TFolder, Vault } from "obsidian";
import { parseFrontmatter } from "./utils";

export interface MemoryItem {
  /** Full vault-relative path */
  path: string;
  /** Display name (basename without extension) */
  name: string;
  /** Whether it's a folder */
  isFolder: boolean;
  /** When it was added (timestamp ms) */
  addedAt: number;
  /** Tags from frontmatter or manual assignment */
  tags: string[];
  /** Optional user description */
  description: string;
  /** Priority level: 0=normal, 1=important, 2=critical */
  priority: number;
  /** Source: "manual" (drag-drop) or "auto" (ai_memory:true frontmatter) */
  source: "manual" | "auto";
  /** Last time AI accessed this memory via get_memory (timestamp ms) */
  lastAccessedAt?: number;
}

export interface MemoryStoreData {
  items: MemoryItem[];
  /** MCP server port (0 = auto) */
  mcpPort: number;
  /** Whether MCP server auto-starts */
  mcpAutoStart: boolean;
  /** Last sync timestamp (for mcp-bridge.js cache invalidation) */
  lastSyncAt?: string;
  /** Paths persistently marked as deleted (blocks auto-discovery re-adding them) */
  deletedPaths: string[];
}

const DEFAULT_DATA: MemoryStoreData = {
  items: [],
  mcpPort: 0, // 0 = auto-pick
  mcpAutoStart: true,
  deletedPaths: [],
};

export class MemoryStore {
  private data: MemoryStoreData;
  private vault: Vault;
  private saveCallback: () => Promise<void>;

  constructor(
    initialData: MemoryStoreData | null,
    vault: Vault,
    saveCallback: () => Promise<void>
  ) {
    this.data = initialData ?? { ...DEFAULT_DATA, items: [] };
    // Migration from old data formats
    if (!this.data.items) {
      this.data.items = [];
    }
    if (this.data.mcpPort === undefined) {
      this.data.mcpPort = DEFAULT_DATA.mcpPort;
    }
    if (this.data.mcpAutoStart === undefined) {
      this.data.mcpAutoStart = DEFAULT_DATA.mcpAutoStart;
    }
    if (!this.data.deletedPaths) {
      this.data.deletedPaths = [];
    }
    // Migrate items missing v0.3.0 fields
    for (const item of this.data.items) {
      if (item.priority === undefined) item.priority = 0;
      if (item.source === undefined) item.source = "manual";
    }
    this.vault = vault;
    this.saveCallback = saveCallback;
  }

  get items(): MemoryItem[] {
    return this.data.items;
  }

  get deletedPaths(): string[] {
    return this.data.deletedPaths;
  }

  get mcpPort(): number {
    return this.data.mcpPort;
  }

  set mcpPort(port: number) {
    this.data.mcpPort = port;
    void this.safeSave();
  }

  get mcpAutoStart(): boolean {
    return this.data.mcpAutoStart;
  }

  set mcpAutoStart(auto: boolean) {
    this.data.mcpAutoStart = auto;
    void this.safeSave();
  }

  /**
   * Add a file or folder to memory.
   * For folders, automatically adds all contained markdown files.
   */
  async addMemory(
    fileOrFolder: TFile | TFolder,
    source: "manual" | "auto" = "manual"
  ): Promise<MemoryItem[]> {
    const added: MemoryItem[] = [];

    // Unlock path if it was previously deleted (user re-adding manually)
    this.removeFromDeletedPaths(fileOrFolder.path);

    if (fileOrFolder instanceof TFolder) {
      // Add folder as a memory item
      if (!this.hasItem(fileOrFolder.path)) {
        const item: MemoryItem = {
          path: fileOrFolder.path,
          name: fileOrFolder.name,
          isFolder: true,
          addedAt: Date.now(),
          tags: [],
          description: "",
          priority: 0,
          source,
        };
        this.data.items.push(item);
        added.push(item);
      }

      // Also add all markdown files inside the folder
      const files = this.getMarkdownFilesInFolder(fileOrFolder);
      for (const file of files) {
        if (!this.hasItem(file.path)) {
          const item = await this.createFileMemoryItem(file, source);
          this.data.items.push(item);
          added.push(item);
        }
      }
    } else {
      // Single file
      if (!this.hasItem(fileOrFolder.path)) {
        const item = await this.createFileMemoryItem(fileOrFolder, source);
        this.data.items.push(item);
        added.push(item);
      }
    }

    if (added.length > 0) {
      await this.safeSave();
    }
    return added;
  }

  /**
   * Create a MemoryItem from a TFile, parsing frontmatter for tags.
   */
  private async createFileMemoryItem(
    file: TFile,
    source: "manual" | "auto"
  ): Promise<MemoryItem> {
    let tags: string[] = [];
    try {
      const content = await this.vault.read(file);
      const fm = parseFrontmatter(content);
      if (Array.isArray(fm.tags)) {
        tags = fm.tags;
      } else if (typeof fm.tags === "string") {
        tags = [fm.tags];
      }
    } catch {
      // File unreadable — leave tags empty
    }

    return {
      path: file.path,
      name: file.basename,
      isFolder: false,
      addedAt: Date.now(),
      tags,
      description: "",
      priority: 0,
      source,
    };
  }

  /**
   * Remove a memory item by path.
   */
  async removeMemory(path: string): Promise<boolean> {
    const before = this.data.items.length;
    const item = this.data.items.find((i) => i.path === path);
    if (!item) return false;

    if (item.isFolder) {
      // Also remove all child items inside the folder.
      // Use trailing "/" to ensure exact directory prefix match
      // (e.g., "notes/" matches "notes/sub.md" but NOT "notes-extra.md").
      const dirPrefix = item.path.endsWith("/") ? item.path : item.path + "/";
      this.data.items = this.data.items.filter(
        (i) => i.path !== path && !i.path.startsWith(dirPrefix)
      );
    } else {
      this.data.items = this.data.items.filter((i) => i.path !== path);
    }

    if (this.data.items.length === before) return false;
    await this.saveCallback();
    return true;
  }

  /**
   * Add a path to the persistent deleted set (blocks auto-discovery).
   */
  addToDeletedPaths(path: string): void {
    if (!this.data.deletedPaths.includes(path)) {
      this.data.deletedPaths.push(path);
      void this.safeSave();
    }
  }

  /**
   * Remove a path from the persistent deleted set (unlocks re-adding).
   */
  removeFromDeletedPaths(path: string): void {
    this.data.deletedPaths = this.data.deletedPaths.filter((p) => p !== path);
    void this.safeSave();
  }

  /**
   * Check if a path is already in the memory list.
   */
  hasItem(path: string): boolean {
    return this.data.items.some((i) => i.path === path);
  }

  /**
   * Get all resolved markdown file paths from the memory items.
   * Expands folders to their contained markdown files.
   */
  getResolvedFilePaths(): string[] {
    const paths = new Set<string>();

    for (const item of this.data.items) {
      if (item.isFolder) {
        const folder = this.vault.getAbstractFileByPath(item.path);
        if (folder instanceof TFolder) {
          const files = this.getMarkdownFilesInFolder(folder);
          for (const f of files) {
            paths.add(f.path);
          }
        }
      } else {
        paths.add(item.path);
      }
    }

    return Array.from(paths);
  }

  /**
   * Get the content of all memory files.
   */
  async getMemoryContents(): Promise<{ path: string; name: string; content: string }[]> {
    const paths = this.getResolvedFilePaths();
    const results: { path: string; name: string; content: string }[] = [];

    for (const path of paths) {
      const file = this.vault.getAbstractFileByPath(path);
      if (file instanceof TFile) {
        const content = await this.vault.read(file);
        results.push({
          path: file.path,
          name: file.basename,
          content,
        });
      }
    }

    return results;
  }

  /**
   * Search memory contents.
   */
  async searchMemories(query: string): Promise<{ path: string; name: string; snippet: string }[]> {
    const results: { path: string; name: string; snippet: string }[] = [];
    const lowerQuery = query.toLowerCase();
    const paths = this.getResolvedFilePaths();

    for (const path of paths) {
      const file = this.vault.getAbstractFileByPath(path);
      if (file instanceof TFile) {
        // Check filename first
        if (file.basename.toLowerCase().includes(lowerQuery)) {
          results.push({ path: file.path, name: file.basename, snippet: "[文件名匹配]" });
          continue;
        }
        // Then check content
        const content = await this.vault.read(file);
        const lowerContent = content.toLowerCase();
        const idx = lowerContent.indexOf(lowerQuery);
        if (idx !== -1) {
          const start = Math.max(0, idx - 40);
          const end = Math.min(content.length, idx + query.length + 40);
          const snippet =
            (start > 0 ? "..." : "") +
            content.slice(start, end).replace(/\n/g, " ") +
            (end < content.length ? "..." : "");
          results.push({
            path: file.path,
            name: file.basename,
            snippet,
          });
        }
      }
    }

    return results;
  }

  /**
   * Update an item's metadata.
   */
  async updateItem(
    path: string,
    updates: Partial<Pick<MemoryItem, "tags" | "description" | "priority">>
  ): Promise<boolean> {
    const item = this.data.items.find((i) => i.path === path);
    if (!item) return false;

    if (updates.tags !== undefined) item.tags = updates.tags;
    if (updates.description !== undefined) item.description = updates.description;
    if (updates.priority !== undefined) item.priority = updates.priority;

    await this.saveCallback();
    return true;
  }

  /**
   * Set memory priority (0=normal, 1=important, 2=critical).
   * Clamps to valid range.
   */
  async setPriority(path: string, priority: number): Promise<boolean> {
    return this.updateItem(path, { priority: Math.max(0, Math.min(2, priority)) });
  }

  /**
   * Safely persist data with error handling.
   * Replaces bare `void this.saveCallback()` calls throughout the class.
   */
  private async safeSave(): Promise<void> {
    try {
      await this.saveCallback();
    } catch (err) {
      console.error("AI Memory Bridge: Failed to save memory data:", err);
    }
  }

  /**
   * Clear all memories.
   */
  async clearAll(): Promise<void> {
    this.data.items = [];
    await this.saveCallback();
  }

  /**
   * Get the raw data for serialization.
   */
  getData(): MemoryStoreData {
    return this.data;
  }

  /**
   * Recursively get all markdown files in a folder.
   */
  private getMarkdownFilesInFolder(folder: TFolder): TFile[] {
    const files: TFile[] = [];
    for (const child of folder.children) {
      if (child instanceof TFile && child.extension === "md") {
        files.push(child);
      } else if (child instanceof TFolder) {
        files.push(...this.getMarkdownFilesInFolder(child));
      }
    }
    return files;
  }
}
