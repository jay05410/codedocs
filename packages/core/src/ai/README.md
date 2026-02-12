# AI Provider Module

Modular AI provider abstraction for @codedocs/core.

## Features

- **Multi-provider support**: OpenAI, Claude, Gemini, Ollama, and custom endpoints
- **Zero external dependencies**: Uses native `fetch` API
- **Type-safe**: Full TypeScript support with strict mode
- **Unified interface**: Single `AiProvider` interface for all providers
- **JSON extraction**: Built-in utility for parsing JSON from LLM responses

## Usage

### Basic Example

```typescript
import { createAiProvider } from '@codedocs/core/ai';

// Create OpenAI provider
const provider = createAiProvider({
  provider: 'openai',
  model: 'gpt-4o',
  apiKey: process.env.OPENAI_API_KEY,
  temperature: 0.1,
  maxTokens: 4096,
});

// Send messages
const response = await provider.chat([
  { role: 'system', content: 'You are a helpful assistant.' },
  { role: 'user', content: 'Explain TypeScript generics.' },
]);

console.log(response);
```

### Provider-Specific Examples

#### OpenAI

```typescript
const openai = createAiProvider({
  provider: 'openai',
  model: 'gpt-4o',
  apiKey: process.env.OPENAI_API_KEY,
});

const result = await openai.chat([
  { role: 'user', content: 'Hello!' },
], { jsonMode: true });
```

#### Claude (Anthropic)

```typescript
const claude = createAiProvider({
  provider: 'claude',
  model: 'claude-sonnet-4-5-20250929',
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const result = await claude.chat([
  { role: 'system', content: 'You are a code reviewer.' },
  { role: 'user', content: 'Review this function...' },
]);
```

#### Gemini

```typescript
const gemini = createAiProvider({
  provider: 'gemini',
  model: 'gemini-2.5-pro',
  apiKey: process.env.GOOGLE_API_KEY,
});

const result = await gemini.chat([
  { role: 'user', content: 'Analyze this code...' },
]);
```

#### Ollama (Local)

```typescript
const ollama = createAiProvider({
  provider: 'ollama',
  model: 'llama3',
  baseUrl: 'http://localhost:11434', // Optional, defaults to this
});

const result = await ollama.chat([
  { role: 'user', content: 'Hello!' },
]);
```

#### Custom Endpoint

```typescript
const custom = createAiProvider({
  provider: 'custom',
  model: 'my-model',
  baseUrl: 'https://my-llm-endpoint.com',
  apiKey: 'optional-api-key',
});

const result = await custom.chat([
  { role: 'user', content: 'Hello!' },
]);
```

### JSON Extraction

```typescript
import { extractJson } from '@codedocs/core/ai';

const llmResponse = `
Here's the analysis:

\`\`\`json
{
  "score": 85,
  "issues": ["naming", "complexity"]
}
\`\`\`

That's my assessment.
`;

const jsonString = extractJson(llmResponse);
const data = JSON.parse(jsonString);
console.log(data.score); // 85
```

## API Reference

### `createAiProvider(config: AiProviderConfig): AiProvider`

Factory function that creates an AI provider based on configuration.

### `AiProviderConfig`

```typescript
interface AiProviderConfig {
  provider: 'openai' | 'claude' | 'gemini' | 'glm' | 'ollama' | 'custom';
  model: string;
  apiKey?: string;
  baseUrl?: string;
  temperature?: number;
  maxTokens?: number;
}
```

### `AiProvider`

```typescript
interface AiProvider {
  name: string;
  chat(messages: ChatMessage[], options?: ChatOptions): Promise<string>;
}
```

### `ChatMessage`

```typescript
interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}
```

### `ChatOptions`

```typescript
interface ChatOptions {
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
}
```

### `extractJson(text: string): string`

Extracts JSON from LLM response text, handling markdown code fences and surrounding text.

## Architecture

```
packages/core/src/ai/
├── index.ts              # Main export
├── types.ts              # Core types and utilities
├── providers/
│   ├── index.ts          # Provider factory
│   ├── openai.ts         # OpenAI provider
│   ├── claude.ts         # Anthropic Claude provider
│   ├── gemini.ts         # Google Gemini provider
│   ├── ollama.ts         # Ollama provider
│   └── custom.ts         # Custom endpoint provider
└── README.md             # This file
```

## Error Handling

All providers throw descriptive errors with truncated response previews for debugging:

```typescript
try {
  const result = await provider.chat([...]);
} catch (error) {
  console.error(error.message);
  // Example: "OpenAI API error (401): Invalid API key"
}
```

## Notes

- All providers use native `fetch` (Node.js 18+)
- No external HTTP libraries required
- ES module exports only
- TypeScript strict mode compatible
- System messages handled appropriately per provider (Claude uses separate field)
- JSON mode automatically enabled for OpenAI o-series models
