import type { CodeDocsConfig } from './schema.js';

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG: CodeDocsConfig = {
  source: './src',
  parsers: [],
  ai: {
    provider: 'ollama',
    model: 'llama3.1:8b',
    baseUrl: 'http://localhost:11434',
    features: {
      domainGrouping: true,
    },
  },
  docs: {
    title: 'CodeDocs',
    locale: 'en',
    sections: [
      {
        id: 'overview',
        label: 'Overview',
        type: 'auto',
      },
    ],
  },
  theme: {
    preset: 'default',
  },
};
