import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { spawn } from 'child_process';
import { existsSync } from 'fs';
import { resolve } from 'path';
import { loadConfig } from '@codedocs/core';
import { getCliStrings, t, initLocale } from '../i18n.js';
import { runSubprocess } from '../utils/run-subprocess.js';

export const devCommand = new Command('dev')
  .description('Start development mode with source watching and hot reload')
  .option('-c, --config <path>', 'Path to config file', 'codedocs.config.ts')
  .option('-p, --port <number>', 'Port number', '3000')
  .option('--host <host>', 'Host address', 'localhost')
  .option('--open', 'Open browser automatically')
  .action(async (options) => {
    const s = getCliStrings().cli;
    console.log(chalk.bold.cyan(`\n🔄 ${s.devTitle || 'Starting Development Mode'}\n`));

    try {
      // Load config
      const configPath = resolve(process.cwd(), options.config);
      if (!existsSync(configPath)) {
        console.error(chalk.red(`Config not found: ${options.config}\n`));
        process.exit(1);
      }

      const config = await loadConfig(configPath);
      initLocale(config.docs?.locale);
      const strings = getCliStrings().cli;

      const docsDir = './docs-output';
      const docsPath = resolve(process.cwd(), docsDir);
      const sourceDir = resolve(process.cwd(), config.source || './src');

      // Step 1: Initial analyze + generate if docs don't exist
      if (!existsSync(docsPath)) {
        await runSubprocess('analyze', ['analyze', '-c', options.config], { quiet: false });
        await runSubprocess('generate', ['generate', '-c', options.config], { quiet: false });
      }

      // Step 2: Start Vite dev server in background
      const viteArgs = ['vite', 'dev'];
      if (options.port) viteArgs.push('--port', options.port);
      if (options.host) viteArgs.push('--host', options.host);
      if (options.open) viteArgs.push('--open');

      const viteProcess = spawn('npx', viteArgs, {
        stdio: ['inherit', 'pipe', 'inherit'],
        shell: true,
      });

      let serverMessageShown = false;
      viteProcess.stdout?.on('data', (data) => {
        const output = data.toString();
        process.stdout.write(output);

        if (!serverMessageShown && (output.includes('ready') || output.includes('Local:'))) {
          serverMessageShown = true;
          console.log(chalk.green(`\n✓ ${strings.serverStarted || 'Server started'}\n`));
          console.log(chalk.cyan(strings.localServer || 'Local server:'));
          console.log(chalk.dim(`  http://${options.host || 'localhost'}:${options.port || '3000'}\n`));
        }
      });

      // Step 3: Watch source files for changes
      let debounceTimer: ReturnType<typeof setTimeout>;
      let isRebuilding = false;

      try {
        const chokidar = await import('chokidar');
        const watcher = chokidar.default.watch(sourceDir, {
          ignored: /(^|[\/\\])\.|node_modules|dist|build/,
          persistent: true,
          ignoreInitial: true,
        });

        watcher.on('all', (_event: string, filePath: string) => {
          if (isRebuilding) return;
          clearTimeout(debounceTimer);
          debounceTimer = setTimeout(async () => {
            isRebuilding = true;
            console.log(chalk.yellow(`\n♻️  ${strings.fileChanged || 'File changed'}: ${filePath}`));
            console.log(chalk.dim(strings.reanalyzing || 'Re-analyzing and regenerating...'));

            try {
              await runSubprocess('analyze', ['analyze', '-c', options.config], { quiet: true });
              await runSubprocess('generate', ['generate', '-c', options.config], { quiet: true });
              console.log(chalk.green(`✓ ${strings.hotReloadActive || 'Hot reload active'}\n`));
            } catch (err) {
              console.error(chalk.red('Rebuild failed:'), (err as Error).message);
            } finally {
              isRebuilding = false;
            }
          }, 500);
        });

        console.log(chalk.dim(`${strings.watchingFiles || 'Watching for file changes...'}`));
        console.log(chalk.dim(`${strings.pressCtrlC || 'Press Ctrl+C to stop'}\n`));
      } catch {
        console.log(chalk.yellow('chokidar not available — file watching disabled.'));
        console.log(chalk.dim('Install with: npm install chokidar\n'));
      }

      // Handle shutdown
      const shutdown = () => {
        console.log(chalk.yellow(`\n\n${strings.shuttingDown || 'Shutting down...'}`));
        viteProcess.kill('SIGINT');
        process.exit(0);
      };

      process.once('SIGINT', shutdown);
      process.once('SIGTERM', shutdown);
    } catch (error) {
      console.error(chalk.red(`\n✗ Dev mode failed\n`));
      console.error(chalk.red((error as Error).message));
      process.exit(1);
    }
  });

