# CodeDocs

AI-powered code documentation generator. Analyze your codebase, generate beautiful documentation, and deploy as a static site.

## Why CodeDocs?

| Feature | CodeDocs | DeepWiki | CodeWiki | DeepWiki-Open |
|---------|----------|----------|----------|---------------|
| Self-hosted | Yes | No | No | Yes |
| Private repos | Yes | Risk* | No | Yes |
| Custom parsers | Plugin system | No | No | No |
| Multi-LLM | OpenAI, Claude, Gemini, GLM, Ollama, Codex CLI, Gemini CLI | Fixed | Fixed | Fixed |
| Air-gapped | Yes (Ollama) | No | No | No |
| i18n | ko/en/ja/zh | English | English | English |
| Static site output | Yes | No | No | No |

\* Code may be used for model training

## Quick Start

```bash
# 1. Initialize (interactive wizard with auto-detection)
npx codedocs init

# 2. Analyze + Generate + Build (all-in-one)
npx codedocs build

# 3. Preview locally
npx codedocs serve
# -> http://localhost:3000
```

## Installation

```bash
npm install codedocs
```

Or install individual packages:

```bash
npm install @codedocs/core @codedocs/cli @codedocs/theme @codedocs/vite-plugin
```

### Requirements

- Node.js >= 20
- npm >= 10

## Configuration

CodeDocs is configured via `codedocs.config.ts`:

```typescript
/** @type {import('@codedocs/core').CodeDocsConfig} */
export default {
  // Source code to analyze
  source: './src',

  // Parsers (use string names - auto-resolved at runtime)
  parsers: ['react', 'nestjs'],

  // AI provider for enhanced documentation
  ai: {
    provider: 'openai',        // openai | claude | gemini | glm | ollama | custom
    model: 'gpt-5.2',
    apiKey: process.env.OPENAI_API_KEY,
    // auth: 'mcp',            // optional: route through MCP server (no API key)
    timeout: 60000,            // optional: request timeout in ms
    maxRetries: 1,             // optional: retry count for transient errors
    features: {
      domainGrouping: true,
      flowDiagrams: true,
      codeExplanation: true,
    },
  },

  // Documentation structure
  docs: {
    title: 'My Project',
    locale: 'en',              // ko | en | ja | zh
    sections: [
      { id: 'overview', label: 'Overview', type: 'auto' },
      { id: 'api', label: 'API', type: 'endpoints' },
      { id: 'entities', label: 'Data Models', type: 'entities' },
      { id: 'architecture', label: 'Architecture', type: 'architecture' },
      { id: 'changelog', label: 'Changelog', type: 'changelog' },
    ],
  },

  // Theme customization
  theme: {
    preset: 'default',         // default | swagger | redoc | mintlify
    colors: { primary: '#2e8555' },
  },
};
```

## CLI Commands

| Command | Description |
|---------|-------------|
| `codedocs init` | Interactive project setup with auto-detection |
| `codedocs analyze` | Analyze source code and extract structure |
| `codedocs generate` | Generate markdown documentation from analysis |
| `codedocs build` | Full pipeline: analyze + generate + static site build |
| `codedocs serve` | Preview documentation locally |
| `codedocs dev` | Watch mode with auto re-analyze and hot reload |

### Options

```bash
codedocs init --detect          # Auto-detect and skip prompts
codedocs init --yes             # Use all defaults
codedocs init --ci              # CI-only generation (GitHub Actions, GitLab CI, Jenkins)
codedocs analyze --verbose      # Show detailed analysis info
codedocs build --skip-analyze   # Skip analysis step
codedocs dev --port 3000        # Custom port for dev server
```

## Built-in Parsers

| Parser | Name | Stack | Package |
|--------|------|-------|---------|
| React | `react` | Components, hooks, Next.js routes | `@codedocs/parser-react` |
| Vue | `vue` | Components, composables, Nuxt routes | `@codedocs/parser-vue` |
| Svelte | `svelte` | Components, stores, SvelteKit routes | `@codedocs/parser-svelte` |
| NestJS | `nestjs` | REST, GraphQL, TypeORM, Prisma | `@codedocs/parser-typescript-nestjs` |
| Kotlin Spring Boot | `kotlin-spring` | REST, DGS GraphQL, JPA | `@codedocs/parser-kotlin-spring` |
| Java Spring Boot | `java-spring` | REST, JPA, Hibernate | `@codedocs/parser-java-spring` |
| Python FastAPI | `python-fastapi` | REST, SQLAlchemy, Pydantic | `@codedocs/parser-python-fastapi` |
| PHP | `php` | Laravel, Symfony, Eloquent, Doctrine | `@codedocs/parser-php` |
| Go | `go` | Gin, Echo, Fiber, Chi, GORM | `@codedocs/parser-go` |
| C | `c` | Structs, functions, enums, macros | `@codedocs/parser-c` |
| C++ | `cpp` | Classes, templates, namespaces | `@codedocs/parser-cpp` |
| GraphQL | `graphql` | Schema-first GraphQL | `@codedocs/parser-graphql` |
| OpenAPI / Swagger | `openapi` | Any stack (spec import) | `@codedocs/parser-openapi` |

## Custom Parsers

Create your own parser as a plugin:

```typescript
import { defineConfig } from '@codedocs/core';

export default defineConfig({
  source: './src',
  parsers: [{
    name: 'my-django-parser',
    filePattern: '**/*.py',
    parse(files) {
      // Your custom parsing logic
      return {
        endpoints: [/* ... */],
        entities: [/* ... */],
      };
    },
  }],
});
```

