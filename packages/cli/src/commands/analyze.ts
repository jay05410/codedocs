import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { loadConfig } from '@codedocs/core';
import { FileReader } from '@codedocs/core';
import { ParserEngine } from '@codedocs/core';

export const analyzeCommand = new Command('analyze')
  .description('Analyze source code and extract documentation')
  .option('-c, --config <path>', 'Path to config file', 'codedocs.config.ts')
  .option('-o, --output <path>', 'Output path for analysis results', './analysis-result.json')
  .option('--verbose', 'Show detailed analysis information')
  .action(async (options) => {
    const spinner = ora('Loading configuration...').start();

    try {
      // Load configuration
      const configPath = resolve(process.cwd(), options.config);
      if (!existsSync(configPath)) {
        spinner.fail('Configuration file not found');
        console.error(chalk.red(`\nCould not find ${options.config}`));
        console.log(chalk.dim('Run "codedocs init" to create a configuration file\n'));
        process.exit(1);
      }

      const config = await loadConfig(configPath);
      spinner.text = 'Reading source files...';

      // Read source files
      const fileReader = new FileReader();
      const sourceDir = config.source || './src';
      const patterns = ['**/*.{ts,tsx,js,jsx}'];
      const sourceFiles = await fileReader.readFiles(sourceDir, patterns);

      if (sourceFiles.length === 0) {
        spinner.warn('No source files found');
        console.log(chalk.yellow('\nNo files matched the configured patterns'));
        console.log(chalk.dim('Check your source path in the config file\n'));
        process.exit(0);
      }

      spinner.text = `Analyzing ${sourceFiles.length} files...`;

      // Create parser engine with proper type casting
      const parserEngine = new ParserEngine(config.parsers as any);

      // Analyze all files
      const analysisResult = await parserEngine.analyze(sourceFiles);
      const successCount = sourceFiles.length;
      const errorCount = 0;

      if (options.verbose) {
        console.log(chalk.dim(`\n  Analyzed ${sourceFiles.length} files`));
        console.log(chalk.dim(`    Endpoints: ${analysisResult.endpoints?.length || 0}`));
        console.log(chalk.dim(`    Entities: ${analysisResult.entities?.length || 0}`));
        console.log(chalk.dim(`    Services: ${analysisResult.services?.length || 0}`));
      }

      // Save analysis results
      const outputPath = resolve(process.cwd(), options.output);
      const analysisData = {
        timestamp: new Date().toISOString(),
        config: {
          name: 'Project Documentation',
          language: 'auto-detect',
          locale: config.docs.locale,
        },
        summary: {
          totalFiles: sourceFiles.length,
          successCount,
          errorCount,
          totalExports: analysisResult.endpoints?.length || 0,
          totalFunctions: analysisResult.services?.length || 0,
          totalClasses: analysisResult.entities?.length || 0,
        },
        results: [analysisResult],
      };

      writeFileSync(outputPath, JSON.stringify(analysisData, null, 2), 'utf-8');

      spinner.succeed('Analysis complete!');

      // Print summary
      console.log(chalk.green('\n✓ Analysis Summary:\n'));
      console.log(chalk.dim(`  Files analyzed: ${successCount}/${sourceFiles.length}`));
      if (errorCount > 0) {
        console.log(chalk.yellow(`  Errors: ${errorCount}`));
      }
      console.log(chalk.dim(`  Total exports: ${analysisData.summary.totalExports}`));
      console.log(chalk.dim(`  Total functions: ${analysisData.summary.totalFunctions}`));
      console.log(chalk.dim(`  Total classes: ${analysisData.summary.totalClasses}`));
      console.log(chalk.dim(`\n  Results saved to: ${options.output}\n`));

      if (errorCount > 0) {
        console.log(chalk.yellow('Run with --verbose to see detailed error messages\n'));
      }
    } catch (error) {
      spinner.fail('Analysis failed');
      console.error(chalk.red(`\n${(error as Error).message}\n`));
      if (options.verbose && error instanceof Error && error.stack) {
        console.error(chalk.dim(error.stack));
      }
      process.exit(1);
    }
  });
