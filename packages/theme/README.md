# @codedocs/theme

[![npm version](https://badge.fury.io/js/@codedocs%2Ftheme.svg)](https://www.npmjs.com/package/@codedocs/theme)

Default React theme for CodeDocs documentation sites.

## Installation

```bash
npm install @codedocs/theme
```

## Overview

`@codedocs/theme` provides a complete UI theme for CodeDocs-generated documentation. It includes:

- Modern, responsive layout
- Multiple theme presets (default, swagger, redoc, mintlify)
- Interactive API playground (Postman-like)
- Mermaid diagram rendering
- Full-text search integration
- Version comparison viewer
- Memo/annotation system
- Dark/light mode with dual theme support
- Multi-language support (ko, en, ja, zh)

## Components

### Layout

Main application layout with sidebar and content area.

```tsx
import Layout from '@codedocs/theme';

function App() {
  return (
    <Layout
      title="My API Docs"
      logo="/logo.svg"
      sections={[
        {
          title: 'API',
          links: [
            { label: 'Endpoints', href: '/api/endpoints' },
            { label: 'Authentication', href: '/api/auth' },
          ],
        },
      ]}
      locale="en"
    >
      {/* Page content */}
    </Layout>
  );
}
```

### Sidebar

Collapsible navigation sidebar.

```tsx
import { Sidebar } from '@codedocs/theme';

<Sidebar
  sections={[
    {
      title: 'Getting Started',
      links: [
        { label: 'Introduction', href: '/' },
        { label: 'Quick Start', href: '/quickstart' },
      ],
    },
  ]}
  currentPath="/quickstart"
/>
```

### SearchBar

Full-text search powered by Pagefind.

```tsx
import { SearchBar } from '@codedocs/theme';

<SearchBar
  placeholder="Search documentation..."
  locale="en"
/>
```

### ApiEndpointCard

Display API endpoint details with method, path, parameters, and examples.

```tsx
import { ApiEndpointCard } from '@codedocs/theme';

<ApiEndpointCard
  endpoint={{
    id: 'get-users',
    method: 'GET',
    path: '/api/users',
    description: 'List all users',
    parameters: [
      { name: 'page', type: 'number', required: false },
      { name: 'limit', type: 'number', required: false },
    ],
    requestExample: '{ "page": 1, "limit": 10 }',
    responseExample: '{ "users": [...] }',
  }}
/>
```

### EntityCard

Display data model/entity schema.

```tsx
import { EntityCard } from '@codedocs/theme';

<EntityCard
  entity={{
    id: 'user',
    name: 'User',
    description: 'User account entity',
    fields: [
      { name: 'id', type: 'string', required: true },
      { name: 'email', type: 'string', required: true },
      { name: 'createdAt', type: 'Date', required: false },
    ],
  }}
/>
```

### MermaidChart

Render Mermaid diagrams.

```tsx
import { MermaidChart } from '@codedocs/theme';

<MermaidChart
  chart={`
    graph TD
      A[User] --> B[Login]
      B --> C{Valid?}
      C -->|Yes| D[Dashboard]
      C -->|No| E[Error]
  `}
  type="flow"
/>
```

Supported types: `er`, `sequence`, `flow`, `class`, `state`, `component`, `deployment`

### ApiPlayground

Interactive API testing tool (Postman-like).

```tsx
import { ApiPlayground } from '@codedocs/theme';

<ApiPlayground
  endpoint={{
    method: 'POST',
    path: '/api/users',
    baseUrl: 'https://api.example.com',
  }}
  config={{
    auth: { type: 'bearer', token: '' },
    headers: { 'Content-Type': 'application/json' },
  }}
/>
```

Features:
- Method selection (GET, POST, PUT, DELETE, PATCH)
- URL parameter editing
- Request header management
- Request body editor (JSON, form-data)
- Authentication (Bearer, API Key, Basic)
- Response viewer with syntax highlighting
- Copy cURL command

### VersionCompare

Compare API versions and highlight breaking changes.

```tsx
import { VersionCompare } from '@codedocs/theme';

<VersionCompare
  comparison={{
    from: 'v1.0.0',
    to: 'v2.0.0',
    breakingChanges: [
      {
        type: 'endpoint',
        path: '/api/users',
        change: 'Parameter "email" is now required',
      },
    ],
    summary: {
      endpointsAdded: 5,
      endpointsRemoved: 2,
      endpointsModified: 8,
    },
  }}
/>
```

### MemoButton & MemoViewer

Add and view annotations/memos on documentation.

```tsx
import { MemoButton, MemoViewer } from '@codedocs/theme';

// Add memo button
<MemoButton
  entityId="api/users"
  entityType="endpoint"
  onSave={(content, isShared) => {
    // Save memo
  }}
/>

// View memos
<MemoViewer
  memos={[
    {
      id: '1',
      content: 'This endpoint requires admin role',
      isShared: true,
      createdAt: new Date(),
    },
  ]}
/>
```

## Theme Presets

Choose from 4 built-in presets or customize your own.

### Available Presets

```typescript
import {
  defaultPreset,
  swaggerPreset,
  redocPreset,
  mintlifyPreset,
} from '@codedocs/theme';
```

**Default** - Clean, modern documentation
```typescript
theme: {
  preset: 'default',
}
```

**Swagger** - Swagger UI-inspired API documentation
```typescript
theme: {
  preset: 'swagger',
}
```

**Redoc** - ReDoc-style three-panel layout
```typescript
theme: {
  preset: 'redoc',
}
```

**Mintlify** - Mintlify-inspired design
```typescript
theme: {
  preset: 'mintlify',
}
```

### Using Presets

```typescript
import { defineConfig } from '@codedocs/core';

export default defineConfig({
  theme: {
    preset: 'swagger',
    colors: {
      primary: '#2e8555',  // Override primary color
    },
  },
});
```

### Generating Preset CSS

```typescript
import { generatePresetCss, getPreset } from '@codedocs/theme';

const preset = getPreset('swagger');
const css = generatePresetCss(preset);
```

## CSS Customization

Override theme variables via `variables.css`:

```css
/* src/css/variables.css */
:root {
  /* Colors */
  --color-primary: #2e8555;
  --color-background: #ffffff;
  --color-text: #1c1e21;
  --color-border: #e3e3e3;

  /* Typography */
  --font-family-base: 'Inter', sans-serif;
  --font-family-mono: 'JetBrains Mono', monospace;
  --font-size-base: 16px;
  --font-size-h1: 2.5rem;
  --font-size-h2: 2rem;

  /* Spacing */
  --spacing-xs: 0.25rem;
  --spacing-sm: 0.5rem;
  --spacing-md: 1rem;
  --spacing-lg: 1.5rem;
  --spacing-xl: 2rem;

  /* Layout */
  --sidebar-width: 280px;
  --content-max-width: 1200px;
  --border-radius: 6px;

  /* Shadows */
  --shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.1);
  --shadow-md: 0 4px 6px rgba(0, 0, 0, 0.1);
  --shadow-lg: 0 10px 20px rgba(0, 0, 0, 0.15);
}

/* Dark mode */
[data-theme='dark'] {
  --color-background: #1b1b1d;
  --color-text: #e3e3e3;
  --color-border: #444444;
}
```

Import in your app:

```typescript
import '@codedocs/theme/css/variables.css';
```

## Internationalization (i18n)

The theme supports 4 languages:

- **Korean** (`ko`)
- **English** (`en`)
- **Japanese** (`ja`)
- **Chinese** (`zh`)

Set locale in config:

```typescript
export default defineConfig({
  docs: {
    locale: 'en',  // or 'ko', 'ja', 'zh'
  },
});
```

UI strings are automatically translated:
- Navigation labels
- Search placeholder
- Button text
- Error messages
- Tooltips

## Dark Mode

Automatic dark/light mode with system preference detection:

```tsx
// Dark mode is handled automatically
// Users can toggle via theme switcher in navigation

// Shiki code highlighting uses dual themes:
// - Light: github-light
// - Dark: github-dark
```

## Peer Dependencies

Required peer dependency:

```json
{
  "peerDependencies": {
    "@codedocs/core": "*"
  }
}
```

Install both packages:

```bash
npm install @codedocs/core @codedocs/theme
```

## TypeScript

Fully typed with exported TypeScript interfaces:

```typescript
import type {
  LayoutProps,
  SidebarSection,
  ApiEndpointCardProps,
  ThemePreset,
  VersionComparisonData,
} from '@codedocs/theme';
```

## License

MIT
