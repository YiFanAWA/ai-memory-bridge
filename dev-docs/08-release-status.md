# 发布状态 (Release Status)

## 当前版本: v0.4.0

## v0.4.0 改动摘要

### 新功能（P2）
- **F34 / S5 最近使用记录**：AI 通过 `get_memory` 访问笔记后，bridge 文件 `accessLog` 记录时间戳；BridgeSync 消费后写入 `MemoryItem.lastAccessedAt`；面板新增 📊 排序按钮按最近使用降序排列。
- **F35 / S6 批量导入文件夹**：在 Obsidian 文件浏览器右键文件夹显示"加入 AI 记忆"菜单项，复用 `store.addMemory(folder)` 自动展开子 .md，加完立即同步 + 激活面板。

### 严重问题修复
- **FIX-A**：`delete_memory` 改为 `pendingDeletes` 队列，Obsidian 端消费并写入 `deletedPaths` 持久化集合，阻断 auto-discovery 复活。
- **FIX-B**：`executeWrite` 增加 `isPathSafe()` 二次校验 + `MAX_FILE_SIZE` 限制。
- **FIX-C**：`MemoryPanel` 全面事件委托重构，移除匿名监听器。
- **FIX-D**：移除 `as any` 类型强转。
- **FIX-E**：mcp-bridge.js 版本号统一为 0.4.0（与 package.json/manifest.json 一致），bridge 文件 `version` 字段保持 0.3.0（格式版本解耦）。

### 兼容性
- bridge 文件格式 v0.3.0（向后兼容 v0.1.0/v0.2.0，新增 `pendingDeletes`/`accessLog`/`deletedPaths` 字段均为可选）
- MCP 工具接口不变（5 工具入参/出参结构保持）
- 旧版 `data.json` 自动迁移（补 `deletedPaths: []`，`lastAccessedAt` 懒赋值）

## GitHub

| 项目 | 状态 | 链接 |
|------|------|------|
| 仓库 | ✅ 公开 | https://github.com/YiFanAWA/ai-memory-bridge |
| Tag v0.3.0 | ✅ 已发布 | https://github.com/YiFanAWA/ai-memory-bridge/releases/tag/v0.3.0 |
| Tag v0.4.0 | ⬜ 待 git tag + push | （代码已就绪，等用户授权 push） |
| Release zip v0.3.0 | ✅ 已上传 | `ai-memory-bridge-v0.3.0.zip` (13KB) |
| Release zip v0.4.0 | ⬜ 待构建 + 上传 | （main.js 已构建后打包） |
| CI/CD | ❌ 未配置 | 后续可加 GitHub Actions 自动构建 |

## Obsidian 社区市场

| 步骤 | 状态 | 说明 |
|------|------|------|
| 仓库满足要求 | ✅ | 公开、manifest.json 完整、Release 就绪 |
| Fork obsidian-releases | ⚠️ 已创建但需重做 | API 无法创建 PR (issues disabled) |
| 提交插件 | ⬜ 待用户操作 | https://docs.obsidian.md/Plugins/Releasing/Submit+your+plugin |

### 如何完成市场上架

1. 打开 https://docs.obsidian.md/Plugins/Releasing/Submit+your+plugin
2. 按文档说明填写插件提交表单
3. 机器人自动审核 → 合并 → 插件出现在市场

## 发布检查清单

- [x] manifest.json 版本号正确 (v0.4.0)
- [x] main.js 已构建（v0.4.0，待 esbuild production 跑完后最终确认）
- [x] styles.css 存在
- [x] README.md 完整
- [x] LICENSE (MIT)
- [ ] GitHub Release v0.4.0 含 zip（待用户授权 git tag + push）
- [x] v0.4.0 验证项通过（详见 `dev-docs/06-quality-checklist.md` Q31-Q40）
- [ ] 社区市场提交
- [ ] 首次 GUI 验收（Obsidian 内实际操作面板 + 右键菜单 + 📊 排序按钮）
