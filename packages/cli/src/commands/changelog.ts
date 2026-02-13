import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { compareAnalysisResults } from '@codedocs/core';
import type { AnalysisResult } from '@codedocs/core';

export const changelogCommand = new Command('changelog')
  .description('Compare analysis results and generate changelog')
  .option('-c, --current <path>', 'Path to current analysis result', './analysis-result.json')
  .option('-p, --previous <path>', 'Path to previous analysis result', './analysis-result.prev.json')
  .option('--format <format>', 'Output format (text|json)', 'text')
  .action(async (options) => {
    const spinner = ora('Loading analysis results...').start();

    try {
      // Load current analysis
      const currentPath = resolve(process.cwd(), options.current);
      if (!existsSync(currentPath)) {
        spinner.fail('Current analysis result not found');
        console.error(chalk.red(`\n${options.current}`));
        console.log(chalk.dim('Run "codedocs analyze" first\n'));
        process.exit(1);
      }

      // Load previous analysis
      const previousPath = resolve(process.cwd(), options.previous);
      if (!existsSync(previousPath)) {
        spinner.fail('Previous analysis result not found');
        console.error(chalk.red(`\n${options.previous}`));
        console.log(chalk.dim('No previous analysis to compare\n'));
        process.exit(1);
      }

      spinner.text = 'Comparing analysis results...';

      // Read and parse analysis files
      const currentData = JSON.parse(readFileSync(currentPath, 'utf-8'));
      const previousData = JSON.parse(readFileSync(previousPath, 'utf-8'));

      // Extract AnalysisResult from the wrapper format
      const current: AnalysisResult = currentData.results?.[0] || currentData;
      const previous: AnalysisResult = previousData.results?.[0] || previousData;

      // Compare results
      const changes = compareAnalysisResults(previous, current);

      spinner.succeed('Changelog generated');

      // Output changelog
      if (options.format === 'json') {
        console.log(JSON.stringify(changes, null, 2));
      } else {
        // Text format
        console.log(chalk.bold('\n📋 Changelog\n'));
        console.log(chalk.dim(`From: ${previousData.timestamp || 'unknown'}`));
        console.log(chalk.dim(`To:   ${currentData.timestamp || 'unknown'}\n`));

        if (changes.length === 0) {
          console.log(chalk.green('No changes detected\n'));
          return;
        }

        // Group changes by type
        const added = changes.filter((c) => c.type === 'added');
        const removed = changes.filter((c) => c.type === 'removed');
        const modified = changes.filter((c) => c.type === 'modified');

        // Display added
        if (added.length > 0) {
          console.log(chalk.green.bold(`✓ Added (${added.length})`));
          for (const change of added) {
            console.log(chalk.green(`  + [${change.category}] ${change.name}`));
            if (change.detail) {
              console.log(chalk.dim(`    ${change.detail}`));
            }
          }
          console.log();
        }

        // Display removed
        if (removed.length > 0) {
          console.log(chalk.red.bold(`✗ Removed (${removed.length})`));
          for (const change of removed) {
            console.log(chalk.red(`  - [${change.category}] ${change.name}`));
            if (change.detail) {
              console.log(chalk.dim(`    ${change.detail}`));
            }
          }
          console.log();
        }

        // Display modified
        if (modified.length > 0) {
          console.log(chalk.yellow.bold(`~ Modified (${modified.length})`));
          for (const change of modified) {
            console.log(chalk.yellow(`  ~ [${change.category}] ${change.name}`));
            if (change.detail) {
              console.log(chalk.dim(`    ${change.detail}`));
            }
          }
          console.log();
        }

        // Summary
        console.log(chalk.bold('Summary:'));
        console.log(chalk.dim(`  Total changes: ${changes.length}`));
        console.log(chalk.dim(`  Added: ${added.length}, Removed: ${removed.length}, Modified: ${modified.length}\n`));
      }
    } catch (error) {
      spinner.fail('Changelog generation failed');
      console.error(chalk.red(`\n${(error as Error).message}\n`));
      process.exit(1);
    }
  });
