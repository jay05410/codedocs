import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { readFileSync, existsSync, mkdirSync, writeFileSync, readdirSync, statSync } from 'fs';
import { resolve, join, dirname } from 'path';
import { loadConfig } from '@codedocs/core';
import { MarkdownGenerator } from '@codedocs/core';
import { getCliStrings, t, initLocale } from '../i18n.js';

export const generateCommand = new Command('generate')
  .description('Generate documentation from analysis results')
  .option('-c, --config <path>', 'Path to config file', 'codedocs.config.ts')
  .option('-i, --input <path>', 'Path to analysis results', './analysis-result.json')
  .option('-o, --output <path>', 'Output directory for generated docs')
  .option('--verbose', 'Show detailed generation information')
  .action(async (options) => {
    const s = getCliStrings().cli;
    const spinner = ora(s.loadingConfig).start();

    try {
      // Load configuration
      const configPath = resolve(process.cwd(), options.config);
      if (!existsSync(configPath)) {
        spinner.fail(s.configNotFound);
        console.error(chalk.red(`\n${options.config}\n`));
        process.exit(1);
      }

      const config = await loadConfig(configPath);
      initLocale(config.docs?.locale);
      const strings = getCliStrings().cli;

      // Load analysis results
      spinner.text = strings.loadingAnalysis;
      const analysisPath = resolve(process.cwd(), options.input);
      if (!existsSync(analysisPath)) {
        spinner.fail(strings.analysisNotFound);
        console.error(chalk.red(`\n${options.input}`));
        console.log(chalk.dim(strings.runAnalyzeFirst + '\n'));
        process.exit(1);
      }

      const analysisData = JSON.parse(readFileSync(analysisPath, 'utf-8'));
      const analysisResults = analysisData.results || [];

      if (analysisResults.length === 0) {
        spinner.warn(strings.noResults);
        console.log(chalk.yellow('\n' + strings.noResultsInFile + '\n'));
        process.exit(0);
      }

      // Determine output directory
      const outputDir = options.output || './docs-output';
      const outputPath = resolve(process.cwd(), outputDir);

      spinner.text = strings.creatingOutputDir;
      if (!existsSync(outputPath)) {
        mkdirSync(outputPath, { recursive: true });
      }

      // Create markdown generator config
      const generatorConfig = {
        outputDir: outputDir,
        locale: config.docs.locale,
        sections: config.docs.sections,
        pageOverrides: config.docs.pageOverrides,
      };

      // Create markdown generator
      spinner.text = strings.generatingDocs;
      const generator = new MarkdownGenerator(generatorConfig);

      let generatedCount = 0;
      const generatedFiles: string[] = [];

      // Generate documentation for each analysis result
      for (const result of analysisResults) {
        try {
          const pages = await generator.generate(result);

          for (const page of pages) {
            const filePath = join(outputPath, page.path);
            const fileDir = dirname(filePath);

            if (!existsSync(fileDir)) {
              mkdirSync(fileDir, { recursive: true });
            }

            writeFileSync(filePath, page.content, 'utf-8');
            generatedFiles.push(page.path);
            generatedCount++;

            if (options.verbose) {
              console.log(chalk.dim(`\n  ✓ Generated: ${page.path}`));
            }
          }
        } catch (error) {
          if (options.verbose) {
            console.log(chalk.dim(`\n  ✗ Failed to generate docs for ${result.filePath}`));
            console.log(chalk.red(`    ${(error as Error).message}`));
          }
        }
      }

      // Generate index page
      spinner.text = strings.generatingIndex;
      const indexContent = generateIndexPage(analysisData, generatedFiles);
      writeFileSync(join(outputPath, 'index.md'), indexContent, 'utf-8');
      generatedCount++;

      // Generate API index if there are API docs
      const apiFiles = generatedFiles.filter((f) => f.startsWith('api/'));
      if (apiFiles.length > 0) {
        const apiIndexContent = generateAPIIndex(analysisData, apiFiles);
        const apiDir = join(outputPath, 'api');
        if (!existsSync(apiDir)) {
          mkdirSync(apiDir, { recursive: true });
        }
        writeFileSync(join(apiDir, 'index.md'), apiIndexContent, 'utf-8');
        generatedCount++;
      }

      spinner.succeed(strings.generationComplete);

      // Print summary
      console.log(chalk.green(`\n✓ ${strings.generationSummary}\n`));
      console.log(chalk.dim(`  ${t(strings.totalPages, { n: generatedCount })}`));
      console.log(chalk.dim(`  ${t(strings.outputDirectory, { dir: outputDir })}`));
      console.log(chalk.dim(`  ${t(strings.indexPage, { path: outputDir + '/index.md' })}`));
      if (apiFiles.length > 0) {
        console.log(chalk.dim(`  ${t(strings.apiIndex, { path: outputDir + '/api/index.md' })}`));
      }

      // Calculate total size
      const totalSize = calculateDirectorySize(outputPath);
      console.log(chalk.dim(`  ${t(strings.totalSize, { size: formatBytes(totalSize) })}\n`));

      console.log(chalk.cyan(strings.nextSteps));
      console.log(chalk.dim(`  - ${strings.previewHint}`));
      console.log(chalk.dim(`  - ${strings.buildHint}\n`));
    } catch (error) {
      spinner.fail(getCliStrings().cli.generationFailed);
      console.error(chalk.red(`\n${(error as Error).message}\n`));
      if (options.verbose && error instanceof Error && error.stack) {
        console.error(chalk.dim(error.stack));
      }
      process.exit(1);
    }
  });

function generateIndexPage(analysisData: any, generatedFiles: string[]): string {
  const { config, summary } = analysisData;

  return `# ${config.name || 'Documentation'}

Welcome to the ${config.name || 'project'} documentation.

## Overview

This documentation was automatically generated from source code analysis.

- **Total Files**: ${summary.totalFiles}
- **Total Exports**: ${summary.totalExports}
- **Total Functions**: ${summary.totalFunctions}
- **Total Classes**: ${summary.totalClasses}
- **Language**: ${config.language || 'Auto-detected'}
- **Generated**: ${new Date(analysisData.timestamp).toLocaleString()}

## Quick Links

- [API Documentation](./api/)
- [Guide](./guide/)

## Documentation Files

${generatedFiles
  .map((file) => {
    const name = file.replace(/\.md$/, '').replace(/\//g, ' / ');
    return `- [${name}](./${file})`;
  })
  .join('\n')}

---

*Generated by [CodeDocs](https://github.com/your-org/codedocs) - AI-powered code documentation*
`;
}

function generateAPIIndex(analysisData: any, apiFiles: string[]): string {
  const { config, summary } = analysisData;

  return `# API Reference

Complete API reference for ${config.name || 'this project'}.

## Statistics

- **Functions**: ${summary.totalFunctions}
- **Classes**: ${summary.totalClasses}
- **Exports**: ${summary.totalExports}

## Modules

${apiFiles
  .map((file) => {
    const moduleName = file
      .replace('api/', '')
      .replace(/\.md$/, '')
      .replace(/\//g, ' / ');
    return `- [${moduleName}](./${file.replace('api/', '')})`;
  })
  .join('\n')}

---

[← Back to Home](../index.md)
`;
}

function calculateDirectorySize(dirPath: string): number {
  let totalSize = 0;

  const files = readdirSync(dirPath);
  for (const file of files) {
    const filePath = join(dirPath, file);
    const stats = statSync(filePath);

    if (stats.isDirectory()) {
      totalSize += calculateDirectorySize(filePath);
    } else {
      totalSize += stats.size;
    }
  }

  return totalSize;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}
