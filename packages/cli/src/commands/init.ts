import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve, join, basename } from 'path';
import { detectStack, formatDetectionResult } from '../detect.js';
import type { DetectedStack, SuggestedParser } from '../detect.js';
import { getCliStrings, t, initLocale } from '../i18n.js';

interface InitAnswers {
  projectName: string;
  sourcePath: string;
  language: string;
  parsers: string[];
  aiProvider: 'openai' | 'claude' | 'gemini' | 'ollama' | 'none';
  aiModel?: string;
  apiKey?: string;
  locale: 'ko' | 'en' | 'ja' | 'zh';
  deployTarget: 'github-pages' | 'gitlab-pages' | 'nginx' | 'local';
  generateCI: boolean;
}

export const initCommand = new Command('init')
  .description('Initialize a new CodeDocs project')
  .option('-y, --yes', 'Skip prompts and use defaults')
  .option('-d, --detect', 'Auto-detect stack and skip prompts')
  .option('-s, --source <path>', 'Target source directory to analyze')
  .action(async (options) => {
    const s = getCliStrings().cli;
    console.log(chalk.bold.cyan(`\n📚 ${s.initTitle}\n`));

    // Auto-detect stack
    const targetDir = options.source ? resolve(options.source) : process.cwd();
    const detectSpinner = ora(s.detectingStack).start();
    let detected: DetectedStack;

    try {
      detected = await detectStack(targetDir);
      detectSpinner.succeed(s.stackDetected);

      console.log(chalk.dim('\n' + formatDetectionResult(detected) + '\n'));
    } catch {
      detectSpinner.warn(s.stackDetectFailed);
      detected = { languages: [], frameworks: [], orms: [], buildTools: [], suggestedParsers: [], sourcePath: './src' };
    }

    let answers: InitAnswers;

    if (options.yes || options.detect) {
      answers = getDefaultAnswers(detected);
    } else {
      // Build parser choices from detection
      const parserChoices = detected.suggestedParsers.map((p) => ({
        name: `${p.package} (auto-detected)`,
        value: p.package,
        checked: true,
      }));

      // Add undetected parsers as unchecked options
      const allParsers = [
        { pkg: '@codedocs/parser-kotlin-spring', label: 'Kotlin + Spring Boot' },
        { pkg: '@codedocs/parser-java-spring', label: 'Java + Spring Boot' },
        { pkg: '@codedocs/parser-typescript-nestjs', label: 'TypeScript + NestJS' },
        { pkg: '@codedocs/parser-python-fastapi', label: 'Python + FastAPI' },
        { pkg: '@codedocs/parser-openapi', label: 'OpenAPI / Swagger' },
      ];
      const detectedPkgs = new Set(detected.suggestedParsers.map((p) => p.package));
      for (const parser of allParsers) {
        if (!detectedPkgs.has(parser.pkg)) {
          parserChoices.push({ name: parser.label, value: parser.pkg, checked: false });
        }
      }

      const primaryLang = detected.languages[0]?.name || 'Auto-detect';

      answers = (await inquirer.prompt([
        {
          type: 'input',
          name: 'projectName',
          message: s.projectName,
          default: basename(targetDir) || 'my-docs',
          validate: (input: string) => input.length > 0 || s.projectNameRequired,
        },
        {
          type: 'input',
          name: 'sourcePath',
          message: s.sourceCodePath,
          default: detected.sourcePath || './src',
        },
        {
          type: 'list',
          name: 'language',
          message: `${s.primaryLanguage} ${primaryLang !== 'Auto-detect' ? chalk.dim(`(detected: ${primaryLang})`) : ''}`,
          choices: [
            'TypeScript',
            'JavaScript',
            'Kotlin',
            'Java',
            'Python',
            'Go',
            'Rust',
            'Auto-detect',
          ],
          default: primaryLang,
        },
        {
          type: 'checkbox',
          name: 'parsers',
          message: s.selectParsers,
          choices: parserChoices,
          when: () => parserChoices.length > 0,
        },
        {
          type: 'list',
          name: 'aiProvider',
          message: s.aiProvider,
          choices: [
            { name: 'OpenAI (GPT-4, GPT-3.5)', value: 'openai' },
            { name: 'Anthropic Claude', value: 'claude' },
            { name: 'Google Gemini', value: 'gemini' },
            { name: 'Ollama (local)', value: 'ollama' },
            { name: 'None (basic extraction only)', value: 'none' },
          ],
          default: 'openai',
        },
        {
          type: 'input',
          name: 'aiModel',
          message: s.aiModel,
          when: (ans: any) => ans.aiProvider !== 'none',
          default: (ans: any) => {
            switch (ans.aiProvider) {
              case 'openai':
                return 'gpt-4-turbo-preview';
              case 'claude':
                return 'claude-3-opus-20240229';
              case 'gemini':
                return 'gemini-pro';
              case 'ollama':
                return 'llama2';
              default:
                return '';
            }
          },
        },
        {
          type: 'password',
          name: 'apiKey',
          message: s.apiKeyPrompt,
          when: (ans: any) => ans.aiProvider !== 'none' && ans.aiProvider !== 'ollama',
        },
        {
          type: 'list',
          name: 'locale',
          message: s.docLanguage,
          choices: [
            { name: 'Korean (한국어)', value: 'ko' },
            { name: 'English', value: 'en' },
            { name: 'Japanese (日本語)', value: 'ja' },
            { name: 'Chinese (中文)', value: 'zh' },
          ],
          default: 'ko',
        },
        {
          type: 'list',
          name: 'deployTarget',
          message: s.deployTarget,
          choices: [
            { name: 'GitHub Pages', value: 'github-pages' },
            { name: 'GitLab Pages', value: 'gitlab-pages' },
            { name: 'Nginx/Apache', value: 'nginx' },
            { name: 'Local only', value: 'local' },
          ],
          default: 'github-pages',
        },
        {
          type: 'confirm',
          name: 'generateCI',
          message: s.generateCI,
          when: (ans: any) => ans.deployTarget !== 'local',
          default: true,
        },
      ] as any)) as InitAnswers;

      // If parsers weren't asked (no choices), use detected
      if (!answers.parsers) {
        answers.parsers = detected.suggestedParsers.map((p) => p.package);
      }
    }

    // After getting locale from answers, re-init locale
    initLocale(answers.locale);
    const strings = getCliStrings().cli;

    const spinner = ora(strings.generatingConfig).start();

    try {
      // Generate config file
      const configPath = resolve(process.cwd(), 'codedocs.config.ts');
      const configContent = generateConfigFile(answers, detected);
      writeFileSync(configPath, configContent, 'utf-8');

      // Generate CI/CD if requested
      if (answers.generateCI && answers.deployTarget !== 'local') {
        generateCIConfig(answers);
      }

      // Create output directories
      const outputDir = resolve(process.cwd(), 'docs');
      if (!existsSync(outputDir)) {
        mkdirSync(outputDir, { recursive: true });
      }

      spinner.succeed(strings.configCreated);

      console.log(chalk.green(`\n✓ ${strings.initSuccess}\n`));
      console.log(chalk.dim(strings.createdFiles));
      console.log(chalk.dim('  - codedocs.config.ts'));
      if (answers.generateCI) {
        const ciFile =
          answers.deployTarget === 'github-pages'
            ? '.github/workflows/deploy.yml'
            : '.gitlab-ci.yml';
        console.log(chalk.dim(`  - ${ciFile}`));
      }

      console.log(chalk.cyan(`\n${strings.nextSteps}`));
      console.log(chalk.dim('  1. Review and edit codedocs.config.ts'));
      if (answers.aiProvider !== 'none' && !answers.apiKey) {
        console.log(
          chalk.dim(`  2. ${t(strings.setEnvVar, { envVar: getEnvVarName(answers.aiProvider) })}`)
        );
      }
      console.log(chalk.dim('  3. Run: codedocs analyze'));
      console.log(chalk.dim('  4. Run: codedocs generate'));
      console.log(chalk.dim('  5. Run: codedocs serve\n'));
    } catch (error) {
      spinner.fail(strings.initFailed);
      console.error(chalk.red((error as Error).message));
      process.exit(1);
    }
  });

