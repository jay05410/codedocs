# CodeDocs

AI-powered code documentation generator. Analyze your codebase, generate beautiful documentation, and deploy as a static site.

## Why CodeDocs?

| Feature | CodeDocs | DeepWiki | CodeWiki | DeepWiki-Open |
|---------|----------|----------|----------|---------------|
| Self-hosted | Yes | No | No | Yes |
| Private repos | Yes | Risk* | No | Yes |
| Custom parsers | Plugin system | No | No | No |
| Multi-LLM | OpenAI, Claude, Gemini, Ollama | Fixed | Fixed | Fixed |
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
# -> http://localhost:4321
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
import { defineConfig } from '@codedocs/core';
import { nestjsParser } from '@codedocs/parser-typescript-nestjs';

export default defineConfig({
  // Source code to analyze
  source: './src',

  // Parsers (auto-detected or manually selected)
  parsers: [
    nestjsParser({ detectOrm: true }),
  ],

  // AI provider for enhanced documentation
  ai: {
    provider: 'openai',        // openai | claude | gemini | ollama
    model: 'gpt-4-turbo',
    apiKey: process.env.OPENAI_API_KEY,
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
});
```

## CLI Commands

| Command | Description |
|---------|-------------|
| `codedocs init` | Interactive project setup with auto-detection |
| `codedocs analyze` | Analyze source code and extract structure |
| `codedocs generate` | Generate markdown documentation from analysis |
| `codedocs build` | Full pipeline: analyze + generate + Vite SSG build |
| `codedocs serve` | Preview documentation locally |

### Options

```bash
codedocs init --detect          # Auto-detect and skip prompts
codedocs init --yes             # Use all defaults
codedocs analyze --verbose      # Show detailed analysis info
codedocs build --skip-analyze   # Skip analysis step
```

## Built-in Parsers

| Parser | Stack | Package |
|--------|-------|---------|
| Kotlin + Spring Boot | REST, DGS GraphQL, JPA | `@codedocs/parser-kotlin-spring` |
| Java + Spring Boot | REST, JPA, Hibernate | `@codedocs/parser-java-spring` |
| TypeScript + NestJS | REST, TypeORM, Prisma | `@codedocs/parser-typescript-nestjs` |
| Python + FastAPI | REST, SQLAlchemy, Pydantic | `@codedocs/parser-python-fastapi` |
| OpenAPI / Swagger | Any (spec import) | `@codedocs/parser-openapi` |
| Go | Gin, Echo, Fiber, Chi, GORM | `@codedocs/parser-go` |
| GraphQL SDL | Schema-first GraphQL | `@codedocs/parser-graphql` |
| React / Next.js | Components, routes, hooks | `@codedocs/parser-react` |
| Vue / Nuxt | Components, routes, composables | `@codedocs/parser-vue` |
| Svelte / SvelteKit | Components, routes, stores | `@codedocs/parser-svelte` |

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

### AI-Enhanced Documentation

- Domain grouping of related endpoints
- Mermaid diagrams (ER, sequence, flow, class, state, component, deployment)
- Code explanation and business logic documentation
- Request/response example generation
- Semantic search (TF-IDF + embedding)

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

Documentation UI and generated content available in:
- English (`en`)
- Korean (`ko`)
- Japanese (`ja`)
- Chinese (`zh`)

## Deployment

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
│       ├── openapi/
│       ├── go/
│       ├── graphql/
│       ├── react/
│       ├── vue/
│       └── svelte/
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

# Run tests (144 tests)
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
| SSG | Vite |
| Markdown | unified (remark + rehype) |
| Code Highlighting | Shiki |
| Search | Pagefind |
| Diagrams | Mermaid.js |
| UI | React |
| CLI | Commander.js + Inquirer.js |
| Testing | Vitest |

## License

MIT