## Features

### Auto Stack Detection

`codedocs init` automatically detects your tech stack by scanning:
- `package.json`, `build.gradle`, `pom.xml`, `go.mod`, `requirements.txt`
- Suggests appropriate parsers based on detected frameworks

### MCP Authentication (No API Key)

Delegate AI requests to installed CLI tools (Codex, Gemini CLI) via OAuth — no API key required:

```typescript
// OpenAI via Codex CLI
ai: {
  provider: 'openai',
  model: 'gpt-5.2',
  auth: 'mcp',
  mcp: {
    command: 'codex',
    args: ['--quiet', '--full-auto', '-'],
  },
}

// Google via Gemini CLI
ai: {
  provider: 'gemini',
  model: 'gemini-3-pro',
  auth: 'mcp',
  mcp: {
    command: 'gemini',
    args: ['-'],
  },
}
```

Install and authenticate the CLI tool first:
```bash
npm install -g @openai/codex    # then: codex auth login
npm install -g @google/gemini-cli  # then: gemini auth login
```

### Tree-sitter AST Parsing

Optional AST-based parsing engine using [Tree-sitter](https://tree-sitter.github.io/) WASM for higher accuracy than regex-based parsers. Supports 13 languages: TypeScript, TSX, JavaScript, JSX, Python, Go, Java, Kotlin, PHP, C, C++, HTML, CSS.

```bash
# Install optional dependency
npm install web-tree-sitter tree-sitter-typescript  # add grammars as needed
```

Falls back to regex parsers when tree-sitter is not installed.

### Optional HTML Sanitizer Hardening

CodeDocs uses a conservative built-in HTML sanitization fallback by default.  
If you want stricter allowlist-based sanitization for rendered markdown HTML, install:

```bash
npm install sanitize-html
```

### AI-Enhanced Documentation

- Domain grouping of related endpoints
- Mermaid diagrams (ER, sequence, flow, class, state, component, deployment)
- Code explanation and business logic documentation
- Request/response example generation
- Pagefind search integration with full-text indexing
- Shiki code highlighting with dual theme support (light/dark)
- Incremental build caching for faster rebuilds
- Watch mode with hot module replacement (HMR)

### Theme Presets

Choose from built-in presets or fully customize:

| Preset | Style |
|--------|-------|
| `default` | Clean, modern documentation |
| `swagger` | Swagger UI-inspired API docs |
| `redoc` | ReDoc-style three-panel layout |
| `mintlify` | Mintlify-inspired design |

### API Playground

Interactive API testing directly from your documentation (Postman-like).

### Version Comparison

Track breaking changes between versions with automatic diff detection.

### Multi-Language Support

All generated documentation content (section headers, table labels, page titles) is fully translated based on the `locale` setting. Supported languages:
- English (`en`)
- Korean (`ko`)
- Japanese (`ja`)
- Chinese (`zh`)

## Deployment

CodeDocs generates static sites that can be deployed anywhere. Use `codedocs init --ci` to auto-generate CI/CD configurations for GitHub Actions, GitLab CI, and Jenkins. See the comprehensive deployment guide at `docs/deploy-guide.md` for detailed instructions.

### GitHub Pages

```yaml
# .github/workflows/deploy.yml
name: Deploy CodeDocs
on:
  push:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npx codedocs build
      - uses: actions/upload-pages-artifact@v2
        with:
          path: ./dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    permissions:
      pages: write
      id-token: write
    environment:
      name: github-pages
    steps:
      - uses: actions/deploy-pages@v3
```

### Nginx

```bash
npx codedocs build
# Copy ./dist to your web server
cp -r ./dist /var/www/codedocs
```

## Project Structure

```
codedocs/
├── packages/
│   ├── core/           # @codedocs/core - Engine (parser, AI, generator)
│   ├── cli/            # @codedocs/cli - CLI tool
│   ├── theme/          # @codedocs/theme - React UI theme
│   ├── vite-plugin/    # @codedocs/vite-plugin - Vite SSG plugin
│   └── parsers/        # Built-in parser packages
│       ├── kotlin-spring/
│       ├── java-spring/
│       ├── typescript-nestjs/
│       ├── python-fastapi/
│       ├── php/
│       ├── openapi/
│       ├── go/
│       ├── c/
│       ├── cpp/
│       ├── graphql/
│       ├── react/
│       ├── vue/
│       └── svelte/
├── docs/               # Documentation and guides
├── .github/workflows/  # CI/CD
├── turbo.json          # Turborepo config
└── tsconfig.base.json  # Shared TypeScript config
```

## Development

```bash
# Install dependencies
npm install

# Build all packages
npx turbo run build

# Run tests (217 tests)
npx vitest run

# Typecheck
npx turbo run typecheck

# Watch mode
npx turbo run dev
```

## Tech Stack

| Area | Technology |
|------|-----------|
| Monorepo | Turborepo + npm workspaces |
| Language | TypeScript (strict) |
| SSG | Vite + unified (remark/rehype) |
| Markdown | unified (remark + rehype) |
| Code Highlighting | Shiki |
| Search | Pagefind |
| Diagrams | Mermaid.js |
| UI | React |
| CLI | Commander.js + Inquirer.js |
| Code Parsing | Tree-sitter WASM (optional) |
| Testing | Vitest |

## License

MIT
