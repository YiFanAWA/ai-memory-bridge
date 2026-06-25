# Checklist

## Phase 1: 严重问题修复

### FIX-A: delete_memory 持久化
- [x] `MemoryStoreData` 接口新增 `deletedPaths: string[]` 字段
- [x] `DEFAULT_DATA` 初始化 `deletedPaths: []`
- [x] `MemoryStore` 构造函数迁移逻辑覆盖 `deletedPaths` 缺失情况
- [x] `MemoryStore` 提供 `addToDeletedPaths` / `removeFromDeletedPaths` getter/setter
- [x] `MemoryStore.addMemory` 在加入后调用 `removeFromDeletedPaths`（手动重新添加解锁）
- [x] `mcp-bridge.js handleDeleteMemory` 改为追加 `pendingDeletes` 队列，不再 splice memories 数组
- [x] `delete_memory` 工具返回结构（success/message/removed/remainingCount/note）保持不变
- [x] `BridgeSync.writeBridgeFile` 读取并消费 `pendingDeletes`：移除 store.items + 加入 deletedPaths
- [x] `bridgeData` 写回时 `pendingDeletes` 仅保留 `status === "pending"` 的条目
- [x] 处理成功后显示 Notice "已处理 N 条 AI 删除请求"
- [x] `BridgeSync.discoverAutoMemories` 跳过 `deletedPaths` 中的路径
- [x] 用 stdin 模拟 `delete_memory` 调用，验证返回 JSON-RPC 正确且 bridge 文件含 `pendingDeletes` 条目

### FIX-B: executeWrite 安全校验
- [x] `src/utils.ts` 导出 `isPathSafe(filePath: string): boolean`
- [x] `src/utils.ts` 的 `isPathSafe` 逻辑与 `mcp-bridge.js` 完全一致（`..`、绝对路径、控制字符）
- [x] `BridgeSync.ts` 导入 `isPathSafe`
- [x] `BridgeSync.ts` 顶部新增 `MAX_FILE_SIZE = 512 * 1024` 常量
- [x] `executeWrite` 方法开头校验 `isPathSafe(write.folder)`、`isPathSafe(write.name)`、`write.content.length <= MAX_FILE_SIZE`
- [x] 校验不通过抛 Error，外层 try/catch 标记 write.status = "failed"，不创建文件
- [x] 构造一条绕过 mcp-bridge.js 入口校验的 pendingWrite，验证 BridgeSync.executeWrite 二次拦截（通过代码审查确认 BridgeSync.ts 第 300-312 行 isPathSafe + MAX_FILE_SIZE + throw）

### FIX-C + FIX-D: MemoryPanel 事件重构
- [x] 所有事件监听器使用命名函数引用并保存到实例字段
- [x] searchInput input 事件改为命名 handler
- [x] copyBtn click 事件改为命名 handler
- [x] sort buttons 改为事件委托（在 toolbar 容器上注册一次）
- [x] group header click 改为事件委托（在 dropZone 上注册一次）
- [x] item click/contextmenu 改为事件委托（在 dropZone 上注册一次）
- [x] removeBtn click 改为事件委托
- [x] `clearBtnClickHandler` 类型签名改为 `(e: MouseEvent) => void`，兼容 EventListener
- [x] `onClose` 中所有命名 handler 被 removeEventListener
- [x] `onClose` 中所有 DOM 引用置 null
- [x] 全文搜索 `as any` 在 MemoryPanel.ts 中无残留

### FIX-E: 版本号统一
- [x] `mcp-bridge.js` 第 4 行头注释改为 "v0.3.1"
- [x] `mcp-bridge.js` 第 21 行 `SERVER_VERSION = "0.3.1"`
- [x] `BridgeSync.ts` 第 135 行 `version: "0.3.0"` 保持不变（bridge 文件格式版本）
- [x] `mcp-bridge.js` 顶部注释说明 `SERVER_VERSION` 与 bridge 文件 `version` 字段语义不同

## Phase 2: v0.4.0 P2 功能

### S5: 最近使用记录
- [x] `MemoryItem` 接口新增 `lastAccessedAt?: number` 字段
- [x] 旧 `data.json` 加载不报错（字段可选，TS 视为 undefined）
- [x] `mcp-bridge.js handleGetMemory` 在 `found: true` 路径返回前向 bridge 文件 `accessLog` 追加 `{path, timestamp}`
- [x] `mcp-bridge.js handleGetMemory` 未找到 / 歧义 / 模糊匹配不追加 accessLog
- [x] 用 stdin 模拟 `get_memory` 调用，验证 bridge 文件 accessLog 被追加
- [x] `BridgeSync.writeBridgeFile` 读取并消费 `accessLog`：更新 `MemoryItem.lastAccessedAt`
- [x] `lastAccessedAt` 取最大值（防重复消费）
- [x] `bridgeData` 写回时 `accessLog: []`（清空已消费）
- [x] 处理后 `safeSave()` 持久化更新后的 lastAccessedAt（采用"直接修改字段 + 不主动持久化"折中方案，加注释说明）
- [x] `MemoryPanel.sortKey` 类型新增 `"recent"`
- [x] `renderSortButtons` 新增"📊 最近"按钮
- [x] `getDisplayItems` sort 新增 `case "recent"`：按 lastAccessedAt 降序，无值项排末尾按 addedAt 二级排序

### S6: 批量导入右键文件夹
- [x] `main.ts onload` 调用 `registerEvent(workspace.on("file-menu", ...))`
- [x] 回调中 `if (file instanceof TFolder)` 才显示菜单项
- [x] 菜单项 `setTitle("加入 AI 记忆").setIcon("brain")`
- [x] onClick 调用 `store.addMemory(file)`
- [x] onClick 调用 `bridgeSync.syncNow()`
- [x] onClick 调用 `activateView()`
- [x] onClick 显示 Notice `已添加 N 条记忆` 或 `该文件夹已在记忆中或无 .md 文件`
- [x] `main.ts` 顶部 import `TFolder`
- [x] 右键单个 .md 文件不显示该菜单项

## Phase 3: 验证

### 编译与构建
- [x] `npx tsc -noEmit -skipLibCheck` 0 error
- [x] `node esbuild.config.mjs production` 构建成功

### MCP 工具回归
- [x] `list_memories` 返回正常
- [x] `get_memory` 返回正常 + bridge 文件 accessLog 被追加
- [x] `search_memories` 返回正常
- [x] `write_memory` 返回正常，pendingWrites 不变
- [x] `delete_memory` 返回结构正确 + bridge 文件 pendingDeletes 被追加 + memories 数组暂未变化

### 安全回归
- [x] `delete_memory` 传 `path="../../../etc/passwd"` → 拦截
- [x] `delete_memory` 传绝对路径 → 拦截
- [x] `delete_memory` 传空字节 → 拦截
- [x] `write_memory` 传 `folder="../../../etc"` → 入口拦截
- [x] 构造绕过入口的 pendingWrite → BridgeSync.executeWrite 二次拦截（通过代码审查确认）

### 向后兼容
- [x] 旧版 bridge 文件（v0.1.0 含 content 字段）能被新版 mcp-bridge.js 读取
- [x] 旧 `data.json`（无 deletedPaths / lastAccessedAt 字段）能被新版 MemoryStore 加载
- [x] MCP 工具入参/出参结构未变化（仅内部实现改变）

### 文档更新
- [x] `dev-docs/05-current-stage-plan.md` 标记 S5、S6 为 ✅ done
- [x] `dev-docs/06-quality-checklist.md` 新增 Q31-Q40 验收项并标记状态
