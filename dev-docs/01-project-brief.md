# 项目简介 (Project Brief)

## 项目名称
AI Memory Bridge

## 一句话定位
在 Obsidian 侧栏拖拽笔记，Claude Code 自动记住 — 不需要学 44 个工具，不需要下载模型。

## 目标用户
- 使用 Obsidian 做知识管理，同时使用 Claude Code 做 AI 辅助开发的用户
- 希望精确控制 AI "记住什么"的用户（而非算法自动选择）
- 需要 Claude Code 能**回写**总结/决策到 Obsidian 的用户

## 核心场景
1. 用户在日常使用 Obsidian 整理笔记，积累项目规范、技术决策、架构设计
2. 打开 AI Memory Bridge 侧栏面板，拖拽想要 AI 记住的笔记
3. 在 Claude Code 中，AI 可以通过 `list_memories`/`get_memory`/`search_memories` 读取记忆
4. AI 通过 `write_memory` 将生成的总结/决策写回 Obsidian
5. 带 `ai_memory: true` frontmatter 的笔记**自动发现**，无需手动拖拽

## 竞品差异化
| 我们的优势 | 竞品弱点 |
|-----------|---------|
| 可视化拖拽策展面板 | 竞品全是纯工具调用，无 UI 面板 |
| 5 工具够用 | enquire-mcp 44 工具，kobsidian 66 工具 |
| TF-IDF 语义搜索 + 零外部依赖 | 竞品需要下载 embedding 模型或调用 API |
| 双向读写 (read + write + delete) | 大部分竞品只读 |
| AI记忆/ 隔离文件夹 | 仅 hippocampus 做了，但无面板 |

## 非目标 (Non-Goals)
- 不做全 vault 自动索引（那是 enquire-mcp 的赛道）
- 不做 AI 模型训练/微调
- 不做多模态（图片/PDF/OCR）
- 不做多用户/团队协作
- 不做 Obsidian 之外的编辑器支持（v1.0 前）

## 项目形态
- Obsidian 社区插件（TypeScript + Obsidian API）
- 独立 MCP stdio server（Node.js，随 Claude Code 启动）
- 双组件通过 JSON 文件桥接（`.obsidian/ai-memory-bridge/memory-bridge.json`）
