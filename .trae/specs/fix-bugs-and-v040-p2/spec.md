# Bug Fixes + v0.4.0 P2 Spec

## Why
项目审查发现 4 项严重问题违反 `dev-docs/AGENTS.md` 核心规则：`delete_memory` 不持久化（功能性 bug）、`executeWrite` 缺路径安全校验、`MemoryPanel` 大量匿名事件监听器无法清理、`as any` 类型强转。同时 v0.4.0 计划中的 P2 功能（最近使用记录、批量导入）是用户痛点的直接解药：让用户能看见 AI 实际访问了哪些笔记、让有大量文件夹的用户能快速批量上架记忆。本 spec 先修严重问题保证质量底线，再做 P2 功能。

## What Changes

### Phase 1: 严重问题修复（必做）
- **FIX-A**：`delete_memory` 持久化 —— mcp-bridge.js 不再直接改 bridge 文件的 `memories` 数组，改用 `pendingDeletes` 队列；Obsidian 端 BridgeSync 处理队列并写入 `deletedPaths` 持久化集合，auto-discovery 跳过该集合。
- **FIX-B**：`executeWrite` 增加 `isPathSafe()` 二次校验 + 写入大小限制（name/folder/content）。
- **FIX-C**：`MemoryPanel` 全面重构事件监听 —— 全部改为命名函数引用并保存到实例字段，`onClose` 逐一 `removeEventListener`。覆盖：searchInput、copyBtn、sort buttons、group header、item click/contextmenu、removeBtn。
- **FIX-D**：移除 `as any` —— `clearBtnClickHandler` 类型改为兼容 `EventListener` 的签名。
- **FIX-E**：统一版本号 —— mcp-bridge.js 头注释和 `SERVER_VERSION` 改为 "0.3.1"；BridgeSync 写入 bridge 文件的 `version` 字段保持 "0.3.0"（这是 bridge 文件格式版本，与产品版本解耦，避免误判兼容性）。

### Phase 2: v0.4.0 P2 功能
- **S5（最近使用记录）**：
  - `MemoryItem` 新增 `lastAccessedAt?: number` 字段（向后兼容，旧数据无此字段视为未访问）。
  - mcp-bridge.js `get_memory` 工具执行时往 bridge 文件 `accessLog` 数组追加 `{path, timestamp}`。
  - BridgeSync.writeBridgeFile 读取并消费 `accessLog`：更新匹配 `MemoryItem.lastAccessedAt`，处理后清空数组。
  - 面板新增"最近使用"排序按钮（🕐 已有"时间"按 addedAt 排，新增 📊 按 lastAccessedAt 排），无 lastAccessedAt 的项排最后。
  - 工具接口不变（get_memory 入参/出参结构不变，只是内部多写一行 log）。
- **S6（批量导入右键文件夹）**：
  - main.ts `registerEvent(this.app.workspace.on("file-menu", ...))` 注册文件浏览器右键菜单。
  - 仅对 `TFolder` 添加菜单项"加入 AI 记忆"。
  - 调用 `store.addMemory(folder)`，复用现有逻辑（自动展开子 .md）。
  - 加完后 `bridgeSync.syncNow()` 立即同步，并 `activateView()` 打开面板可见反馈。

### 不在本 spec 范围
- 中等问题 #6（JSON-RPC buffer）、#7（atomicWriteFileSync 权限）、#8（bridge 文件大小限制）、#9（auto-discovery 读全文）—— 留下个 spec。
- v0.4.0 的 S7（社区市场上架）、S8（GUI 验收）—— 留下个 spec。
- 轻微问题 #10-#12 —— 留下个 spec。

