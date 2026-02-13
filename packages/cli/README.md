# @codedocs/cli

[![npm version](https://badge.fury.io/js/@codedocs%2Fcli.svg)](https://www.npmjs.com/package/@codedocs/cli)

Command-line interface for CodeDocs - AI-powered code documentation generator.

## Installation

### npx (Recommended)

No installation required:

```bash
npx codedocs init
npx codedocs build
```

### Global Installation

```bash
npm install -g @codedocs/cli
codedocs --help
```

### Local Installation

```bash
npm install --save-dev @codedocs/cli
npx codedocs init
```

## Commands

### `codedocs init`

Initialize a new CodeDocs project with interactive setup.

```bash
codedocs init
```

**Options:**

- `-y, --yes` - Skip prompts and use default values
- `-d, --detect` - Auto-detect stack and skip prompts
- `-s, --source <path>` - Target source directory to analyze
- `--ci` - Generate CI/CD configuration only

**Examples:**

```bash
# Interactive setup with auto-detection
codedocs init

# Quick setup with defaults
codedocs init --yes

# Auto-detect and configure
codedocs init --detect

# Generate CI/CD config for existing project
codedocs init --ci

# Specify source directory
codedocs init --source ./backend/src
```

**What it does:**

1. Detects your tech stack (language, frameworks, ORMs)
2. Suggests appropriate parsers
3. Creates `codedocs.config.ts` with optimized settings
4. Optionally generates CI/CD configuration (GitHub Actions, GitLab CI, Jenkins)
5. Sets up directory structure

**Detected stacks:**

- Kotlin + Spring Boot (REST, DGS GraphQL, JPA)
- Java + Spring Boot (REST, JPA, Hibernate)
- TypeScript + NestJS (REST, TypeORM, Prisma)
- Python + FastAPI (REST, SQLAlchemy, Pydantic)
- PHP (Laravel, Symfony, Eloquent, Doctrine)
- Go (Gin, Echo, Fiber, GORM)
- C/C++ (microhttpd, Crow, Pistache)
- React, Vue, Svelte

---

### `codedocs analyze`

Analyze source code and extract documentation structure.

```bash
codedocs analyze
```

**Options:**

- `-c, --config <path>` - Path to config file (default: `codedocs.config.ts`)
- `-o, --output <path>` - Output path for analysis results (default: `./analysis-result.json`)
- `--verbose` - Show detailed analysis information

**Examples:**

```bash
# Basic analysis
codedocs analyze

# Custom config path
codedocs analyze --config custom.config.ts

# Save to custom location
codedocs analyze --output ./data/analysis.json

# Detailed output
codedocs analyze --verbose
```

**Output:** JSON file containing:
- Detected endpoints (REST, GraphQL)
- Entities/models (database schemas, DTOs)
- Services/controllers
- Type definitions
- Dependencies

---

### `codedocs generate`

Generate markdown documentation from analysis results.

```bash
codedocs generate
```

**Options:**

- `-c, --config <path>` - Path to config file (default: `codedocs.config.ts`)
- `-i, --input <path>` - Path to analysis results (default: `./analysis-result.json`)
- `-o, --output <path>` - Output directory for markdown files (default: `./docs`)
- `--verbose` - Show detailed generation information

**Examples:**

```bash
# Basic generation
codedocs generate

# Custom paths
codedocs generate --input ./data/analysis.json --output ./documentation

# With AI enhancements
OPENAI_API_KEY=sk-xxx codedocs generate
```

**AI Features** (when `ai` is configured in `codedocs.config.ts`):

| Feature Flag | What it does | Token cost |
|---|---|---|
| `domainGrouping` | Groups endpoints/entities by business domain in sidebar | ~800 tokens |
| `flowDiagrams` | Generates Mermaid architecture flow diagram | ~500 tokens |
| `codeExplanation` | Generates request/response examples for API endpoints | ~500/endpoint |

- Prompts are sent in English for token efficiency (~20-30% savings)
- Responses are returned in the configured `docs.locale`
- Three-tier fallback: AI → heuristic grouping → static sidebar
- Total budget: ~9,000 tokens/run (1 grouping + 15 examples + 1 diagram)

**Config example:**

```typescript
// codedocs.config.ts
export default {
  source: './src',
  ai: {
    provider: 'openai',    // openai | anthropic | gemini | ollama | glm | custom
    model: 'gpt-4o-mini',
    features: {
      domainGrouping: true,
      flowDiagrams: true,
      codeExplanation: true,  // explicit opt-in required
    },
  },
  docs: {
    locale: 'ko',  // en | ko | ja | zh
  },
};
```

---

### `codedocs build`

Full pipeline: analyze + generate + build static site.

```bash
codedocs build
```

**Options:**

- `-c, --config <path>` - Path to config file (default: `codedocs.config.ts`)
- `--skip-analyze` - Skip analysis step (use existing results)
- `--skip-generate` - Skip generation step (use existing markdown)
- `--docs-dir <path>` - Input docs directory (default: `./docs-output`)
- `-o, --output <path>` - Output directory (default: `./dist`)
- `--verbose` - Show detailed build output

**Examples:**

```bash
# Full build
codedocs build

# Skip analysis (use cached results)
codedocs build --skip-analyze

# Quick rebuild (skip analyze and generate)
codedocs build --skip-analyze --skip-generate

# Custom output directory
codedocs build --output ./my-output

# Detailed output
codedocs build --verbose
```

**Build pipeline:**

1. Analyze source code
2. Generate markdown documentation
3. Build static HTML site (Marked-based rendering)

**Output:** Production-ready static site in `./dist`

---

### `codedocs serve`

Preview built documentation locally with a static file server.

```bash
codedocs serve
```

**Options:**

- `-p, --port <port>` - Port number (default: `4321`)
- `-d, --dir <path>` - Directory to serve (default: `./dist`)
- `--open` - Open browser automatically

**Examples:**

```bash
# Serve on default port
codedocs serve

# Custom port
codedocs serve --port 3000

# Auto-open browser
codedocs serve --open

# Serve custom directory
codedocs serve -d ./my-output
```

**URL:** `http://localhost:4321`

**Note:** Run `codedocs build` first to generate the static site.

---

### `codedocs dev`

Watch mode with auto re-analyze and hot reload.

```bash
codedocs dev
```

**Options:**

- `-c, --config <path>` - Path to config file (default: `codedocs.config.ts`)
- `-p, --port <port>` - Dev server port (default: `3000`)
- `--host <host>` - Host address (default: `localhost`)
- `--open` - Open browser automatically

**Examples:**

```bash
# Start dev server
codedocs dev

# Custom port and host
codedocs dev --port 8080 --host 0.0.0.0

# Auto-open browser
codedocs dev --open
```

**Features:**
- File watching for source code changes
- Incremental re-analysis
- Auto-rebuild on source changes
- Live preview

---

### `codedocs changelog`

Generate changelog and version comparison.

```bash
codedocs changelog
```

**Options:**

- `-c, --config <path>` - Path to config file
- `--from <version>` - Compare from version
- `--to <version>` - Compare to version
- `--output <path>` - Output markdown file (default: `CHANGELOG.md`)

**Examples:**

```bash
# Generate changelog
codedocs changelog --from v1.0.0 --to v2.0.0

# Custom output
codedocs changelog --output docs/releases/v2.0.0.md
```

## Environment Variables

Set AI provider API keys:

```bash
# OpenAI
export OPENAI_API_KEY=sk-...

# Anthropic Claude
export ANTHROPIC_API_KEY=sk-ant-...

# Google Gemini
export GOOGLE_API_KEY=...

# Ollama (local, no key required)
export OLLAMA_BASE_URL=http://localhost:11434
```

**In CI/CD:**

GitHub Actions:
```yaml
env:
  OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
```

GitLab CI:
```yaml
variables:
  OPENAI_API_KEY: ${OPENAI_API_KEY}
```

## Quick Start Workflow

```bash
# 1. Initialize project
npx codedocs init

# 2. Build documentation
npx codedocs build

# 3. Preview locally
npx codedocs serve

# 4. Deploy (copy ./dist to your server)
```

## Development Workflow

```bash
# Watch mode for development
npx codedocs dev

# View at http://localhost:3000
# Edit source code → auto-regenerate docs
```

## CI/CD Integration

Generate CI/CD configs automatically:

```bash
codedocs init --ci
```

**GitHub Actions** (`.github/workflows/deploy.yml`):
```yaml
- run: npm ci
- run: npx codedocs build
  env:
    OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
```

**GitLab CI** (`.gitlab-ci.yml`):
```yaml
script:
  - npm ci
  - npx codedocs build
```

**Jenkins** (`Jenkinsfile`):
```groovy
sh 'npm ci'
sh 'npx codedocs build'
```

## Troubleshooting

**Config not found:**
```bash
# Initialize first
codedocs init
```

**No files detected:**
```bash
# Check source path in codedocs.config.ts
source: './src'  # adjust as needed
```

**AI features not working:**
```bash
# Set API key
export OPENAI_API_KEY=sk-...

# Or use local Ollama
ai: { provider: 'ollama', model: 'llama2' }
```

## Requirements

- Node.js >= 20
- npm >= 10

## License

MIT
