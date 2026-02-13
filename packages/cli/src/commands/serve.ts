import { Command } from 'commander';
import chalk from 'chalk';
import { existsSync, readFileSync, statSync } from 'fs';
import { resolve, join, extname } from 'path';
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

    // Check if directory exists
    if (!existsSync(dir)) {
      console.error(chalk.red(`Directory not found: ${dir}. Run 'codedocs build' first.`));
      process.exit(1);
    }

    // Create HTTP server
    const server = createServer((req, res) => {
      let filePath = join(dir, req.url || '/');

      // Handle directory requests
      if (existsSync(filePath) && statSync(filePath).isDirectory()) {
        filePath = join(filePath, 'index.html');
      }

      // Serve file
      if (existsSync(filePath) && statSync(filePath).isFile()) {
        try {
          const content = readFileSync(filePath);
          const ext = extname(filePath);
          const mimeType = MIME_TYPES[ext] || 'application/octet-stream';

          res.writeHead(200, { 'Content-Type': mimeType });
          res.end(content);
        } catch (error) {
          res.writeHead(500);
          res.end('Internal Server Error');
        }
      } else {
        res.writeHead(404);
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
