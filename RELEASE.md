# 发布检查清单

## Obsidian 社区市场上架

### 前置条件
- [x] manifest.json 有完整 id/name/version/description/author
- [x] README.md 有安装说明和截图
- [x] 代码在 GitHub 公开仓库
- [x] 有 Git tag 标记版本
- [ ] GitHub Release 页面有发布包

### 上架步骤

#### 1. 推送到 GitHub

```bash
git remote add origin https://github.com/YiFanAWA/ai-memory-bridge.git
git push -u origin master
```

#### 2. 创建 Release

```bash
# 打 tag
git tag v0.3.0
git push origin v0.3.0

# 创建 release zip（只包含必要文件）
zip -r ai-memory-bridge-v0.3.0.zip \
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
3. 更新 `dev-docs/` 真源文档
4. 构建: `node esbuild.config.mjs production`
5. 测试: `bash tests/run-tests.sh`
6. Git commit + tag + push
7. 创建 GitHub Release 并上传 zip