function getDefaultAnswers(detected?: DetectedStack): InitAnswers {
  return {
    projectName: basename(process.cwd()) || 'my-docs',
    sourcePath: detected?.sourcePath || './src',
    language: detected?.languages[0]?.name || 'Auto-detect',
    parsers: detected?.suggestedParsers.map((p) => p.package) || [],
    aiProvider: 'openai',
    aiModel: 'gpt-4-turbo-preview',
    locale: 'ko',
    deployTarget: 'github-pages',
    generateCI: true,
  };
}

function generateConfigFile(answers: InitAnswers, detected?: DetectedStack): string {
  // Build parser imports and config
  const selectedParsers = answers.parsers || [];
  const parserMap = new Map<string, SuggestedParser>();
  if (detected) {
    for (const p of detected.suggestedParsers) {
      parserMap.set(p.package, p);
    }
  }
  // Add defaults for manually selected parsers
  const parserDefaults: Record<string, SuggestedParser> = {
    '@codedocs/parser-kotlin-spring': { package: '@codedocs/parser-kotlin-spring', importName: 'kotlinSpringParser', factoryFn: 'kotlinSpringParser', options: { detectFrameworks: true } },
    '@codedocs/parser-java-spring': { package: '@codedocs/parser-java-spring', importName: 'javaSpringParser', factoryFn: 'javaSpringParser', options: { detectFrameworks: true } },
    '@codedocs/parser-typescript-nestjs': { package: '@codedocs/parser-typescript-nestjs', importName: 'nestjsParser', factoryFn: 'nestjsParser', options: { detectOrm: true } },
    '@codedocs/parser-python-fastapi': { package: '@codedocs/parser-python-fastapi', importName: 'fastApiParser', factoryFn: 'fastApiParser', options: { detectOrm: true, detectPydantic: true } },
    '@codedocs/parser-openapi': { package: '@codedocs/parser-openapi', importName: 'openApiParser', factoryFn: 'openApiParser', options: { parseSchemas: true } },
  };

  const parserImports: string[] = [];
  const parserConfigs: string[] = [];

  for (const pkg of selectedParsers) {
    const info = parserMap.get(pkg) || parserDefaults[pkg];
    if (!info) continue;
    parserImports.push(`import { ${info.importName} } from '${pkg}';`);
    if (info.options && Object.keys(info.options).length > 0) {
      const optsStr = Object.entries(info.options).map(([k, v]) => `${k}: ${v}`).join(', ');
      parserConfigs.push(`    ${info.factoryFn}({ ${optsStr} }),`);
    } else {
      parserConfigs.push(`    ${info.factoryFn}(),`);
    }
  }

  const importsBlock = [
    `import { defineConfig } from '@codedocs/core';`,
    ...parserImports,
  ].join('\n');

  const parsersBlock = parserConfigs.length > 0
    ? `\n  // Parsers (auto-detected)\n  parsers: [\n${parserConfigs.join('\n')}\n  ],\n`
    : '';

  const aiConfig =
    answers.aiProvider !== 'none'
      ? `\n  // AI configuration\n  ai: {\n    provider: '${answers.aiProvider}',\n    model: '${answers.aiModel}',\n    apiKey: process.env.${getEnvVarName(answers.aiProvider)}${answers.apiKey ? ` || '${answers.apiKey}'` : ''},\n    features: {\n      domainGrouping: true,\n      flowDiagrams: true,\n      codeExplanation: true,\n      releaseNoteAnalysis: true,\n    },\n  },\n`
      : '';

  return `${importsBlock}

export default defineConfig({
  // Project information
  name: '${answers.projectName}',

  // Source code paths
  source: '${answers.sourcePath}',
${parsersBlock}${aiConfig}
  // Documentation configuration
  docs: {
    title: '${answers.projectName} Documentation',
    locale: '${answers.locale}',
    sections: [
      { id: 'overview', label: 'Overview', type: 'auto' },
      { id: 'api', label: 'API', type: 'endpoints' },
      { id: 'entities', label: 'Data Models', type: 'entities' },
      { id: 'architecture', label: 'Architecture', type: 'architecture' },
      { id: 'changelog', label: 'Changelog', type: 'changelog' },
    ],
  },

  // Theme configuration
  theme: {
    preset: 'default',
    colors: { primary: '#2e8555' },
  },

  // Build configuration
  build: {
    outDir: './dist',
    base: '/${answers.deployTarget === 'github-pages' ? answers.projectName : ''}/',
  },
});
`;
}

