export interface GeneratorConfig {
  outputDir: string;
  locale: 'ko' | 'en' | 'ja' | 'zh';
  sections: SectionConfig[];
  pageOverrides?: Record<string, PageMeta>;
}

export interface SectionConfig {
  id: string;
  label: string;
  type: 'auto' | 'endpoints' | 'entities' | 'architecture' | 'changelog' | 'custom';
  dir?: string;  // for type='custom'
}

export interface PageMeta {
  title?: string;
  description?: string;
  tags?: string[];
}

export interface GeneratedPage {
  path: string;       // relative output path (e.g., 'api/users.md')
  title: string;
  content: string;    // markdown content
  meta?: PageMeta;
  sidebarPosition?: number;
}

export interface GeneratorResult {
  pages: GeneratedPage[];
  sidebar: SidebarItem[];
}

export interface SidebarItem {
  label: string;
  type: 'category' | 'doc';
  items?: SidebarItem[];  // for categories
  id?: string;            // for docs
  position?: number;
}
