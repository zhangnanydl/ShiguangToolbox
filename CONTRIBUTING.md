# 参与贡献

感谢你愿意改进拾光工具箱。

## 提交 Issue

- Bug 请写明系统版本、软件版本、复现步骤和实际结果。
- 界面问题建议附截图，并标记发生位置。
- 请先搜索已有 Issue，避免重复提交。
- 不要上传包含个人路径、账号或其他敏感信息的配置文件。

## 本地开发

```powershell
npm install
npm run dev
```

提交 Pull Request 前请至少执行：

```powershell
node --check electron/main.cjs
node --check electron/preload.cjs
npm run build
```

## Pull Request 约定

- 一次 Pull Request 聚焦一个主题。
- 保持界面为紧凑亮色风格，并补全 hover、focus、disabled 和加载状态。
- 涉及用户数据结构时需兼容旧数据。
- 涉及界面时请附修改前后截图。
- 不要提交 `node_modules/`、`dist/`、`release/` 或本机用户数据。
