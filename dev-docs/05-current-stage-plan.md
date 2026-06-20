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

| 子阶段 | 内容 | 优先级 |
|--------|------|--------|
| S5 | 最近使用记录 | 🟡 P2 |
| S6 | 批量导入（右键文件夹）| 🟡 P2 |
| S7 | 社区市场上架完成 | 🔴 P3 |
| S8 | GUI 验收（Obsidian 实际操作） | 🔴 P3 |
