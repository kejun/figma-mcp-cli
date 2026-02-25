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
figma-mcp --file ./index.html
```

也支持环境变量：

```bash
# 可选：自定义 Figma Desktop MCP 地址（默认 http://127.0.0.1:3845/mcp）
export FIGMA_MCP_URL=http://127.0.0.1:3845/mcp
figma-mcp --file ./index.html
```

必须/可选配置说明：

- **必须**：已启动并登录 Figma Desktop（本地 MCP Server）
- **可选**：`FIGMA_MCP_URL`（默认 `http://127.0.0.1:3845/mcp`）

> CLI 默认连接 Figma Desktop MCP 本地服务，授权由桌面端自动处理。

## 常用参数

- `--token`: 保留参数（当前 Desktop MCP 模式下不需要）
- `--file`: HTML 文件路径（默认 `./index.html`）
- `--port`: 本地服务端口（默认 `8080`）
- `--team-id`: Figma 团队 ID
- `--file-name`: 生成的 Figma 文件名
- `--poll-interval`: 轮询间隔毫秒数（默认 `5000`）
- `--poll-timeout`: 轮询超时毫秒数（默认 `300000`）
- `--no-restore`: 完成后不恢复原始 HTML
