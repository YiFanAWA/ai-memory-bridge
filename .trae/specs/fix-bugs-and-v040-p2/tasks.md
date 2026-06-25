# Tasks

## Phase 1: 严重问题修复

- [x] Task 1: FIX-E 统一版本号字符串
  - [x] SubTask 1.1: 修改 `mcp-bridge.js` 第 4 行头注释 "v0.2.0" → "v0.3.1"
  - [x] SubTask 1.2: 修改 `mcp-bridge.js` 第 21 行 `SERVER_VERSION = "0.2.0"` → `"0.3.1"`
  - [x] SubTask 1.3: 确认 `BridgeSync.ts` 第 135 行 `version: "0.3.0"` 保持不变（bridge 文件格式版本）
  - [x] SubTask 1.4: 在 `mcp-bridge.js` 顶部注释中说明 `SERVER_VERSION` 是产品版本、bridge 文件 `version` 字段是格式版本，两者解耦

- [x] Task 2: FIX-B 在 `src/utils.ts` 导出 `isPathSafe` 函数
  - [x] SubTask 2.1: 在 `src/utils.ts` 新增 `isPathSafe(filePath: string): boolean` 实现，逻辑与 `mcp-bridge.js` 中的 `isPathSafe` 一致（拦截 `..`、绝对路径、控制字符）
  - [x] SubTask 2.2: 在 `BridgeSync.ts` 导入 `isPathSafe`
  - [x] SubTask 2.3: 在 `BridgeSync.ts` 顶部新增 `const MAX_FILE_SIZE = 512 * 1024;` 常量（与 mcp-bridge.js 一致）
  - [x] SubTask 2.4: 修改 `executeWrite` 方法，在方法开头校验：`isPathSafe(write.folder)`、`isPathSafe(write.name)`、`write.content.length <= MAX_FILE_SIZE`，不通过则 `throw new Error(...)`

- [x] Task 3: FIX-A `delete_memory` 持久化 —— MemoryStore 新增 `deletedPaths`
  - [x] SubTask 3.1: 在 `MemoryStoreData` 接口新增 `deletedPaths: string[]` 字段
  - [x] SubTask 3.2: 在 `DEFAULT_DATA` 中初始化 `deletedPaths: []`
  - [x] SubTask 3.3: 在 `MemoryStore` 构造函数迁移逻辑中补充：`if (!this.data.deletedPaths) this.data.deletedPaths = []`
  - [x] SubTask 3.4: 新增 getter `get deletedPaths(): string[]` 返回 `this.data.deletedPaths`
  - [x] SubTask 3.5: 新增方法 `addToDeletedPaths(path: string): void` —— 推入并去重，调用 `safeSave()`
  - [x] SubTask 3.6: 新增方法 `removeFromDeletedPaths(path: string): void` —— 过滤移除，调用 `safeSave()`
  - [x] SubTask 3.7: 修改 `addMemory`：在加入 `store.items` 后调用 `this.removeFromDeletedPaths(fileOrFolder.path)`（用户手动重新添加时解锁）

- [x] Task 4: FIX-A mcp-bridge.js `handleDeleteMemory` 改为追加 `pendingDeletes`
  - [x] SubTask 4.1: 不再 `memories.splice(idx, 1)`，改为读取 `data.pendingDeletes || []`
  - [x] SubTask 4.2: 推入 `{id: "del_<ts>_<rand>", path: targetPath, status: "pending", timestamp: ISOString}`
  - [x] SubTask 4.3: 写回 bridge 文件 `{ ...data, pendingDeletes }`，调用 `atomicWriteFileSync` + `invalidateBridgeCache()`
  - [x] SubTask 4.4: 返回结构保持原样（`success: true`、`message`、`removed: {path, name}`、`remainingCount`、`note`），其中 `remainingCount` 仍基于当前 `memories.length`（视觉一致），`note` 文案改为"删除请求已排队，下次 Obsidian 同步生效"
  - [x] SubTask 4.5: 用 stdin 模拟调用验证 `delete_memory` 返回 JSON-RPC 正确

- [x] Task 5: FIX-A BridgeSync.writeBridgeFile 消费 `pendingDeletes`
  - [x] SubTask 5.1: 在 `writeBridgeFile` 读取 `existingData` 后，取 `const pendingDeletes: any[] = existingData.pendingDeletes || []`
  - [x] SubTask 5.2: 在 pendingWrites 处理循环之后新增 pendingDeletes 处理循环
  - [x] SubTask 5.3: 对每条 `status === "pending"` 的 del：调用 `this.store.removeMemory(del.path)`（已存在则移除 manual 项），再调用 `this.store.addToDeletedPaths(del.path)`（阻断 auto 复活），标记 `del.status = "done"`
  - [x] SubTask 5.4: 在 `bridgeData` 写回时，`pendingDeletes: pendingDeletes.filter(d => d.status === "pending")`（保留未处理的，移除已完成的）
  - [x] SubTask 5.5: 若有处理成功的 del，`new Notice("已处理 N 条 AI 删除请求")`

