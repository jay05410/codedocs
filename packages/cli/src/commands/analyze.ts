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
import { resolveSourcePatterns } from '../utils/source-patterns.js';

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

      // Resolve string parser names to actual parser instances first.
      const { parsers: resolvedParsers, errors: parserErrors } =
        await resolveBuiltinParsers(config.parsers as any);

      // Warn about parser load failures (visible before spinner completes)
      if (parserErrors.length > 0) {
        spinner.stop();
        for (const err of parserErrors) {
          console.error(chalk.yellow(`  ⚠ Parser "${err.name}": ${err.reason}`));
        }
        spinner.start(strings.readingFiles);
      }

      if (resolvedParsers.length === 0) {
        spinner.fail('No parsers loaded');
        console.error(chalk.red('\n  No parsers were loaded. Check your config and installed packages.'));
        if (parserErrors.length > 0) {
          console.error(chalk.yellow('  Failed parsers:'));
          for (const err of parserErrors) {
            console.error(chalk.yellow(`    - ${err.name}: ${err.reason}`));
          }
        }
        console.log('');
        process.exit(1);
      }

      // Read source files based on parser file patterns (multi-language aware).
      const fileReader = new FileReader();
      const sourceDir = config.source || './src';
      const patterns = resolveSourcePatterns(resolvedParsers);
      const sourceFiles = await fileReader.readFiles(sourceDir, patterns);

      if (sourceFiles.length === 0) {
        spinner.warn(strings.noFilesFound);
        console.log(chalk.yellow('\n' + strings.checkSourcePath));
        process.exit(0);
      }

      spinner.text = t(strings.analyzingFiles, { n: sourceFiles.length });
      const parserNames = resolvedParsers.map(p => p.name).join(', ');
      console.log(chalk.dim(`  Found ${sourceFiles.length} files to analyze (parsers: ${parserNames})`));

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
        console.log(chalk.dim(`    Types: ${analysisResult.types?.length || 0}`));
      }

      // Domain-specific counts
      const totalEndpoints = analysisResult.endpoints?.length || 0;
      const totalServices = analysisResult.services?.length || 0;
      const totalEntities = analysisResult.entities?.length || 0;
      const totalTypes = analysisResult.types?.length || 0;

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
          // Domain-specific (primary)
          totalEndpoints,
          totalServices,
          totalEntities,
          totalTypes,
          // Legacy aliases (backward compat with generate.ts)
          totalExports: totalEndpoints,
          totalFunctions: totalServices,
          totalClasses: totalEntities,
          totalComponents: totalTypes,
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
      console.log(chalk.dim(`  Endpoints: ${totalEndpoints}`));
      console.log(chalk.dim(`  Services: ${totalServices}`));
      console.log(chalk.dim(`  Entities: ${totalEntities}`));
      console.log(chalk.dim(`  Types: ${totalTypes}`));
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
