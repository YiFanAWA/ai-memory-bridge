# 发布检查清单

## v0.4.0 发布说明

### 新功能（P2）
- **最近使用记录 (S5/F34)**：AI 通过 `get_memory` 访问笔记后记录时间戳，面板新增 📊 排序按钮按最近使用降序排列。
- **批量导入文件夹 (S6/F35)**：在 Obsidian 文件浏览器右键文件夹显示"加入 AI 记忆"菜单项，自动展开子 .md。

### 严重问题修复
- `delete_memory` 改为 `pendingDeletes` 队列 + `deletedPaths` 持久化集合，删除持久生效、阻断 auto-discovery 复活。
- `executeWrite` 增加 `isPathSafe()` 二次校验 + `MAX_FILE_SIZE` 限制（纵深防御）。
- `MemoryPanel` 全面事件委托重构，移除匿名监听器，`onClose` 完整清理。
- 移除 `as any` 类型强转。
- 版本号统一为 0.4.0（package.json / manifest.json / mcp-bridge.js），bridge 文件格式版本保持 0.3.0（解耦）。

### 兼容性
- bridge 文件格式 v0.3.0（向后兼容 v0.1.0/v0.2.0）
- MCP 工具接口不变（5 工具入参/出参结构保持）
- 旧版 `data.json` 自动迁移

## Obsidian 社区市场上架

### 前置条件
- [x] manifest.json 有完整 id/name/version/description/author
- [x] README.md 有安装说明和截图
- [x] 代码在 GitHub 公开仓库
- [x] 有 Git tag 标记版本（v0.3.0 已有，v0.4.0 待打）
- [ ] GitHub Release 页面有 v0.4.0 发布包

### 上架步骤

#### 1. 推送到 GitHub

```bash
git remote add origin https://github.com/YiFanAWA/ai-memory-bridge.git
git push -u origin master
```

#### 2. 创建 v0.4.0 Release

```bash
# 打 tag
git tag v0.4.0
git push origin v0.4.0

# 创建 release zip（只包含必要文件）
zip -r ai-memory-bridge-v0.4.0.zip \
  main.js \
  manifest.json \
  styles.css \
  README.md \
  LICENSE
```

上传 zip 到 GitHub Release。

#### 3. 提交到 Obsidian 社区市场

Fork https://github.com/obsidianmd/obsidian-releases

在 `community-plugins.json` 中添加：

```json
{
  "id": "ai-memory-bridge",
  "name": "AI Memory Bridge",
  "author": "YiFanAWA",
  "description": "Connect Obsidian as AI memory for Claude Code via MCP. Drag-drop panel, TF-IDF search, bidirectional read/write.",
  "repo": "YiFanAWA/ai-memory-bridge"
}
```

提交 PR。

### 后续版本发布流程

1. 更新 `manifest.json` 版本号
2. 更新 `package.json` 版本号
3. 更新 `mcp-bridge.js` 头注释 + `SERVER_VERSION`
4. 运行 `node version-bump.mjs <新版本>` 同步 manifest.json + 创建 versions.json 条目
5. 更新 `dev-docs/` 真源文档
6. 构建: `node esbuild.config.mjs production`
7. 测试: `bash tests/run-tests.sh`
8. Git commit + tag + push
9. 创建 GitHub Release 并上传 zip
