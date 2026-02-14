# @codedocs/core

[![npm version](https://badge.fury.io/js/@codedocs%2Fcore.svg)](https://www.npmjs.com/package/@codedocs/core)

Core engine for CodeDocs - AI-powered code documentation generator.

## Installation

```bash
npm install @codedocs/core
```

## Overview

`@codedocs/core` is the foundational package that powers CodeDocs. It provides:

- **Parser Engine**: Extensible parser plugin system for analyzing source code
- **AI Integration**: Multi-provider AI support (OpenAI, Claude, Gemini, Ollama)
- **Documentation Generation**: Markdown generation with frontmatter and metadata
- **Semantic Search**: Embedding-based search with custom providers
- **Diagram Generation**: Mermaid diagram generation (ER, sequence, flow, etc.)
- **Version Comparison**: Automatic breaking change detection and diff generation
- **Internationalization**: Built-in i18n support (ko, en, ja, zh)

## Key APIs

### Configuration

```typescript
import { defineConfig } from '@codedocs/core';

export default defineConfig({
  source: './src',
  parsers: [/* parser plugins */],
  ai: {
    provider: 'openai',
    model: 'gpt-4-turbo',
    apiKey: process.env.OPENAI_API_KEY,
  },
  docs: {
    title: 'My Project',
    locale: 'en',
    sections: [
      { id: 'api', label: 'API', type: 'endpoints' },
      { id: 'entities', label: 'Data Models', type: 'entities' },
    ],
  },
});
```

### Parser Engine

Analyze source code with custom parsers:

```typescript
import { ParserEngine, FileReader } from '@codedocs/core';

const fileReader = new FileReader();
const sourceFiles = await fileReader.readFiles('./src', ['**/*.ts']);

const engine = new ParserEngine([
  {
    name: 'my-parser',
    filePattern: '**/*.ts',
    parse(files) {
      return {
        endpoints: [/* extracted API endpoints */],
        entities: [/* extracted data models */],
        services: [/* extracted services */],
      };
    },
  },
]);

const result = await engine.analyze(sourceFiles);
// result: { endpoints, entities, services, types, errors }
```

### AI Providers

Create AI provider instances for enhanced documentation:

```typescript
import { createAiProvider } from '@codedocs/core';

const provider = createAiProvider({
  provider: 'openai',
  model: 'gpt-4-turbo',
  apiKey: process.env.OPENAI_API_KEY,
});

// Use AI provider for chat
const response = await provider.chat([
  { role: 'user', content: 'Explain this code...' },
]);

// Domain grouping
import { groupByDomain } from '@codedocs/core';
const result = await groupByDomain(provider, endpoints, entities, {
  locale: 'en',
  maxGroups: 8,
});
```

Supported providers: `openai`, `claude`, `gemini`, `ollama`

### Markdown Generation

Generate documentation pages with frontmatter:

```typescript
import { MarkdownGenerator, generateFrontmatter } from '@codedocs/core';

const generator = new MarkdownGenerator({
  locale: 'en',
  sections: [
    { id: 'api', label: 'API', type: 'endpoints' },
  ],
});

const pages = await generator.generate(analysisResult);

// Custom frontmatter
const frontmatter = generateFrontmatter({
  title: 'API Reference',
  description: 'REST API documentation',
  tags: ['api', 'rest'],
});
```

### Sidebar Generation

Generate navigation sidebar structure:

```typescript
import { SidebarGenerator } from '@codedocs/core';

const sidebarGen = new SidebarGenerator();
const sidebar = sidebarGen.generate(pages);
// Returns hierarchical sidebar structure
```

### Diagram Generation

Create Mermaid diagrams from code structure:

```typescript
import { DiagramGenerator } from '@codedocs/core';

const diagramGen = new DiagramGenerator();

// Entity Relationship diagram
const erDiagram = await diagramGen.generateERDiagram(entities);

// Sequence diagram
const seqDiagram = await diagramGen.generateSequenceDiagram(endpoint);

// Flow diagram
const flowDiagram = await diagramGen.generateFlowDiagram(service);
```

Supported diagram types: `er`, `sequence`, `flow`, `class`, `state`, `component`, `deployment`

### Semantic Search

Full-text and semantic search with embeddings:

```typescript
import { SemanticSearch } from '@codedocs/core';

const search = new SemanticSearch({
  embeddingProvider: myEmbeddingProvider,
});

await search.indexDocuments(pages);
const results = await search.search('authentication flow', { limit: 5 });
```

### Changelog & Version Comparison

Track changes between versions:

```typescript
import {
  compareAnalysisResults,
  generateReleaseNote,
  generateVersionComparison,
} from '@codedocs/core';

// Compare two versions
const changes = compareAnalysisResults(oldResult, newResult);
// Returns: { added, modified, removed }

// Generate release notes
const releaseNote = await generateReleaseNote(changes, aiProvider);

// Detailed version comparison
const comparison = generateVersionComparison(oldResult, newResult);
// Returns breaking changes, endpoint diffs, entity diffs
```

### Internationalization

Get localized strings:

```typescript
import { getStrings, getSupportedLocales, getLocaleName, LOCALE_NAMES } from '@codedocs/core';

const strings = getStrings('en');
console.log(strings.overview.title); // "API Documentation"

const locales = getSupportedLocales(); // ['ko', 'en', 'ja', 'zh']

const name = getLocaleName('ko'); // "Korean"
console.log(LOCALE_NAMES); // { en: 'English', ko: 'Korean', ja: 'Japanese', zh: 'Chinese' }
```

### Analysis Caching

Incremental builds with smart caching:

```typescript
import { AnalysisCache } from '@codedocs/core';

const cache = new AnalysisCache('.codedocs/cache');
await cache.load();

// Check if file changed
if (cache.hasChanged(filePath, content)) {
  // Re-analyze
  const result = await parser.parse(file);
  cache.set(filePath, result, content);
}

await cache.save();
```

### Memo System

Store and retrieve documentation memos:

```typescript
import { createEmptyMemoStore, parseMemoStore, mergeMemoStores } from '@codedocs/core';

const store = createEmptyMemoStore();
store.memos['api/users'] = {
  id: 'api/users',
  content: 'User management endpoint',
  isShared: true,
};

// Merge shared and personal memos
const merged = mergeMemoStores(sharedStore, personalStore);
```

## Custom Parser Plugin Example

```typescript
import { defineConfig, type ParserPlugin } from '@codedocs/core';

const myDjangoParser: ParserPlugin = {
  name: 'django-parser',
  filePattern: '**/*.py',
  async parse(files) {
    const endpoints = [];
    const entities = [];

    for (const file of files) {
      // Parse Django views
      if (file.path.includes('views.py')) {
        endpoints.push({
          id: 'api-users',
          path: '/api/users',
          method: 'GET',
          description: 'List users',
          // ... more fields
        });
      }

      // Parse Django models
      if (file.path.includes('models.py')) {
        entities.push({
          id: 'user-model',
          name: 'User',
          fields: [
            { name: 'id', type: 'int', required: true },
            { name: 'email', type: 'string', required: true },
          ],
          // ... more fields
        });
      }
    }

    return { endpoints, entities, services: [], types: [] };
  },
};

export default defineConfig({
  source: './src',
  parsers: [myDjangoParser],
});
```

## Configuration Schema

The `defineConfig` function provides type-safe configuration with validation:

```typescript
{
  source: string;                    // Source code directory
  parsers: ParserPlugin[];           // Parser plugins
  ai?: {
    provider: 'openai' | 'claude' | 'gemini' | 'glm' | 'ollama' | 'custom';
    model: string;
    apiKey: string;
    baseUrl?: string;                // For Ollama
    features?: {
      domainGrouping?: boolean;
      flowDiagrams?: boolean;
      codeExplanation?: boolean;
      releaseNoteAnalysis?: boolean;
    };
  };
  docs: {
    title: string;
    locale: 'ko' | 'en' | 'ja' | 'zh';
    sections: SectionConfig[];
  };
  theme?: {
    preset: 'default' | 'swagger' | 'redoc' | 'mintlify';
    colors?: { primary: string };
  };
  build?: {
    outDir: string;
    base: string;
  };
}
```

## Exports

Complete list of public exports:

**Configuration**
- `defineConfig`, `loadConfig`, `CodeDocsConfig`

**Parser**
- `ParserEngine`, `FileReader`, `AnalysisCache`
- Types: `ParserPlugin`, `ParseResult`, `AnalysisResult`, `EndpointInfo`, `EntityInfo`, `ServiceInfo`, `TypeInfo`

**AI**
- `createAiProvider`, `ExampleGenerator`, `groupByDomain`, `groupByHeuristic`
- `AI_DEFAULTS`, `formatExampleAsMarkdown`
- Types: `AiProvider`, `AiProviderConfig`, `DomainGroup`

**Generator**
- `MarkdownGenerator`, `SidebarGenerator`, `DiagramGenerator`
- `generateFrontmatter`, `generateMetaTags`
- Types: `GeneratorConfig`, `PageMeta`, `GeneratedPage`, `SidebarItem`

**Changelog**
- `compareAnalysisResults`, `generateReleaseNote`, `generateVersionComparison`
- Types: `ChangeEntry`, `ReleaseNote`, `VersionComparison`, `BreakingChange`

**Search**
- `SemanticSearch`
- Types: `SearchResult`, `SearchOptions`, `SearchIndex`

**i18n**
- `getStrings`, `getSupportedLocales`, `getLocaleName`, `LOCALE_NAMES`
- Types: `Locale`, `I18nStrings`

**Memo**
- `createEmptyMemoStore`, `parseMemoStore`, `mergeMemoStores`
- Types: `Memo`, `MemoStore`

**Utilities**
- `escapeHtml`, `escapeMd`, `toKebab`, `extractFrontmatter`
- `Logger`, `logger`
- `getPrompt`, `fillTemplate`

## TypeScript

Fully typed with TypeScript strict mode. All types are exported for external use.

## License

MIT
