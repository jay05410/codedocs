# Contributing to CodeDocs

Thank you for your interest in contributing to CodeDocs! This guide will help you get started with development.

## Development Setup

### Prerequisites

- **Node.js** >= 20
- **npm** >= 10
- **Git**

### Clone and Install

```bash
# Clone the repository
git clone https://github.com/jay05410/codedocs.git
cd codedocs

# Install dependencies (uses npm workspaces)
npm install

# Build all packages
npx turbo run build

# Run tests
npx vitest run
```

## Project Structure

```
codedocs/
├── packages/
│   ├── core/              # @codedocs/core - Core engine
│   │   ├── src/
│   │   │   ├── parser/    # Parser engine and plugins
│   │   │   ├── ai/        # AI provider integrations
│   │   │   ├── generator/ # Markdown and sidebar generation
│   │   │   ├── diagram/   # Mermaid diagram generation
│   │   │   ├── search/    # Semantic search
│   │   │   ├── changelog/ # Version comparison
│   │   │   ├── i18n/      # Internationalization
│   │   │   └── memo/      # Memo system
│   │   └── tests/
│   │
│   ├── cli/               # @codedocs/cli - CLI tool
│   │   ├── src/
│   │   │   ├── commands/  # CLI commands (init, analyze, etc.)
│   │   │   └── templates/ # Config templates
│   │   └── tests/
│   │
│   ├── theme/             # @codedocs/theme - React UI
│   │   ├── src/
│   │   │   ├── app/       # Layout components
│   │   │   ├── components/ # UI components
│   │   │   ├── presets/   # Theme presets
│   │   │   └── css/       # Stylesheets
│   │   └── tests/
│   │
│   ├── vite-plugin/       # @codedocs/vite-plugin - Build tool
│   │   ├── src/
│   │   │   ├── plugin.ts  # Vite plugin
│   │   │   ├── markdown-loader.ts
│   │   │   └── ssg.ts
│   │   └── tests/
│   │
│   └── parsers/           # Parser packages
│       ├── kotlin-spring/
│       ├── java-spring/
│       ├── typescript-nestjs/
│       ├── python-fastapi/
│       ├── php/
│       ├── go/
│       ├── c/
│       ├── cpp/
│       ├── openapi/
│       ├── graphql/
│       ├── react/
│       ├── vue/
│       └── svelte/
│
├── docs/                  # Documentation and guides
├── turbo.json             # Turborepo configuration
└── tsconfig.base.json     # Shared TypeScript config
```

## Development Workflow

### Build

```bash
# Build all packages
npx turbo run build

# Build specific package
cd packages/core
npm run build

# Watch mode for development
npx turbo run dev
```

### Testing

```bash
# Run all tests (144 tests across packages)
npx vitest run

# Run tests in watch mode
npx vitest

# Run tests for specific package
cd packages/core
npm run test

# Test with coverage
npx vitest run --coverage
```

### Type Checking

```bash
# Type check all packages
npx turbo run typecheck

# Type check specific package
cd packages/cli
npm run typecheck
```

### Linting

```bash
# Lint all packages
npx turbo run lint

# Fix linting issues
npx turbo run lint:fix
```

## How to Add a New Parser Plugin

Parser plugins extract documentation structure from source code.

### 1. Create Package Structure

```bash
mkdir -p packages/parsers/my-framework
cd packages/parsers/my-framework
npm init -y
```

### 2. Implement Parser

