import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { readFileSync, existsSync, mkdirSync, writeFileSync, readdirSync, statSync } from 'fs';
import { resolve, join, dirname } from 'path';
import { loadConfig, getStrings, getLocaleName, AI_DEFAULTS, type Locale, type I18nStrings, type SectionConfig } from '@codedocs/core';
import { MarkdownGenerator, SidebarGenerator } from '@codedocs/core';
import { createAiProvider, groupByDomain, groupByHeuristic, groupComponentsByHeuristic, ExampleGenerator, formatExampleAsMarkdown, getPrompt, fillTemplate } from '@codedocs/core';
import type { AiProvider, GeneratedPage, GeneratedExample, DomainGroup, SidebarItem } from '@codedocs/core';
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

      // Initialize AI provider if configured
      let aiProvider: AiProvider | null = null;
      const aiFeatures = {
        domainGrouping: true,
        flowDiagrams: true,
        codeExplanation: true,
        releaseNoteAnalysis: true,
        ...config.ai?.features,
      };
      if (config.ai?.provider && config.ai?.model) {
        try {
          aiProvider = createAiProvider({
            provider: config.ai.provider as any,
            model: config.ai.model,
            apiKey: config.ai.apiKey,
            baseUrl: config.ai.baseUrl,
            auth: config.ai.auth,
            mcp: config.ai.mcp,
            timeout: config.ai.timeout,
          });
          if (options.verbose) {
            console.log(chalk.dim(`\n  AI: ${config.ai.provider} / ${config.ai.model}`));
          }
        } catch (error) {
          if (options.verbose) {
            console.log(chalk.yellow(`\n  AI provider failed: ${(error as Error).message}`));
          }
        }
      }

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

      // Create markdown generator config (use effective sections for page generation)
      const pageGenSections = buildEffectiveSections(config.docs?.sections || [], analysisData);
      const generatorConfig = {
        outputDir: outputDir,
        locale: config.docs.locale,
        sections: pageGenSections,
        pageOverrides: config.docs.pageOverrides,
      };

      // Create markdown generator
      spinner.text = strings.generatingDocs;
      const generator = new MarkdownGenerator(generatorConfig);

      let generatedCount = 0;
      const generatedFiles: string[] = [];
      const allPages: GeneratedPage[] = [];

      // Step 1: Generate all pages (static)
      for (let i = 0; i < analysisResults.length; i++) {
        const result = analysisResults[i];
        spinner.text = `${strings.generatingDocs} (${i + 1}/${analysisResults.length})`;
        try {
          const pages = await generator.generate(result);
          allPages.push(...pages);
        } catch (error) {
          if (options.verbose) {
            console.log(chalk.dim(`\n  ✗ Failed: ${(error as Error).message}`));
          }
        }
      }

      // Deduplicate pages by path (keep last occurrence which has most data)
      const pageMap = new Map<string, GeneratedPage>();
      for (const page of allPages) {
        pageMap.set(page.path, page);
      }
      allPages.length = 0;
      allPages.push(...pageMap.values());

      // Step 2: AI enrichment (optional, based on feature flags)
      const mergedAnalysis = mergeAnalysisResults(analysisResults);
      if (aiProvider) {
        await enrichWithAI(aiProvider, allPages, mergedAnalysis, config, spinner, options);
      }

      // Step 3: Write all pages
      for (const page of allPages) {
        const filePath = join(outputPath, page.path);
        const fileDir = dirname(filePath);
        if (!existsSync(fileDir)) {
          mkdirSync(fileDir, { recursive: true });
        }
        writeFileSync(filePath, page.content, 'utf-8');
        generatedFiles.push(page.path);
        generatedCount++;
        if (options.verbose) {
          console.log(chalk.dim(`\n  ✓ ${page.path}`));
        }
      }

      // Generate index page
      spinner.text = strings.generatingIndex;
      const i18n = getStrings(config.docs?.locale as Locale);
      const indexContent = generateIndexPage(analysisData, generatedFiles, i18n);
      writeFileSync(join(outputPath, 'index.md'), indexContent, 'utf-8');
      generatedCount++;

      // Generate API index if there are API docs
      const apiFiles = generatedFiles.filter((f) => f.startsWith('api/'));
      if (apiFiles.length > 0) {
        const apiIndexContent = generateAPIIndex(analysisData, apiFiles, i18n);
        const apiDir = join(outputPath, 'api');
        if (!existsSync(apiDir)) {
          mkdirSync(apiDir, { recursive: true });
        }
        writeFileSync(join(apiDir, 'index.md'), apiIndexContent, 'utf-8');
        generatedCount++;
      }

      // Generate component index if there are component docs (skip if consolidated index already exists)
      const componentFiles = generatedFiles.filter((f) => f.startsWith('components/'));
      if (componentFiles.length > 0 && !componentFiles.includes('components/index.md')) {
        const compIndexContent = generateSectionIndex(
          i18n.overview.components,
          componentFiles,
          'components/',
          i18n,
        );
        const compDir = join(outputPath, 'components');
        if (!existsSync(compDir)) {
          mkdirSync(compDir, { recursive: true });
        }
        writeFileSync(join(compDir, 'index.md'), compIndexContent, 'utf-8');
        generatedCount++;
      }

      // Generate hooks index if there are hook/service docs (skip if consolidated index already exists)
      const hookFiles = generatedFiles.filter((f) => f.startsWith('hooks/'));
      if (hookFiles.length > 0 && !hookFiles.includes('hooks/index.md')) {
        const hookIndexContent = generateSectionIndex(
          i18n.overview.hooksAndServices,
          hookFiles,
          'hooks/',
          i18n,
        );
        const hookDir = join(outputPath, 'hooks');
        if (!existsSync(hookDir)) {
          mkdirSync(hookDir, { recursive: true });
        }
        writeFileSync(join(hookDir, 'index.md'), hookIndexContent, 'utf-8');
        generatedCount++;
      }

      // Generate memo management page
      const memoContent = `# ${i18n.memoPage?.title || 'Memo Manager'}\n\n${i18n.memoPage?.description || ''}\n`;
      writeFileSync(join(outputPath, 'memo.md'), memoContent, 'utf-8');
      generatedCount++;

      // Generate _sidebar.json with domain grouping (AI or heuristic)
      spinner.text = 'Building sidebar...';
      const sidebarItems = await buildDomainSidebar(
        aiProvider, aiFeatures, mergedAnalysis, allPages, config, analysisData, options
      );
      writeFileSync(join(outputPath, '_sidebar.json'), JSON.stringify(sidebarItems, null, 2), 'utf-8');

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

