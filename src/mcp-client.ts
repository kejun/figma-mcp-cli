import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { CaptureResponse, FigmaConfig } from './types.js';

export class FigmaMCPClient {
  private client: Client;
  private transport: StreamableHTTPClientTransport;
  private readonly mcpBaseUrl: string;

  constructor(options: { mcpBaseUrl?: string } = {}) {
    this.mcpBaseUrl = (options.mcpBaseUrl ?? 'http://127.0.0.1:3845/mcp').replace(/\/$/, '');
    this.transport = new StreamableHTTPClientTransport(new URL(this.mcpBaseUrl));

    this.client = new Client({ name: 'figma-mcp-cli', version: '1.0.0' }, { capabilities: {} });
  }

  async connect(): Promise<void> {
    await this.client.connect(this.transport);
    console.log(`✓ Figma Desktop MCP 已连接 (${this.mcpBaseUrl})`);
  }

  async listTools(): Promise<string[]> {
    const { tools } = await this.client.listTools();
    return tools.map((tool) => tool.name);
  }

  async generateFigmaDesign(config: FigmaConfig, captureId?: string): Promise<CaptureResponse> {
    const args: Record<string, unknown> = {
      outputMode: config.outputMode,
    };

    if (config.fileName) args.fileName = config.fileName;
    if (config.teamId) args.planKey = `team::${config.teamId}`;
    if (captureId) args.captureId = captureId;

    const result = await this.client.callTool({
      name: 'generate_figma_design',
      arguments: args,
    });

    const content = result.content as Array<{ type: string; text?: string }>;
    const text = content.find((c) => c.type === 'text')?.text ?? '';

    const captureIdMatch = text.match(/capture ID[:\s]+`?([a-f0-9-]+)`?/i);
    const urlMatch = text.match(/https:\/\/www\.figma\.com[^\s]*/i);

    if (captureId) {
      if (text.includes('completed') || urlMatch) {
        return {
          captureId,
          status: 'completed',
          figmaUrl: urlMatch?.[0],
        };
      }

      if (text.includes('failed')) {
        return {
          captureId,
          status: 'failed',
          error: text,
        };
      }

      return {
        captureId,
        status: 'pending',
      };
    }

    return {
      captureId: captureIdMatch?.[1] ?? '',
      status: 'pending',
    };
  }

  getCaptureScriptUrl(): string {
    return `${this.mcpBaseUrl}/html-to-design/capture.js`;
  }

  getCaptureEndpoint(captureId: string): string {
    return `${this.mcpBaseUrl}/capture/${captureId}`;
  }

  async disconnect(): Promise<void> {
    await this.client.close();
  }
}
