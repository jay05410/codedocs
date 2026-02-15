import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve, join, basename } from 'path';
import Handlebars from 'handlebars';
import { detectStack, formatDetectionResult } from '../detect.js';
import type { DetectedStack } from '../detect.js';
import { getCliStrings, t, initLocale } from '../i18n.js';
import { packageToParserName } from '../parser-registry.js';

// ─── Constants ──────────────────────────────────────────────────────────────

const BACK_VALUE = '__back__';

/**
 * AI model choices per provider (Feb 2026)
 * Criteria: large context window (>= 200K) for codebase analysis, cost-effective
 */
const AI_MODELS: Record<string, Array<{ name: string; value: string }>> = {
  openai: [
    { name: 'GPT-5.2 (recommended)', value: 'gpt-5.2' },
    { name: 'GPT-5 mini', value: 'gpt-5-mini' },
    { name: 'GPT-4o', value: 'gpt-4o' },
  ],
  claude: [
    { name: 'Claude Sonnet 4.5 (recommended)', value: 'claude-sonnet-4-5-20250929' },
    { name: 'Claude Sonnet 5', value: 'claude-sonnet-5-20260203' },
    { name: 'Claude Opus 4.6', value: 'claude-opus-4-6-20260205' },
  ],
  gemini: [
    { name: 'Gemini 3 Pro (recommended)', value: 'gemini-3-pro' },
    { name: 'Gemini 3 Flash', value: 'gemini-3-flash' },
    { name: 'Gemini 2.5 Pro', value: 'gemini-2.5-pro' },
  ],
  glm: [
    { name: 'GLM-4 Plus (recommended)', value: 'glm-4-plus' },
    { name: 'GLM-4', value: 'glm-4' },
  ],
  ollama: [
    { name: 'Qwen 3 (recommended)', value: 'qwen3' },
    { name: 'Llama 3.3', value: 'llama3.3' },
    { name: 'DeepSeek Coder v2', value: 'deepseek-coder-v2' },
    { name: 'Granite 4', value: 'granite4' },
  ],
};

/** All available parsers */
const ALL_PARSERS = [
  { pkg: '@codedocs/parser-react', label: 'React' },
  { pkg: '@codedocs/parser-vue', label: 'Vue' },
  { pkg: '@codedocs/parser-svelte', label: 'Svelte' },
  { pkg: '@codedocs/parser-typescript-nestjs', label: 'NestJS' },
  { pkg: '@codedocs/parser-kotlin-spring', label: 'Kotlin Spring Boot' },
  { pkg: '@codedocs/parser-java-spring', label: 'Java Spring Boot' },
  { pkg: '@codedocs/parser-python-fastapi', label: 'Python FastAPI' },
  { pkg: '@codedocs/parser-php', label: 'PHP' },
  { pkg: '@codedocs/parser-go', label: 'Go' },
  { pkg: '@codedocs/parser-c', label: 'C' },
  { pkg: '@codedocs/parser-cpp', label: 'C++' },
  { pkg: '@codedocs/parser-graphql', label: 'GraphQL' },
  { pkg: '@codedocs/parser-openapi', label: 'OpenAPI / Swagger' },
];

// ─── Types ──────────────────────────────────────────────────────────────────

interface InitAnswers {
  projectName: string;
  sourcePath: string;
  language: string;
  parsers: string[];
  aiProvider: 'openai' | 'claude' | 'gemini' | 'glm' | 'ollama' | 'none';
  aiModel?: string;
  authMethod?: 'api-key' | 'env' | 'mcp' | 'custom-endpoint';
  apiKey?: string;
  baseUrl?: string;
  mcpCommand?: string;
  mcpArgs?: string;
  mcpTool?: string;
  locale: 'ko' | 'en' | 'ja' | 'zh';
  deployTarget: 'github-pages' | 'gitlab-pages' | 'nginx' | 'jenkins' | 'local';
  generateCI: boolean;
}

// ─── Wizard ─────────────────────────────────────────────────────────────────

// Helper to work around inquirer v10 type mismatch with @types/inquirer@9
async function prompt<T = any>(questions: any): Promise<T> {
  return inquirer.prompt(questions) as Promise<T>;
}

/**
 * Build parser choices with recommended (detected) parsers first
 */
