import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { join, resolve, extname } from 'path';
import { getCliStrings, t } from './i18n.js';

export interface DetectedStack {
  languages: StackLanguage[];
  frameworks: StackFramework[];
  orms: string[];
  buildTools: string[];
  suggestedParsers: SuggestedParser[];
  sourcePath: string;
}

export interface StackLanguage {
  name: string;
  percentage: number; // 0-100
  fileCount: number;
}

export interface StackFramework {
  name: string;
  confidence: 'high' | 'medium' | 'low';
  evidence: string;
}

export interface SuggestedParser {
  package: string;
  importName: string;
  factoryFn: string;
  options?: Record<string, boolean>;
}

const LANGUAGE_EXTENSIONS: Record<string, string> = {
  '.ts': 'TypeScript', '.tsx': 'TypeScript',
  '.js': 'JavaScript', '.jsx': 'JavaScript',
  '.java': 'Java',
  '.kt': 'Kotlin', '.kts': 'Kotlin',
  '.py': 'Python',
  '.go': 'Go',
  '.rs': 'Rust',
  '.rb': 'Ruby',
  '.cs': 'C#',
  '.cpp': 'C++', '.cc': 'C++', '.cxx': 'C++',
  '.c': 'C',
  '.swift': 'Swift',
  '.php': 'PHP',
  '.vue': 'Vue',
  '.svelte': 'Svelte',
};

const IGNORE_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', 'target', '.gradle',
  '__pycache__', '.venv', 'venv', 'vendor', '.next', '.nuxt',
  'coverage', '.idea', '.vscode', 'bin', 'obj',
]);

/**
 * Auto-detect the tech stack of a project directory
 */
export async function detectStack(projectDir: string): Promise<DetectedStack> {
  const absDir = resolve(projectDir);
  const fileCounts = countFilesByLanguage(absDir);
  const totalFiles = Object.values(fileCounts).reduce((a, b) => a + b, 0);

  // Build language list sorted by file count
  const languages: StackLanguage[] = Object.entries(fileCounts)
    .map(([name, fileCount]) => ({
      name,
      fileCount,
      percentage: totalFiles > 0 ? Math.round((fileCount / totalFiles) * 100) : 0,
    }))
    .sort((a, b) => b.fileCount - a.fileCount);

  // Detect frameworks
  const frameworks = detectFrameworks(absDir);

  // Detect ORMs
  const orms = detectOrms(absDir);

  // Detect build tools
  const buildTools = detectBuildTools(absDir);

  // Suggest parsers based on detected stack
  const suggestedParsers = suggestParsers(languages, frameworks, absDir);

  // Infer best source path
  const sourcePath = inferSourcePath(absDir);

  return { languages, frameworks, orms, buildTools, suggestedParsers, sourcePath };
}

function countFilesByLanguage(dir: string, depth = 0): Record<string, number> {
  const counts: Record<string, number> = {};
  if (depth > 8) return counts; // Prevent deep recursion

  try {
    const entries = readdirSync(dir);
    for (const entry of entries) {
      if (IGNORE_DIRS.has(entry) || entry.startsWith('.')) continue;

      const fullPath = join(dir, entry);
      try {
        const stat = statSync(fullPath);
        if (stat.isDirectory()) {
          const subCounts = countFilesByLanguage(fullPath, depth + 1);
          for (const [lang, count] of Object.entries(subCounts)) {
            counts[lang] = (counts[lang] || 0) + count;
          }
        } else if (stat.isFile()) {
          const ext = extname(entry).toLowerCase();
          const lang = LANGUAGE_EXTENSIONS[ext];
          if (lang) {
            counts[lang] = (counts[lang] || 0) + 1;
          }
        }
      } catch {
        // Skip inaccessible files
      }
    }
  } catch {
    // Skip inaccessible directories
  }

  return counts;
}

