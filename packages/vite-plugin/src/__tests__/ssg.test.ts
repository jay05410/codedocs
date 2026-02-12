import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildStaticPages } from '../ssg.js';
import type { SsgPage } from '../ssg.js';

// Mock fs/promises
vi.mock('fs/promises', () => ({
  readdir: vi.fn(),
  readFile: vi.fn(),
}));

// Import mocked functions
import { readdir, readFile } from 'fs/promises';

describe('ssg', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('buildStaticPages', () => {
    it('returns empty array for empty docs directory', async () => {
      vi.mocked(readdir).mockResolvedValue([]);

      const pages = await buildStaticPages('/docs');

      expect(pages).toEqual([]);
      expect(readdir).toHaveBeenCalledWith('/docs', { withFileTypes: true, recursive: true });
    });

    it('processes single markdown file', async () => {
      const mockDirent = {
        name: 'test.md',
        isFile: () => true,
        parentPath: '/docs',
      };

      vi.mocked(readdir).mockResolvedValue([mockDirent as any]);
      vi.mocked(readFile).mockResolvedValue('# Test Page\n\nContent here.');

      const pages = await buildStaticPages('/docs');

      expect(pages).toHaveLength(1);
      expect(pages[0].slug).toBe('test');
      expect(pages[0].title).toBe('test');
      expect(pages[0].html).toContain('<h1');
      expect(pages[0].html).toContain('Test Page');
      expect(pages[0].raw).toBe('# Test Page\n\nContent here.');
    });

    it('extracts frontmatter title', async () => {
      const mockDirent = {
        name: 'page.md',
        isFile: () => true,
        parentPath: '/docs',
      };

      const content = `---
title: My Custom Title
description: Page description
---
# Heading

Content.`;

      vi.mocked(readdir).mockResolvedValue([mockDirent as any]);
      vi.mocked(readFile).mockResolvedValue(content);

      const pages = await buildStaticPages('/docs');

      expect(pages[0].title).toBe('My Custom Title');
      expect(pages[0].meta.title).toBe('My Custom Title');
      expect(pages[0].meta.description).toBe('Page description');
    });

    it('extracts multiple frontmatter fields', async () => {
      const mockDirent = {
        name: 'doc.md',
        isFile: () => true,
        parentPath: '/docs',
      };

      const content = `---
title: "Title with quotes"
description: A description
tags: api, reference, v1
canonical: https://example.com/doc
robots: index, follow
---
Content.`;

      vi.mocked(readdir).mockResolvedValue([mockDirent as any]);
      vi.mocked(readFile).mockResolvedValue(content);

      const pages = await buildStaticPages('/docs');
      const meta = pages[0].meta;

      expect(meta.title).toBe('Title with quotes');
      expect(meta.description).toBe('A description');
      expect(meta.tags).toBe('api, reference, v1');
      expect(meta.canonical).toBe('https://example.com/doc');
      expect(meta.robots).toBe('index, follow');
    });

    it('generates basic headTags with title', async () => {
      const mockDirent = {
        name: 'basic.md',
        isFile: () => true,
        parentPath: '/docs',
      };

      const content = `---
title: Basic Page
---
Content.`;

      vi.mocked(readdir).mockResolvedValue([mockDirent as any]);
      vi.mocked(readFile).mockResolvedValue(content);

      const pages = await buildStaticPages('/docs');
      const headTags = pages[0].headTags;

      expect(headTags).toContain('<title>Basic Page</title>');
      expect(headTags).toContain('<meta property="og:title" content="Basic Page" />');
      expect(headTags).toContain('<meta property="og:type" content="article" />');
    });

    it('generates headTags with description and keywords', async () => {
      const mockDirent = {
        name: 'meta.md',
        isFile: () => true,
        parentPath: '/docs',
      };

      const content = `---
title: Meta Page
description: This is a test page
tags: test, example
---
Content.`;

      vi.mocked(readdir).mockResolvedValue([mockDirent as any]);
      vi.mocked(readFile).mockResolvedValue(content);

      const pages = await buildStaticPages('/docs');
      const headTags = pages[0].headTags;

      expect(headTags).toContain('<meta name="description" content="This is a test page" />');
      expect(headTags).toContain('<meta name="keywords" content="test, example" />');
      expect(headTags).toContain('<meta property="og:description" content="This is a test page" />');
    });

    it('generates Open Graph tags', async () => {
      const mockDirent = {
        name: 'og.md',
        isFile: () => true,
        parentPath: '/docs',
      };

      const content = `---
title: OG Test
og_title: Custom OG Title
og_description: Custom OG description
og_image: https://example.com/image.png
og_type: website
---
Content.`;

      vi.mocked(readdir).mockResolvedValue([mockDirent as any]);
      vi.mocked(readFile).mockResolvedValue(content);

      const pages = await buildStaticPages('/docs');
      const headTags = pages[0].headTags;

      expect(headTags).toContain('<meta property="og:title" content="Custom OG Title" />');
      expect(headTags).toContain('<meta property="og:description" content="Custom OG description" />');
      expect(headTags).toContain('<meta property="og:image" content="https://example.com/image.png" />');
      expect(headTags).toContain('<meta property="og:type" content="website" />');
    });

    it('generates Twitter Card tags', async () => {
      const mockDirent = {
        name: 'twitter.md',
        isFile: () => true,
        parentPath: '/docs',
      };

      const content = `---
title: Twitter Test
description: Main description
twitter_card: summary_large_image
twitter_title: Custom Twitter Title
twitter_description: Twitter description
twitter_image: https://example.com/twitter.png
---
Content.`;

      vi.mocked(readdir).mockResolvedValue([mockDirent as any]);
      vi.mocked(readFile).mockResolvedValue(content);

      const pages = await buildStaticPages('/docs');
      const headTags = pages[0].headTags;

      expect(headTags).toContain('<meta name="twitter:card" content="summary_large_image" />');
      expect(headTags).toContain('<meta name="twitter:title" content="Custom Twitter Title" />');
      expect(headTags).toContain('<meta name="twitter:description" content="Twitter description" />');
      expect(headTags).toContain('<meta name="twitter:image" content="https://example.com/twitter.png" />');
    });

    it('falls back to OG image for Twitter when twitter_image not provided', async () => {
      const mockDirent = {
        name: 'fallback.md',
        isFile: () => true,
        parentPath: '/docs',
      };

      const content = `---
title: Fallback Test
og_image: https://example.com/og.png
---
Content.`;

      vi.mocked(readdir).mockResolvedValue([mockDirent as any]);
      vi.mocked(readFile).mockResolvedValue(content);

      const pages = await buildStaticPages('/docs');
      const headTags = pages[0].headTags;

      expect(headTags).toContain('<meta name="twitter:image" content="https://example.com/og.png" />');
    });

    it('escapes HTML entities in headTags', async () => {
      const mockDirent = {
        name: 'escape.md',
        isFile: () => true,
        parentPath: '/docs',
      };

      const content = `---
title: Title with <script> & "quotes"
description: Description with <tags> & entities
---
Content.`;

      vi.mocked(readdir).mockResolvedValue([mockDirent as any]);
      vi.mocked(readFile).mockResolvedValue(content);

      const pages = await buildStaticPages('/docs');
      const headTags = pages[0].headTags;

      expect(headTags).toContain('&lt;script&gt;');
      expect(headTags).toContain('&amp;');
      expect(headTags).toContain('&quot;');
      expect(headTags).not.toContain('<script>');
    });

    it('generates canonical link tag', async () => {
      const mockDirent = {
        name: 'canonical.md',
        isFile: () => true,
        parentPath: '/docs',
      };

      const content = `---
title: Canonical Test
canonical: https://example.com/canonical-url
---
Content.`;

      vi.mocked(readdir).mockResolvedValue([mockDirent as any]);
      vi.mocked(readFile).mockResolvedValue(content);

      const pages = await buildStaticPages('/docs');
      const headTags = pages[0].headTags;

      expect(headTags).toContain('<link rel="canonical" href="https://example.com/canonical-url" />');
    });

    it('generates robots meta tag', async () => {
      const mockDirent = {
        name: 'robots.md',
        isFile: () => true,
        parentPath: '/docs',
      };

      const content = `---
title: Robots Test
robots: noindex, nofollow
---
Content.`;

      vi.mocked(readdir).mockResolvedValue([mockDirent as any]);
      vi.mocked(readFile).mockResolvedValue(content);

      const pages = await buildStaticPages('/docs');
      const headTags = pages[0].headTags;

      expect(headTags).toContain('<meta name="robots" content="noindex, nofollow" />');
    });

    it('processes nested directory structure', async () => {
      const mockDirents = [
        { name: 'root.md', isFile: () => true, parentPath: '/docs' },
        { name: 'guide.md', isFile: () => true, parentPath: '/docs/guides' },
        { name: 'api.md', isFile: () => true, parentPath: '/docs/api/v1' },
      ];

      vi.mocked(readdir).mockResolvedValue(mockDirents as any);
      vi.mocked(readFile).mockImplementation((path: any) => {
        if (path.includes('root.md')) return Promise.resolve('# Root');
        if (path.includes('guide.md')) return Promise.resolve('# Guide');
        if (path.includes('api.md')) return Promise.resolve('# API');
        return Promise.resolve('');
      });

      const pages = await buildStaticPages('/docs');

      expect(pages).toHaveLength(3);
      expect(pages.find(p => p.slug === 'root')).toBeDefined();
      expect(pages.find(p => p.slug === 'guides/guide')).toBeDefined();
      expect(pages.find(p => p.slug === 'api/v1/api')).toBeDefined();
    });

    it('filters out non-.md files', async () => {
      const mockDirents = [
        { name: 'doc.md', isFile: () => true, parentPath: '/docs' },
        { name: 'image.png', isFile: () => true, parentPath: '/docs' },
        { name: 'readme.txt', isFile: () => true, parentPath: '/docs' },
        { name: 'subdir', isFile: () => false, parentPath: '/docs' },
      ];

      vi.mocked(readdir).mockResolvedValue(mockDirents as any);
      vi.mocked(readFile).mockResolvedValue('# Doc');

      const pages = await buildStaticPages('/docs');

      expect(pages).toHaveLength(1);
      expect(pages[0].slug).toBe('doc');
    });

    it('handles markdown without frontmatter', async () => {
      const mockDirent = {
        name: 'no-frontmatter.md',
        isFile: () => true,
        parentPath: '/docs',
      };

      vi.mocked(readdir).mockResolvedValue([mockDirent as any]);
      vi.mocked(readFile).mockResolvedValue('# Plain Markdown\n\nNo frontmatter here.');

      const pages = await buildStaticPages('/docs');

      expect(pages[0].meta).toEqual({});
      expect(pages[0].title).toBe('no-frontmatter');
      expect(pages[0].raw).toBe('# Plain Markdown\n\nNo frontmatter here.');
    });

    it('uses slug basename as title when no frontmatter title', async () => {
      const mockDirent = {
        name: 'my-doc-name.md',
        isFile: () => true,
        parentPath: '/docs/nested',
      };

      vi.mocked(readdir).mockResolvedValue([mockDirent as any]);
      vi.mocked(readFile).mockResolvedValue('Content without title.');

      const pages = await buildStaticPages('/docs');

      expect(pages[0].title).toBe('my-doc-name');
    });

    it('processes code blocks with syntax highlighting', async () => {
      const mockDirent = {
        name: 'code.md',
        isFile: () => true,
        parentPath: '/docs',
      };

      const content = '```typescript\nconst x: number = 42;\n```';

      vi.mocked(readdir).mockResolvedValue([mockDirent as any]);
      vi.mocked(readFile).mockResolvedValue(content);

      const pages = await buildStaticPages('/docs');

      expect(pages[0].html).toContain('<pre class="shiki');
      expect(pages[0].html).toContain('const');
    });

    it('handles GFM tables in content', async () => {
      const mockDirent = {
        name: 'table.md',
        isFile: () => true,
        parentPath: '/docs',
      };

      const content = `| Col 1 | Col 2 |
|-------|-------|
| A     | B     |`;

      vi.mocked(readdir).mockResolvedValue([mockDirent as any]);
      vi.mocked(readFile).mockResolvedValue(content);

      const pages = await buildStaticPages('/docs');

      expect(pages[0].html).toContain('<table>');
      expect(pages[0].html).toContain('<thead>');
      expect(pages[0].html).toContain('Col 1');
    });

    it('adds ID slugs to headings', async () => {
      const mockDirent = {
        name: 'headings.md',
        isFile: () => true,
        parentPath: '/docs',
      };

      const content = '# Main Title\n\n## Subsection';

      vi.mocked(readdir).mockResolvedValue([mockDirent as any]);
      vi.mocked(readFile).mockResolvedValue(content);

      const pages = await buildStaticPages('/docs');

      expect(pages[0].html).toContain('id="main-title"');
      expect(pages[0].html).toContain('id="subsection"');
    });
  });
});
