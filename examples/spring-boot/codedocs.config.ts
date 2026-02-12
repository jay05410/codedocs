import { defineConfig } from '@codedocs/core';
import { javaSpringParser } from '@codedocs/parser-java-spring';

export default defineConfig({
  name: 'Spring Boot Product API',
  source: './src/main/java',

  parsers: [
    javaSpringParser({ detectFrameworks: true }),
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
    title: 'Product API Documentation',
    locale: 'en',
    sections: [
      { id: 'overview', label: 'Overview', type: 'auto' },
      { id: 'api', label: 'API', type: 'endpoints' },
      { id: 'entities', label: 'Data Models', type: 'entities' },
      { id: 'architecture', label: 'Architecture', type: 'architecture' },
    ],
  },

  theme: {
    preset: 'swagger',
    colors: { primary: '#6db33f' },
  },
});