function detectFrameworks(dir: string): StackFramework[] {
  const frameworks: StackFramework[] = [];

  // -- Node.js / TypeScript frameworks --
  const packageJsonPath = join(dir, 'package.json');
  if (existsSync(packageJsonPath)) {
    try {
      const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
      const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };

      if (allDeps['@nestjs/core']) {
        frameworks.push({ name: 'NestJS', confidence: 'high', evidence: 'package.json: @nestjs/core' });
      }
      if (allDeps['next']) {
        frameworks.push({ name: 'Next.js', confidence: 'high', evidence: 'package.json: next' });
      }
      if (allDeps['express']) {
        frameworks.push({ name: 'Express', confidence: 'high', evidence: 'package.json: express' });
      }
      if (allDeps['fastify']) {
        frameworks.push({ name: 'Fastify', confidence: 'high', evidence: 'package.json: fastify' });
      }
      if (allDeps['react']) {
        frameworks.push({ name: 'React', confidence: 'high', evidence: 'package.json: react' });
      }
      if (allDeps['vue']) {
        frameworks.push({ name: 'Vue', confidence: 'high', evidence: 'package.json: vue' });
      }
      if (allDeps['svelte']) {
        frameworks.push({ name: 'Svelte', confidence: 'high', evidence: 'package.json: svelte' });
      }
      if (allDeps['@apollo/server'] || allDeps['apollo-server']) {
        frameworks.push({ name: 'Apollo GraphQL', confidence: 'high', evidence: 'package.json: apollo' });
      }
      if (allDeps['typeorm']) {
        frameworks.push({ name: 'TypeORM', confidence: 'high', evidence: 'package.json: typeorm' });
      }
      if (allDeps['prisma'] || allDeps['@prisma/client']) {
        frameworks.push({ name: 'Prisma', confidence: 'high', evidence: 'package.json: prisma' });
      }
      if (allDeps['mongoose']) {
        frameworks.push({ name: 'Mongoose', confidence: 'high', evidence: 'package.json: mongoose' });
      }
    } catch {
      // Invalid package.json
    }
  }

  // -- Java / Kotlin (Gradle) --
  const buildGradlePaths = ['build.gradle', 'build.gradle.kts'];
  for (const gradleFile of buildGradlePaths) {
    const gradlePath = join(dir, gradleFile);
    if (existsSync(gradlePath)) {
      try {
        const content = readFileSync(gradlePath, 'utf-8');
        if (/spring-boot|org\.springframework/.test(content)) {
          const isKotlin = gradleFile.endsWith('.kts') || content.includes('kotlin');
          frameworks.push({
            name: isKotlin ? 'Kotlin Spring Boot' : 'Java Spring Boot',
            confidence: 'high',
            evidence: `${gradleFile}: spring-boot dependency`,
          });
        }
        if (/com\.netflix\.graphql\.dgs|dgs-framework/.test(content)) {
          frameworks.push({ name: 'DGS GraphQL', confidence: 'high', evidence: `${gradleFile}: DGS dependency` });
        }
      } catch {
        // Invalid gradle file
      }
    }
  }

  // -- Java (Maven) --
  const pomPath = join(dir, 'pom.xml');
  if (existsSync(pomPath)) {
    try {
      const content = readFileSync(pomPath, 'utf-8');
      if (/spring-boot/.test(content)) {
        frameworks.push({ name: 'Java Spring Boot', confidence: 'high', evidence: 'pom.xml: spring-boot' });
      }
      if (/hibernate/.test(content)) {
        frameworks.push({ name: 'Hibernate', confidence: 'high', evidence: 'pom.xml: hibernate' });
      }
    } catch {
      // Invalid pom.xml
    }
  }

  // -- Python --
  const pyProjectPaths = ['requirements.txt', 'pyproject.toml', 'Pipfile', 'setup.py'];
  for (const pyFile of pyProjectPaths) {
    const pyPath = join(dir, pyFile);
    if (existsSync(pyPath)) {
      try {
        const content = readFileSync(pyPath, 'utf-8');
        if (/fastapi/i.test(content)) {
          frameworks.push({ name: 'FastAPI', confidence: 'high', evidence: `${pyFile}: fastapi` });
        }
        if (/django/i.test(content)) {
          frameworks.push({ name: 'Django', confidence: 'high', evidence: `${pyFile}: django` });
        }
        if (/flask/i.test(content)) {
          frameworks.push({ name: 'Flask', confidence: 'high', evidence: `${pyFile}: flask` });
        }
        if (/sqlalchemy/i.test(content)) {
          frameworks.push({ name: 'SQLAlchemy', confidence: 'high', evidence: `${pyFile}: sqlalchemy` });
        }
        if (/tortoise/i.test(content)) {
          frameworks.push({ name: 'Tortoise ORM', confidence: 'high', evidence: `${pyFile}: tortoise` });
        }
        if (/strawberry/i.test(content)) {
          frameworks.push({ name: 'Strawberry GraphQL', confidence: 'high', evidence: `${pyFile}: strawberry` });
        }
      } catch {
        // Invalid file
      }
    }
  }

  // -- OpenAPI spec --
  const openApiFiles = ['openapi.json', 'openapi.yaml', 'openapi.yml', 'swagger.json', 'swagger.yaml'];
  for (const oaFile of openApiFiles) {
    if (existsSync(join(dir, oaFile))) {
      frameworks.push({ name: 'OpenAPI', confidence: 'high', evidence: `Root file: ${oaFile}` });
      break;
    }
  }
  // Also check docs/ or api/ subdirectories
  for (const subDir of ['docs', 'api', 'spec']) {
    const subPath = join(dir, subDir);
    if (existsSync(subPath)) {
      for (const oaFile of openApiFiles) {
        if (existsSync(join(subPath, oaFile))) {
          frameworks.push({ name: 'OpenAPI', confidence: 'medium', evidence: `${subDir}/${oaFile}` });
          break;
        }
      }
    }
  }

  // -- Go --
  const goModPath = join(dir, 'go.mod');
  if (existsSync(goModPath)) {
    try {
      const content = readFileSync(goModPath, 'utf-8');
      if (/gin-gonic/.test(content)) {
        frameworks.push({ name: 'Gin', confidence: 'high', evidence: 'go.mod: gin-gonic' });
      }
      if (/labstack\/echo/.test(content)) {
        frameworks.push({ name: 'Echo', confidence: 'high', evidence: 'go.mod: echo' });
      }
      if (/gofiber/.test(content)) {
        frameworks.push({ name: 'Fiber', confidence: 'high', evidence: 'go.mod: fiber' });
      }
    } catch {
      // Invalid go.mod
    }
  }

  return frameworks;
}

