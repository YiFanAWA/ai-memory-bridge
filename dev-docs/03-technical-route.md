# 技术选型 (Technical Route) — 唯一主路线

## 推荐技术栈

| 层 | 选型 | 理由 |
|----|------|------|
| Obsidian 插件 | TypeScript + Obsidian API | 唯一选择，Obsidian 官方仅支持 TS/JS |
| 构建工具 | esbuild | Obsidian 社区标准，快，配置简单 |
| MCP Server 运行时 | Node.js (stdlib only) | 零外部依赖，Claude Code 内置 Node 运行时 |
| MCP 协议 | `@modelcontextprotocol/sdk` v1.0+ | 官方 SDK |
| 数据交换 | JSON 文件 (`memory-bridge.json`) | 无需额外进程/数据库 |
| 语义搜索 | TF-IDF 纯 JS | 零下载、零 API 调用、中日韩分词 |
| 安全 | 自实现中间件 | 路径校验 + 大小限制 + 确认门 |

## 已拒绝的技术路线

| 路线 | 拒绝原因 |
|------|---------|
| REST API + HTTP Server | 增加复杂度，需要端口管理、认证、CORS |
| SQLite 存储 | 过度设计，5-50 条记忆用文件完全够 |
| OpenAI Embeddings | 需要 API key + 网络 + 费用 + 隐私风险 |
| Transformers.js (all-MiniLM) | 25MB 下载，对 5-50 条笔记过大材小用 |
| WebSocket 实时推送 | 过度设计，mtime 缓存已足够 |
| 纯 Rust/Go 重写 MCP | 失去 npm 生态便利性，用户需要额外运行时 |

## 架构约束
1. mcp-bridge.js 必须是**独立可运行**的（不依赖 Obsidian 运行时）
2. 插件和 MCP server 的唯一通信方式是 JSON 文件
3. 不引入需要网络下载的依赖（air-gap 安全）
4. 代码需兼容 Windows/macOS/Linux 路径

## 待确认
- Obsidian 社区市场对 Node.js stdio MCP 的审核标准 → `待确认`
- 是否需要支持 Node 18 LTS（当前要求 Node ≥20）→ `待确认`
