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
figma-mcp --file ./index.html
```

> 首次连接远程 MCP 服务时，即使已提供 Figma token，也可能需要额外 OAuth 认证。CLI 会自动打开浏览器完成认证。

## 常用参数

- `--token`: Figma Personal Access Token（可选，未传时读取 `FIGMA_ACCESS_TOKEN`）
- `--file`: HTML 文件路径（默认 `./index.html`）
- `--port`: 本地服务端口（默认 `8080`）
- `--team-id`: Figma 团队 ID
- `--file-name`: 生成的 Figma 文件名
- `--poll-interval`: 轮询间隔毫秒数（默认 `5000`）
- `--poll-timeout`: 轮询超时毫秒数（默认 `300000`）
- `--no-restore`: 完成后不恢复原始 HTML
