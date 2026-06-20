# 功能清单 (Function List) — v0.2.0

## MCP 工具层 (mcp-bridge.js)

| ID | 工具名 | 功能 | 状态 | 关键实现 |
|----|--------|------|------|---------|
| F1 | `list_memories` | 列出所有记忆笔记（含 tags、字符数、wikilink 数） | ✅ done | 读 bridge 索引 + 实时读 .md 文件 |
| F2 | `get_memory` | 获取笔记完整内容 + frontmatter + wikilink 出链/反向链接 | ✅ done | 三级匹配(精确→单模糊→歧义报告) |
| F3 | `search_memories` | TF-IDF 语义搜索，支持 semantic/keyword/both 模式 | ✅ done | 中日韩分词 + 余弦相似度排序 |
| F4 | `write_memory` | AI 内容写入 Obsidian（新建/追加）| ✅ done | pendingWrites 队列 + BridgeSync 处理 |
| F5 | `delete_memory` | 从记忆列表移除（不删原文件），需 confirm | ✅ done | 确认门 + 路径安全检查 |

## Obsidian 插件层 (main.ts + src/)

| ID | 功能 | 状态 | 关键实现 |
|----|------|------|---------|
| F6 | 侧栏拖拽面板 | ✅ done | MemoryPanel — drag/drop 事件 + 可视化列表 |
| F7 | 手动添加记忆 | ✅ done | 拖拽文件/文件夹到面板 → MemoryStore |
| F8 | 手动移除记忆 | ✅ done | × 按钮 + 右键菜单 |
| F9 | 自动发现 ai_memory:true | ✅ done | BridgeSync.discoverAutoMemories() |
| F10 | MCP Bridge 启停控制 | ✅ done | 面板按钮 + 命令面板 |
| F11 | 设置页 | ✅ done | AIBridgeSettingTab — 端口/自启/脚本路径 |
| F12 | Claude Code 配置生成 | ✅ done | 设置页展示 MCP JSON 配置 |

## 安全层

| ID | 功能 | 状态 |
|----|------|------|
| F13 | 路径遍历拦截 (../, nullbyte, 绝对路径) | ✅ done |
| F14 | 文件大小限制 (512KB) | ✅ done |
| F15 | 删除确认门 (confirm:true) | ✅ done |

## 已规划但未实现

| ID | 功能 | 优先级 | 依赖 |
|----|------|--------|------|
| F16 | 面板内搜索记忆 | 🟢 P0 | 无 |
| F17 | 一键复制 MCP 配置 | 🟢 P0 | 无 |
| F18 | 记忆排序（名称/时间/tags）| 🟢 P1 | 无 |
| F19 | 首次使用引导 | 🟢 P1 | 无 |
| F20 | 记忆分组（按项目/tags）| 🟡 P1 | 改数据模型 |
| F21 | 记忆⭐优先级 | 🟡 P1 | 改 bridge 格式 |
| F22 | 最近使用记录 | 🟡 P2 | 无 |
| F23 | 批量导入（右键文件夹）| 🟡 P2 | 无 |
| F24 | Git 版本化记忆 | 🔴 P2 | Git 操作安全 |
| F25 | 多 vault 支持 | 🔴 P3 | 架构变更 |
| F26 | 技能/Skills 系统 | 🔴 P3 | 新增子系统 |
| F27 | Obsidian 社区市场发布 | 🔴 P3 | 版本管理+文档 |
