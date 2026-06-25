# 当前阶段实施真源 — v0.3.0 → v0.4.0

## v0.3.0 阶段验收 ✅

| 子阶段 | 内容 | 状态 | 验证证据 |
|--------|------|------|---------|
| S1 | 面板搜索框 + 排序 | ✅ done | getDisplayItems 管道生效，三按钮切换正常 |
| S2 | 一键复制 MCP 配置 | ✅ done | clipboard API + fallback Notice |
| S3 | 首次使用引导 | ✅ done | 空面板 3 步教程 |
| S4 | 按 tags 分组 | ✅ done | 📂 按钮折叠分组，未分类归入"未分类" |
| FIX-1 | MemoryItem 扩展 | ✅ done | priority/source/tags，addMemory 解析 frontmatter |
| FIX-2 | bridge v0.3.0 格式 | ✅ done | 完整元数据传递 |
| FIX-3 | getDisplayItems 管道 | ✅ done | filter→sort→group 独立于渲染 |
| FIX-4 | 共享工具函数 | ✅ done | src/utils.ts |

## 工程化验收 ✅

| 事项 | 状态 | 证据 |
|------|------|------|
| Git 初始化 | ✅ | 6 commits, pushed to GitHub |
| 自动化测试 | ✅ | 13 项 100% pass |
| 质量验收 | ✅ | 可自动化部分 13/13 |
| GitHub Release | ✅ | v0.3.0 tag + zip |
| README | ✅ | 安装说明 + 竞品对比 + 5 工具 |
| 社区市场提交 | ⬜ | 待用户填表 |

## v0.4.0 目标

| 子阶段 | 内容 | 优先级 | 状态 |
|--------|------|--------|------|
| S5 | 最近使用记录 | 🟡 P2 | ✅ done |
| S6 | 批量导入（右键文件夹）| 🟡 P2 | ✅ done |
| S7 | 社区市场上架完成 | 🔴 P3 | ⬜ 待办 |
| S8 | GUI 验收（Obsidian 实际操作） | 🔴 P3 | ⬜ 待办 |

### v0.4.0 已完成项详情

#### S5: 最近使用记录 ✅
- `MemoryItem` 新增 `lastAccessedAt?: number` 字段（向后兼容）
- mcp-bridge.js `get_memory` 在 found:true 路径向 bridge 文件 `accessLog` 数组追加 `{path, timestamp}`
- BridgeSync.writeBridgeFile 消费 `accessLog` 更新 `lastAccessedAt`，处理完清空数组
- MemoryPanel 新增"📊 最近"排序按钮，按 lastAccessedAt 降序，无值项排末尾按 addedAt 二级排序

#### S6: 批量导入右键文件夹 ✅
- main.ts 注册 `workspace.on("file-menu")` 事件
- 仅对 TFolder 显示"加入 AI 记忆"菜单项
- 复用 `store.addMemory(folder)` 自动展开子 .md
- 加完后立即 `bridgeSync.syncNow()` + `activateView()` + Notice 反馈

### 同时修复的严重问题
- **FIX-A**：delete_memory 改为 pendingDeletes 队列，Obsidian 端消费并写入 deletedPaths 持久化集合，阻断 auto-discovery 复活
- **FIX-B**：BridgeSync.executeWrite 增加 isPathSafe 二次校验 + MAX_FILE_SIZE 限制
- **FIX-C**：MemoryPanel 全面事件委托重构，移除匿名监听器
- **FIX-D**：移除 `as any` 类型强转
- **FIX-E**：mcp-bridge.js 版本号统一为 0.3.1（与 package.json/manifest.json 一致），bridge 文件 version 字段保持 0.3.0（格式版本解耦）
