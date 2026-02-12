import { readdir, readFile } from 'fs/promises';
import { resolve, relative, extname } from 'path';
import { createMarkdownProcessor } from './markdown-loader.js';

export interface SsgPage {
  slug: string;
  title: string;
  html: string;
  raw: string;
  meta: Record<string, string>;
}

/**
 * Build static pages from a docs directory.
 * Reads all .md files, processes them through unified, and returns SsgPage[].
 */
export async function buildStaticPages(docsDir: string): Promise<SsgPage[]> {
  const processor = createMarkdownProcessor();
  const pages: SsgPage[] = [];

  const files = await collectMarkdownFiles(docsDir);

  for (const filePath of files) {
    const raw = await readFile(filePath, 'utf-8');
    const { meta, body } = extractFrontmatter(raw);
    const result = await processor.process(body);

    const slug = relative(docsDir, filePath)
      .replace(extname(filePath), '')
      .replace(/\\/g, '/');

    pages.push({
      slug,
      title: meta.title || slug.split('/').pop() || 'Untitled',
      html: String(result),
      raw: body,
      meta,
    });
  }

  return pages;
}

async function collectMarkdownFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true, recursive: true });
  return entries
    .filter((e) => e.isFile() && e.name.endsWith('.md'))
    .map((e) => resolve(e.parentPath || dir, e.name));
}

function extractFrontmatter(content: string): { meta: Record<string, string>; body: string } {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return { meta: {}, body: content };

  const meta: Record<string, string> = {};
  for (const line of match[1].split('\n')) {
    const colonIdx = line.indexOf(':');
    if (colonIdx > 0) {
      const key = line.slice(0, colonIdx).trim();
      const value = line.slice(colonIdx + 1).trim().replace(/^["']|["']$/g, '');
      meta[key] = value;
    }
  }

  return { meta, body: match[2] };
}