```typescript
// packages/parsers/my-framework/src/index.ts
import type { ParserPlugin, SourceFile, ParseResult } from '@codedocs/core';

export interface MyFrameworkOptions {
  detectORM?: boolean;
  includeTests?: boolean;
}

export function myFrameworkParser(options: MyFrameworkOptions = {}): ParserPlugin {
  return {
    name: 'my-framework-parser',
    filePattern: '**/*.{ts,js}',

    async parse(files: SourceFile[]): Promise<ParseResult> {
      const endpoints = [];
      const entities = [];
      const services = [];

      for (const file of files) {
        // Parse file content
        const ast = parseSourceCode(file.content);

        // Extract endpoints (routes, controllers)
        if (file.path.includes('controller')) {
          endpoints.push({
            id: 'my-endpoint',
            path: '/api/resource',
            method: 'GET',
            description: 'Description from code comments',
            // ... more fields
          });
        }

        // Extract entities (models, schemas)
        if (file.path.includes('model')) {
          entities.push({
            id: 'my-entity',
            name: 'Resource',
            description: 'Entity description',
            fields: [
              { name: 'id', type: 'number', required: true },
              { name: 'name', type: 'string', required: true },
            ],
            // ... more fields
          });
        }
      }

      return {
        endpoints,
        entities,
        services,
        types: [],
      };
    },
  };
}
```

### 3. Add Tests

```typescript
// packages/parsers/my-framework/tests/parser.test.ts
import { describe, it, expect } from 'vitest';
import { myFrameworkParser } from '../src/index.js';

describe('myFrameworkParser', () => {
  it('should parse endpoints', async () => {
    const parser = myFrameworkParser();
    const files = [
      {
        path: '/src/UserController.ts',
        content: `
          @Controller('/users')
          class UserController {
            @Get('/')
            getUsers() {}
          }
        `,
      },
    ];

    const result = await parser.parse(files);
    expect(result.endpoints).toHaveLength(1);
    expect(result.endpoints[0].path).toBe('/users');
  });

  it('should parse entities', async () => {
    // Similar test for entities
  });
});
```

### 4. Export from Parser

```typescript
// packages/parsers/my-framework/src/index.ts
export { myFrameworkParser } from './parser.js';
export type { MyFrameworkOptions } from './parser.js';
```

### 5. Add to Monorepo

Update `package.json`:

```json
{
  "name": "@codedocs/parser-my-framework",
  "version": "0.1.0",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "dependencies": {
    "@codedocs/core": "*"
  }
}
```

## How to Add a New AI Provider

AI providers generate enhanced documentation (examples, explanations, diagrams).

### 1. Create Provider Implementation

```typescript
// packages/core/src/ai/providers/my-provider.ts
import type { AiProvider, AiProviderConfig } from '../types.js';

export interface MyProviderConfig extends AiProviderConfig {
  provider: 'my-provider';
  apiKey: string;
  baseUrl?: string;
}

export class MyProvider implements AiProvider {
  private apiKey: string;
  private model: string;
  private baseUrl: string;

  constructor(config: MyProviderConfig) {
    this.apiKey = config.apiKey;
    this.model = config.model;
    this.baseUrl = config.baseUrl || 'https://api.myprovider.com';
  }

  async generateCompletion(prompt: string): Promise<string> {
    const response = await fetch(`${this.baseUrl}/v1/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        prompt,
        max_tokens: 2000,
      }),
    });

    const data = await response.json();
    return data.choices[0].text;
  }

  async generateExamples(endpoint: EndpointInfo): Promise<GeneratedExample> {
    const prompt = `Generate request/response examples for: ${endpoint.path}`;
    const completion = await this.generateCompletion(prompt);
    // Parse and return examples
  }

  async explainCode(code: string): Promise<string> {
    const prompt = `Explain this code:\n\n${code}`;
    return this.generateCompletion(prompt);
  }

  async groupByDomain(endpoints: EndpointInfo[]): Promise<DomainGroup[]> {
    // Implementation for domain grouping
  }
}
```

### 2. Register Provider

```typescript
// packages/core/src/ai/providers/index.ts
import { MyProvider } from './my-provider.js';