function detectOrms(dir: string): string[] {
  const orms: string[] = [];

  const packageJsonPath = join(dir, 'package.json');
  if (existsSync(packageJsonPath)) {
    try {
      const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
      const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
      if (allDeps['typeorm']) orms.push('TypeORM');
      if (allDeps['prisma'] || allDeps['@prisma/client']) orms.push('Prisma');
      if (allDeps['mongoose']) orms.push('Mongoose');
      if (allDeps['sequelize']) orms.push('Sequelize');
      if (allDeps['drizzle-orm']) orms.push('Drizzle');
    } catch { /* skip */ }
  }

  return orms;
}

function detectBuildTools(dir: string): string[] {
  const tools: string[] = [];

  if (existsSync(join(dir, 'package.json'))) tools.push('npm');
  if (existsSync(join(dir, 'pnpm-workspace.yaml'))) tools.push('pnpm');
  if (existsSync(join(dir, 'yarn.lock'))) tools.push('yarn');
  if (existsSync(join(dir, 'turbo.json'))) tools.push('Turborepo');
  if (existsSync(join(dir, 'build.gradle')) || existsSync(join(dir, 'build.gradle.kts'))) tools.push('Gradle');
  if (existsSync(join(dir, 'pom.xml'))) tools.push('Maven');
  if (existsSync(join(dir, 'go.mod'))) tools.push('Go Modules');
  if (existsSync(join(dir, 'Cargo.toml'))) tools.push('Cargo');
  if (existsSync(join(dir, 'pyproject.toml'))) tools.push('pyproject');
  if (existsSync(join(dir, 'Pipfile'))) tools.push('Pipenv');
  if (existsSync(join(dir, 'Makefile'))) tools.push('Make');
  if (existsSync(join(dir, 'docker-compose.yml')) || existsSync(join(dir, 'docker-compose.yaml'))) tools.push('Docker Compose');

  return tools;
}

