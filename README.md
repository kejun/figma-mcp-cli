# Figma MCP CLI

一个 TypeScript CLI 工具，用于将本地 HTML 页面通过 Figma MCP 工作流转换为 Figma 设计文件。

## 安装

```bash
npm install
npm run build
npm link
```

## 使用

```bash
figma-mcp --token YOUR_FIGMA_TOKEN --file ./index.html
```

也支持环境变量：

```bash
export FIGMA_ACCESS_TOKEN=YOUR_FIGMA_TOKEN
# 如需使用 2025.11 后重新发布的 OAuth App（推荐）
export FIGMA_OAUTH_CLIENT_ID=YOUR_FIGMA_CLIENT_ID
export FIGMA_OAUTH_CLIENT_SECRET=YOUR_FIGMA_CLIENT_SECRET
figma-mcp --file ./index.html
```

必须/可选配置说明：

- **必须**：`FIGMA_ACCESS_TOKEN`（或通过 `--token` 传入）
- **可选**：`FIGMA_OAUTH_CLIENT_ID`、`FIGMA_OAUTH_CLIENT_SECRET`
  - 机密 OAuth 应用建议同时设置这两个变量
  - `FIGMA_OAUTH_CLIENT_SECRET` 不能单独设置，必须和 `FIGMA_OAUTH_CLIENT_ID` 成对出现

> 首次连接远程 MCP 服务时，即使已提供 Figma token，也可能需要额外 OAuth 认证。CLI 会自动打开浏览器完成认证。
> 如遇到 OAuth 403，请在 Figma My Apps 重新发布应用并启用最新粒度 scopes。

## 常用参数

- `--token`: Figma Personal Access Token（可选，未传时读取 `FIGMA_ACCESS_TOKEN`）
- `--file`: HTML 文件路径（默认 `./index.html`）
- `--port`: 本地服务端口（默认 `8080`）
- `--team-id`: Figma 团队 ID
- `--file-name`: 生成的 Figma 文件名
- `--poll-interval`: 轮询间隔毫秒数（默认 `5000`）
- `--poll-timeout`: 轮询超时毫秒数（默认 `300000`）
- `--no-restore`: 完成后不恢复原始 HTML