export function createAiProvider(config: AiProviderConfig): AiProvider {
  switch (config.provider) {
    case 'openai':
      return new OpenAiProvider(config);
    case 'claude':
      return new ClaudeProvider(config);
    case 'gemini':
      return new GeminiProvider(config);
    case 'ollama':
      return new OllamaProvider(config);
    case 'my-provider':
      return new MyProvider(config);
    default:
      throw new Error(`Unknown AI provider: ${config.provider}`);
  }
}
```

### 3. Update Types

```typescript
// packages/core/src/ai/types.ts
export type AiProviderConfig =
  | OpenAiProviderConfig
  | ClaudeProviderConfig
  | GeminiProviderConfig
  | OllamaProviderConfig
  | MyProviderConfig;
```

### 4. Add Tests

```typescript
// packages/core/tests/ai/my-provider.test.ts
import { describe, it, expect, vi } from 'vitest';
import { MyProvider } from '../../src/ai/providers/my-provider.js';

describe('MyProvider', () => {
  it('should generate completion', async () => {
    const provider = new MyProvider({
      provider: 'my-provider',
      model: 'my-model',
      apiKey: 'test-key',
    });

    // Mock fetch
    global.fetch = vi.fn().mockResolvedValue({
      json: async () => ({
        choices: [{ text: 'Generated text' }],
      }),
    });

    const result = await provider.generateCompletion('Test prompt');
    expect(result).toBe('Generated text');
  });
});
```

## Testing Guidelines

### Unit Tests

- Test individual functions and classes
- Mock external dependencies (file system, network)
- Use descriptive test names
- Aim for >80% code coverage

```typescript
describe('ParserEngine', () => {
  it('should analyze files with multiple parsers', async () => {
    const engine = new ParserEngine([parser1, parser2]);
    const result = await engine.analyze(files);
    expect(result.endpoints).toHaveLength(2);
  });
});
```

### Integration Tests

- Test full workflows (e.g., init → analyze → generate)
- Use temporary directories for file system tests
- Clean up resources after tests

## Pull Request Process

1. **Fork** the repository
2. **Create a branch**: `git checkout -b feature/my-feature`
3. **Make changes** with clear commits
4. **Add tests** for new functionality
5. **Run tests**: `npx vitest run`
6. **Type check**: `npx turbo run typecheck`
7. **Commit**: Follow conventional commits format
   - `feat: add new parser for Django`
   - `fix: resolve markdown rendering issue`
   - `docs: update contributing guide`
   - `test: add tests for AI providers`
8. **Push**: `git push origin feature/my-feature`
9. **Open PR** with clear description

### PR Checklist

- [ ] Tests pass (`npx vitest run`)
- [ ] Type checking passes (`npx turbo run typecheck`)
- [ ] Code follows existing style
- [ ] Documentation updated (if needed)
- [ ] No console.log or debug code
- [ ] Commits follow conventional format

## Code Style

### TypeScript

- **Strict mode** enabled
- **ESM modules** (`.js` extensions in imports)
- **No `any`** types (use `unknown` or proper types)
- **Explicit return types** for public APIs
- **Named exports** preferred over default exports

```typescript
// Good
export function createParser(options: ParserOptions): Parser {
  return { /* ... */ };
}

// Avoid
export default function(options: any) {
  // ...
}
```

### Naming Conventions

- **Interfaces/Types**: PascalCase (`ParserPlugin`, `AiProvider`)
- **Functions**: camelCase (`createParser`, `generateDocs`)
- **Constants**: UPPER_SNAKE_CASE (`DEFAULT_PORT`, `MAX_RETRIES`)
- **Files**: kebab-case (`parser-engine.ts`, `ai-provider.ts`)

### File Organization

```typescript
// 1. Type imports
import type { ParserPlugin } from './types.js';

// 2. Value imports
import { readFile } from 'fs/promises';

// 3. Types/Interfaces
export interface Options { /* ... */ }

// 4. Implementation
export function myFunction(options: Options) { /* ... */ }
```

## Getting Help

- **GitHub Issues**: Report bugs or request features
- **GitHub Discussions**: Ask questions or discuss ideas
- **Discord**: Join the community (link in main README)

## License

By contributing to CodeDocs, you agree that your contributions will be licensed under the MIT License.
