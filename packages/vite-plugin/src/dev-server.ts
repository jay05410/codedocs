import { createServer, type ViteDevServer } from 'vite';
import { codedocsPlugin } from './plugin.js';

export interface DevServerOptions {
  docsDir: string;
  port?: number;
  open?: boolean;
}

export async function startDevServer(options: DevServerOptions): Promise<ViteDevServer> {
  const server = await createServer({
    plugins: [codedocsPlugin({ docsDir: options.docsDir })],
    server: {
      port: options.port || 4321,
      open: options.open ?? true,
    },
  });

  await server.listen();
  server.printUrls();

  return server;
}
