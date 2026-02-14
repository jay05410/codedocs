import { getStrings, type Locale, type I18nStrings } from '@codedocs/core';

let cachedLocale: Locale = 'en';
let cachedStrings: I18nStrings = getStrings('en');

/**
 * Initialize CLI locale from environment variable or config
 */
export function initLocale(locale?: Locale): void {
  const resolved = locale || (process.env.CODEDOCS_LOCALE as Locale) || 'en';
  cachedLocale = resolved;
  cachedStrings = getStrings(resolved);
}

/**
 * Get current i18n strings
 */
export function getCliStrings(): I18nStrings {
  return cachedStrings;
}

/**
 * Template interpolation helper
 */
export function t(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return Object.entries(vars).reduce(
    (result, [key, value]) => result.replace(`{{${key}}}`, String(value)),
    template,
  );
}

export { type Locale };
