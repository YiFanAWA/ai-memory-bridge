import {
  ItemView,
  WorkspaceLeaf,
  TFile,
  TFolder,
  Vault,
  Menu,
  Notice,
} from "obsidian";
import { MemoryStore, MemoryItem } from "./MemoryStore";
import { getVaultBasePath } from "./utils";

export const VIEW_TYPE_MEMORY_PANEL = "ai-memory-bridge-panel";

export class MemoryPanel extends ItemView {
  private store: MemoryStore;
  private vault: Vault;

  // View state — decoupled from rendering logic
  private searchQuery: string = "";
  private sortKey: "name" | "time" | "priority" | "recent" = "time";
  private groupBy: "none" | "tags" = "none";

  // Callback to notify main plugin of MCP server toggle
  private onToggleServer: (() => void) | null = null;

  // DOM references for cleanup
  private dropZone: HTMLElement | null = null;
  private serverStatusDot: HTMLElement | null = null;
  private serverStatusText: HTMLElement | null = null;
  private countEl: HTMLElement | null = null;
  private clearBtn: HTMLElement | null = null;
  private searchInput: HTMLInputElement | null = null;
  private copyBtn: HTMLButtonElement | null = null;
  private toolbar: HTMLElement | null = null;

  // Store event listener references for cleanup
  private dragoverHandler: ((e: DragEvent) => void) | null = null;
  private dragleaveHandler: ((e: DragEvent) => void) | null = null;
  private dropHandler: ((e: DragEvent) => void) | null = null;
  private toggleBtnClickHandler: (() => void) | null = null;
  private clearBtnClickHandler: ((e: MouseEvent) => void) | null = null;
  private searchInputHandler: ((e: Event) => void) | null = null;
  private copyBtnClickHandler: (() => void) | null = null;
  private toolbarClickHandler: ((e: MouseEvent) => void) | null = null;
  private dropZoneClickHandler: ((e: MouseEvent) => void) | null = null;
  private dropZoneContextmenuHandler: ((e: MouseEvent) => void) | null = null;

  constructor(leaf: WorkspaceLeaf, store: MemoryStore, vault: Vault) {
    super(leaf);
    this.store = store;
    this.vault = vault;
  }

  getViewType(): string {
    return VIEW_TYPE_MEMORY_PANEL;
  }

  getDisplayText(): string {
    return "AI Memory Bridge";
  }

  getIcon(): string {
    return "brain";
  }

  setToggleServerCallback(cb: () => void): void {
    this.onToggleServer = cb;
  }

  async onOpen(): Promise<void> {
    const container = this.containerEl.children[1];
    container.empty();
    container.addClass("ai-memory-panel");

    // Header
    const header = container.createDiv("ai-memory-panel-header");
    header.createSpan({ cls: "ai-memory-panel-title", text: "🧠 AI 记忆面板" });
    this.countEl = header.createSpan({ cls: "ai-memory-panel-count", text: "0" });

    // Toolbar: search + sort (event delegation for sort buttons)
    this.toolbar = container.createDiv("ai-memory-toolbar");
    const searchInput = this.toolbar.createEl("input", {
      type: "text",
      placeholder: "搜索记忆...",
      cls: "ai-memory-search-input",
    });
    this.searchInput = searchInput;
    this.searchInputHandler = (e: Event) => {
      this.searchQuery = (e.target as HTMLInputElement).value;
      this.renderDropZone();
    };
    searchInput.addEventListener("input", this.searchInputHandler);

    // Sort buttons container (click handled via toolbar delegation)
    const sortGroup = this.toolbar.createDiv("ai-memory-sort-group");
    this.toolbarClickHandler = (e: MouseEvent) => {
      const btn = (e.target as HTMLElement).closest(".ai-memory-sort-btn");
      if (!btn) return;
      const key = btn.getAttribute("data-sort-key");
      const group = btn.getAttribute("data-group-toggle");
      if (key) {
        this.sortKey = key as typeof this.sortKey;
        this.renderSortButtons(sortGroup);
        this.renderDropZone();
      } else if (group === "tags") {
        this.groupBy = this.groupBy === "tags" ? "none" : "tags";
        this.renderSortButtons(sortGroup);
        this.renderDropZone();
      }
    };
    this.toolbar.addEventListener("click", this.toolbarClickHandler);
    this.renderSortButtons(sortGroup);

    // Drop zone
    this.dropZone = container.createDiv("ai-memory-drop-zone");
    this.renderDropZone();

    // Setup drag events
    this.setupDragEvents();

    // Event delegation on dropZone for item clicks, contextmenu, remove buttons,
    // and group header collapse. Avoids per-item listeners (AGENTS.md 禁止模式).
    this.dropZoneClickHandler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // Remove button takes priority
      if (target.classList.contains("ai-memory-item-remove")) {
        e.stopPropagation();
        const path = target.closest("[data-item-path]")?.getAttribute("data-item-path");
        if (path) {
          const item = this.store.items.find((i) => i.path === path);
          if (item) {
            void this.store
              .removeMemory(path)
              .then(() => {
                this.renderDropZone();
                new Notice(`已移除: ${item.name}`);
              });
          }
        }
        return;
      }
      // Group header collapse toggle
      const headerEl = target.closest(".ai-memory-group-header");
      if (headerEl) {
        const body = headerEl.nextElementSibling;
        const toggle = headerEl.querySelector(".ai-memory-group-toggle");
        if (body && toggle) {
          if (body.hasClass("collapsed")) {
            body.removeClass("collapsed");
            toggle.textContent = "▼";
          } else {
            body.addClass("collapsed");
            toggle.textContent = "▶";
          }
        }
        return;
      }
      // Item body click → open note
      const itemEl = target.closest("[data-item-path]");
      if (itemEl) {
        const path = itemEl.getAttribute("data-item-path");
        if (path) {
          const item = this.store.items.find((i) => i.path === path);
          if (item && !item.isFolder) {
            const file = this.vault.getAbstractFileByPath(item.path);
            if (file instanceof TFile) {
              const leaf = this.app.workspace.getLeaf(false);
              void leaf.openFile(file);
            }
          }
        }
      }
    };
    this.dropZone.addEventListener("click", this.dropZoneClickHandler);

