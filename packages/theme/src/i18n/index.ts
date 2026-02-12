import React, { createContext, useContext } from 'react';
import type { I18nStrings, Locale } from '@codedocs/core';
import { getStrings } from '@codedocs/core';

interface I18nContextValue {
  strings: I18nStrings;
  locale: Locale;
  t: (template: string, vars?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextValue>({
  strings: getStrings('en'),
  locale: 'en',
  t: (template) => template,
});

export interface I18nProviderProps {
  locale?: Locale;
  children: React.ReactNode;
}

export function I18nProvider({ locale = 'en', children }: I18nProviderProps) {
  const strings = getStrings(locale);

  const t = (template: string, vars?: Record<string, string | number>): string => {
    if (!vars) return template;
    return Object.entries(vars).reduce(
      (result, [key, value]) => result.replace(`{${key}}`, String(value)),
      template,
    );
  };

  return React.createElement(I18nContext.Provider, { value: { strings, locale, t } }, children);
}

export function useI18n() {
  return useContext(I18nContext);
}
