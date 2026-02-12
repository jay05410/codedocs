import { defineConfig } from '@codedocs/core';
import { kotlinSpringParser } from '@codedocs/parser-kotlin-spring';
import { nestjsParser } from '@codedocs/parser-typescript-nestjs';
import { openApiParser } from '@codedocs/parser-openapi';

export default defineConfig({
  // Project information
  name: 'My Project',

  // Source code paths
  source: './src',

  // Parsers (add parsers based on your stack)
  parsers: [
    kotlinSpringParser({ detectFrameworks: true }),
    nestjsParser({ detectOrm: true }),
    openApiParser({ parseSchemas: true }),
  ],

  // AI configuration
  ai: {
    provider: 'openai',
    model: 'gpt-4-turbo-preview',
    apiKey: process.env.OPENAI_API_KEY,
    features: {
      domainGrouping: true,
      flowDiagrams: true,
      codeExplanation: true,
      releaseNoteAnalysis: true,
    },
  },

  // Documentation configuration
  docs: {
    title: 'My Project Documentation',
    locale: 'ko',
    sections: [
      { id: 'overview', label: 'Overview', type: 'auto' },
      { id: 'api', label: 'API', type: 'endpoints' },
      { id: 'entities', label: 'Data Models', type: 'entities' },
      { id: 'architecture', label: 'Architecture', type: 'architecture' },
      { id: 'changelog', label: 'Changelog', type: 'changelog' },
    ],
  },

  // Theme configuration
  theme: {
    preset: 'default',
    colors: { primary: '#2e8555' },
  },

  // Build configuration
  build: {
    outDir: './dist',
    base: '/',
  },
});