    this.dropZoneContextmenuHandler = (e: MouseEvent) => {
      const itemEl = (e.target as HTMLElement).closest("[data-item-path]");
      if (!itemEl) return;
      const path = itemEl.getAttribute("data-item-path");
      if (!path) return;
      const item = this.store.items.find((i) => i.path === path);
      if (!item) return;
      e.preventDefault();
      const menu = new Menu();
      if (!item.isFolder) {
        menu.addItem((menuItem) => {
          menuItem
            .setTitle("打开笔记")
            .setIcon("file")
            .onClick(async () => {
              const file = this.vault.getAbstractFileByPath(item.path);
              if (file instanceof TFile) {
                const leaf = this.app.workspace.getLeaf(false);
                await leaf.openFile(file);
              }
            });
        });
      }
      menu.addItem((menuItem) => {
        menuItem
          .setTitle("在文件浏览器中显示")
          .setIcon("folder")
          .onClick(() => {
            const fileExplorer =
              this.app.workspace.getLeavesOfType("file-explorer")[0];
            if (fileExplorer) {
              this.app.workspace.revealLeaf(fileExplorer);
            }
          });
      });
      menu.addSeparator();
      menu.addItem((menuItem) => {
        menuItem
          .setTitle("移除记忆")
          .setIcon("trash")
          .onClick(async () => {
            await this.store.removeMemory(item.path);
            this.renderDropZone();
          });
      });
      menu.showAtMouseEvent(e);
    };
    this.dropZone.addEventListener("contextmenu", this.dropZoneContextmenuHandler);

    // Footer with server status and actions
    const footer = container.createDiv("ai-memory-panel-footer");

    const statusDiv = footer.createDiv("ai-memory-server-status");
    this.serverStatusDot = statusDiv.createSpan("ai-memory-server-dot stopped");
    this.serverStatusText = statusDiv.createSpan({ text: "MCP 已停止" });

    const actions = footer.createDiv("ai-memory-actions");
    const toggleBtn = actions.createEl("button", {
      cls: "ai-memory-btn primary",
      text: "启动 MCP",
    });
    this.toggleBtnClickHandler = () => {
      this.onToggleServer?.();
    };
    toggleBtn.addEventListener("click", this.toggleBtnClickHandler);

    this.clearBtn = actions.createEl("button", {
      cls: "ai-memory-btn",
      text: "清空",
    });
    this.clearBtnClickHandler = (_e: MouseEvent) => {
      void this.store.clearAll();
      void this.renderDropZone();
    };
    this.clearBtn.addEventListener("click", this.clearBtnClickHandler);

