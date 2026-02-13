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

**AI Features** (when configured):
- Domain-based endpoint grouping
- Mermaid diagram generation
- Code explanation and business logic docs
- Request/response examples

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
- `--verbose` - Show detailed build output

**Examples:**

```bash
# Full build
codedocs build

# Skip analysis (use cached results)
codedocs build --skip-analyze

# Quick rebuild (skip analyze and generate)
codedocs build --skip-analyze --skip-generate

# Detailed output
codedocs build --verbose
```

**Build pipeline:**

1. Analyze source code
2. Generate markdown documentation
3. Build static site with Vite
4. Index with Pagefind for search

**Output:** Production-ready static site in `./dist`

---

### `codedocs serve`

Preview documentation locally.

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
```

**URL:** `http://localhost:4321`

---

### `codedocs dev`

Watch mode with auto re-analyze and hot reload.

```bash
codedocs dev
```

**Options:**

- `-c, --config <path>` - Path to config file (default: `codedocs.config.ts`)
- `-p, --port <port>` - Dev server port (default: `3000`)
- `--verbose` - Show detailed watch information

**Examples:**

```bash
# Start dev server
codedocs dev

# Custom port
codedocs dev --port 8080

# Detailed logs
codedocs dev --verbose
```

**Features:**
- File watching for source code changes
- Incremental re-analysis
- Hot Module Replacement (HMR)
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
