# 功能清单 (Function List) — v0.3.0

## MCP 工具层 (mcp-bridge.js)

| ID | 工具名 | 功能 | 状态 | 关键实现 |
|----|--------|------|------|---------|
| F1 | `list_memories` | 列出所有记忆笔记（含 tags、priority、addedAt、source） | ✅ done | 读 bridge 索引 + 实时读 .md |
| F2 | `get_memory` | 获取笔记完整内容 + frontmatter + wikilink 出链/反向链接 | ✅ done | 三级匹配（精确→单模糊→歧义报告） |
| F3 | `search_memories` | TF-IDF 语义搜索，支持 semantic/keyword/both 模式 | ✅ done | 中日韩分词 + 余弦相似度排序 |
| F4 | `write_memory` | AI 内容写入 Obsidian（新建/追加） | ✅ done | pendingWrites 队列 + BridgeSync 处理 |
| F5 | `delete_memory` | 从记忆列表移除（不删原文件），需 confirm:true | ✅ done | 确认门 + 路径安全检查 |

## Obsidian 面板层 (main.ts + src/)

| ID | 功能 | 状态 | 关键实现 |
|----|------|------|---------|
| F6 | 侧栏拖拽面板 | ✅ done | MemoryPanel — drag/drop 事件 + 可视化列表 |
| F7 | 手动添加记忆 | ✅ done | 拖拽文件/文件夹 → MemoryStore + 解析 frontmatter tags |
| F8 | 手动移除记忆 | ✅ done | × 按钮 + 右键菜单 + onClose 清理 |
| F9 | 自动发现 ai_memory:true | ✅ done | BridgeSync.discoverAutoMemories() 全 vault 扫描 |
| F10 | MCP Bridge 启停控制 | ✅ done | 面板按钮 + 命令面板 toggle-mcp-bridge |
| F11 | 设置页 | ✅ done | 端口/自启/脚本路径 + Claude Code 配置展示 |
| F12 | Claude Code 配置生成 | ✅ done | 设置页 + 面板 📋 一键复制到剪贴板 |
| F16 | 面板搜索框 | ✅ done | 实时筛选（名称/路径/tags），getDisplayItems 管道 |
| F17 | 复制 MCP 配置 | ✅ done | navigator.clipboard API + fallback |
| F18 | 记忆排序 | ✅ done | 🕐时间 / 🔤名称 / ⭐优先级 三按钮切换 |
| F19 | 首次使用引导 | ✅ done | 空面板 3 步教程 + ai_memory:true 提示 |
| F20 | 按 tags 分组 | ✅ done | 📂 按钮折叠分组，未分类归入"未分类" |
| F21 | 记忆⭐优先级 | ✅ done | MemoryItem.priority + panel 显示 + sort |

## 框架层 (src/)

| ID | 功能 | 状态 | 关键实现 |
|----|------|------|---------|
| F22 | MemoryItem 扩展 | ✅ done | priority/source/tags，addMemory 解析 frontmatter |
| F23 | bridge v0.3.0 格式 | ✅ done | 传递完整元数据 (tags/priority/addedAt/source) |
| F24 | getDisplayItems 管道 | ✅ done | filter → sort → group 独立于渲染 |
| F25 | 共享工具函数 | ✅ done | src/utils.ts (getVaultBasePath/parseFrontmatter/MCP_TOOL_DEFINITIONS) |

## 安全层

| ID | 功能 | 状态 |
|----|------|------|
| F26 | 路径遍历拦截 (../, nullbyte, 绝对路径) | ✅ done |
| F27 | 文件大小限制 (512KB) | ✅ done |
| F28 | 删除确认门 (confirm:true) | ✅ done |

## 工程化

| ID | 功能 | 状态 |
|----|------|------|
| F29 | dev-docs/ 真源文档 (8 文件) | ✅ done |
| F30 | 自动化测试 (13 项, 100% pass) | ✅ done |
| F31 | Git 版本控制 (6 commits) | ✅ done |
| F32 | GitHub Release (v0.3.0 + zip) | ✅ done |
| F33 | Obsidian 社区市场提交 | ⬜ 待用户操作 |

## 未实现（后续版本）

| ID | 功能 | 优先级 |
|----|------|--------|
| F34 | 最近使用记录 | 🟡 P2 |
| F35 | 批量导入（右键文件夹） | 🟡 P2 |
| F36 | Git 版本化记忆 | 🔴 P3 |
| F37 | 多 vault 支持 | 🔴 P3 |
| F38 | 技能/Skills 系统 | 🔴 P3 |
