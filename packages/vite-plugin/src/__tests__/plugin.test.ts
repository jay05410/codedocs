import { describe, it, expect, vi, beforeEach } from 'vitest';
import { codedocsPlugin } from '../plugin.js';
import type { Plugin } from 'vite';

describe('plugin', () => {
  describe('codedocsPlugin', () => {
    it('returns a plugin object with name "codedocs"', () => {
      const plugin = codedocsPlugin();
      expect(plugin.name).toBe('codedocs');
    });

    it('has enforce: "pre"', () => {
      const plugin = codedocsPlugin();
      expect(plugin.enforce).toBe('pre');
    });

    it('config() adds @docs alias', () => {
      const plugin = codedocsPlugin({ docsDir: './my-docs' });
      const config = (plugin as Plugin).config?.({} as any, { command: 'serve', mode: 'development' });

      expect(config?.resolve?.alias).toHaveProperty('@docs');
      expect(config?.resolve?.alias?.['@docs']).toContain('my-docs');
    });

    it('uses default docsDir when no options given', () => {
      const plugin = codedocsPlugin();
      const config = (plugin as Plugin).config?.({} as any, { command: 'serve', mode: 'development' });

      expect(config?.resolve?.alias?.['@docs']).toContain('docs');
    });

    it('preserves existing resolve config', () => {
      const plugin = codedocsPlugin({ docsDir: './docs' });
      const existingConfig = {
        resolve: {
          alias: {
            '@existing': '/path/to/existing',
          },
        },
      };

      const config = (plugin as Plugin).config?.(existingConfig as any, { command: 'serve', mode: 'development' });

      expect(config?.resolve?.alias).toHaveProperty('@existing');
      expect(config?.resolve?.alias).toHaveProperty('@docs');
    });

    it('transform() returns null for non-.md files', async () => {
      const plugin = codedocsPlugin();
      const result = await (plugin as Plugin).transform?.('console.log("test");', '/path/to/file.ts');

      expect(result).toBeNull();
    });

    it('transform() returns null for .md in middle of path', async () => {
      const plugin = codedocsPlugin();
      const result = await (plugin as Plugin).transform?.('code', '/path.md/file.ts');

      expect(result).toBeNull();
    });

    it('transform() converts .md content to JS module with html and raw exports', async () => {
      const plugin = codedocsPlugin();
      const markdown = '# Title\n\nContent here.';
      const result = await (plugin as Plugin).transform?.(markdown, '/path/to/doc.md');

      expect(result).toBeTruthy();
      expect(result?.code).toContain('export const html =');
      expect(result?.code).toContain('export const raw =');
      expect(result?.code).toContain('Title');
      expect(result?.code).toContain('Content here.');
      expect(result?.map).toBeNull();
    });

    it('transform() processes markdown with GFM features', async () => {
      const plugin = codedocsPlugin();
      const markdown = '# Test\n\n~~strikethrough~~\n\n- [ ] Task';
      const result = await (plugin as Plugin).transform?.(markdown, '/test.md');

      expect(result?.code).toContain('<del>strikethrough</del>');
      expect(result?.code).toContain('checkbox');
    });

    it('transform() reuses processor instance', async () => {
      const plugin = codedocsPlugin();

      // First call creates processor
      const result1 = await (plugin as Plugin).transform?.('# First', '/first.md');
      expect(result1).toBeTruthy();

      // Second call should reuse processor
      const result2 = await (plugin as Plugin).transform?.('# Second', '/second.md');
      expect(result2).toBeTruthy();
      expect(result2?.code).toContain('Second');
    });

    it('transform() handles empty markdown file', async () => {
      const plugin = codedocsPlugin();
      const result = await (plugin as Plugin).transform?.('', '/empty.md');

      expect(result).toBeTruthy();
      expect(result?.code).toContain('export const html = ""');
      expect(result?.code).toContain('export const raw = ""');
    });

    it('transform() escapes quotes in exported strings', async () => {
      const plugin = codedocsPlugin();
      const markdown = 'Text with "quotes" and \'apostrophes\'.';
      const result = await (plugin as Plugin).transform?.(markdown, '/quotes.md');

      // JSON.stringify should handle escaping
      expect(result?.code).toContain('export const raw =');
      expect(result?.code).toContain('\\"quotes\\"');
      expect(result?.code).toContain("'apostrophes'");
    });

    it('configureServer() is defined', () => {
      const plugin = codedocsPlugin();
      expect((plugin as Plugin).configureServer).toBeDefined();
    });

    it('configureServer() watches docs directory', () => {
      const plugin = codedocsPlugin({ docsDir: './my-docs' });
      const mockWatcher = { add: vi.fn() };
      const mockServer = {
        watcher: mockWatcher,
      };

      (plugin as Plugin).configureServer?.(mockServer as any);

      expect(mockWatcher.add).toHaveBeenCalled();
      expect(mockWatcher.add).toHaveBeenCalledWith(expect.stringContaining('my-docs'));
    });
  });
});