function generateCIConfig(answers: InitAnswers): void {
  if (answers.deployTarget === 'github-pages') {
    const workflowDir = resolve(process.cwd(), '.github/workflows');
    if (!existsSync(workflowDir)) {
      mkdirSync(workflowDir, { recursive: true });
    }

    const workflowContent = `name: Deploy CodeDocs

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build documentation
        run: npx codedocs build
        env:
          ${getEnvVarName(answers.aiProvider)}: \${{ secrets.${getEnvVarName(answers.aiProvider)} }}

      - name: Upload artifact
        uses: actions/upload-pages-artifact@v2
        with:
          path: ./dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: \${{ steps.deployment.outputs.page_url }}
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v3
`;

    writeFileSync(
      join(workflowDir, 'deploy.yml'),
      workflowContent,
      'utf-8'
    );
  } else if (answers.deployTarget === 'gitlab-pages') {
    const gitlabCIContent = `image: node:20

pages:
  stage: deploy
  cache:
    paths:
      - node_modules/
  script:
    - npm ci
    - npx codedocs build
    - mv dist public
  artifacts:
    paths:
      - public
  only:
    - main
  variables:
    ${getEnvVarName(answers.aiProvider)}: \${${getEnvVarName(answers.aiProvider)}}
`;

    writeFileSync(
      resolve(process.cwd(), '.gitlab-ci.yml'),
      gitlabCIContent,
      'utf-8'
    );
  }
}

function getEnvVarName(provider: string): string {
  switch (provider) {
    case 'openai':
      return 'OPENAI_API_KEY';
    case 'claude':
      return 'ANTHROPIC_API_KEY';
    case 'gemini':
      return 'GOOGLE_API_KEY';
    case 'ollama':
      return 'OLLAMA_BASE_URL';
    default:
      return 'AI_API_KEY';
  }
}