function generateIndexPage(analysisData: any, generatedFiles: string[], s: I18nStrings): string {
  const { config, summary } = analysisData;
  const projectName = config.name || 'project';
  const welcome = s.common.welcome.replace('{name}', projectName);

  // Group files by category for organized navigation
  const apiFiles = generatedFiles.filter(f => f.startsWith('api/'));
  const entityFiles = generatedFiles.filter(f => f.startsWith('entities/'));
  const componentFiles = generatedFiles.filter(f => f.startsWith('components/'));
  const hookFiles = generatedFiles.filter(f => f.startsWith('hooks/'));
  const otherFiles = generatedFiles.filter(f =>
    !f.startsWith('api/') && !f.startsWith('entities/')
    && !f.startsWith('components/') && !f.startsWith('hooks/')
  );

  let sections = '';

  if (otherFiles.length > 0) {
    sections += otherFiles
      .map((file) => {
        const name = file.replace(/\.md$/, '').replace(/\//g, ' / ');
        return `- [${name}](./${file})`;
      })
      .join('\n');
    sections += '\n';
  }

  if (apiFiles.length > 0) {
    sections += `\n### ${s.common.api}\n\n`;
    sections += apiFiles
      .map((file) => {
        const name = file.replace('api/', '').replace(/\.md$/, '');
        return `- [${name}](./${file})`;
      })
      .join('\n');
    sections += '\n';
  }

  if (entityFiles.length > 0) {
    sections += `\n### ${s.common.dataModels}\n\n`;
    sections += entityFiles
      .map((file) => {
        const name = file.replace('entities/', '').replace(/\.md$/, '');
        return `- [${name}](./${file})`;
      })
      .join('\n');
    sections += '\n';
  }

  if (componentFiles.length > 0) {
    sections += `\n### ${s.overview.components}\n\n`;
    sections += componentFiles
      .map((file) => {
        const name = file.replace('components/', '').replace(/\.md$/, '');
        return `- [${name}](./${file})`;
      })
      .join('\n');
    sections += '\n';
  }

  if (hookFiles.length > 0) {
    sections += `\n### ${s.overview.hooksAndServices}\n\n`;
    sections += hookFiles
      .map((file) => {
        const name = file.replace('hooks/', '').replace(/\.md$/, '');
        return `- [${name}](./${file})`;
      })
      .join('\n');
    sections += '\n';
  }

  return `# ${config.name || s.common.documentation}

${welcome}

## ${s.common.overview}

${s.common.autoGenerated}

- **${s.overview.totalFiles}**: ${summary.totalFiles}
- **${s.common.exports}**: ${summary.totalExports}
- **${s.common.functions}**: ${summary.totalFunctions}
- **${s.common.classes}**: ${summary.totalClasses}
- **Language**: ${config.language || 'Auto-detected'}
- **Generated**: ${new Date(analysisData.timestamp).toLocaleString()}

## ${s.overview.quickLinks}

${sections}
---

*${s.common.generatedBy}*
`;
}

function generateAPIIndex(analysisData: any, apiFiles: string[], s: I18nStrings): string {
  const { config, summary } = analysisData;
  const projectName = config.name || 'this project';
  const completeRef = s.common.completeApiReference.replace('{name}', projectName);

  return `# ${s.common.apiReference}

${completeRef}

## ${s.overview.statistics}

- **${s.common.functions}**: ${summary.totalFunctions}
- **${s.common.classes}**: ${summary.totalClasses}
- **${s.common.exports}**: ${summary.totalExports}

## ${s.common.modules}

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

[← ${s.common.backToHome}](../index.md)
`;
}

/**
 * Generate a section index page for components, hooks, etc.
 */
function generateSectionIndex(
  title: string,
  files: string[],
  prefix: string,
  s: I18nStrings,
): string {
  const items = files
    .map((file) => {
      const name = file.replace(prefix, '').replace(/\.md$/, '');
      return `- [${name}](./${file.replace(prefix, '')})`;
    })
    .join('\n');

  return `# ${title}

${items}

---

[← ${s.common.backToHome}](../index.md)
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

/**
 * Build effective sections by auto-detecting from analysis data
 * when the config only has a generic 'auto' section.
 */
function buildEffectiveSections(configSections: SectionConfig[], analysisData: any): SectionConfig[] {
  // If user explicitly configured multiple sections, respect that
  const hasExplicitSections = configSections.length > 1
    || (configSections.length === 1 && configSections[0].type !== 'auto');
  if (hasExplicitSections) return configSections;

  // Auto-detect sections from analysis results
  const sections: SectionConfig[] = [];
  const results = analysisData.results || [];
  const summary = analysisData.summary || {};

  // Overview is generated unconditionally by MarkdownGenerator.generate().
  // Use 'custom' (no dir) so the switch case produces no pages, avoiding duplication.
  sections.push({ id: 'overview', label: 'Overview', type: 'custom' });

  // Add endpoints section if any endpoints found
  if (summary.endpoints > 0 || results.some((r: any) => r.endpoints?.length > 0)) {
    sections.push({ id: 'api', label: 'API', type: 'endpoints' });
  }

  // Add entities section if any entities found
  if (summary.entities > 0 || results.some((r: any) => r.entities?.length > 0)) {
    sections.push({ id: 'entities', label: 'Data Models', type: 'entities' });
  }

  // Add components section if UI components found (React/Vue/Svelte types)
  const hasComponents = results.some((r: any) =>
    Array.isArray(r.types) && r.types.some((t: any) =>
      typeof t.name === 'string'
      && /^[A-Z]/.test(t.name)
      && !/Props$|DTO$|Dto$|Request$|Response$|Input$|Args$/.test(t.name)
      && t.kind && !['enum', 'dto', 'input', 'response'].includes(t.kind)
    )
  );
  if (hasComponents) {
    sections.push({ id: 'components', label: 'Components', type: 'components' });
  }

  // Add services/hooks section if any found
  if (summary.services > 0 || results.some((r: any) => r.services?.length > 0)) {
    sections.push({ id: 'hooks', label: 'Hooks & Services', type: 'services' });
  }

  // Always add architecture (shows dependency graph)
  sections.push({ id: 'architecture', label: 'Architecture', type: 'architecture' });

  // Always add changelog
  sections.push({ id: 'changelog', label: 'Changelog', type: 'changelog' });

  return sections;
}

// ── AI Enrichment ──

/**
 * Merge multiple AnalysisResult objects into one combined result
 */
function mergeAnalysisResults(results: any[]): any {
  const merged: any = {
    endpoints: [],
    entities: [],
    services: [],
    types: [],
    dependencies: [],
  };
  for (const r of results) {
    if (r.endpoints) merged.endpoints.push(...r.endpoints);
    if (r.entities) merged.entities.push(...r.entities);
    if (r.services) merged.services.push(...r.services);
    if (r.types) merged.types.push(...r.types);
    if (r.dependencies) merged.dependencies.push(...r.dependencies);
  }
  return merged;
}

/**
 * Enrich generated pages with AI-generated content.
 * Uses English prompts for token optimization, locale instruction for response language.
 */
async function enrichWithAI(
  provider: AiProvider,
  pages: GeneratedPage[],
  analysis: any,
  config: any,
  spinner: ReturnType<typeof import('ora').default>,
  options: { verbose?: boolean },
): Promise<void> {
  const features = {
    domainGrouping: true,
    flowDiagrams: true,
    codeExplanation: true,
    releaseNoteAnalysis: true,
    ...config.ai?.features,
  };
  const locale = (config.docs?.locale || 'en') as string;
  const localeInstr = locale !== 'en'
    ? `\nIMPORTANT: Write all text content in ${getLocaleName(locale as Locale)}.`
    : '';

  // 1. Example generation for API endpoints (requires explicit opt-in)
  if (features.codeExplanation) {
    const endpoints = analysis.endpoints || [];
    if (endpoints.length > 0) {
      const maxEx = Math.min(endpoints.length, AI_DEFAULTS.maxExampleEndpoints);
      spinner.text = `Generating API examples (${maxEx} endpoints)...`;
      try {
        const exampleGen = new ExampleGenerator(provider, {
          locale: 'en' as any,  // English prompts for token optimization; response is JSON (language-neutral)
          maxExamples: maxEx,
        });
        const examples = await exampleGen.generateAll(
          endpoints,
          analysis.types || [],
          analysis.entities || [],
        );

        // Group examples by handlerClass to match page structure
        const examplesByClass = new Map<string, GeneratedExample[]>();
        for (const ex of examples) {
          const ep = endpoints.find((e: any) => e.name === ex.endpointName);
          const cls = ep?.handlerClass || 'misc';
          if (!examplesByClass.has(cls)) examplesByClass.set(cls, []);
          examplesByClass.get(cls)!.push(ex);
        }

        // Append examples section to each API page
        for (const page of pages.filter(p => p.path.startsWith('api/'))) {
          const exs = examplesByClass.get(page.title) || [];
          if (exs.length > 0) {
            let section = '\n\n---\n\n## Examples\n\n';
            for (const ex of exs) {
              section += `### ${ex.endpointName}\n\n`;
              section += formatExampleAsMarkdown(ex);
              section += '\n';
            }
            page.content += section;
          }
        }

        if (options.verbose) {
          console.log(chalk.dim(`\n  ✓ Generated ${examples.length} API examples`));
        }
      } catch (error) {
        if (options.verbose) {
          console.log(chalk.yellow(`\n  Example generation skipped: ${(error as Error).message}`));
        }
      }
    }
  }

  // 2. Component description enrichment via AI
  if (features.codeExplanation) {
    const componentPages = pages.filter(p => p.path.startsWith('components/'));
    if (componentPages.length > 0) {
      const maxComp = Math.min(componentPages.length, AI_DEFAULTS.maxComponentDescriptions);
      spinner.text = `Generating component descriptions (${maxComp})...`;
      try {
        const promptTpl = getPrompt('componentDescription', 'en');
        let enriched = 0;

        for (const page of componentPages.slice(0, maxComp)) {
          const compName = page.title;
          const compType = (analysis.types || []).find((t: any) => t.name === compName);
          if (!compType) continue;

          const propsStr = compType.fields
            .map((f: any) => `${f.name}: ${f.type}${f.required ? ' (required)' : ''}`)
            .join(', ') || '(none)';

          const userMsg = fillTemplate(promptTpl.user, {
            name: compName,
            props: propsStr,
            hooks: '(detected from source)',
            filePath: compType.filePath,
          });

          const description = await provider.chat([
            { role: 'system', content: promptTpl.system + localeInstr },
            { role: 'user', content: userMsg },
          ]);

          if (description && description.trim().length > 10) {
            // Insert description after the H1 title
            page.content = page.content.replace(
              /^(# .+\n\n)/m,
              `$1${description.trim()}\n\n`
            );
            enriched++;
          }
        }

        if (options.verbose) {
          console.log(chalk.dim(`\n  ✓ Enriched ${enriched} component descriptions`));
        }
      } catch (error) {
        if (options.verbose) {
          console.log(chalk.yellow(`\n  Component enrichment skipped: ${(error as Error).message}`));
        }
      }
    }
  }

  // 3. Service/hook description enrichment via AI
  if (features.codeExplanation) {
    const servicePages = pages.filter(p => p.path.startsWith('hooks/'));
    if (servicePages.length > 0 && (analysis.services || []).length > 0) {
      const maxSvc = Math.min((analysis.services || []).length, AI_DEFAULTS.maxComponentDescriptions);
      spinner.text = `Generating service/hook descriptions (${maxSvc})...`;
      try {
        let enriched = 0;

        for (const svc of (analysis.services || []).slice(0, maxSvc)) {
          const methodsList = svc.methods.join(', ') || '(none)';
          const depsList = svc.dependencies.join(', ') || '(none)';

          const userMsg = `Describe this service/hook concisely for developer documentation:
Name: ${svc.name}
Methods: ${methodsList}
Dependencies: ${depsList}
File: ${svc.filePath}

Write 2-3 sentences describing what this service/hook does, its role in the application, and key usage patterns. Be specific and technical.`;

          const description = await provider.chat([
            { role: 'system', content: 'You are a technical documentation writer. Write concise, accurate descriptions for code documentation.' + localeInstr },
            { role: 'user', content: userMsg },
          ]);

          if (description && description.trim().length > 10) {
            // Find and update the service accordion in hook pages
            for (const page of servicePages) {
              const marker = `<details class="service-accordion`;
              const svcMarker = `id="svc-${svc.name.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase()}"`;
              if (page.content.includes(svcMarker)) {
                // Insert description after the summary closing tag
                const summaryEnd = '</summary>\n\n';
                const idx = page.content.indexOf(svcMarker);
                if (idx >= 0) {
                  const afterIdx = page.content.indexOf(summaryEnd, idx);
                  if (afterIdx >= 0) {
                    const insertPos = afterIdx + summaryEnd.length;
                    page.content = page.content.slice(0, insertPos) + description.trim() + '\n\n' + page.content.slice(insertPos);
                    enriched++;
                  }
                }
              }
            }
          }
        }

        if (options.verbose) {
          console.log(chalk.dim(`\n  ✓ Enriched ${enriched} service/hook descriptions`));
        }
      } catch (error) {
        if (options.verbose) {
          console.log(chalk.yellow(`\n  Service enrichment skipped: ${(error as Error).message}`));
        }
      }
    }
  }

  // 4. Enhanced architecture diagram via AI
  if (features.flowDiagrams) {
    const archPage = pages.find(p => p.path === 'architecture.md');
    if (archPage && (analysis.services?.length > 0 || analysis.dependencies?.length > 0)) {
      spinner.text = 'Generating architecture diagram (AI)...';
      try {
        const services = (analysis.services || []).map((s: any) =>
          `${s.name} → [${s.dependencies.join(', ')}]`
        ).join('\n');

        // Use English prompt for token optimization
        const promptTpl = getPrompt('flowDiagram', 'en');
        const userMsg = fillTemplate(promptTpl.user, {
          endpoint: `System overview (${(analysis.services || []).length} services)`,
          handler: (analysis.services || []).map((s: any) => s.name).join(', '),
          service: services || '(none)',
          dependencies: (analysis.dependencies || []).map((d: any) =>
            `${d.source} → ${d.target} (${d.type})`
          ).join('\n') || '(none)',
        });

        const diagram = await provider.chat([
          { role: 'system', content: promptTpl.system + localeInstr },
          { role: 'user', content: userMsg },
        ]);

        // Validate and append diagram
        if (diagram && diagram.includes('flowchart')) {
          const cleaned = diagram.replace(/```mermaid\n?/g, '').replace(/```\n?/g, '').trim();
          archPage.content += `\n\n## System Flow\n\n\`\`\`mermaid\n${cleaned}\n\`\`\`\n`;
        }

        if (options.verbose) {
          console.log(chalk.dim(`\n  ✓ Generated architecture flow diagram`));
        }
      } catch (error) {
        if (options.verbose) {
          console.log(chalk.yellow(`\n  Diagram generation skipped: ${(error as Error).message}`));
        }
      }
    }
  }
}