function suggestParsers(
  languages: StackLanguage[],
  frameworks: StackFramework[],
  dir: string,
): SuggestedParser[] {
  const parsers: SuggestedParser[] = [];
  const frameworkNames = new Set(frameworks.map((f) => f.name));

  // Kotlin Spring Boot
  if (frameworkNames.has('Kotlin Spring Boot')) {
    parsers.push({
      package: '@codedocs/parser-kotlin-spring',
      importName: 'kotlinSpringParser',
      factoryFn: 'kotlinSpringParser',
      options: { detectFrameworks: true },
    });
  }

  // Java Spring Boot
  if (frameworkNames.has('Java Spring Boot')) {
    parsers.push({
      package: '@codedocs/parser-java-spring',
      importName: 'javaSpringParser',
      factoryFn: 'javaSpringParser',
      options: { detectFrameworks: true },
    });
  }

  // NestJS
  if (frameworkNames.has('NestJS')) {
    const opts: Record<string, boolean> = { detectOrm: true };
    if (frameworkNames.has('Apollo GraphQL')) opts.detectGraphQL = true;
    parsers.push({
      package: '@codedocs/parser-typescript-nestjs',
      importName: 'nestjsParser',
      factoryFn: 'nestjsParser',
      options: opts,
    });
  }

  // FastAPI
  if (frameworkNames.has('FastAPI')) {
    const opts: Record<string, boolean> = { detectOrm: true, detectPydantic: true };
    if (frameworkNames.has('Strawberry GraphQL')) opts.detectGraphQL = true;
    parsers.push({
      package: '@codedocs/parser-python-fastapi',
      importName: 'fastApiParser',
      factoryFn: 'fastApiParser',
      options: opts,
    });
  }

  // OpenAPI (as supplement)
  if (frameworkNames.has('OpenAPI')) {
    parsers.push({
      package: '@codedocs/parser-openapi',
      importName: 'openApiParser',
      factoryFn: 'openApiParser',
      options: { parseSchemas: true },
    });
  }

  // If no specific framework detected but we have TypeScript/JavaScript
  if (parsers.length === 0 && languages.some((l) => l.name === 'TypeScript' || l.name === 'JavaScript')) {
    // Check if there's an OpenAPI spec
    const openApiFiles = ['openapi.json', 'openapi.yaml', 'openapi.yml', 'swagger.json', 'swagger.yaml'];
    for (const oaFile of openApiFiles) {
      if (existsSync(join(dir, oaFile))) {
        parsers.push({
          package: '@codedocs/parser-openapi',
          importName: 'openApiParser',
          factoryFn: 'openApiParser',
        });
        break;
      }
    }
  }

  return parsers;
}

function inferSourcePath(dir: string): string {
  const candidates = ['src', 'app', 'lib', 'server', 'api', 'main'];
  for (const candidate of candidates) {
    const fullPath = join(dir, candidate);
    if (existsSync(fullPath) && statSync(fullPath).isDirectory()) {
      return `./${candidate}`;
    }
  }

  // Java/Kotlin convention
  const javaSrc = join(dir, 'src/main');
  if (existsSync(javaSrc)) return './src/main';

  // Python convention
  const pyApp = join(dir, 'app');
  if (existsSync(pyApp)) return './app';

  return './src';
}

/**
 * Format detection results for display
 */
export function formatDetectionResult(stack: DetectedStack): string {
  const s = getCliStrings().cli;
  const lines: string[] = [];

  if (stack.languages.length > 0) {
    lines.push(s.languages);
    for (const lang of stack.languages.slice(0, 5)) {
      lines.push(`  ${lang.name}: ${lang.fileCount} files (${lang.percentage}%)`);
    }
  }

  if (stack.frameworks.length > 0) {
    lines.push(s.frameworks);
    for (const fw of stack.frameworks) {
      lines.push(`  ${fw.name} (${fw.confidence}) - ${fw.evidence}`);
    }
  }

  if (stack.suggestedParsers.length > 0) {
    lines.push(s.suggestedParsers);
    for (const parser of stack.suggestedParsers) {
      lines.push(`  ${parser.package}`);
    }
  }

  lines.push(t(s.sourcePath, { path: stack.sourcePath }));

  return lines.join('\n');
}
