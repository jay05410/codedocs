import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { spawn } from 'child_process';
import { existsSync } from 'fs';
import { resolve } from 'path';
import { loadConfig } from '@codedocs/core';

export const buildCommand = new Command('build')
  .description('Build production-ready documentation site')
  .option('-c, --config <path>', 'Path to config file', 'codedocs.config.ts')
  .option('--skip-analyze', 'Skip analysis step')
  .option('--skip-generate', 'Skip generation step')
  .option('--verbose', 'Show detailed build output')
  .action(async (options) => {
    console.log(chalk.bold.cyan('\n🏗️  Building Documentation\n'));

    try {
      // Load config
      const configPath = resolve(process.cwd(), options.config);
      if (!existsSync(configPath)) {
        console.error(chalk.red(`Configuration file not found: ${options.config}\n`));
        process.exit(1);
      }

      const config = await loadConfig(configPath);
      const outDir = './dist';

      // Step 1: Analyze
      if (!options.skipAnalyze) {
        await runCommand('analyze', ['analyze', '-c', options.config], options.verbose);
      } else {
        console.log(chalk.dim('⊘ Skipping analysis step\n'));
      }

      // Step 2: Generate
      if (!options.skipGenerate) {
        await runCommand('generate', ['generate', '-c', options.config], options.verbose);
      } else {
        console.log(chalk.dim('⊘ Skipping generation step\n'));
      }

      // Step 3: Build with Vite
      console.log(chalk.cyan('Building static site...'));
      await runViteBuild(outDir, options.verbose);

      // Summary
      console.log(chalk.green('\n✓ Build Complete!\n'));
      console.log(chalk.dim(`  Output directory: ${outDir}`));
      console.log(chalk.dim(`  Base URL: /`));
      console.log(chalk.cyan('\nNext steps:'));
      console.log(chalk.dim(`  - Deploy the ${outDir} directory to your hosting service`));
      console.log(chalk.dim('  - Or preview locally with a static file server\n'));
    } catch (error) {
      console.error(chalk.red('\n✗ Build failed\n'));
      console.error(chalk.red((error as Error).message));
      process.exit(1);
    }
  });

async function runCommand(
  name: string,
  args: string[],
  verbose: boolean
): Promise<void> {
  const spinner = ora(`Running ${name}...`).start();

  return new Promise((resolve, reject) => {
    const cmd = spawn('npx', ['codedocs', ...args], {
      stdio: verbose ? 'inherit' : 'pipe',
      shell: true,
    });

    if (!verbose) {
      let output = '';
      cmd.stdout?.on('data', (data) => {
        output += data.toString();
      });
      cmd.stderr?.on('data', (data) => {
        output += data.toString();
      });

      cmd.on('close', (code) => {
        if (code === 0) {
          spinner.succeed(`${name} complete`);
          resolve();
        } else {
          spinner.fail(`${name} failed`);
          if (output) {
            console.error(chalk.red(output));
          }
          reject(new Error(`${name} exited with code ${code}`));
        }
      });
    } else {
      cmd.on('close', (code) => {
        if (code === 0) {
          spinner.succeed(`${name} complete`);
          resolve();
        } else {
          spinner.fail(`${name} failed`);
          reject(new Error(`${name} exited with code ${code}`));
        }
      });
    }

    cmd.on('error', (error) => {
      spinner.fail(`${name} failed`);
      reject(error);
    });
  });
}

async function runViteBuild(outDir: string, verbose: boolean): Promise<void> {
  const spinner = ora('Building with Vite...').start();

  return new Promise((resolve, reject) => {
    const cmd = spawn(
      'npx',
      ['vite', 'build', '--outDir', outDir],
      {
        stdio: verbose ? 'inherit' : 'pipe',
        shell: true,
      }
    );

    if (!verbose) {
      let output = '';
      cmd.stdout?.on('data', (data) => {
        output += data.toString();
      });
      cmd.stderr?.on('data', (data) => {
        output += data.toString();
      });

      cmd.on('close', (code) => {
        if (code === 0) {
          spinner.succeed('Vite build complete');
          resolve();
        } else {
          spinner.fail('Vite build failed');
          if (output) {
            console.error(chalk.red(output));
          }
          reject(new Error(`Vite build exited with code ${code}`));
        }
      });
    } else {
      cmd.on('close', (code) => {
        if (code === 0) {
          spinner.succeed('Vite build complete');
          resolve();
        } else {
          spinner.fail('Vite build failed');
          reject(new Error(`Vite build exited with code ${code}`));
        }
      });
    }

    cmd.on('error', (error) => {
      spinner.fail('Vite build failed');
      reject(error);
    });
  });
}
