import { defineConfig } from '@codedocs/core';
import { fastApiParser } from '@codedocs/parser-python-fastapi';

export default defineConfig({
  name: 'FastAPI Task Manager',
  source: './app',

  parsers: [
    fastApiParser({ detectOrm: true, detectPydantic: true }),
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
    title: 'Task Manager API Documentation',
    locale: 'en',
    sections: [
      { id: 'overview', label: 'Overview', type: 'auto' },
      { id: 'api', label: 'API', type: 'endpoints' },
      { id: 'entities', label: 'Data Models', type: 'entities' },
      { id: 'architecture', label: 'Architecture', type: 'architecture' },
    ],
  },

  theme: {
    preset: 'redoc',
    colors: { primary: '#009688' },
  },
});