// ── Domain-Aware Sidebar Builder ──

/**
 * Build sidebar using AI domain grouping or heuristic fallback.
 * Falls back to SidebarGenerator with static sections when no grouping available.
 */
async function buildDomainSidebar(
  aiProvider: AiProvider | null,
  aiFeatures: any,
  analysis: any,
  pages: GeneratedPage[],
  config: any,
  analysisData: any,
  options: { verbose?: boolean },
): Promise<SidebarItem[]> {
  const endpoints = analysis.endpoints || [];
  const entities = analysis.entities || [];

  // Respect explicit user-configured sections
  const configSections = config.docs?.sections || [];
  const hasExplicitSections = configSections.length > 1
    || (configSections.length === 1 && configSections[0].type !== 'auto');

  // Try domain grouping when applicable
  let groups: DomainGroup[] = [];
  let useDomainSidebar = false;
  const types = analysis.types || [];
  const services = analysis.services || [];

  const hasBackendData = endpoints.length > 0 || entities.length > 0;
  const hasFrontendData = types.length > 0 || services.length > 0;

  if (!hasExplicitSections && (hasBackendData || hasFrontendData)) {
    // AI domain grouping (for backend endpoints/entities)
    if (hasBackendData && aiFeatures?.domainGrouping && aiProvider) {
      try {
        const result = await groupByDomain(aiProvider, endpoints, entities, {
          locale: 'en',  // English prompts for token optimization
          maxGroups: AI_DEFAULTS.maxDomainGroups,
          minGroupSize: AI_DEFAULTS.minGroupSize,
        });
        groups = result.groups;
        useDomainSidebar = groups.length > 0;
        if (options.verbose) {
          console.log(chalk.dim(`\n  ✓ AI domain grouping: ${groups.length} domains`));
        }
      } catch (error) {
        if (options.verbose) {
          console.log(chalk.yellow(`\n  Domain grouping failed, using heuristic: ${(error as Error).message}`));
        }
      }
    }

    // Heuristic fallback for backend
    if (!useDomainSidebar && hasBackendData) {
      const result = groupByHeuristic(endpoints, entities);
      groups = result.groups;
      useDomainSidebar = groups.length > 0;
    }

    // Heuristic grouping for frontend components/services
    if (hasFrontendData) {
      const frontendGroups = groupComponentsByHeuristic(types, services);
      if (frontendGroups.length > 0) {
        groups = [...groups, ...frontendGroups];
        useDomainSidebar = true;
      }
    }
  }

  if (useDomainSidebar) {
    return buildSidebarFromGroups(groups, pages, analysis);
  }

  // Final fallback: SidebarGenerator with static sections
  const effectiveSections = buildEffectiveSections(configSections, analysisData);
  const sidebarGenerator = new SidebarGenerator();
  return sidebarGenerator.generate(pages, effectiveSections);
}

