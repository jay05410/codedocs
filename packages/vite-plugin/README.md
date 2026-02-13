# @codedocs/vite-plugin

[![npm version](https://badge.fury.io/js/@codedocs%2Fvite-plugin.svg)](https://www.npmjs.com/package/@codedocs/vite-plugin)

Vite plugin for CodeDocs - Markdown processing, SSG build, and dev server with HMR.

## Installation

```bash
npm install @codedocs/vite-plugin
```

## What It Does

`@codedocs/vite-plugin` provides the build pipeline for CodeDocs documentation sites:

1. **Markdown Processing**: Transform `.md` files into importable JavaScript modules
2. **Unified Pipeline**: Process markdown with remark and rehype plugins
3. **Code Highlighting**: Syntax highlighting with Shiki (dual theme support)
4. **SSG Build**: Static site generation for production
5. **Dev Server**: Development server with Hot Module Replacement (HMR)
6. **Virtual Modules**: Expose shared memos as virtual module

## Usage

Add to your `vite.config.ts`:

```typescript
import { defineConfig } from 'vite';
import { codedocsPlugin } from '@codedocs/vite-plugin';

export default defineConfig({
  plugins: [
    codedocsPlugin({
      docsDir: './docs',           // Generated markdown directory
      memosFile: '.codedocs/memos.json',  // Shared memos file
    }),
  ],
});
```

## Options

```typescript
interface CodeDocsViteOptions {
  /**
   * Directory containing generated markdown files
   * @default './docs'
   */
  docsDir?: string;

  /**
   * Theme package entry point
   * @default '@codedocs/theme'
   */
  themeEntry?: string;

  /**
   * Path to shared memos JSON file
   * @default '.codedocs/memos.json'
   */
  memosFile?: string;
}
```

## Markdown Processing

The plugin processes markdown files through a unified pipeline:

```typescript
// Import markdown files
import { html, raw } from './docs/api-overview.md';

// Use in React components
function Page() {
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}
```

### Remark Plugins (Markdown → AST)

- **remark-parse**: Parse markdown to AST
- **remark-gfm**: GitHub Flavored Markdown support (tables, task lists, strikethrough)

### Rehype Plugins (AST → HTML)

- **remark-rehype**: Transform markdown AST to HTML AST
- **rehype-slug**: Add IDs to headings for anchor links
- **@shikijs/rehype**: Code syntax highlighting with Shiki

## Code Highlighting

Powered by Shiki with dual theme support:

```typescript
// Light theme: github-light
// Dark theme: github-dark
```

**Supported languages**: TypeScript, JavaScript, Python, Java, Kotlin, Go, Rust, C, C++, PHP, Ruby, Swift, and 100+ more.

**Features**:
- Accurate syntax highlighting (same as VS Code)
- Line numbers
- Line highlighting
- Diff highlighting
- Automatic theme switching (light/dark mode)

## Virtual Modules

### Memos Module

Access shared memos as a virtual module:

```typescript
import memos from 'virtual:codedocs-memos';

console.log(memos);
// { version: 1, memos: { "api/users": { content: "...", isShared: true } } }
```

The plugin watches the memos file and triggers HMR when it changes.

## Dev Server

Development server with file watching and HMR:

```bash
npx vite dev
```

**Features**:
- Watch docs directory for markdown changes
- Watch memos file for annotation updates
- Hot Module Replacement (instant updates)
- Full-page reload on configuration changes

**Configuration**:

```typescript
export default defineConfig({
  plugins: [codedocsPlugin()],
  server: {
    port: 3000,
    open: true,
  },
});
```

## SSG Build

Static Site Generation for production:

```bash
npx vite build
```

**Output**: Production-optimized static site in `./dist`

**Features**:
- Minified HTML/CSS/JavaScript
- Code splitting
- Asset optimization
- Source maps (optional)
- Prerendered pages

**Build configuration**:

```typescript
export default defineConfig({
  plugins: [codedocsPlugin()],
  build: {
    outDir: 'dist',
    sourcemap: false,
    minify: 'terser',
  },
});
```

## Alias Resolution

The plugin automatically creates an alias for the docs directory:

```typescript
// Instead of:
import doc from '../../docs/api-overview.md';

// Use:
import doc from '@docs/api-overview.md';
```

## Peer Dependencies

Required peer dependencies:

```json
{
  "peerDependencies": {
    "@codedocs/core": "*",
    "vite": "^6.0.0"
  }
}
```

## Full Example

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { codedocsPlugin } from '@codedocs/vite-plugin';

export default defineConfig({
  plugins: [
    react(),
    codedocsPlugin({
      docsDir: './docs',
      memosFile: '.codedocs/memos.json',
    }),
  ],
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: './index.html',
      },
    },
  },
  server: {
    port: 3000,
  },
});
```

```tsx
// src/pages/ApiPage.tsx
import { html } from '@docs/api-reference.md';
import memos from 'virtual:codedocs-memos';

function ApiPage() {
  const pageMemos = memos.memos['api-reference'] || [];

  return (
    <div>
      <div dangerouslySetInnerHTML={{ __html: html }} />
      {pageMemos.map(memo => (
        <div key={memo.id}>{memo.content}</div>
      ))}
    </div>
  );
}
```

## Dependencies

**Core**:
- `vite` - Build tool and dev server
- `unified` - Markdown/HTML processing pipeline

**Remark** (Markdown):
- `remark-parse` - Markdown parser
- `remark-gfm` - GitHub Flavored Markdown
- `remark-rehype` - Markdown → HTML transformer

**Rehype** (HTML):
- `rehype-stringify` - HTML serializer
- `rehype-slug` - Add heading IDs
- `@shikijs/rehype` - Code highlighting integration

**Highlighting**:
- `shiki` - Syntax highlighter

## TypeScript

Fully typed with TypeScript. Virtual module types:

```typescript
// virtual-modules.d.ts
declare module 'virtual:codedocs-memos' {
  export interface MemoStore {
    version: number;
    memos: Record<string, Memo[]>;
  }
  const memos: MemoStore;
  export default memos;
}
```

## License

MIT
