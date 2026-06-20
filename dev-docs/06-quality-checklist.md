# 质量验收清单 (Quality Checklist)

## MCP 工具验收

| # | 验收项 | 方法 | 状态 |
|---|--------|------|------|
| Q1 | list_memories 返回含 tags/charCount | 调 tool 验证 JSON | ✅ v0.2.0 |
| Q2 | get_memory 精确匹配返回正确内容 | path="AI项目开发规范.md" | ✅ |
| Q3 | get_memory 模糊匹配单个不歧义 | name="ClaudeCode" → partial | ✅ |
| Q4 | get_memory 多匹配报告候选列表 | 多文件同名前缀时 | ⬜ 未验证 |
| Q5 | get_memory 返回 wikilinks + backlinks | 含 [[]] 的笔记 | ⬜ 未验证 |
| Q6 | search_memories semantic 模式得分排序 | 查"MCP配置" | ✅ |
| Q7 | search_memories keyword 模式字符串匹配 | 同查 + mode:"keyword" | ⬜ 未验证 |
| Q8 | search_memories both 模式合并去重 | 同查 + mode:"both" | ✅ |
| Q9 | write_memory 写入成功返回 writeId | 正常参数 | ✅ |
| Q10 | write_memory 拒绝空 name/content | 空参数 | ✅ |
| Q11 | delete_memory 无 confirm 返回确认要求 | confirm 未设 | ✅ |
| Q12 | delete_memory confirm:true 执行删除 | confirm:true | ⬜ 未验证 |
| Q13 | delete_memory 不存在路径给出候选列表 | 不存在的路径 | ⬜ 未验证 |

## 安全验收

| # | 验收项 | 方法 | 状态 |
|---|--------|------|------|
| Q14 | 路径遍历 ../ 被拦截 | path="../../../etc/passwd" | ✅ |
| Q15 | 绝对路径被拦截 | path="/etc/passwd" | ✅ |
| Q16 | 空字节被拦截 | path="test\x00.md" | ✅ |
| Q17 | write_memory 超大内容被拒绝 | content > 512KB | ⬜ 未验证 |

## 面板验收

| # | 验收项 | 方法 | 状态 |
|---|--------|------|------|
| Q18 | 拖拽 .md 文件 → 面板显示 | Obsidian 内操作 | ⬜ 需 GUI |
| Q19 | 拖拽文件夹 → 自动添加子 .md | Obsidian 内操作 | ⬜ 需 GUI |
| Q20 | × 按钮移除记忆 | Obsidian 内操作 | ⬜ 需 GUI |
| Q21 | 清空按钮清除所有 | Obsidian 内操作 | ⬜ 需 GUI |
| Q22 | 启动/停止按钮切换 MCP | Obsidian 内操作 | ⬜ 需 GUI |
| Q23 | 状态指示灯变化 | Obsidian 内操作 | ⬜ 需 GUI |
| Q24 | ai_memory:true 自动发现 | 重启 Obsidian | ⬜ 需 GUI |

## 兼容性验收

| # | 验收项 | 状态 |
|---|--------|------|
| Q25 | TypeScript 编译 0 error | ✅ |
| Q26 | esbuild 构建成功 | ✅ |
| Q27 | mcp-bridge.js 独立可运行 | ✅ |
| Q28 | 旧版 bridge 文件 (v0.1.0) 向后兼容 | ⬜ 未验证 |
| Q29 | Windows 路径 (D:/...) 正常工作 | ✅ |
| Q30 | macOS/Linux 路径 (/Users/...) 未测试 | ⬜ 未验证 |

## 回归测试命令

```bash
# TypeScript 检查
cd ai-memory-bridge && npx tsc -noEmit -skipLibCheck

# 构建
node esbuild.config.mjs production

# MCP 工具回归
for tool in list_memories get_memory search_memories write_memory delete_memory; do
  echo "Testing $tool..."
  # (手动测试脚本)
done
```
