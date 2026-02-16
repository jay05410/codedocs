import type { GeneratedPage, SectionConfig, SidebarItem } from './types.js';

/**
 * SidebarGenerator - builds sidebar tree from generated pages
 */
export class SidebarGenerator {
  /**
   * Generate sidebar structure from pages and section config
   */
  generate(pages: GeneratedPage[], sections: SectionConfig[]): SidebarItem[] {
    const sidebar: SidebarItem[] = [];

    // Group pages by section (based on path prefix)
    const pagesBySection = this.groupPagesBySection(pages, sections);

    // Build sidebar items for each section
    sections.forEach(section => {
      const sectionPages = pagesBySection.get(section.id) || [];

      if (sectionPages.length === 0) return;

      // Sort pages by sidebarPosition
      const sortedPages = sectionPages.sort((a, b) => {
        const posA = a.sidebarPosition || 999;
        const posB = b.sidebarPosition || 999;
        return posA - posB;
      });

      // Create category or doc item
      if (sectionPages.length === 1) {
        // Single page - add as doc
        const page = sortedPages[0];
        sidebar.push({
          type: 'doc',
          label: page.title,
          id: this.getDocId(page.path),
          position: page.sidebarPosition,
        });
      } else {
        // Multiple pages - create category
        const items: SidebarItem[] = sortedPages.map(page => ({
          type: 'doc',
          label: page.title,
          id: this.getDocId(page.path),
        }));

        sidebar.push({
          type: 'category',
          label: section.label,
          items,
          position: this.getSectionPosition(section),
        });
      }
    });

    // Sort sidebar by position
    return sidebar.sort((a, b) => {
      const posA = a.position || 999;
      const posB = b.position || 999;
      return posA - posB;
    });
  }

  /**
   * Group pages by section based on path patterns
   */
  private groupPagesBySection(
    pages: GeneratedPage[],
    sections: SectionConfig[]
  ): Map<string, GeneratedPage[]> {
    const grouped = new Map<string, GeneratedPage[]>();

    pages.forEach(page => {
      const section = this.findSectionForPage(page, sections);
      const sectionId = section?.id || 'default';

      if (!grouped.has(sectionId)) {
        grouped.set(sectionId, []);
      }
      grouped.get(sectionId)!.push(page);
    });

    return grouped;
  }

  /**
   * Find which section a page belongs to based on path
   */
  private findSectionForPage(page: GeneratedPage, sections: SectionConfig[]): SectionConfig | null {
    // Match by path prefix — skip 'auto' (empty prefix matches everything)
    for (const section of sections) {
      if (section.type === 'auto') continue;
      const prefix = this.getSectionPathPrefix(section);
      if (prefix && page.path.startsWith(prefix)) {
        return section;
      }
    }

    // overview.md and index.md belong to the auto section
    if (page.path === 'overview.md' || page.path === 'index.md') {
      return sections.find(s => s.type === 'auto' || s.id === 'overview') || null;
    }

    return null;
  }

  /**
   * Get path prefix for a section type
   */
  private getSectionPathPrefix(section: SectionConfig): string {
    switch (section.type) {
      case 'endpoints':
        return 'api/';
      case 'entities':
        return 'entities/';
      case 'architecture':
        return 'architecture';
      case 'changelog':
        return 'changelog';
      case 'components':
        return 'components/';
      case 'services':
        return 'hooks/';
      case 'custom':
        return section.dir || section.id + '/';
      case 'auto':
        return '';
      default:
        return '';
    }
  }

  /**
   * Get position for a section
   */
  private getSectionPosition(section: SectionConfig): number {
    switch (section.type) {
      case 'auto':
        return 0;
      case 'endpoints':
        return 10;
      case 'entities':
        return 100;
      case 'architecture':
        return 1000;
      case 'changelog':
        return 9999;
      case 'custom':
        return 500;
      default:
        return 999;
    }
  }

  /**
   * Convert file path to doc ID (remove .md extension)
   */
  private getDocId(path: string): string {
    return path.replace(/\.md$/, '');
  }
}
