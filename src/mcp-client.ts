import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { OAuthClientProvider, UnauthorizedError } from '@modelcontextprotocol/sdk/client/auth.js';
import { createServer } from 'node:http';
import open from 'open';
import { CaptureResponse, FigmaConfig } from './types.js';

class InMemoryOAuthClientProvider implements OAuthClientProvider {
  private readonly _redirectUrl: string;
  private readonly _clientMetadata: OAuthClientProvider['clientMetadata'];
  private _clientInformation?: ReturnType<OAuthClientProvider['clientInformation']>;
  private _tokens?: ReturnType<OAuthClientProvider['tokens']>;
  private _codeVerifier?: string;

  constructor(redirectUrl: string, onRedirect: (authorizationUrl: URL) => void) {
    this._redirectUrl = redirectUrl;
    this._clientMetadata = {
      client_name: 'figma-mcp-cli',
      redirect_uris: [redirectUrl],
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: 'none',
    };
    this._onRedirect = onRedirect;
  }

  private readonly _onRedirect: (authorizationUrl: URL) => void;

  get redirectUrl(): string {
    return this._redirectUrl;
  }

  get clientMetadata(): OAuthClientProvider['clientMetadata'] {
    return this._clientMetadata;
  }

  clientInformation(): OAuthClientProvider['clientInformation'] extends () => infer T ? T : never {
    return this._clientInformation;
  }

  saveClientInformation(clientInformation: NonNullable<ReturnType<OAuthClientProvider['clientInformation']>>): void {
    this._clientInformation = clientInformation;
  }

  tokens(): OAuthClientProvider['tokens'] extends () => infer T ? T : never {
    return this._tokens;
  }

  saveTokens(tokens: NonNullable<ReturnType<OAuthClientProvider['tokens']>>): void {
    this._tokens = tokens;
  }

  redirectToAuthorization(authorizationUrl: URL): void {
    this._onRedirect(authorizationUrl);
  }

  saveCodeVerifier(codeVerifier: string): void {
    this._codeVerifier = codeVerifier;
  }

  codeVerifier(): string {
    if (!this._codeVerifier) {
      throw new Error('No code verifier saved');
    }
    return this._codeVerifier;
  }
}

export class FigmaMCPClient {
  private client: Client;
  private transport: StreamableHTTPClientTransport;
  private readonly callbackPort: number;
  private readonly callbackUrl: string;
  private readonly authProvider: InMemoryOAuthClientProvider;

  constructor(_accessToken: string, callbackPort = 38421) {
    this.callbackPort = callbackPort;
    this.callbackUrl = `http://127.0.0.1:${this.callbackPort}/callback`;
    this.authProvider = new InMemoryOAuthClientProvider(this.callbackUrl, (authorizationUrl) => {
      console.log('\n🔐 需要进行 MCP 认证，正在打开浏览器...');
      void open(authorizationUrl.toString());
    });

    this.transport = new StreamableHTTPClientTransport(new URL('https://mcp.figma.com/mcp'), {
      authProvider: this.authProvider,
    });

    this.client = new Client({ name: 'figma-mcp-cli', version: '1.0.0' }, { capabilities: {} });
  }

  async connect(): Promise<void> {
    try {
      await this.client.connect(this.transport);
      console.log('✓ Figma MCP 服务器已连接');
    } catch (error) {
      if (!(error instanceof UnauthorizedError)) {
        throw error;
      }

      const authorizationCode = await this.waitForOAuthCallback();
      await this.transport.finishAuth(authorizationCode);
      await this.client.connect(this.transport);
      console.log('✓ Figma MCP 服务器已连接');
    }
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

  async disconnect(): Promise<void> {
    await this.client.close();
  }

  private async waitForOAuthCallback(): Promise<string> {
    return new Promise((resolve, reject) => {
      const server = createServer((req, res) => {
        if (req.url === '/favicon.ico') {
          res.writeHead(404);
          res.end();
          return;
        }

        const callbackUrl = new URL(req.url ?? '', this.callbackUrl);
        const code = callbackUrl.searchParams.get('code');
        const oauthError = callbackUrl.searchParams.get('error');

        if (code) {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end('<h1>认证成功</h1><p>可以关闭这个页面并返回终端。</p>');
          resolve(code);
          setTimeout(() => server.close(), 500);
          return;
        }

        res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`<h1>认证失败</h1><p>${oauthError ?? '未收到授权码'}</p>`);
        reject(new Error(oauthError ? `OAuth authorization failed: ${oauthError}` : 'No authorization code provided'));
        setTimeout(() => server.close(), 500);
      });

      server.listen(this.callbackPort, () => {
        console.log(`🌐 等待浏览器回调：${this.callbackUrl}`);
      });
      server.on('error', reject);
    });
  }
}