    // Copy MCP config button
    this.copyBtn = actions.createEl("button", {
      cls: "ai-memory-btn",
      text: "📋 配置",
      title: "复制 Claude Code MCP 配置到剪贴板",
    });
    this.copyBtnClickHandler = () => {
      void this.copyMCPConfig();
    };
    this.copyBtn.addEventListener("click", this.copyBtnClickHandler);
  }

  async onClose(): Promise<void> {
    // Remove drag event listeners + delegated listeners on dropZone
    if (this.dropZone) {
      if (this.dragoverHandler) {
        this.dropZone.removeEventListener("dragover", this.dragoverHandler);
        this.dragoverHandler = null;
      }
      if (this.dragleaveHandler) {
        this.dropZone.removeEventListener("dragleave", this.dragleaveHandler);
        this.dragleaveHandler = null;
      }
      if (this.dropHandler) {
        this.dropZone.removeEventListener("drop", this.dropHandler);
        this.dropHandler = null;
      }
      if (this.dropZoneClickHandler) {
        this.dropZone.removeEventListener("click", this.dropZoneClickHandler);
        this.dropZoneClickHandler = null;
      }
      if (this.dropZoneContextmenuHandler) {
        this.dropZone.removeEventListener("contextmenu", this.dropZoneContextmenuHandler);
        this.dropZoneContextmenuHandler = null;
      }
    }

    // Remove toolbar (sort/group) delegated listener
    if (this.toolbar && this.toolbarClickHandler) {
      this.toolbar.removeEventListener("click", this.toolbarClickHandler);
      this.toolbarClickHandler = null;
    }

    // Remove search input listener
    if (this.searchInput && this.searchInputHandler) {
      this.searchInput.removeEventListener("input", this.searchInputHandler);
      this.searchInputHandler = null;
    }

    // Remove button listeners
    const toggleBtn = this.containerEl.querySelector(".ai-memory-btn.primary");
    if (toggleBtn && this.toggleBtnClickHandler) {
      toggleBtn.removeEventListener("click", this.toggleBtnClickHandler);
      this.toggleBtnClickHandler = null;
    }
    if (this.clearBtn && this.clearBtnClickHandler) {
      this.clearBtn.removeEventListener("click", this.clearBtnClickHandler);
      this.clearBtnClickHandler = null;
    }
    if (this.copyBtn && this.copyBtnClickHandler) {
      this.copyBtn.removeEventListener("click", this.copyBtnClickHandler);
      this.copyBtnClickHandler = null;
    }

    // Null out all DOM references
    this.dropZone = null;
    this.toolbar = null;
    this.searchInput = null;
    this.copyBtn = null;
    this.clearBtn = null;
    this.countEl = null;
    this.serverStatusDot = null;
    this.serverStatusText = null;
    this.onToggleServer = null;
  }

  /**
   * Refresh the panel display (called after data changes).
   */
  refresh(): void {
    this.renderDropZone();
  }

  /**
   * Update the server status indicator.
   */
  setServerStatus(running: boolean, port?: number): void {
    if (this.serverStatusDot) {
      this.serverStatusDot.className = "ai-memory-server-dot " + (running ? "running" : "stopped");
    }
    if (this.serverStatusText) {
      if (running && port) {
        this.serverStatusText.textContent = `MCP 运行中 :${port}`;
      } else {
        this.serverStatusText.textContent = running ? "MCP 启动中..." : "MCP 已停止";
      }
    }
    // Update button text
    const toggleBtn = this.containerEl.querySelector(".ai-memory-btn.primary") as HTMLButtonElement;
    if (toggleBtn) {
      toggleBtn.textContent = running ? "停止 MCP" : "启动 MCP";
    }
  }

  private setupDragEvents(): void {
    if (!this.dropZone) return;

    this.dragoverHandler = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = "copy";
      }
      this.dropZone?.addClass("drag-over");
    };
    this.dropZone.addEventListener("dragover", this.dragoverHandler);

    this.dragleaveHandler = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      this.dropZone?.removeClass("drag-over");
    };
    this.dropZone.addEventListener("dragleave", this.dragleaveHandler);

    this.dropHandler = async (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      this.dropZone?.removeClass("drag-over");

      if (!e.dataTransfer) return;

      const data = e.dataTransfer.getData("text/plain");
      if (!data) return;

      // Obsidian file explorer drag format: paths separated by newlines
      // Folder paths may end with "/"
      const paths = data
        .split("\n")
        .map((p) => p.trim())
        .filter((p) => p.length > 0);

      for (const rawPath of paths) {
        // Remove trailing slash for folder detection
        const cleanPath = rawPath.endsWith("/") ? rawPath.slice(0, -1) : rawPath;
        const abstractFile = this.vault.getAbstractFileByPath(cleanPath);

        if (abstractFile instanceof TFile || abstractFile instanceof TFolder) {
          const added = await this.store.addMemory(abstractFile);
          if (added.length > 0) {
            new Notice(`已添加 ${added.length} 条记忆`);
          }
        } else {
          new Notice(`未找到文件: ${cleanPath}`, 3000);
        }
      }

      this.renderDropZone();
    };
    this.dropZone.addEventListener("drop", this.dropHandler);
  }

  /**
   * Render sort toggle buttons + group toggle.
   * Click handling is delegated to the toolbar (see onOpen); here we only
   * attach data-* attributes so the delegate can identify which button was clicked.
   */
  private renderSortButtons(container: HTMLElement): void {
    container.empty();
    const sorts: Array<{ key: typeof this.sortKey; label: string; icon: string }> = [
      { key: "time", label: "时间", icon: "🕐" },
      { key: "name", label: "名称", icon: "🔤" },
      { key: "priority", label: "优先级", icon: "⭐" },
      { key: "recent", label: "最近", icon: "📊" },
    ];

    for (const s of sorts) {
      container.createEl("button", {
        cls: "ai-memory-sort-btn" + (this.sortKey === s.key ? " active" : ""),
        text: s.icon,
        title: `按${s.label}排序`,
        attr: { "data-sort-key": s.key },
      });
    }

    // Group toggle
    container.createEl("button", {
      cls: "ai-memory-sort-btn" + (this.groupBy === "tags" ? " active" : ""),
      text: "📂",
      title: this.groupBy === "tags" ? "取消分组" : "按标签分组",
      attr: { "data-group-toggle": "tags" },
    });
  }

  // ─── Data Pipeline (filter → sort → group) ──────────────────────────

  /**
   * Get display items after applying search/sort/group.
   * Extracted from render logic — add new filters/sorts here without touching DOM.
   */
  private getDisplayItems(): MemoryItem[] {
    let items = [...this.store.items];

    // Filter by search query
    if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase();
      items = items.filter(
        (item) =>
          item.name.toLowerCase().includes(q) ||
          item.path.toLowerCase().includes(q) ||
          item.tags.some((t) => t.toLowerCase().includes(q))
      );
    }

    // Sort
    items.sort((a, b) => {
      switch (this.sortKey) {
        case "name":
          return a.name.localeCompare(b.name);
        case "priority":
          return b.priority - a.priority || b.addedAt - a.addedAt;
        case "recent":
          return (b.lastAccessedAt || 0) - (a.lastAccessedAt || 0) || b.addedAt - a.addedAt;
        case "time":
        default:
          return b.addedAt - a.addedAt;
      }
    });

    return items;
  }

  // ─── Rendering ───────────────────────────────────────────────────────

  private renderDropZone(): void {
    if (!this.dropZone) return;

    this.dropZone.empty();
    const items = this.getDisplayItems();

    if (this.countEl) {
      this.countEl.textContent = `${this.store.items.length}`;
    }

    if (items.length === 0) {
      this.renderEmptyState();
      return;
    }

    if (this.groupBy === "tags") {
      this.renderGroupedItems(items);
    } else {
      for (const item of items) {
        this.renderItem(item);
      }
    }
  }

  /**
   * Render items grouped by tags with collapsible headers.
   */
  private renderGroupedItems(items: MemoryItem[]): void {
    const groups = new Map<string, MemoryItem[]>();

    for (const item of items) {
      if (item.tags.length === 0) {
        const key = "未分类";
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(item);
      } else {
        for (const tag of item.tags) {
          if (!groups.has(tag)) groups.set(tag, []);
          groups.get(tag)!.push(item);
        }
      }
    }

    // Sort groups: tagged first, then "未分类"
    const sortedGroups = [...groups.entries()].sort(([a], [b]) => {
      if (a === "未分类") return 1;
      if (b === "未分类") return -1;
      return a.localeCompare(b);
    });

    for (const [groupName, groupItems] of sortedGroups) {
      const header = this.dropZone!.createDiv("ai-memory-group-header");
      header.createSpan({ cls: "ai-memory-group-toggle", text: "▼" });
      header.createSpan({ cls: "ai-memory-group-name", text: groupName });
      header.createSpan({ cls: "ai-memory-group-count", text: `${groupItems.length}` });

      const body = this.dropZone!.createDiv("ai-memory-group-body");
      // Header click-to-collapse is handled by dropZone's delegated click handler.

      for (const item of groupItems) {
        const wrapper = body.createDiv();
        this.renderItemTo(item, wrapper);
      }
    }
  }

  /**
   * Render a single memory item into a specific container (for grouped mode).
   */
  private renderItemTo(item: MemoryItem, container: HTMLElement): void {
    const el = container.createDiv("ai-memory-item");
    this.buildItemDOM(el, item);
  }

  private renderEmptyState(): void {
    if (!this.dropZone) return;
    const empty = this.dropZone.createDiv("ai-memory-drop-zone-empty");
    if (this.store.items.length === 0) {
      // First-time guide
      empty.createSpan({ cls: "icon", text: "🧠" });
      empty.createDiv({ cls: "guide-title", text: "欢迎使用 AI Memory Bridge" });
      empty.createDiv({ cls: "guide-step", text: "1️⃣ 从左侧文件浏览器拖拽笔记到这里" });
      empty.createDiv({ cls: "guide-step", text: "2️⃣ 点击下方「启动 MCP」开启服务" });
      empty.createDiv({ cls: "guide-step", text: "3️⃣ 点击「📋 配置」复制 JSON 到 Claude Code" });
      empty.createDiv({ cls: "guide-hint", text: "💡 提示：在笔记 frontmatter 中加 ai_memory: true 可自动发现" });
    } else {
      // Has items but all filtered out by search
      empty.createSpan({ cls: "icon", text: "🔍" });
      empty.createDiv({ text: `没有匹配 "${this.searchQuery}" 的记忆` });
    }
  }

  /**
   * Copy the MCP config JSON to clipboard.
   */
  private async copyMCPConfig(): Promise<void> {
    const vaultPath = getVaultBasePath(this.app.vault) || "你的vault路径";

    const config = {
      mcpServers: {
        "ai-memory-bridge": {
          command: "node",
          args: ["mcp-bridge.js", "--vault", vaultPath],
        },
      },
    };

    try {
      await navigator.clipboard.writeText(JSON.stringify(config, null, 2));
      new Notice("✅ MCP 配置已复制到剪贴板！粘贴到 Claude Code 的 MCP 设置中即可。");
    } catch {
      // Fallback: show config in a notice
      new Notice("📋 请手动复制以下配置到 Claude Code MCP 设置", 8000);
      console.log(JSON.stringify(config, null, 2));
    }
  }

  private renderItem(item: MemoryItem): void {
    if (!this.dropZone) return;
    const el = this.dropZone.createDiv("ai-memory-item");
    this.buildItemDOM(el, item);
  }

  /**
   * Build the DOM for a memory item (reused by both flat and grouped rendering).
   * Event handling (click/contextmenu/remove) is delegated to dropZone (see onOpen);
   * here we only stamp `data-item-path` so the delegate can resolve the clicked item.
   */
  private buildItemDOM(el: HTMLElement, item: MemoryItem): void {
    el.setAttribute("data-item-path", item.path);

    // Priority indicator
    if (item.priority > 0) {
      el.createSpan({
        cls: "ai-memory-item-priority",
        text: item.priority === 2 ? "⭐" : "★",
        title: `优先级: ${item.priority === 2 ? "关键" : "重要"}`,
      });
    }

    // Icon
    el.createSpan({
      cls: "ai-memory-item-icon",
      text: item.isFolder ? "📁" : "📝",
    });

    // Name
    el.createSpan({
      cls: "ai-memory-item-name",
      text: item.name,
      title: item.path,
    });

    // Tags (from frontmatter)
    if (item.tags.length > 0) {
      const tagsEl = el.createSpan({ cls: "ai-memory-item-tags" });
      for (const tag of item.tags.slice(0, 3)) {
        tagsEl.createSpan({ cls: "ai-memory-tag", text: tag });
      }
    }

    // Path
    el.createSpan({
      cls: "ai-memory-item-path",
      text: this.getParentPath(item.path),
    });

    // Remove button (click handled by dropZone delegation)
    el.createSpan({
      cls: "ai-memory-item-remove",
      text: "×",
      title: "移除记忆",
    });
  }

  private getParentPath(filePath: string): string {
    const parts = filePath.split("/");
    if (parts.length <= 1) return "根目录";
    return parts.slice(0, -1).join("/");
  }
}
