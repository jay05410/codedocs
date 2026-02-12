import { describe, it, expect } from 'vitest';
import { defineConfig } from '../config/schema.js';

describe('Config Schema', () => {
  describe('defineConfig', () => {
    it('returns the config unchanged', () => {
      const config = {
        source: './src',
        parsers: [
          {
            name: 'test-parser',
            filePattern: '**/*.ts',
            parse: async () => ({ endpoints: [], entities: [], services: [], types: [], dependencies: [] }),
          },
        ],
        ai: {
          provider: 'openai' as const,
          model: 'gpt-4',
        },
        docs: {
          title: 'Test Docs',
          locale: 'en' as const,
          sections: [
            { id: 'overview', label: 'Overview', type: 'auto' as const },
          ],
        },
        theme: {
          preset: 'default' as const,
        },
      };

      const result = defineConfig(config);
      expect(result).toBe(config);
      expect(result.source).toBe('./src');
      expect(result.docs.title).toBe('Test Docs');
    });

    it('preserves all config properties', () => {
      const config = {
        source: '/path/to/source',
        parsers: [],
        ai: {
          provider: 'claude' as const,
          model: 'claude-3-opus',
          apiKey: 'test-key',
          features: {
            domainGrouping: true,
            flowDiagrams: false,
          },
        },
        docs: {
          title: 'My API',
          logo: '/logo.png',
          locale: 'ko' as const,
          sections: [],
          pageOverrides: {
            'api/users': {
              title: 'User API',
              description: 'User management endpoints',
            },
          },
        },
        theme: {
          preset: 'swagger' as const,
          colors: {
            primary: '#007bff',
            secondary: '#6c757d',
          },
        },
        git: {
          trackBranch: 'main',
          autoVersionBump: true,
        },
      };

      const result = defineConfig(config);
      expect(result).toEqual(config);
      expect(result.ai.features?.domainGrouping).toBe(true);
      expect(result.git?.trackBranch).toBe('main');
    });
  });
});
