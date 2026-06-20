# 发布状态 (Release Status)

## 当前版本: v0.3.0

### GitHub

| 项目 | 状态 | 链接 |
|------|------|------|
| 仓库 | ✅ 公开 | https://github.com/YiFanAWA/ai-memory-bridge |
| Tag | ✅ v0.3.0 | https://github.com/YiFanAWA/ai-memory-bridge/releases/tag/v0.3.0 |
| Release zip | ✅ 已上传 | `ai-memory-bridge-v0.3.0.zip` (13KB, 含 main.js/manifest.json/styles.css/README.md/LICENSE) |
| CI/CD | ❌ 未配置 | 后续可加 GitHub Actions 自动构建 |

### Obsidian 社区市场

| 步骤 | 状态 | 说明 |
|------|------|------|
| 仓库满足要求 | ✅ | 公开、manifest.json 完整、Release 就绪 |
| Fork obsidian-releases | ⚠️ 已创建但需重做 | API 无法创建 PR (issues disabled) |
| 提交插件 | ⬜ 待用户操作 | https://docs.obsidian.md/Plugins/Releasing/Submit+your+plugin |

### 如何完成市场上架

1. 打开 https://docs.obsidian.md/Plugins/Releasing/Submit+your+plugin
2. 按文档说明填写插件提交表单
3. 机器人自动审核 → 合并 → 插件出现在市场

### 发布检查清单

- [x] manifest.json 版本号正确 (v0.3.0)
- [x] main.js 已构建
- [x] styles.css 存在
- [x] README.md 完整
- [x] LICENSE (MIT)
- [x] GitHub Release 含 zip
- [x] 13 项测试 100% 通过
- [ ] 社区市场提交
- [ ] 首次 GUI 验收（Obsidian 内实际操作面板）