/**
 * Build sidebar items from domain groups, mapping endpoints/entities to pages.
 */
function buildSidebarFromGroups(
  groups: DomainGroup[],
  pages: GeneratedPage[],
  analysis: any,
): SidebarItem[] {
  const sidebar: SidebarItem[] = [];
  const endpoints = analysis.endpoints || [];
  const usedPageIds = new Set<string>();

  // Overview first
  const overviewPage = pages.find(p => p.path === 'overview.md');
  if (overviewPage) {
    sidebar.push({ type: 'doc', label: overviewPage.title, id: 'overview', position: 0 });
    usedPageIds.add('overview');
  }

  // Domain groups
  let position = 10;
  for (const group of groups) {
    const items: SidebarItem[] = [];

    // Match endpoints in this group to API pages
    for (const epName of group.endpoints) {
      const ep = endpoints.find((e: any) => e.name === epName);
      if (!ep) continue;
      const cls = ep.handlerClass || 'misc';
      const pageId = `api/${toKebabCase(cls)}`;
      if (usedPageIds.has(pageId)) continue;
      const page = pages.find(p => p.path === `${pageId}.md`);
      if (page) {
        items.push({ type: 'doc', label: page.title, id: pageId });
        usedPageIds.add(pageId);
      }
    }

    // Match entities in this group to entity pages
    for (const entName of group.entities) {
      const pageId = `entities/${toKebabCase(entName)}`;
      if (usedPageIds.has(pageId)) continue;
      const page = pages.find(p => p.path === `${pageId}.md`);
      if (page) {
        items.push({ type: 'doc', label: page.title, id: pageId });
        usedPageIds.add(pageId);
      }
    }

    // Match components in this group to component pages
    for (const compName of (group.components || [])) {
      const pageId = `components/${toKebabCase(compName)}`;
      if (usedPageIds.has(pageId)) continue;
      const page = pages.find(p => p.path === `${pageId}.md`);
      if (page) {
        items.push({ type: 'doc', label: page.title, id: pageId });
        usedPageIds.add(pageId);
      }
    }

    // Match services/hooks in this group to hook pages
    for (const svcName of (group.services || [])) {
      const pageId = `hooks/${toKebabCase(svcName)}`;
      if (usedPageIds.has(pageId)) continue;
      const page = pages.find(p => p.path === `${pageId}.md`);
      if (page) {
        items.push({ type: 'doc', label: page.title, id: pageId });
        usedPageIds.add(pageId);
      }
    }

    if (items.length > 0) {
      sidebar.push({ type: 'category', label: group.name, items, position });
      position += 10;
    }
  }

  // Add consolidated index pages as top-level nav items
  const componentIndex = pages.find(p => p.path === 'components/index.md');
  if (componentIndex && !usedPageIds.has('components/index')) {
    sidebar.push({ type: 'doc', label: componentIndex.title, id: 'components/index', position: 200 });
    usedPageIds.add('components/index');
  }

  const hookIndex = pages.find(p => p.path === 'hooks/index.md');
  if (hookIndex && !usedPageIds.has('hooks/index')) {
    sidebar.push({ type: 'doc', label: hookIndex.title, id: 'hooks/index', position: 300 });
    usedPageIds.add('hooks/index');
  }

  // Collect ungrouped pages
  const ungroupedItems: SidebarItem[] = [];
  for (const page of pages) {
    const pageId = page.path.replace(/\.md$/, '');
    if (usedPageIds.has(pageId)) continue;
    if (page.path === 'architecture.md' || page.path === 'changelog.md') continue;
    ungroupedItems.push({ type: 'doc', label: page.title, id: pageId });
    usedPageIds.add(pageId);
  }
  if (ungroupedItems.length > 0) {
    sidebar.push({ type: 'category', label: 'Other', items: ungroupedItems, position: 500 });
  }

  // Architecture
  const archPage = pages.find(p => p.path === 'architecture.md');
  if (archPage) {
    sidebar.push({ type: 'doc', label: archPage.title, id: 'architecture', position: 1000 });
  }

  // Changelog
  const clPage = pages.find(p => p.path === 'changelog.md');
  if (clPage) {
    sidebar.push({ type: 'doc', label: clPage.title, id: 'changelog', position: 9999 });
  }

  return sidebar.sort((a, b) => (a.position || 999) - (b.position || 999));
}

/**
 * Convert CamelCase/PascalCase to kebab-case
 */
function toKebabCase(name: string): string {
  return name
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase();
}
