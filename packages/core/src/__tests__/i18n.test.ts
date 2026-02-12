import { describe, it, expect } from 'vitest';
import { getStrings, getSupportedLocales, type Locale } from '../i18n/index.js';

describe('i18n', () => {
  describe('getSupportedLocales', () => {
    it('returns all 4 supported locales', () => {
      const locales = getSupportedLocales();
      expect(locales).toHaveLength(4);
      expect(locales).toContain('en');
      expect(locales).toContain('ko');
      expect(locales).toContain('ja');
      expect(locales).toContain('zh');
    });
  });

  describe('getStrings', () => {
    it('returns English strings for en locale', () => {
      const strings = getStrings('en');
      expect(strings.overview.title).toBe('API Documentation');
      expect(strings.common.overview).toBe('Overview');
    });

    it('returns Korean strings for ko locale', () => {
      const strings = getStrings('ko');
      expect(strings.overview.title).toBe('API 문서');
      expect(strings.common.overview).toBe('개요');
    });

    it('returns Japanese strings for ja locale', () => {
      const strings = getStrings('ja');
      expect(strings.overview.title).toBe('APIドキュメント');
    });

    it('returns Chinese strings for zh locale', () => {
      const strings = getStrings('zh');
      expect(strings.overview.title).toBe('API 文档');
    });

    it('falls back to English for unknown locale', () => {
      const strings = getStrings('xx' as Locale);
      expect(strings.overview.title).toBe('API Documentation');
    });

    it('all locales have the same structure', () => {
      const locales = getSupportedLocales();
      const enKeys = getDeepKeys(getStrings('en'));

      for (const locale of locales) {
        const localeKeys = getDeepKeys(getStrings(locale));
        expect(localeKeys).toEqual(enKeys);
      }
    });

    it('theme section exists in all locales', () => {
      for (const locale of getSupportedLocales()) {
        const strings = getStrings(locale);
        expect(strings.theme).toBeDefined();
        expect(strings.theme.send).toBeTruthy();
        expect(strings.theme.breakingChanges).toBeTruthy();
      }
    });

    it('cli section exists in all locales', () => {
      for (const locale of getSupportedLocales()) {
        const strings = getStrings(locale);
        expect(strings.cli).toBeDefined();
        expect(strings.cli.loadingConfig).toBeTruthy();
        expect(strings.cli.analysisComplete).toBeTruthy();
      }
    });
  });
});

function getDeepKeys(obj: any, prefix = ''): string[] {
  const keys: string[] = [];
  for (const key of Object.keys(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof obj[key] === 'object' && obj[key] !== null) {
      keys.push(...getDeepKeys(obj[key], fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys.sort();
}
