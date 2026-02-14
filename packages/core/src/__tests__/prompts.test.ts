import { describe, it, expect } from 'vitest';
import { getPrompt, getPromptKeys, fillTemplate } from '../ai/prompts/index.js';
import type { Locale } from '../i18n/index.js';

describe('AI Prompts', () => {
  describe('getPromptKeys', () => {
    it('returns all 8 prompt keys', () => {
      const keys = getPromptKeys();
      expect(keys).toHaveLength(8);
      expect(keys).toContain('domainGrouping');
      expect(keys).toContain('codeExplanation');
      expect(keys).toContain('flowDiagram');
      expect(keys).toContain('releaseNote');
      expect(keys).toContain('apiSummary');
      expect(keys).toContain('entityDescription');
      expect(keys).toContain('componentGrouping');
      expect(keys).toContain('componentDescription');
    });
  });

  describe('getPrompt', () => {
    it('returns prompt template with system and user fields', () => {
      const prompt = getPrompt('domainGrouping', 'en');
      expect(prompt.system).toBeTruthy();
      expect(prompt.user).toBeTruthy();
    });

    it('returns English prompts for en locale without locale instruction', () => {
      const prompt = getPrompt('apiSummary', 'en');
      expect(prompt.system).toContain('technical writer');
      expect(prompt.system).not.toContain('IMPORTANT: Write all text content in');
    });

    it('returns English prompts with Korean locale instruction for ko locale', () => {
      const prompt = getPrompt('apiSummary', 'ko');
      expect(prompt.system).toContain('technical writer');
      expect(prompt.system).toContain('IMPORTANT: Write all text content in Korean.');
    });

    it('returns English prompts with Japanese locale instruction for ja locale', () => {
      const prompt = getPrompt('apiSummary', 'ja');
      expect(prompt.system).toContain('technical writer');
      expect(prompt.system).toContain('IMPORTANT: Write all text content in Japanese.');
    });

    it('returns English prompts with Chinese locale instruction for zh locale', () => {
      const prompt = getPrompt('apiSummary', 'zh');
      expect(prompt.system).toContain('technical writer');
      expect(prompt.system).toContain('IMPORTANT: Write all text content in Chinese.');
    });

    it('all prompt keys work for all locales', () => {
      const keys = getPromptKeys();
      const locales: Locale[] = ['en', 'ko', 'ja', 'zh'];

      for (const locale of locales) {
        for (const key of keys) {
          const prompt = getPrompt(key, locale);
          expect(prompt.system).toBeTruthy();
          expect(prompt.user).toBeTruthy();
        }
      }
    });
  });

  describe('fillTemplate', () => {
    it('replaces single placeholder', () => {
      const result = fillTemplate('Hello {{name}}!', { name: 'World' });
      expect(result).toBe('Hello World!');
    });

    it('replaces multiple different placeholders', () => {
      const result = fillTemplate('{{method}} {{path}}', { method: 'GET', path: '/users' });
      expect(result).toBe('GET /users');
    });

    it('replaces multiple occurrences of same placeholder', () => {
      const result = fillTemplate('{{x}} and {{x}}', { x: 'test' });
      expect(result).toBe('test and test');
    });

    it('leaves unknown placeholders unchanged', () => {
      const result = fillTemplate('{{known}} {{unknown}}', { known: 'yes' });
      expect(result).toBe('yes {{unknown}}');
    });

    it('handles empty values', () => {
      const result = fillTemplate('{{name}}', { name: '' });
      expect(result).toBe('');
    });

    it('handles template with no placeholders', () => {
      const result = fillTemplate('no placeholders here', { key: 'value' });
      expect(result).toBe('no placeholders here');
    });
  });
});
