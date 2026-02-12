import React, { type ReactNode } from 'react';
import { Sidebar } from '../components/Sidebar.js';

export interface LayoutProps {
  children: ReactNode;
  sidebar?: SidebarSection[];
  title?: string;
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

export default function Layout({ children, sidebar = [], title = 'CodeDocs' }: LayoutProps) {
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
            aria-label="Toggle dark mode"
          >
            <span className="codedocs-theme-icon" />
          </button>
        </div>
      </header>
      <div className="codedocs-body">
        {sidebar.length > 0 && <Sidebar sections={sidebar} />}
        <main className="codedocs-main">
          <article className="codedocs-content">
            {children}
          </article>
        </main>
      </div>
    </div>
  );
}
