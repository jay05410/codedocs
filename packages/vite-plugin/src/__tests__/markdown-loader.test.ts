import { describe, it, expect } from 'vitest';
import { createMarkdownProcessor } from '../markdown-loader.js';

describe('markdown-loader', () => {
  describe('createMarkdownProcessor', () => {
    it('processes basic markdown to HTML', async () => {
      const processor = await createMarkdownProcessor();
      const result = await processor.process('# Hello\n\nThis is **bold** text.');
      const html = String(result);

      expect(html).toContain('<h1');
      expect(html).toContain('Hello');
      expect(html).toContain('<strong>bold</strong>');
    });

    it('handles GFM tables', async () => {
      const processor = await createMarkdownProcessor();
      const markdown = `
| Header 1 | Header 2 |
|----------|----------|
| Cell 1   | Cell 2   |
`;
      const result = await processor.process(markdown);
      const html = String(result);

      expect(html).toContain('<table>');
      expect(html).toContain('<thead>');
      expect(html).toContain('<tbody>');
      expect(html).toContain('Header 1');
      expect(html).toContain('Cell 1');
    });

    it('handles GFM strikethrough and task lists', async () => {
      const processor = await createMarkdownProcessor();
      const markdown = `
~~strikethrough~~

- [ ] Task 1
- [x] Task 2
`;
      const result = await processor.process(markdown);
      const html = String(result);

      expect(html).toContain('<del>strikethrough</del>');
      expect(html).toContain('type="checkbox"');
      expect(html).toContain('disabled');
    });

    it('adds id slugs to headings (rehypeSlug)', async () => {
      const processor = await createMarkdownProcessor();
      const result = await processor.process('# My Heading\n\n## Another One');
      const html = String(result);

      expect(html).toContain('id="my-heading"');
      expect(html).toContain('id="another-one"');
    });

    it('handles code blocks with shiki', async () => {
      const processor = await createMarkdownProcessor();
      const markdown = '```js\nconst x = 42;\n```';
      const result = await processor.process(markdown);
      const html = String(result);

      expect(html).toContain('<pre class="shiki');
      expect(html).toContain('const');
      expect(html).toContain('42');
    });

    it('handles dangerous HTML pass-through', async () => {
      const processor = await createMarkdownProcessor();
      const markdown = '<div class="custom">raw html</div>\n\nAnd **markdown**.';
      const result = await processor.process(markdown);
      const html = String(result);

      expect(html).toContain('<div class="custom">');
      expect(html).toContain('raw html');
      expect(html).toContain('<strong>markdown</strong>');
    });

    it('processes empty input', async () => {
      const processor = await createMarkdownProcessor();
      const result = await processor.process('');
      const html = String(result);

      expect(html).toBe('');
    });

    it('processes whitespace-only input', async () => {
      const processor = await createMarkdownProcessor();
      const result = await processor.process('   \n\n   ');
      const html = String(result);

      expect(html.trim()).toBe('');
    });
  });
});
