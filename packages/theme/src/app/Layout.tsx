import React, { type ReactNode } from 'react';
import { Sidebar } from '../components/Sidebar.js';
import { I18nProvider, useI18n } from '../i18n/index.js';
import type { Locale } from '@codedocs/core';

export interface LayoutProps {
  children: ReactNode;
  sidebar?: SidebarSection[];
  title?: string;
  locale?: Locale;
}

export interface SidebarSection {
  label: string;
  items: SidebarLink[];
}

export interface SidebarLink {
  label: string;
  href: string;
  active?: boolean;
}

export default function Layout({ children, sidebar = [], title = 'CodeDocs', locale = 'en' }: LayoutProps) {
  return (
    <I18nProvider locale={locale}>
      <LayoutInner sidebar={sidebar} title={title}>
        {children}
      </LayoutInner>
    </I18nProvider>
  );
}

function LayoutInner({ children, sidebar = [], title = 'CodeDocs' }: Omit<LayoutProps, 'locale'>) {
  const { strings } = useI18n();

  return (
    <div className="codedocs-layout">
      <header className="codedocs-header">
        <div className="codedocs-header-inner">
          <a href="/" className="codedocs-logo">{title}</a>
          <nav className="codedocs-nav">
            <div className="codedocs-search" id="codedocs-search" />
          </nav>
          <button
            className="codedocs-theme-toggle"
            onClick={() => document.documentElement.classList.toggle('dark')}
            aria-label={strings.theme.toggleDarkMode}
          >
            <span className="codedocs-theme-icon" />
          </button>
        </div>
      </header>
      <div className="codedocs-body">
        {sidebar && sidebar.length > 0 && <Sidebar sections={sidebar} />}
        <main className="codedocs-main">
          <article className="codedocs-content">
            {children}
          </article>
        </main>
      </div>
    </div>
  );
}
