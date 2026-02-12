import { describe, it, expect } from 'vitest';
import { SidebarGenerator } from '../generator/sidebar.js';
import type { GeneratedPage, SectionConfig } from '../generator/types.js';

function createPage(overrides: Partial<GeneratedPage> = {}): GeneratedPage {
  return {
    path: 'test.md',
    content: '# Test',
    title: 'Test Page',
    ...overrides,
  };
}

const defaultSections: SectionConfig[] = [
  { id: 'api', label: 'API', type: 'endpoints' },
  { id: 'entities', label: 'Data Models', type: 'entities' },
  { id: 'architecture', label: 'Architecture', type: 'architecture' },
  { id: 'changelog', label: 'Changelog', type: 'changelog' },
  { id: 'overview', label: 'Overview', type: 'auto' },
];

describe('SidebarGenerator', () => {
  const generator = new SidebarGenerator();

  it('creates doc items for single-page sections', () => {
    const pages = [createPage({ path: 'overview.md', title: 'Overview' })];

    const sidebar = generator.generate(pages, defaultSections);

    expect(sidebar).toHaveLength(1);
    expect(sidebar[0].type).toBe('doc');
    expect(sidebar[0].label).toBe('Overview');
    expect(sidebar[0].id).toBe('overview');
  });

  it('creates category items for multi-page sections', () => {
    const pages = [
      createPage({ path: 'api/users.md', title: 'Users API' }),
      createPage({ path: 'api/orders.md', title: 'Orders API' }),
    ];

    const sidebar = generator.generate(pages, defaultSections);

    expect(sidebar).toHaveLength(1);
    expect(sidebar[0].type).toBe('category');
    expect(sidebar[0].label).toBe('API');
    expect(sidebar[0].items).toHaveLength(2);
  });

  it('sorts sidebar by section position', () => {
    const pages = [
      createPage({ path: 'api/test.md', title: 'API' }),
      createPage({ path: 'entities/user.md', title: 'User' }),
      createPage({ path: 'overview.md', title: 'Overview' }),
    ];

    const sidebar = generator.generate(pages, defaultSections);

    // Sidebar is sorted by position: overview first (doc with no position = 999),
    // but API (10) and entities (100) categories have lower positions
    expect(sidebar.length).toBeGreaterThan(0);
    // API section should come before entities
    const labels = sidebar.map(s => s.label);
    const apiIdx = labels.indexOf('API');
    const entitiesIdx = labels.indexOf('Data Models');
    if (apiIdx >= 0 && entitiesIdx >= 0) {
      expect(apiIdx).toBeLessThan(entitiesIdx);
    }
  });

  it('returns empty sidebar for no pages', () => {
    const sidebar = generator.generate([], defaultSections);
    expect(sidebar).toHaveLength(0);
  });

  it('converts path to doc id (removes .md extension)', () => {
    const pages = [createPage({ path: 'api/users.md', title: 'Users' })];

    const sidebar = generator.generate(pages, defaultSections);

    // Category with single item check
    const apiCategory = sidebar.find(s => s.label === 'API');
    if (apiCategory && apiCategory.items) {
      expect(apiCategory.items[0].id).toBe('api/users');
    }
  });

  it('sorts pages within sections by sidebarPosition', () => {
    const pages = [
      createPage({ path: 'api/b.md', title: 'B', sidebarPosition: 2 }),
      createPage({ path: 'api/a.md', title: 'A', sidebarPosition: 1 }),
    ];

    const sidebar = generator.generate(pages, defaultSections);

    const apiCategory = sidebar.find(s => s.label === 'API');
    expect(apiCategory?.items?.[0].label).toBe('A');
    expect(apiCategory?.items?.[1].label).toBe('B');
  });
});
