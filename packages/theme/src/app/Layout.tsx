import React, { type ReactNode } from 'react';
import { TopNav } from '../components/TopNav.js';
import { TOC } from '../components/TOC.js';
import { SearchBar } from '../components/SearchBar.js';

import { MemoPanel } from '../components/MemoPanel.js';
import { I18nProvider, useI18n } from '../i18n/index.js';
import type { Locale } from '@codedocs/core';

export interface LayoutProps {
  children: ReactNode;
  nav?: NavSection[];
  title?: string;
  locale?: Locale;
  pageSlug?: string;
}

export interface NavSection {
  label: string;
  items: NavLink[];
}

export interface NavLink {
  label: string;
  href: string;
  active?: boolean;
}

export default function Layout({ 
  children, 
  nav = [], 
  title = 'CodeDocs', 
  locale = 'en',
  pageSlug = 'index'
}: LayoutProps) {
  return (
    <I18nProvider locale={locale}>
      <LayoutInner nav={nav} title={title} pageSlug={pageSlug}>
        {children}
      </LayoutInner>
    </I18nProvider>
  );
}

function LayoutInner({ children, nav = [], title = 'CodeDocs', pageSlug = 'index' }: Omit<LayoutProps, 'locale'>) {
  const { strings } = useI18n();

  return (
    <div className="codedocs-layout">
      <header className="codedocs-header">
        <div className="codedocs-header-inner">
          <a href="/" className="codedocs-logo">{title}</a>
          <TopNav sections={nav} />
          <div className="codedocs-header-actions">
            <SearchBar />
            <button
              className="codedocs-theme-toggle"
              onClick={() => document.documentElement.classList.toggle('dark')}
              aria-label={strings.theme.toggleDarkMode}
            >
              <span className="codedocs-theme-icon" />
            </button>
          </div>
        </div>
      </header>
      <div className="codedocs-body">
        <main className="codedocs-main">
          <article className="codedocs-content">
            {children}
            <MemoPanel pageSlug={pageSlug || 'index'} />
          </article>
        </main>
        <TOC />
      </div>

    </div>
  );
}