- [x] Task 6: FIX-A BridgeSync.discoverAutoMemories 跳过 `deletedPaths`
  - [x] SubTask 6.1: 在 `discoverAutoMemories` 循环开始处 `const deleted = new Set(this.store.deletedPaths);`
  - [x] SubTask 6.2: 对每个 file，`if (deleted.has(file.path)) continue;`

- [x] Task 7: FIX-C + FIX-D MemoryPanel 事件监听器全面重构
  - [x] SubTask 7.1: 在类字段新增所有命名 handler：`searchInputHandler`、`copyBtnClickHandler`、`sortBtnClickHandler`、`groupHeaderClickHandler`（按需动态创建）、`itemClickHandler`、`itemContextmenuHandler`、`removeBtnClickHandler`
  - [x] SubTask 7.2: 修改 `clearBtnClickHandler` 类型签名从 `() => Promise<void>` 改为 `(e: MouseEvent) => void`（兼容 EventListener），方法体内 `void this.store.clearAll()` 处理 Promise
  - [x] SubTask 7.3: searchInput：`this.searchInputHandler = (e: Event) => { this.searchQuery = (e.target as HTMLInputElement).value; this.renderDropZone(); }`，注册并保存 input 元素引用
  - [x] SubTask 7.4: copyBtn：`this.copyBtnClickHandler = () => { void this.copyMCPConfig(); }`，保存 copyBtn 引用
  - [x] SubTask 7.5: sort buttons：在 `renderSortButtons` 中创建闭包绑定到 `this.sortBtnClickHandler`（每次重建按钮时移除旧 handler、注册新的），或改用事件委托（推荐：在 toolbar 容器上注册一次 click handler，通过 `e.target` 判断按钮）
  - [x] SubTask 7.6: group header：在 `renderGroupedItems` 中改用事件委托，在 `this.dropZone` 上注册一次 click handler，通过 `e.target` 最近 `.ai-memory-group-header` 判断
  - [x] SubTask 7.7: item click/contextmenu：在 `buildItemDOM` 中改为通过 `this.dropZone` 上的事件委托处理（避免每个 item 注册独立 handler）
  - [x] SubTask 7.8: removeBtn：在 `buildItemDOM` 中改为事件委托，click handler 内通过 `e.target.closest(".ai-memory-item-remove")` 判断
  - [x] SubTask 7.9: `onClose` 中：移除所有命名 handler 引用，置 null 所有 DOM 引用（searchInput、copyBtn、dropZone、countEl、serverStatusDot、serverStatusText）
  - [x] SubTask 7.10: 删除原 `as any` 强转代码

## Phase 2: v0.4.0 P2 功能

- [x] Task 8: S5 MemoryItem 新增 `lastAccessedAt` 字段
  - [x] SubTask 8.1: 在 `MemoryItem` 接口新增 `lastAccessedAt?: number;`（可选）
  - [x] SubTask 8.2: 不需要迁移（旧数据无此字段，TS 视为 undefined）

- [x] Task 9: S5 mcp-bridge.js `handleGetMemory` 追加 accessLog
  - [x] SubTask 9.1: 在 `handleGetMemory` 成功返回前（return 之前），读取 bridge 文件，向 `data.accessLog = data.accessLog || []` 推入 `{path: match.path, timestamp: Date.now()}`
  - [x] SubTask 9.2: 用 `atomicWriteFileSync` 写回，调用 `invalidateBridgeCache()`
  - [x] SubTask 9.3: 注意：只在实际读取到笔记内容时追加（`found: true` 路径），模糊匹配 / 未找到 / 歧义时不追加
  - [x] SubTask 9.4: 用 stdin 模拟 `get_memory` 调用，验证 bridge 文件 accessLog 被追加

- [x] Task 10: S5 BridgeSync.writeBridgeFile 消费 `accessLog`
  - [x] SubTask 10.1: 在 `writeBridgeFile` 读取 `existingData` 后，取 `const accessLog: any[] = existingData.accessLog || []`
  - [x] SubTask 10.2: 在 pendingDeletes 处理之后新增 accessLog 消费循环
  - [x] SubTask 10.3: 对每条 `{path, timestamp}`：在 `this.store.items` 中找到对应项，更新 `item.lastAccessedAt = Math.max(item.lastAccessedAt || 0, timestamp)`（取最大值防重复）
  - [x] SubTask 10.4: 处理完成后清空 accessLog 数组（在 bridgeData 写回时 `accessLog: []`）
  - [x] SubTask 10.5: 调用 `safeSave()` 持久化更新后的 lastAccessedAt

