#!/usr/bin/env node

import { Command } from 'commander';
import open from 'open';
import { dirname, resolve } from 'node:path';
import { access } from 'node:fs/promises';
import { FigmaMCPClient } from './mcp-client.js';
import { LocalServer } from './server.js';
import { HTMLInjector } from './html-injector.js';
import { CaptureResponse, FigmaConfig } from './types.js';

interface CLIOptions {
  port: number;
  file: string;
  token?: string;
  teamId?: string;
  fileName: string;
  pollInterval: number;
  pollTimeout: number;
  restore: boolean;
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

async function pollCaptureStatus(
  mcpClient: FigmaMCPClient,
  config: FigmaConfig,
  captureId: string,
  pollInterval: number,
  pollTimeout: number,
): Promise<CaptureResponse> {
  const startTime = Date.now();
  let attempts = 0;

  console.log('\n⏳ 开始轮询 Figma 生成状态...');

  while (Date.now() - startTime <= pollTimeout) {
    await sleep(pollInterval);
    attempts += 1;
    console.log(`   第 ${attempts} 次检查...`);

    const result = await mcpClient.generateFigmaDesign(config, captureId);

    if (result.status === 'completed') {
      console.log('✓ Figma 文件已生成完成!');
      return result;
    }

    if (result.status === 'failed') {
      throw new Error(result.error ?? 'Figma 生成失败');
    }
  }

  throw new Error(`轮询超时 (${pollTimeout}ms)`);
}

async function main(): Promise<void> {
  const program = new Command();

  program
    .name('figma-mcp')
    .description('将本地 HTML 设计发送到 Figma')
    .option('-t, --token [token]', 'Figma Personal Access Token')
    .option('-f, --file <path>', 'HTML 文件路径', './index.html')
    .option('-p, --port <number>', '本地服务器端口', (value) => Number.parseInt(value, 10), 8080)
    .option('--team-id <id>', 'Figma 团队 ID')
    .option('--file-name <name>', 'Figma 文件名', 'Design from HTML')
    .option('--poll-interval <ms>', '轮询间隔 (ms)', (value) => Number.parseInt(value, 10), 5000)
    .option('--poll-timeout <ms>', '轮询超时 (ms)', (value) => Number.parseInt(value, 10), 300000)
    .option('--no-restore', '完成后不恢复原始 HTML')
    .parse(process.argv);

  const options = program.opts<CLIOptions>();
  const mcpBaseUrl = process.env.FIGMA_MCP_URL;

  const htmlPath = resolve(options.file);
  await access(htmlPath);

  console.log('🎨 Figma MCP CLI - HTML to Design\n');
  console.log(`📁 HTML 文件：${htmlPath}`);

  const mcpClient = new FigmaMCPClient({ mcpBaseUrl });
  const server = new LocalServer({
    port: options.port,
    directory: dirname(htmlPath),
  });
  const injector = new HTMLInjector(htmlPath);

  try {
    console.log('\n🔌 连接 Figma MCP 服务器...');
    await mcpClient.connect();

    console.log('\n🚀 启动本地服务器...');
    await server.start();

    console.log('\n💉 注入 Figma capture 脚本...');
    await injector.backup();
    await injector.injectScript(mcpClient.getCaptureScriptUrl());

    console.log('\n📡 请求 Figma 设计生成...');
    const fileName = htmlPath.split('/').pop();
    const figmaConfig: FigmaConfig = {
      teamId: options.teamId,
      outputMode: 'newFile',
      fileName: options.fileName,
      url: `${server.getUrl()}/${fileName}`,
    };

    const captureResponse = await mcpClient.generateFigmaDesign(figmaConfig);
    const captureId = captureResponse.captureId;

    if (!captureId) {
      throw new Error('未能获取 captureId，请检查 MCP 服务器连接和工具响应');
    }

    console.log(`✓ Capture ID: ${captureId}`);

    const captureEndpoint = encodeURIComponent(mcpClient.getCaptureEndpoint(captureId));
    const captureUrl = `${server.getUrl()}/${fileName}#figmacapture=${captureId}&figmaendpoint=${captureEndpoint}`;

    console.log('\n🌐 打开浏览器...');
    console.log(`   ${captureUrl}`);
    await open(captureUrl);

    await sleep(3000);

    const result = await pollCaptureStatus(
      mcpClient,
      figmaConfig,
      captureId,
      options.pollInterval,
      options.pollTimeout,
    );

    console.log('\n✅ 完成!\n');
    console.log('┌─────────────────────────────────────────────────────┐');
    console.log(`│  Figma 文件：${result.figmaUrl?.padEnd(40) ?? 'N/A'.padEnd(40)} │`);
    console.log('└─────────────────────────────────────────────────────┘');

    if (result.figmaUrl) {
      await open(result.figmaUrl);
    }
  } finally {
    if (options.restore) {
      await injector.restore();
    }
    await server.stop();
    await mcpClient.disconnect();
  }
}

main().catch((error: unknown) => {
  console.error('\n❌ 错误:', error instanceof Error ? error.message : error);
  process.exit(1);
});
