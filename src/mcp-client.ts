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
    if (config.url) args.url = config.url;
    if (captureId) args.captureId = captureId;

    const result = await this.client.callTool({
      name: 'generate_figma_design',
      arguments: args,
    });

    if (result.isError) {
      const errorContent = result.content as Array<{ type: string; text?: string }>;
      const errorText = errorContent.find((c) => c.type === 'text')?.text ?? 'Unknown error';
      throw new Error(`MCP tool error: ${errorText}`);
    }

    const content = result.content as Array<{ type: string; text?: string }>;
    const text = content.find((c) => c.type === 'text')?.text ?? '';

    const urlMatch = text.match(/https:\/\/www\.figma\.com[^\s)>]*/i);

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

    const extractedId = this.extractCaptureId(text);

    if (!extractedId) {
      console.error('⚠ MCP 响应内容:', text);
    }

    return {
      captureId: extractedId,
      status: 'pending',
    };
  }

  private extractCaptureId(text: string): string {
    // Try JSON parsing first
    try {
      const json = JSON.parse(text) as Record<string, unknown>;
      if (typeof json.captureId === 'string' && json.captureId) {
        return json.captureId;
      }
      if (typeof json.capture_id === 'string' && json.capture_id) {
        return json.capture_id;
      }
    } catch {
      // Not JSON, try regex patterns
    }

    // Try multiple regex patterns for different response formats
    const patterns = [
      /capture\s*id[:\s]+`?([a-f0-9-]+)`?/i,
      /capture[_-]id[:\s]+`?([a-f0-9-]+)`?/i,
      /"captureId"\s*:\s*"([^"]+)"/,
      /"capture_id"\s*:\s*"([^"]+)"/,
      /([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match?.[1]) {
        return match[1];
      }
    }

    return '';
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