- [x] Task 11: S5 MemoryPanel 新增"最近使用"排序按钮
  - [x] SubTask 11.1: 在 `sortKey` 类型新增 `"recent"`：`"name" | "time" | "priority" | "recent"`
  - [x] SubTask 11.2: 在 `renderSortButtons` 的 sorts 数组新增 `{ key: "recent", label: "最近", icon: "📊" }`
  - [x] SubTask 11.3: 在 `getDisplayItems` 的 sort switch 新增 `case "recent": return (b.lastAccessedAt || 0) - (a.lastAccessedAt || 0) || b.addedAt - a.addedAt;`（无 lastAccessedAt 排末尾，按 addedAt 二级排序）

- [x] Task 12: S6 main.ts 注册 file-menu 事件
  - [x] SubTask 12.1: 在 `onload` 中调用 `this.registerEvent(this.app.workspace.on("file-menu", (menu, file, _source) => { ... }))`
  - [x] SubTask 12.2: 在回调中 `if (file instanceof TFolder)` 才继续
  - [x] SubTask 12.3: `menu.addItem((item) => { item.setTitle("加入 AI 记忆").setIcon("brain").onClick(async () => { ... }) })`
  - [x] SubTask 12.4: onClick 内：`const added = await this.store.addMemory(file); await this.bridgeSync.syncNow(); await this.activateView(); if (added.length > 0) new Notice(\`已添加 ${added.length} 条记忆\`); else new Notice("该文件夹已在记忆中或无 .md 文件");`
  - [x] SubTask 12.5: 在 main.ts 顶部 import `TFolder`

## Phase 3: 验证

- [x] Task 13: 编译 + 构建验证
  - [x] SubTask 13.1: `npx tsc -noEmit -skipLibCheck` 0 error
  - [x] SubTask 13.2: `node esbuild.config.mjs production` 构建成功

- [x] Task 14: MCP 工具回归（stdin 模拟）
  - [x] SubTask 14.1: `list_memories` 调用返回正常
  - [x] SubTask 14.2: `get_memory` 调用后 bridge 文件 `accessLog` 被追加
  - [x] SubTask 14.3: `search_memories` 调用返回正常
  - [x] SubTask 14.4: `write_memory` 调用返回正常，pendingWrites 不变
  - [x] SubTask 14.5: `delete_memory` 调用：返回结构正确（success/message/removed/remainingCount），bridge 文件 `pendingDeletes` 被追加，`memories` 数组暂未变化（等 Obsidian 消费）

- [x] Task 15: 安全回归
  - [x] SubTask 15.1: `delete_memory` 传 `path="../../../etc/passwd"` → 返回 "路径包含不安全字符"
  - [x] SubTask 15.2: `delete_memory` 传绝对路径 → 拦截
  - [x] SubTask 15.3: `delete_memory` 传空字节 → 拦截
  - [x] SubTask 15.4: `write_memory` 传 `folder="../../../etc"` → mcp-bridge.js 入口拦截；executeWrite 二次校验通过代码审查确认（BridgeSync.ts 第 300-312 行 isPathSafe + MAX_FILE_SIZE + throw）

- [x] Task 16: 更新 dev-docs（轻量）
  - [x] SubTask 16.1: 在 `dev-docs/05-current-stage-plan.md` v0.4.0 表格中标记 S5、S6 状态为 ✅ done
  - [x] SubTask 16.2: 在 `dev-docs/06-quality-checklist.md` 新增 Q31-Q40 验收项（delete 持久化、accessLog 追加、recent 排序、右键菜单、executeWrite 二次校验等）

# Task Dependencies

- Task 2 须先于 Task 5（BridgeSync 需要 isPathSafe）
- Task 3 须先于 Task 5、Task 6（BridgeSync 需要 store.deletedPaths）
- Task 3 须先于 Task 7（addMemory 修改影响 panel 行为）
- Task 4 须先于 Task 5（mcp-bridge.js 写 pendingDeletes，BridgeSync 消费）
- Task 8 须先于 Task 10（MemoryItem 字段定义先于 BridgeSync 更新）
- Task 8 须先于 Task 11（panel 排序依赖字段）
- Task 9 须先于 Task 10（mcp-bridge.js 写 accessLog，BridgeSync 消费）
- Task 13 须在所有代码改动之后
- Task 14、Task 15 须在 Task 13 之后
- Task 16 须在 Task 14、Task 15 通过后

# 并行机会

- Phase 1 中 Task 1（版本号）独立可并行
- Phase 1 中 Task 2（utils.isPathSafe）和 Task 3（MemoryStore.deletedPaths）独立可并行
- Phase 1 中 Task 7（panel 重构）依赖 Task 3（addMemory 行为变化）但可与其他并行
- Phase 2 中 Task 8（字段定义）独立可并行
- Phase 2 中 Task 11（panel 排序按钮）独立于 mcp-bridge.js 改动，可与 Task 9 并行
- Phase 2 中 Task 12（main.ts 右键菜单）完全独立