## Impact
- **Affected specs**: dev-docs/02-function-list.md（新增 S5/S6 功能描述）、dev-docs/05-current-stage-plan.md（标记 S5/S6 done）、dev-docs/06-quality-checklist.md（新增验收项）。
- **Affected code**:
  - [mcp-bridge.js](file:///d:/ai-memory-bridge/mcp-bridge.js)：FIX-A（delete_memory 改队列）、FIX-E（版本号）、S5（accessLog 追加）。
  - [src/BridgeSync.ts](file:///d:/ai-memory-bridge/src/BridgeSync.ts)：FIX-A（消费 pendingDeletes）、FIX-B（executeWrite 校验）、S5（消费 accessLog）。
  - [src/MemoryStore.ts](file:///d:/ai-memory-bridge/src/MemoryStore.ts)：FIX-A（deletedPaths 字段 + addMemory 时清除）、S5（lastAccessedAt 字段）。
  - [src/MemoryPanel.ts](file:///d:/ai-memory-bridge/src/MemoryPanel.ts)：FIX-C（事件重构）、FIX-D（去 as any）、S5（新增排序按钮）。
  - [main.ts](file:///d:/ai-memory-bridge/main.ts)：S6（注册 file-menu 事件）。
  - [src/utils.ts](file:///d:/ai-memory-bridge/src/utils.ts)：FIX-B（导出 isPathSafe 供 BridgeSync 复用）。

## ADDED Requirements

### Requirement: 最近使用记录 (S5)
系统 SHALL 跟踪 AI 通过 `get_memory` 工具访问笔记的时间戳，并在面板提供按最近使用排序的视图。

#### Scenario: AI 访问笔记后时间戳被记录
- **WHEN** Claude Code 调用 `get_memory` 工具成功返回某笔记内容
- **THEN** mcp-bridge.js 在 bridge 文件 `accessLog` 数组追加 `{path, timestamp}` 条目
- **AND** 下次 BridgeSync.writeBridgeFile 执行时，对应 `MemoryItem.lastAccessedAt` 被更新
- **AND** `accessLog` 数组被清空（已消费）

#### Scenario: 面板按最近使用排序
- **WHEN** 用户点击面板工具栏新增的"📊 最近"排序按钮
- **THEN** 列表按 `lastAccessedAt` 降序排列
- **AND** 没有 `lastAccessedAt` 的项（从未被 AI 访问）排在末尾，按 `addedAt` 降序二级排序

#### Scenario: 旧数据兼容
- **WHEN** 加载不含 `lastAccessedAt` 字段的旧 `data.json`
- **THEN** 所有项的 `lastAccessedAt` 视为 `undefined`
- **AND** 不报错，不触发数据迁移（按需懒赋值）

### Requirement: 批量导入右键文件夹 (S6)
系统 SHALL 在 Obsidian 文件浏览器右键菜单为文件夹提供"加入 AI 记忆"入口。

#### Scenario: 右键文件夹加入记忆
- **WHEN** 用户在文件浏览器右键某文件夹并点击"加入 AI 记忆"
- **THEN** 调用 `store.addMemory(folder)`
- **AND** 立即触发 `bridgeSync.syncNow()` 同步到 bridge 文件
- **AND** 打开/激活 Memory Panel 提供视觉反馈
- **AND** 显示 Notice "已添加 N 条记忆"（N = 1 文件夹 + 子 .md 数量）

#### Scenario: 右键文件不显示菜单项
- **WHEN** 用户右键单个 `.md` 文件（非文件夹）
- **THEN** 不显示"加入 AI 记忆"菜单项（避免与拖拽方式重复）

## MODIFIED Requirements

### Requirement: delete_memory 工具行为
mcp-bridge.js `delete_memory` 不再直接修改 bridge 文件的 `memories` 数组，改为追加到 `pendingDeletes` 队列。Obsidian 端 BridgeSync 消费队列：从 `store.items` 移除（manual 项）并将路径加入 `store.deletedPaths` 持久化集合（阻断 auto 项复活）。

#### Scenario: 删除 manual 项持久生效
- **WHEN** Claude Code 调用 `delete_memory` 删除一个 manual 来源的记忆
- **THEN** mcp-bridge.js 在 bridge 文件 `pendingDeletes` 追加 `{path, status:"pending"}`
- **AND** BridgeSync 下次 writeBridgeFile 时从 `store.items` 移除该路径
- **AND** 该路径加入 `store.deletedPaths`
- **AND** 后续 sync 不再写回该路径

#### Scenario: 删除 auto 项不被自动扫描复活
- **WHEN** Claude Code 删除一个 auto 来源的记忆（来自 frontmatter `ai_memory: true`）
- **THEN** 路径加入 `store.deletedPaths`
- **AND** `discoverAutoMemories` 跳过 `deletedPaths` 中的路径
- **AND** 5 分钟后自动扫描不再重新加入该路径

#### Scenario: 用户手动重新添加已删除路径
- **WHEN** 用户拖拽一个被 `deletedPaths` 标记的文件回面板
- **THEN** `addMemory` 从 `deletedPaths` 移除该路径
- **AND** 文件正常加入 `store.items`

#### Scenario: 工具接口不变
- **WHEN** Claude Code 调用 `delete_memory` 工具
- **THEN** 入参（`path`、`confirm`）和出参结构（`success`、`message`、`removed`、`remainingCount`）保持不变
- **AND** 仅内部实现从"直接改数组"变为"追加 pendingDeletes"

### Requirement: executeWrite 安全校验
BridgeSync.executeWrite 在执行写入前 SHALL 对 `write.folder`、`write.name`、`write.content` 进行二次校验，作为 mcp-bridge.js 入口校验的纵深防御。

#### Scenario: 拦截恶意 folder
- **WHEN** pendingWrites 中某条 `folder` 含 `..` 或绝对路径或控制字符
- **THEN** executeWrite 抛错并标记该 write 为 `failed`
- **AND** 不创建任何文件

#### Scenario: 拦截超大 content
- **WHEN** pendingWrites 中某条 `content.length > MAX_FILE_SIZE`（512KB）
- **THEN** executeWrite 抛错并标记该 write 为 `failed`

### Requirement: MemoryPanel 事件清理
MemoryPanel 所有事件监听器 SHALL 使用命名函数引用并保存到实例字段，`onClose` 中逐一 `removeEventListener`。

#### Scenario: 关闭面板时无残留监听器
- **WHEN** MemoryPanel.onClose 执行
- **THEN** 所有事件监听器（dragover/dragleave/drop/input/click/contextmenu）被移除
- **AND** DOM 引用被置 null
- **AND** 不存在 `as any` 类型强转

## REMOVED Requirements
（无移除项）
