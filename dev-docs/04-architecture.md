# 架构设计 (Architecture)

## 组件关系

```
┌─────────────────────────────────────────────────────────┐
│                    Obsidian Vault                        │
│                                                         │
│  ┌─────────────┐    ┌──────────────┐                    │
│  │ .md 笔记文件 │    │  .obsidian/  │                    │
│  │ (实时读取)   │    │  ai-memory-  │                    │
│  │             │    │  bridge/     │                    │
│  │ AI项目规范.md│    │  memory-     │                    │
│  │ ClaudeCode..│    │  bridge.json │ ← 轻量索引文件     │
│  │ 项目架构.md │    │              │   (仅路径+元数据)  │
│  └──────┬──────┘    └──────┬───────┘                    │
│         │                  │                            │
└─────────┼──────────────────┼────────────────────────────┘
          │                  │
    ┌─────▼─────┐      ┌─────▼────────┐
    │ BridgeSync │      │ mcp-bridge.js│
    │ (Obsidian  │◄────►│ (独立进程)    │
    │  插件内)   │ JSON │ (MCP stdio)  │
    │           │      │              │
    │ • 写索引   │      │ • 读索引      │
    │ • 处理写入 │      │ • 读.md 实时  │
    │ • 自动发现 │      │ • TF-IDF 搜索 │
    │ • 拖拽面板 │      │ • 安全校验    │
    └───────────┘      └──────┬───────┘
                              │ MCP Protocol (stdio)
                        ┌─────▼─────┐
                        │ Claude Code│
                        │ (5 tools)  │
                        └───────────┘
```

## 数据流（读）

```
Claude Code 调用 get_memory("AI项目开发规范.md")
  → mcp-bridge.js 读 memory-bridge.json (mtime 缓存)
  → 在索引中找到 path: "AI项目开发规范.md"
  → readVaultFile() 直接读 D:/calude/liu2/AI项目开发规范.md
  → parseMarkdown() 提取 frontmatter + [[wikilinks]]
  → getBacklinks() 计算反向链接
  → 返回 { found, content, frontmatter, wikilinks, backlinks }
```

## 数据流（写）

```
Claude Code 调用 write_memory({name:"决策", content:"...", mode:"create"})
  → mcp-bridge.js 将写入请求加入 pendingWrites 队列
  → 写入 memory-bridge.json

Obsidian 打开/刷新时:
  → BridgeSync.syncNow() 读取 pendingWrites
  → executeWrite() 创建 AI记忆/决策.md
  → 清除 pendingWrites
  → 更新 memory-bridge.json 索引
```

## 目录结构

```
ai-memory-bridge/
├── main.ts                    # Obsidian 插件入口
├── src/
│   ├── BridgeSync.ts          # 桥接数据同步（索引写入 + 写入处理）
│   ├── MemoryStore.ts         # 记忆数据模型 + 持久化
│   ├── MemoryPanel.ts         # 侧栏拖拽面板 UI
│   └── settings.ts            # 设置页
├── mcp-bridge.js              # 独立 MCP Server (stdio)
├── styles.css                 # 面板样式
├── manifest.json              # Obsidian 插件清单
├── esbuild.config.mjs         # 构建配置
├── dev-docs/                  # 内部真源文档
│   ├── 01-project-brief.md
│   ├── 02-function-list.md
│   ├── 03-technical-route.md
│   ├── 04-architecture.md     # ← 当前文件
│   ├── 05-current-stage-plan.md
│   ├── 06-quality-checklist.md
│   ├── 07-ux-roadmap.md
│   └── AGENTS.md
└── package.json
```

## 关键设计决策

| 决策 | 理由 |
|------|------|
| bridge 文件仅存索引（无内容）| 内容直接读 .md，永远新鲜 |
| mtime 双重缓存（bridge + content）| 避免重复 IO |
| 异步写入 + pending 队列 | 防止 Claude 和 Obsidian 同时写冲突 |
| 确认门（confirm:true）| 防止 AI 误删用户笔记 |
| 纯 JS TF-IDF | 零依赖，中日韩分词，适合小规模笔记 |
