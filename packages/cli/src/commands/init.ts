import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve, join } from 'path';

interface InitAnswers {
  projectName: string;
  sourcePath: string;
  language: string;
  aiProvider: 'openai' | 'claude' | 'gemini' | 'ollama' | 'none';
  aiModel?: string;
  apiKey?: string;
  locale: 'ko' | 'en';
  deployTarget: 'github-pages' | 'gitlab-pages' | 'nginx' | 'local';
  generateCI: boolean;
}

export const initCommand = new Command('init')
  .description('Initialize a new CodeDocs project')
  .option('-y, --yes', 'Skip prompts and use defaults')
  .action(async (options) => {
    console.log(chalk.bold.cyan('\n📚 CodeDocs Initialization\n'));
    let answers: InitAnswers;

    if (options.yes) {
      answers = getDefaultAnswers();
    } else {
      answers = (await inquirer.prompt([
        {
          type: 'input',
          name: 'projectName',
          message: 'Project name:',
          default: 'my-docs',
          validate: (input: string) => input.length > 0 || 'Project name is required',
        },
        {
          type: 'input',
          name: 'sourcePath',
          message: 'Source code path:',
          default: './src',
        },
        {
          type: 'list',
          name: 'language',
          message: 'Primary language/framework:',
          choices: [
            'TypeScript',
            'JavaScript',
            'Python',
            'Java',
            'Go',
            'Rust',
            'Auto-detect',
          ],
          default: 'Auto-detect',
        },
        {
          type: 'list',
          name: 'aiProvider',
          message: 'AI provider for documentation generation:',
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
          message: 'AI model:',
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
          message: 'API key (leave empty to set via environment variable):',
          when: (ans: any) => ans.aiProvider !== 'none' && ans.aiProvider !== 'ollama',
        },
        {
          type: 'list',
          name: 'locale',
          message: 'Documentation language:',
          choices: [
            { name: 'Korean (한국어)', value: 'ko' },
            { name: 'English', value: 'en' },
          ],
          default: 'ko',
        },
        {
          type: 'list',
          name: 'deployTarget',
          message: 'Deployment target:',
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
          message: 'Generate CI/CD pipeline configuration?',
          when: (ans: any) => ans.deployTarget !== 'local',
          default: true,
        },
      ] as any)) as InitAnswers;
    }

    const spinner = ora('Generating configuration...').start();

    try {
      // Generate config file
      const configPath = resolve(process.cwd(), 'codedocs.config.ts');
      const configContent = generateConfigFile(answers);
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

      spinner.succeed('Configuration created successfully!');

      console.log(chalk.green('\n✓ CodeDocs initialized successfully!\n'));
      console.log(chalk.dim('Created files:'));
      console.log(chalk.dim(`  - codedocs.config.ts`));
      if (answers.generateCI) {
        const ciFile =
          answers.deployTarget === 'github-pages'
            ? '.github/workflows/deploy.yml'
            : '.gitlab-ci.yml';
        console.log(chalk.dim(`  - ${ciFile}`));
      }

      console.log(chalk.cyan('\nNext steps:'));
      console.log(chalk.dim('  1. Review and edit codedocs.config.ts'));
      if (answers.aiProvider !== 'none' && !answers.apiKey) {
        console.log(
          chalk.dim(
            `  2. Set ${getEnvVarName(answers.aiProvider)} environment variable`
          )
        );
      }
      console.log(chalk.dim('  3. Run: codedocs analyze'));
      console.log(chalk.dim('  4. Run: codedocs generate'));
      console.log(chalk.dim('  5. Run: codedocs serve (to preview)\n'));
    } catch (error) {
      spinner.fail('Failed to create configuration');
      console.error(chalk.red((error as Error).message));
      process.exit(1);
    }
  });

function getDefaultAnswers(): InitAnswers {
  return {
    projectName: 'my-docs',
    sourcePath: './src',
    language: 'Auto-detect',
    aiProvider: 'openai',
    aiModel: 'gpt-4-turbo-preview',
    locale: 'ko',
    deployTarget: 'github-pages',
    generateCI: true,
  };
}

function generateConfigFile(answers: InitAnswers): string {
  const aiConfig =
    answers.aiProvider !== 'none'
      ? `
  ai: {
    provider: '${answers.aiProvider}',
    model: '${answers.aiModel}',
    apiKey: process.env.${getEnvVarName(answers.aiProvider)}${answers.apiKey ? ` || '${answers.apiKey}'` : ''},
  },`
      : '';

  return `import { defineConfig } from '@codedocs/core';

export default defineConfig({
  // Project information
  name: '${answers.projectName}',

  // Source code paths
  source: {
    include: ['${answers.sourcePath}/**/*.{ts,tsx,js,jsx,py,java,go,rs}'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/__tests__/**'],
  },
${aiConfig}
  // Parser configuration
  parser: {
    language: '${answers.language.toLowerCase()}',
    extractComments: true,
    extractTypes: true,
    extractExamples: true,
  },

  // Generator configuration
  generator: {
    locale: '${answers.locale}',
    outputDir: './docs',
    templates: {
      module: 'default',
      class: 'default',
      function: 'default',
    },
  },

  // Theme configuration
  theme: {
    name: '${answers.projectName} Documentation',
    locale: '${answers.locale}',
    nav: [
      { text: 'Home', link: '/' },
      { text: 'API', link: '/api/' },
      { text: 'Guide', link: '/guide/' },
    ],
    sidebar: 'auto',
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
