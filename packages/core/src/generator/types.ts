export interface GeneratorConfig {
  outputDir: string;
  locale: 'ko' | 'en' | 'ja' | 'zh';
  sections: SectionConfig[];
  pageOverrides?: Record<string, PageMeta>;
  baseDir?: string;  // Base directory for resolving custom page paths
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
  // SEO
  canonical?: string;
  robots?: string;       // e.g., 'noindex, nofollow'
  // Open Graph
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  ogType?: string;       // 'article' | 'website'
  // Twitter Card
  twitterCard?: string;  // 'summary' | 'summary_large_image'
  twitterTitle?: string;
  twitterDescription?: string;
  twitterImage?: string;
  // Custom
  custom?: Record<string, string>;
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
