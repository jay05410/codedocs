import { Command } from 'commander';
import chalk from 'chalk';
import { existsSync, readFileSync, statSync } from 'fs';
import { resolve, join, extname, normalize, sep } from 'path';
import { createServer } from 'http';
import { exec } from 'child_process';

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.map': 'application/json',
};

export const serveCommand = new Command('serve')
  .description('Start static file server for built documentation')
  .option('-p, --port <number>', 'Port number', '4321')
  .option('-d, --dir <path>', 'Directory to serve', './dist')
  .option('--open', 'Open browser automatically')
  .action(async (options) => {
    const port = parseInt(options.port, 10);
    const dir = resolve(process.cwd(), options.dir);
    const rootWithSep = dir.endsWith(sep) ? dir : `${dir}${sep}`;

    // Check if directory exists
    if (!existsSync(dir)) {
      console.error(chalk.red(`Directory not found: ${dir}. Run 'codedocs build' first.`));
      process.exit(1);
    }

    // Create HTTP server
    const server = createServer((req, res) => {
      const requestUrl = req.url || '/';
      const pathname = safePathname(requestUrl);
      const filePath = resolveRequestPath(dir, pathname);

      if (!filePath || (!filePath.startsWith(rootWithSep) && filePath !== dir)) {
        res.writeHead(403, defaultHeaders('text/plain'));
        res.end('Forbidden');
        return;
      }

      let finalPath = filePath;

      // Handle directory requests
      if (existsSync(finalPath) && statSync(finalPath).isDirectory()) {
        finalPath = join(finalPath, 'index.html');
      }

      // Serve file
      if (existsSync(finalPath) && statSync(finalPath).isFile()) {
        try {
          const content = readFileSync(finalPath);
          const ext = extname(finalPath);
          const mimeType = MIME_TYPES[ext] || 'application/octet-stream';

          res.writeHead(200, defaultHeaders(mimeType));
          res.end(content);
        } catch (error) {
          res.writeHead(500, defaultHeaders('text/plain'));
          res.end('Internal Server Error');
        }
      } else {
        res.writeHead(404, defaultHeaders('text/plain'));
        res.end('Not Found');
      }
    });

    server.listen(port, () => {
      const url = `http://localhost:${port}`;
      console.log(chalk.green(`\n✓ Server started\n`));
      console.log(chalk.cyan(`  ${url}\n`));
      console.log(chalk.dim(`Press Ctrl+C to stop\n`));

      // Open browser if requested
      if (options.open) {
        const command = process.platform === 'win32'
          ? `start ${url}`
          : process.platform === 'darwin'
          ? `open ${url}`
          : `xdg-open ${url}`;

        exec(command, (error) => {
          if (error) {
            console.error(chalk.yellow(`Failed to open browser: ${error.message}`));
          }
        });
      }
    });

    // Handle graceful shutdown
    process.once('SIGINT', () => {
      console.log(chalk.yellow('\n\nShutting down...'));
      server.close(() => process.exit(0));
    });

    process.once('SIGTERM', () => {
      server.close(() => process.exit(0));
    });
  });

function safePathname(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl, 'http://localhost');
    const decoded = decodeURIComponent(parsed.pathname || '/');
    return decoded.includes('\0') ? '/' : decoded;
  } catch {
    return '/';
  }
}

function resolveRequestPath(rootDir: string, pathname: string): string | null {
  const safePath = normalize(pathname).replace(/^(\.\.(\/|\\|$))+/, '');
  return resolve(rootDir, `.${safePath.startsWith('/') ? safePath : `/${safePath}`}`);
}

function defaultHeaders(contentType: string): Record<string, string> {
  return {
    'Content-Type': contentType,
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
  };
}
