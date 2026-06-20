# 用户体验扩充路线图 (UX Roadmap)

> 按 sliver-vibe-coding 风险分级。不改产品底层逻辑的标 🟢，改数据模型的标 🟡，改架构的标 🔴。

## 🟢 P0 — 本周可交付

| ID | 功能 | 用户痛点 | 改什么 |
|----|------|---------|--------|
| UX1 | 面板搜索框 | 10+ 记忆时滚屏找很慢 | MemoryPanel.ts + styles.css |
| UX2 | 一键复制 MCP 配置 | 用户不会写 JSON，复制粘贴最方便 | MemoryPanel.ts (clipboard API) |
| UX3 | 记忆排序切换 | 名称/时间/tags 排序按钮 | MemoryPanel.ts |
| UX4 | 首次使用引导 | 新用户看不懂面板是什么 | MemoryPanel.ts + 状态判断 |

## 🟡 P1 — 两周内

| ID | 功能 | 用户痛点 | 改什么 |
|----|------|---------|--------|
| UX5 | 按 tags 分组显示 | 标签多了视觉混乱 | MemoryPanel.ts + bridge 格式 |
| UX6 | 记忆⭐优先级 | AI 需要知道哪些最重要 | MemoryItem + bridge 格式 |
| UX7 | 面板中显示 tags 标签 | 拖入后不知道有哪些 tags | MemoryPanel renderItem |
| UX8 | 右键"在文件浏览器中定位" | 实际已实现，需验证 | MemoryPanel.ts |

## 🟡 P2 — 一月内

| ID | 功能 | 用户痛点 | 改什么 |
|----|------|---------|--------|
| UX9 | 最近使用记录 | 想知道 Claude 读了什么 | bridge 格式加 accessLog |
| UX10 | 批量导入文件夹 | 已有 50 篇笔记，不想一个个拖 | MemoryPanel + 文件浏览器集成 |
| UX11 | 记忆列表导出/导入 | 换 vault 或分享给团队 | MemoryStore import/export |
| UX12 | 快捷键支持 | 常用操作用键盘 | Obsidian command 注册 |

## 🔴 P3 — 需真源评审

| ID | 功能 | 风险 | 前置条件 |
|----|------|------|---------|
| UX13 | 多 vault 支持 | 架构变更 | 技术选型复审 |
| UX14 | Git 版本化记忆 | 涉及 Git 操作安全 | 安全评审 |
| UX15 | 可视化记忆图谱 | 新增 D3/Canvas 子系统 | 性能评审 |
| UX16 | 技能系统 | 新增子系统 | 架构设计 |

## 竞品体验差距分析

| 体验维度 | 我们 | enquire-mcp | obsidian-pkm | 差距 |
|---------|------|------------|-------------|------|
| 首次上手 | 拖拽即用 ⭐⭐⭐⭐⭐ | 读 44 工具文档 ⭐⭐ | 配 OpenAI key ⭐⭐ | **领先** |
| 搜索能力 | TF-IDF ⭐⭐⭐ | 混合+Reranker ⭐⭐⭐⭐⭐ | OpenAI 嵌入 ⭐⭐⭐⭐ | 落后 |
| 可视化策展 | 拖拽面板 ⭐⭐⭐⭐⭐ | ❌ | ❌ | **独有** |
| 写入能力 | 排队写入 ⭐⭐⭐ | ❌ | ❌ | **独有** |
| 多 vault | ❌ | ✅ | ✅ | 缺失 |
| 图表可视化 | ❌ | GraphRAG | ❌ | 缺失 |

## 一句话策略
**"强化拖拽面板的独有体验，不追查全 vault 搜索的赛道"**
