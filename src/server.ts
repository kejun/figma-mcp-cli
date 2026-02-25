import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, resolve } from 'node:path';
import { ServerConfig } from './types.js';

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
};

export class LocalServer {
  private server: ReturnType<typeof createServer>;
  private port: number;
  private directory: string;

  constructor(config: ServerConfig) {
    this.port = config.port;
    this.directory = resolve(config.directory);
    this.server = createServer(this.handleRequest.bind(this));
  }

  private async handleRequest(req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse): Promise<void> {
    try {
      const requestPath = req.url === '/' ? '/index.html' : req.url ?? '/index.html';
      const filePath = resolve(this.directory, `.${requestPath}`);

      if (!filePath.startsWith(this.directory)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
      }

      const fileStats = await stat(filePath);
      if (!fileStats.isFile()) {
        res.writeHead(404);
        res.end('Not Found');
        return;
      }

      const ext = extname(filePath);
      const contentType = MIME_TYPES[ext] ?? 'application/octet-stream';
      const content = await readFile(filePath);

      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    } catch {
      res.writeHead(500);
      res.end('Internal Server Error');
    }
  }

  async start(): Promise<number> {
    return new Promise((resolveStart, rejectStart) => {
      this.server
        .listen(this.port, () => {
          console.log(`✓ 本地服务器运行在 http://localhost:${this.port}`);
          resolveStart(this.port);
        })
        .on('error', rejectStart);
    });
  }

  async stop(): Promise<void> {
    return new Promise((resolveStop) => {
      this.server.close(() => {
        console.log('✓ 本地服务器已停止');
        resolveStop();
      });
    });
  }

  getUrl(): string {
    return `http://localhost:${this.port}`;
  }
}
