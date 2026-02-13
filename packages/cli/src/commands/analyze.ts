import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { loadConfig } from '@codedocs/core';
import { FileReader } from '@codedocs/core';
import { ParserEngine } from '@codedocs/core';
import { getCliStrings, t, initLocale } from '../i18n.js';
import { resolveBuiltinParsers } from '../parser-registry.js';

export const analyzeCommand = new Command('analyze')
  .description('Analyze source code and extract documentation')
  .option('-c, --config <path>', 'Path to config file', 'codedocs.config.ts')
  .option('-o, --output <path>', 'Output path for analysis results', './analysis-result.json')
  .option('--verbose', 'Show detailed analysis information')
  .action(async (options) => {
    const s = getCliStrings().cli;
    const spinner = ora(s.loadingConfig).start();

    try {
      // Load configuration
      const configPath = resolve(process.cwd(), options.config);
      if (!existsSync(configPath)) {
        spinner.fail(s.configNotFound);
        console.error(chalk.red(`\n${options.config}`));
        console.log(chalk.dim(s.runInitFirst + '\n'));
        process.exit(1);
      }

      const config = await loadConfig(configPath);
      initLocale(config.docs?.locale);
      const strings = getCliStrings().cli;

      spinner.text = strings.readingFiles;

      // Read source files
      const fileReader = new FileReader();
      const sourceDir = config.source || './src';
      const patterns = ['**/*.{ts,tsx,js,jsx}'];
      const sourceFiles = await fileReader.readFiles(sourceDir, patterns);

      if (sourceFiles.length === 0) {
        spinner.warn(strings.noFilesFound);
        console.log(chalk.yellow('\n' + strings.checkSourcePath));
        process.exit(0);
      }

      spinner.text = t(strings.analyzingFiles, { n: sourceFiles.length });
      console.log(chalk.dim(`  Found ${sourceFiles.length} files to analyze`));

      // Resolve string parser names to actual parser instances
      const resolvedParsers = await resolveBuiltinParsers(config.parsers as any);
      const parserEngine = new ParserEngine(resolvedParsers);

      // Analyze all files
      const analysisResult = await parserEngine.analyze(sourceFiles);
      const successCount = sourceFiles.length;
      const errorCount = analysisResult.errors?.length || 0;

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
          totalComponents: analysisResult.types?.length || 0,
        },
        results: [analysisResult],
      };

      writeFileSync(outputPath, JSON.stringify(analysisData, null, 2), 'utf-8');

      spinner.succeed(strings.analysisComplete);

      // Print summary
      console.log(chalk.green(`\n✓ ${strings.analysisSummary}\n`));
      console.log(chalk.dim(`  ${t(strings.filesAnalyzed, { success: successCount, total: sourceFiles.length })}`));
      if (errorCount > 0) {
        console.log(chalk.yellow(`  ${t(strings.errors, { n: errorCount })}`));
      }
      console.log(chalk.dim(`  ${t(strings.totalExports, { n: analysisData.summary.totalExports })}`));
      console.log(chalk.dim(`  ${t(strings.totalFunctions, { n: analysisData.summary.totalFunctions })}`));
      console.log(chalk.dim(`  ${t(strings.totalClasses, { n: analysisData.summary.totalClasses })}`));
      console.log(chalk.dim(`  ${t(strings.totalComponents, { n: analysisData.summary.totalComponents })}`));
      console.log(chalk.dim(`\n  ${t(strings.resultsSaved, { path: options.output })}\n`));

      if (errorCount > 0) {
        console.log(chalk.yellow(strings.runVerbose + '\n'));
      }
    } catch (error) {
      spinner.fail(getCliStrings().cli.analysisFailed);
      console.error(chalk.red(`\n${(error as Error).message}\n`));
      if (options.verbose && error instanceof Error && error.stack) {
        console.error(chalk.dim(error.stack));
      }
      process.exit(1);
    }
  });
