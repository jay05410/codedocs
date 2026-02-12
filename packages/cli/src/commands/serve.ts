import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { spawn } from 'child_process';
import { existsSync } from 'fs';
import { resolve } from 'path';
import { loadConfig } from '@codedocs/core';
import { getCliStrings, t, initLocale } from '../i18n.js';

export const serveCommand = new Command('serve')
  .description('Start development server with hot reload')
  .option('-c, --config <path>', 'Path to config file', 'codedocs.config.ts')
  .option('-p, --port <number>', 'Port number', '3000')
  .option('--host <host>', 'Host address', 'localhost')
  .option('--skip-analyze', 'Skip analysis step')
  .option('--skip-generate', 'Skip generation step')
  .option('--open', 'Open browser automatically')
  .action(async (options) => {
    const s = getCliStrings().cli;
    console.log(chalk.bold.cyan(`\n📡 ${s.serverTitle}\n`));

    try {
      // Load config
      const configPath = resolve(process.cwd(), options.config);
      if (!existsSync(configPath)) {
        console.error(chalk.red(`${s.configNotFound}: ${options.config}\n`));
        process.exit(1);
      }

      const config = await loadConfig(configPath);
      initLocale(config.docs?.locale);
      const strings = getCliStrings().cli;

      // Check if docs need to be generated
      const docsDir = './docs-output';
      const docsPath = resolve(process.cwd(), docsDir);
      const needsGeneration = !existsSync(docsPath);

      // Step 1: Analyze if needed
      if (!options.skipAnalyze && needsGeneration) {
        await runAnalyze(options.config, strings);
      }

      // Step 2: Generate if needed
      if (!options.skipGenerate && needsGeneration) {
        await runGenerate(options.config, strings);
      }

      // Step 3: Start Vite dev server
      console.log(chalk.cyan(strings.startingVite + '\n'));
      await startViteServer(options, strings);
    } catch (error) {
      console.error(chalk.red(`\n✗ ${getCliStrings().cli.serverFailed}\n`));
      console.error(chalk.red((error as Error).message));
      process.exit(1);
    }
  });

async function runAnalyze(configPath: string, strings: any): Promise<void> {
  const spinner = ora(strings.analyzingSource).start();

  return new Promise((resolve, reject) => {
    const cmd = spawn(
      'npx',
      ['codedocs', 'analyze', '-c', configPath],
      { stdio: 'pipe', shell: true }
    );

    let output = '';
    cmd.stdout?.on('data', (data) => {
      output += data.toString();
    });
    cmd.stderr?.on('data', (data) => {
      output += data.toString();
    });

    cmd.on('close', (code) => {
      if (code === 0) {
        spinner.succeed(strings.analysisComplete);
        resolve();
      } else {
        spinner.fail(strings.analysisFailed);
        if (output) {
          console.error(chalk.red(output));
        }
        reject(new Error(`Analysis exited with code ${code}`));
      }
    });

    cmd.on('error', (error) => {
      spinner.fail(strings.analysisFailed);
      reject(error);
    });
  });
}

async function runGenerate(configPath: string, strings: any): Promise<void> {
  const spinner = ora(strings.generatingDocumentation).start();

  return new Promise((resolve, reject) => {
    const cmd = spawn(
      'npx',
      ['codedocs', 'generate', '-c', configPath],
      { stdio: 'pipe', shell: true }
    );

    let output = '';
    cmd.stdout?.on('data', (data) => {
      output += data.toString();
    });
    cmd.stderr?.on('data', (data) => {
      output += data.toString();
    });

    cmd.on('close', (code) => {
      if (code === 0) {
        spinner.succeed(strings.generationComplete);
        resolve();
      } else {
        spinner.fail(strings.generationFailed);
        if (output) {
          console.error(chalk.red(output));
        }
        reject(new Error(`Generation exited with code ${code}`));
      }
    });

    cmd.on('error', (error) => {
      spinner.fail(strings.generationFailed);
      reject(error);
    });
  });
}

async function startViteServer(options: any, strings: any): Promise<void> {
  return new Promise((resolve, reject) => {
    const args = ['vite', 'dev'];

    if (options.port) {
      args.push('--port', options.port);
    }

    if (options.host) {
      args.push('--host', options.host);
    }

    if (options.open) {
      args.push('--open');
    }

    const cmd = spawn('npx', args, {
      stdio: 'inherit',
      shell: true,
    });

    // Print server info
    console.log(chalk.green(`✓ ${strings.serverStarted}\n`));
    console.log(chalk.cyan(strings.localServer));
    console.log(chalk.dim(`  http://${options.host || 'localhost'}:${options.port || '3000'}\n`));
    console.log(chalk.dim(strings.pressCtrlC + '\n'));

    cmd.on('error', (error) => {
      reject(error);
    });

    // Handle Ctrl+C
    process.on('SIGINT', () => {
      console.log(chalk.yellow(`\n\n${strings.shuttingDown}`));
      cmd.kill('SIGINT');
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      cmd.kill('SIGTERM');
      process.exit(0);
    });
  });
}
