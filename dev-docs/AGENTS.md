# AI Memory Bridge — Agent Constitution

## 项目证据包

| 证据 | 路径 |
|------|------|
| 项目简介 | dev-docs/01-project-brief.md |
| 功能清单 | dev-docs/02-function-list.md |
| 技术选型 | dev-docs/03-technical-route.md |
| 架构设计 | dev-docs/04-architecture.md |
| 阶段计划 | dev-docs/05-current-stage-plan.md |
| 质量清单 | dev-docs/06-quality-checklist.md |
| UX 路线 | dev-docs/07-ux-roadmap.md |

## 核心规则 (非协商)

### 1. 双组件不可拆
- `main.ts` (Obsidian 插件) 和 `mcp-bridge.js` (MCP Server) 是同一个产品的两个组件
- 改动一个必须验证另一个的兼容性
- 唯一的通信渠道是 `.obsidian/ai-memory-bridge/memory-bridge.json`

### 2. 零外部依赖原则
- mcp-bridge.js 只能使用 Node.js 标准库 (fs, path, readline)
- 插件端只能使用 Obsidian API + 标准 TypeScript
- 不引入需要网络下载的依赖（包括 ML 模型、API SDK）

### 3. 安全底线
- 所有文件路径操作必须过 `isPathSafe()` 校验
- 所有写入操作必须有大小限制
- 所有删除操作必须有确认门
- 绝不删除用户的原始笔记文件（delete_memory 只移除索引）

### 4. 向后兼容
- bridge JSON 格式可以加字段，不能删字段
- 旧版 bridge 文件（v0.1.0 含 content 字段）必须能被新版 mcp-bridge.js 读取
- 工具接口（参数名、返回结构）只能加不能改

### 5. 改动前必读文件
- 改 MCP 工具 → 先读 `mcp-bridge.js` 全文
- 改面板 UI → 先读 `src/MemoryPanel.ts` + `styles.css`
- 改数据存储 → 先读 `src/MemoryStore.ts` + `src/BridgeSync.ts`
- 改构建 → 先读 `esbuild.config.mjs` + `package.json`

### 6. 验证标准 (不接受"应该没问题")
- 每个 MCP 工具改动 → 用 stdin 模拟调用验证 JSON-RPC 响应
- 每个 UI 改动 → TypeScript 编译 0 error
- 每个安全相关改动 → 验证路径遍历/大小/确认门三个测试点
- 发布前 → 全 5 工具回归 + 安全 4 项回归

### 7. 项目所有者
- 项目的"用户"是 Obsidian + Claude Code 的双重用户
- 改动不应破坏他们在 Obsidian 中的笔记数据
- AI 生成的笔记放在 `AI记忆/` 文件夹，不污染用户自己的目录

### 8. 语言
- MCP 工具描述和返回消息使用中文（目标用户中文优先）
- 代码注释使用中文/英文均可
- dev-docs 使用中文

## 禁止模式

| 模式 | 原因 |
|------|------|
| `as any` 类型强转 | 掩盖类型错误，用 `instanceof` 守卫替代 |
| `require()` 在 TypeScript 中 | 用 ES `import` |
| 同步 `writeFileSync` 在 async 方法中 | 用 `fs.promises.writeFile` |
| 匿名函数做事件监听器 | 无法在 onClose 中清理 |
| `fs.readFileSync` 无 mtime 缓存 | 每次调用都读盘 |
| 硬编码绝对路径 (D:/...) | 不可移植 |

## 验证命令

```bash
# 每次改动后运行
cd ai-memory-bridge
npx tsc -noEmit -skipLibCheck          # 类型检查
node esbuild.config.mjs production      # 构建

# 每次改动 MCP 工具后运行
for tool in list_memories get_memory search_memories; do
  echo "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"tools/call\",\"params\":{\"name\":\"$tool\",\"arguments\":{}}}" \
  | node mcp-bridge.js --vault D:/calude/liu2
done
```