function buildParserChoices(detected: DetectedStack) {
  const detectedPkgs = new Set(detected.suggestedParsers.map(p => p.package));
  const recommended: Array<{ name: string; value: string; checked: boolean }> = [];
  const others: Array<{ name: string; value: string; checked: boolean }> = [];

  for (const parser of ALL_PARSERS) {
    if (detectedPkgs.has(parser.pkg)) {
      recommended.push({
        name: `${parser.label} ${chalk.green('\u2605 recommended')}`,
        value: parser.pkg,
        checked: true,
      });
    } else {
      others.push({
        name: parser.label,
        value: parser.pkg,
        checked: false,
      });
    }
  }

  return { recommended, others };
}

/**
 * Step-by-step interactive wizard with back navigation
 */
async function runWizard(detected: DetectedStack, targetDir: string): Promise<InitAnswers> {
  const s = getCliStrings().cli;
  const answers: Record<string, any> = {};
  const primaryLang = detected.languages[0]?.name || 'Auto-detect';
  const { recommended, others } = buildParserChoices(detected);
  const hasRecommendedParsers = recommended.length > 0;
  const totalParserChoices = recommended.length + others.length;

  const backSep = new inquirer.Separator('───────────────');
  const backChoice = { name: chalk.dim('\u2190 Back to previous step'), value: BACK_VALUE };

  interface WizardStep {
    key: string;
    skip?: () => boolean;
    prompt: () => Promise<any>;
  }

  const steps: WizardStep[] = [
    // Step 0: Project name
    {
      key: 'projectName',
      prompt: async () => {
        const { value } = await prompt([{
          type: 'input',
          name: 'value',
          message: s.projectName,
          default: answers.projectName || basename(targetDir) || 'my-docs',
          validate: (input: string) => input.length > 0 || s.projectNameRequired,
        }]);
        return value;
      },
    },

    // Step 1: Source path
    {
      key: 'sourcePath',
      prompt: async () => {
        const { value } = await prompt([{
          type: 'input',
          name: 'value',
          message: s.sourceCodePath,
          default: answers.sourcePath || detected.sourcePath || './src',
        }]);
        return value;
      },
    },

    // Step 2: Language (detected language shown first with ★ recommended)
    {
      key: 'language',
      prompt: async () => {
        const allLangs = ['TypeScript', 'JavaScript', 'Kotlin', 'Java', 'Python', 'Go', 'PHP', 'C', 'C++', 'Rust'];
        const langChoices: any[] = [];

        if (primaryLang !== 'Auto-detect') {
          langChoices.push({ name: `${primaryLang} ${chalk.green('\u2605 recommended')}`, value: primaryLang });
          for (const lang of allLangs) {
            if (lang !== primaryLang) langChoices.push(lang);
          }
        } else {
          langChoices.push(...allLangs);
        }
        langChoices.push('Auto-detect', backSep, backChoice);

        const { value } = await prompt([{
          type: 'list',
          name: 'value',
          message: s.primaryLanguage,
          choices: langChoices,
          default: answers.language || primaryLang,
        }]);
        return value;
      },
    },

    // Step 3: Parser selection
    {
      key: 'parsers',
      skip: () => totalParserChoices === 0,
      prompt: async () => {
        const choices: any[] = [];

        if (hasRecommendedParsers) {
          choices.push(...recommended);
          choices.push(...others);
        } else {
          choices.push(...others);
        }

        choices.push(backSep, backChoice);

        const { value } = await prompt([{
          type: 'checkbox',
          name: 'value',
          message: s.selectParsers,
          choices,
        }]);

        if (Array.isArray(value) && value.includes(BACK_VALUE)) {
          return BACK_VALUE;
        }
        return value;
      },
    },

    // Step 4: AI provider
    {
      key: 'aiProvider',
      prompt: async () => {
        const { value } = await prompt([{
          type: 'list',
          name: 'value',
          message: s.aiProvider,
          choices: [
            { name: 'OpenAI', value: 'openai' },
            { name: 'Anthropic Claude', value: 'claude' },
            { name: 'Google Gemini', value: 'gemini' },
            { name: 'GLM (Zhipu AI)', value: 'glm' },
            new inquirer.Separator(chalk.dim('── Local ──')),
            { name: 'Ollama (free, runs on your machine)', value: 'ollama' },
            new inquirer.Separator(chalk.dim('──────────')),
            { name: 'None (basic extraction only)', value: 'none' },
            backSep, backChoice,
          ],
          default: answers.aiProvider || 'openai',
        }]);

        // Show Ollama setup guide when selected
        if (value === 'ollama') {
          console.log(chalk.cyan('\n  Ollama - Local AI Model Runner'));
          console.log(chalk.dim('  Ollama runs AI models locally on your machine (no API key needed).'));
          console.log(chalk.dim('  Setup:'));
          console.log(chalk.dim('    1. Install: https://ollama.ai'));
          console.log(chalk.dim('    2. Pull a model: ollama pull qwen3'));
          console.log(chalk.dim('    3. Ollama runs at http://localhost:11434'));
          console.log(chalk.dim('  Recommended: 16GB+ RAM, GPU for best performance.\n'));
        }

        return value;
      },
    },

    // Step 5: AI model (list selection, not free text)
    {
      key: 'aiModel',
      skip: () => answers.aiProvider === 'none',
      prompt: async () => {
        const models = AI_MODELS[answers.aiProvider] || [];
        const { value } = await prompt([{
          type: 'list',
          name: 'value',
          message: s.aiModel,
          choices: [...models, backSep, backChoice],
          default: answers.aiModel || models[0]?.value,
        }]);
        return value;
      },
    },

    // Step 6: Auth method
    {
      key: 'authMethod',
      skip: () => answers.aiProvider === 'none' || answers.aiProvider === 'ollama',
      prompt: async () => {
        const envVar = getEnvVarName(answers.aiProvider);

        const choices: any[] = [
          { name: `Environment variable (${chalk.dim(envVar)})`, value: 'env' },
          { name: 'API key (enter now)', value: 'api-key' },
          { name: `MCP server (${chalk.dim('Model Context Protocol')})`, value: 'mcp' },
          { name: `Custom endpoint / proxy (${chalk.dim('enter baseUrl')})`, value: 'custom-endpoint' },
          backSep, backChoice,
        ];

        const { value } = await prompt([{
          type: 'list',
          name: 'value',
          message: 'How do you want to authenticate?',
          choices,
          default: answers.authMethod || 'env',
        }]);

        return value;
      },
    },

    // Step 6b: API key input (only if api-key selected)
    {
      key: 'apiKey',
      skip: () => answers.authMethod !== 'api-key',
      prompt: async () => {
        const { value } = await prompt([{
          type: 'password',
          name: 'value',
          message: s.apiKeyPrompt,
          mask: '*',
        }]);
        if (!value) return BACK_VALUE;
        return value;
      },
    },

    // Step 6c: Custom endpoint URL (only if custom-endpoint selected)
    {
      key: 'baseUrl',
      skip: () => answers.authMethod !== 'custom-endpoint',
      prompt: async () => {
        const { value } = await prompt([{
          type: 'input',
          name: 'value',
          message: 'Proxy / custom endpoint URL:',
          default: answers.baseUrl || 'https://api.openrouter.ai/api',
          validate: (input: string) => input.startsWith('http') || 'URL must start with http:// or https://',
        }]);
        if (!value) return BACK_VALUE;
        return value;
      },
    },

    // Step 6d: MCP server command (only if mcp selected)
    {
      key: 'mcpCommand',
      skip: () => answers.authMethod !== 'mcp',
      prompt: async () => {
        const { value } = await prompt([{
          type: 'input',
          name: 'value',
          message: 'MCP server command:',
          default: answers.mcpCommand || 'npx',
        }]);
        if (!value) return BACK_VALUE;
        return value;
      },
    },

    // Step 6e: MCP server args (only if mcp selected)
    {
      key: 'mcpArgs',
      skip: () => answers.authMethod !== 'mcp',
      prompt: async () => {
        const { value } = await prompt([{
          type: 'input',
          name: 'value',
          message: 'MCP server package / arguments:',
          default: answers.mcpArgs || '-y @anthropic/mcp-server',
          validate: (input: string) => input.length > 0 || 'Arguments are required',
        }]);
        if (!value) return BACK_VALUE;
        return value;
      },
    },

    // Step 7: Documentation language
    {
      key: 'locale',
      prompt: async () => {
        const { value } = await prompt([{
          type: 'list',
          name: 'value',
          message: s.docLanguage,
          choices: [
            { name: 'Korean (\ud55c\uad6d\uc5b4)', value: 'ko' },
            { name: 'English', value: 'en' },
            { name: 'Japanese (\u65e5\u672c\u8a9e)', value: 'ja' },
            { name: 'Chinese (\u4e2d\u6587)', value: 'zh' },
            backSep, backChoice,
          ],
          default: answers.locale || 'ko',
        }]);
        return value;
      },
    },

    // Step 8: Deployment target
    {
      key: 'deployTarget',
      prompt: async () => {
        const { value } = await prompt([{
          type: 'list',
          name: 'value',
          message: s.deployTarget,
          choices: [
            { name: 'GitHub Pages', value: 'github-pages' },
            { name: 'GitLab Pages', value: 'gitlab-pages' },
            { name: 'Jenkins', value: 'jenkins' },
            { name: 'Nginx/Apache', value: 'nginx' },
            { name: 'Local only', value: 'local' },
            backSep, backChoice,
          ],
          default: answers.deployTarget || 'github-pages',
        }]);
        return value;
      },
    },

    // Step 9: Generate CI/CD
    {
      key: 'generateCI',
      skip: () => answers.deployTarget === 'local',
      prompt: async () => {
        const { value } = await prompt([{
          type: 'confirm',
          name: 'value',
          message: s.generateCI,
          default: answers.generateCI ?? true,
        }]);
        return value;
      },
    },
  ];

  let i = 0;
  while (i < steps.length) {
    const step = steps[i];

    // Skip conditional steps
    if (step.skip?.()) {
      i++;
      continue;
    }

    const result = await step.prompt();

    if (result === BACK_VALUE) {
      // Go back to previous non-skipped step
      do {
        i--;
      } while (i > 0 && steps[i].skip?.());
      i = Math.max(0, i);
      continue;
    }

    answers[step.key] = result;
    i++;
  }

  // Ensure parsers have a value
  if (!answers.parsers) {
    answers.parsers = detected.suggestedParsers.map(p => p.package);
  }

  return answers as unknown as InitAnswers;
}

