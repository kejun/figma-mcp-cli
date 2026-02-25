import { readFile, writeFile } from 'node:fs/promises';

export class HTMLInjector {
  private filePath: string;
  private originalContent?: string;

  constructor(filePath: string) {
    this.filePath = filePath;
  }

  async backup(): Promise<void> {
    this.originalContent = await readFile(this.filePath, 'utf-8');
  }

  async injectScript(): Promise<void> {
    let content = await readFile(this.filePath, 'utf-8');
    const scriptTag = '<script src="https://mcp.figma.com/mcp/html-to-design/capture.js" async></script>';

    if (!content.includes('capture.js')) {
      content = content.includes('</head>')
        ? content.replace('</head>', `  ${scriptTag}\n</head>`)
        : `${scriptTag}\n${content}`;
    }

    await writeFile(this.filePath, content, 'utf-8');
    console.log('✓ 已注入 Figma capture 脚本');
  }

  async restore(): Promise<void> {
    if (this.originalContent !== undefined) {
      await writeFile(this.filePath, this.originalContent, 'utf-8');
      console.log('✓ 已恢复原始 HTML 文件');
    }
  }
}
