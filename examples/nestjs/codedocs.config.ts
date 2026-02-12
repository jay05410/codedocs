import { defineConfig } from '@codedocs/core';
import { nestjsParser } from '@codedocs/parser-typescript-nestjs';

export default defineConfig({
  name: 'NestJS User API',
  source: './src',

  parsers: [
    nestjsParser({ detectOrm: true }),
  ],

  ai: {
    provider: 'ollama',
    model: 'llama3.1:8b',
    baseUrl: 'http://localhost:11434',
    features: {
      domainGrouping: true,
      flowDiagrams: true,
      codeExplanation: true,
    },
  },

  docs: {
    title: 'User API Documentation',
    locale: 'en',
    sections: [
      { id: 'overview', label: 'Overview', type: 'auto' },
      { id: 'api', label: 'API', type: 'endpoints' },
      { id: 'entities', label: 'Data Models', type: 'entities' },
      { id: 'architecture', label: 'Architecture', type: 'architecture' },
    ],
  },

  theme: {
    preset: 'default',
    colors: { primary: '#e0234e' },
  },
});