// ─── Command ────────────────────────────────────────────────────────────────

export const initCommand = new Command('init')
  .description('Initialize a new CodeDocs project')
  .option('-y, --yes', 'Skip prompts and use defaults')
  .option('-d, --detect', 'Auto-detect stack and skip prompts')
  .option('-s, --source <path>', 'Target source directory to analyze')
  .option('--ci', 'Generate CI/CD config only')
  .action(async (options) => {
    const s = getCliStrings().cli;
    console.log(chalk.bold.cyan(`\n\ud83d\udcda ${s.initTitle}\n`));

    // Handle --ci only mode
    if (options.ci) {
      await generateCIOnly();
      return;
    }

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
      answers = await runWizard(detected, targetDir);
    }

    // After getting locale from answers, re-init locale
    initLocale(answers.locale);
    const strings = getCliStrings().cli;

    const spinner = ora(strings.generatingConfig).start();

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

      spinner.succeed(strings.configCreated);

      console.log(chalk.green(`\n\u2713 ${strings.initSuccess}\n`));
      console.log(chalk.dim(strings.createdFiles));
      console.log(chalk.dim('  - codedocs.config.ts'));
      if (answers.generateCI) {
        const ciFile =
          answers.deployTarget === 'github-pages'
            ? '.github/workflows/deploy.yml'
            : answers.deployTarget === 'gitlab-pages'
            ? '.gitlab-ci.yml'
            : answers.deployTarget === 'jenkins'
            ? 'Jenkinsfile'
            : '';
        if (ciFile) {
          console.log(chalk.dim(`  - ${ciFile}`));
        }
      }

      console.log(chalk.cyan(`\n${strings.nextSteps}`));
      console.log(chalk.dim('  1. Review and edit codedocs.config.ts'));
      if (answers.aiProvider !== 'none' && answers.authMethod !== 'api-key') {
        const envVar = getEnvVarName(answers.aiProvider);
        if (answers.authMethod === 'mcp') {
          console.log(chalk.dim('  2. Set MCP_SERVER_URL to your MCP server endpoint'));
        } else if (answers.authMethod === 'custom-endpoint') {
          console.log(chalk.dim(`  2. Set ${envVar} if your proxy requires auth`));
        } else {
          console.log(
            chalk.dim(`  2. ${t(strings.setEnvVar, { envVar })}`)
          );
        }
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

// ─── Helpers ────────────────────────────────────────────────────────────────

function getDefaultAnswers(detected?: DetectedStack): InitAnswers {
  return {
    projectName: basename(process.cwd()) || 'my-docs',
    sourcePath: detected?.sourcePath || './src',
    language: detected?.languages[0]?.name || 'Auto-detect',
    parsers: detected?.suggestedParsers.map((p) => p.package) || [],
    aiProvider: 'openai',
    aiModel: 'gpt-5.2',
    locale: 'ko',
    deployTarget: 'github-pages',
    generateCI: true,
  };
}

function getEnvVarName(provider: string): string {
  switch (provider) {
    case 'openai':
      return 'OPENAI_API_KEY';
    case 'claude':
      return 'ANTHROPIC_API_KEY';
    case 'gemini':
      return 'GOOGLE_API_KEY';
    case 'glm':
      return 'GLM_API_KEY';
    case 'ollama':
      return 'OLLAMA_BASE_URL';
    default:
      return 'AI_API_KEY';
  }
}

// ─── Config File Generation ─────────────────────────────────────────────────

function generateConfigFile(answers: InitAnswers): string {
  const selectedParsers = answers.parsers || [];

  // Convert package names to short registry names
  const parserNames = selectedParsers
    .map(pkg => packageToParserName(pkg))
    .filter((name): name is string => name != null);

  const parsersLine = parserNames.length > 0
    ? `\n  // Parsers\n  parsers: [${parserNames.map(n => `'${n}'`).join(', ')}],\n`
    : '';

  let aiConfig = '';
  if (answers.aiProvider !== 'none') {
    const envVar = getEnvVarName(answers.aiProvider);
    let connLines: string;

    if (answers.aiProvider === 'ollama') {
      connLines = `    baseUrl: process.env.${envVar} || 'http://localhost:11434',`;
    } else if (answers.authMethod === 'mcp') {
      const cmd = answers.mcpCommand || 'npx';
      const argsStr = (answers.mcpArgs || '-y @anthropic/mcp-server')
        .split(/\s+/)
        .map(a => `'${a}'`)
        .join(', ');
      connLines = `    auth: 'mcp',\n    mcp: {\n      command: '${cmd}',\n      args: [${argsStr}],\n    },`;
    } else if (answers.authMethod === 'custom-endpoint') {
      const baseUrl = answers.baseUrl || 'https://api.openrouter.ai/api';
      connLines = `    provider: 'custom',\n    baseUrl: '${baseUrl}',\n    apiKey: process.env.${envVar}, // optional depending on proxy`;
    } else if (answers.authMethod === 'api-key' && answers.apiKey) {
      connLines = `    apiKey: '${answers.apiKey}',`;
    } else {
      connLines = `    apiKey: process.env.${envVar},`;
    }

    const providerLine = answers.authMethod === 'custom-endpoint'
      ? '' : `    provider: '${answers.aiProvider}',\n`;

    aiConfig = `\n  // AI configuration\n  ai: {\n${providerLine}    model: '${answers.aiModel}',\n${connLines}\n    features: {\n      domainGrouping: true,\n      flowDiagrams: true,\n      codeExplanation: true,\n    },\n  },\n`;
  }

  const basePath = answers.deployTarget === 'github-pages'
    ? `/${answers.projectName}/`
    : '/';

  return `/** @type {import('@codedocs/core').CodeDocsConfig} */
export default {
  // Project information
  name: '${answers.projectName}',

  // Source code paths
  source: '${answers.sourcePath}',
${parsersLine}${aiConfig}
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
    base: '${basePath}',
  },
};
`;
}

// ─── CI/CD Generation ───────────────────────────────────────────────────────

function generateCIConfig(answers: InitAnswers): void {
  const envVar = getEnvVarName(answers.aiProvider);
  const branch = 'main';
  const hasEnvVar = answers.aiProvider !== 'none';

  if (answers.deployTarget === 'github-pages') {
    const workflowDir = resolve(process.cwd(), '.github/workflows');
    if (!existsSync(workflowDir)) {
      mkdirSync(workflowDir, { recursive: true });
    }

    // Pre-compute GitHub Actions expressions to avoid Handlebars {{ }} conflicts
    const secretsRef = `\${{ secrets.${envVar} }}`;
    const deployUrlRef = '${{ steps.deployment.outputs.page_url }}';

    const template = Handlebars.compile(GITHUB_ACTIONS_TEMPLATE);
    const content = template({ branch, envVar, secretsRef, deployUrlRef, hasEnvVar });

    writeFileSync(join(workflowDir, 'deploy.yml'), content, 'utf-8');
  } else if (answers.deployTarget === 'gitlab-pages') {
    // Pre-compute GitLab CI variable reference
    const gitlabVarRef = `\${${envVar}}`;

    const template = Handlebars.compile(GITLAB_CI_TEMPLATE);
    const content = template({ branch, envVar, gitlabVarRef, hasEnvVar });

    writeFileSync(resolve(process.cwd(), '.gitlab-ci.yml'), content, 'utf-8');
  } else if (answers.deployTarget === 'jenkins') {
    const template = Handlebars.compile(JENKINSFILE_TEMPLATE);
    const content = template({
      envVar,
      envVarCredentialId: `${envVar.toLowerCase().replace(/_/g, '-')}-credential`,
      isNginx: false,
      deployPath: '/var/www/codedocs/dist/',
      hasEnvVar,
    });

    writeFileSync(resolve(process.cwd(), 'Jenkinsfile'), content, 'utf-8');
  }
}

async function generateCIOnly(): Promise<void> {
  const s = getCliStrings().cli;

  const answers = await prompt([
    {
      type: 'list',
      name: 'deployTarget',
      message: 'Select deployment target:',
      choices: [
        { name: 'GitHub Pages', value: 'github-pages' },
        { name: 'GitLab Pages', value: 'gitlab-pages' },
        { name: 'Jenkins', value: 'jenkins' },
        { name: 'Nginx/Apache', value: 'nginx' },
      ],
      default: 'github-pages',
    },
    {
      type: 'list',
      name: 'aiProvider',
      message: s.aiProvider,
      choices: [
        { name: 'OpenAI', value: 'openai' },
        { name: 'Anthropic Claude', value: 'claude' },
        { name: 'Google Gemini', value: 'gemini' },
        { name: 'GLM (Zhipu AI)', value: 'glm' },
        { name: 'Ollama (local)', value: 'ollama' },
        { name: 'None', value: 'none' },
      ],
      default: 'openai',
    },
  ]);

  const spinner = ora('Generating CI/CD configuration...').start();

  try {
    generateCIConfig(answers as InitAnswers);
    spinner.succeed('CI/CD configuration created');

    const ciFile =
      answers.deployTarget === 'github-pages'
        ? '.github/workflows/deploy.yml'
        : answers.deployTarget === 'gitlab-pages'
        ? '.gitlab-ci.yml'
        : 'Jenkinsfile';

    console.log(chalk.green(`\n\u2713 Created ${ciFile}\n`));
  } catch (error) {
    spinner.fail('Failed to generate CI/CD config');
    console.error(chalk.red((error as Error).message));
    process.exit(1);
  }
}

// ─── CI/CD Templates ────────────────────────────────────────────────────────
// Templates use Handlebars with pre-computed expression values (triple-stache)
// to avoid conflicts between Handlebars {{ }} and CI platform ${{ }} syntax.

const GITHUB_ACTIONS_TEMPLATE = `name: Deploy CodeDocs

on:
  push:
    branches: [{{branch}}]
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
{{#if hasEnvVar}}
        env:
          {{envVar}}: {{{secretsRef}}}
{{/if}}
      - name: Upload artifact
        uses: actions/upload-pages-artifact@v2
        with:
          path: ./dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: {{{deployUrlRef}}}
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v3
`;

const GITLAB_CI_TEMPLATE = `image: node:20

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
    - {{branch}}
{{#if hasEnvVar}}
  variables:
    {{envVar}}: {{{gitlabVarRef}}}
{{/if}}
`;

const JENKINSFILE_TEMPLATE = `pipeline {
    agent any

    tools {
        nodejs 'Node20'
    }
{{#if hasEnvVar}}

    environment {
        {{envVar}} = credentials('{{envVarCredentialId}}')
    }
{{/if}}

    stages {
        stage('Install') {
            steps {
                sh 'npm ci'
            }
        }
        stage('Build Docs') {
            steps {
                sh 'npx codedocs build'
            }
        }
        stage('Deploy') {
            steps {
                {{#if isNginx}}
                sh 'rsync -avz --delete dist/ {{deployPath}}'
                {{else}}
                archiveArtifacts artifacts: 'dist/**', fingerprint: true
                {{/if}}
            }
        }
    }
}
`;
