import { readdir, readFile } from 'fs/promises';
import { resolve, relative, extname } from 'path';
import { createMarkdownProcessor } from './markdown-loader.js';

export interface SsgPage {
  slug: string;
  title: string;
  html: string;
  raw: string;
  meta: Record<string, string>;
  headTags: string;
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

    const title = meta.title || slug.split('/').pop() || 'Untitled';
    const headTags = buildHeadTags(meta, title);

    pages.push({
      slug,
      title,
      html: String(result),
      raw: body,
      meta,
      headTags,
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

function buildHeadTags(meta: Record<string, string>, title: string): string {
  const tags: string[] = [];

  tags.push(`<title>${escapeHtml(title)}</title>`);

  if (meta.description) {
    tags.push(`<meta name="description" content="${escapeHtml(meta.description)}" />`);
  }
  if (meta.tags) {
    tags.push(`<meta name="keywords" content="${escapeHtml(meta.tags)}" />`);
  }
  if (meta.canonical) {
    tags.push(`<link rel="canonical" href="${escapeHtml(meta.canonical)}" />`);
  }
  if (meta.robots) {
    tags.push(`<meta name="robots" content="${escapeHtml(meta.robots)}" />`);
  }

  // Open Graph
  const ogTitle = meta.og_title || title;
  tags.push(`<meta property="og:title" content="${escapeHtml(ogTitle)}" />`);
  if (meta.og_description || meta.description) {
    tags.push(`<meta property="og:description" content="${escapeHtml(meta.og_description || meta.description)}" />`);
  }
  if (meta.og_image) {
    tags.push(`<meta property="og:image" content="${escapeHtml(meta.og_image)}" />`);
  }
  tags.push(`<meta property="og:type" content="${escapeHtml(meta.og_type || 'article')}" />`);

  // Twitter
  if (meta.twitter_card || meta.og_image) {
    tags.push(`<meta name="twitter:card" content="${escapeHtml(meta.twitter_card || 'summary')}" />`);
    tags.push(`<meta name="twitter:title" content="${escapeHtml(meta.twitter_title || ogTitle)}" />`);
    if (meta.twitter_description || meta.og_description || meta.description) {
      tags.push(`<meta name="twitter:description" content="${escapeHtml(meta.twitter_description || meta.og_description || meta.description)}" />`);
    }
    if (meta.twitter_image || meta.og_image) {
      tags.push(`<meta name="twitter:image" content="${escapeHtml(meta.twitter_image || meta.og_image)}" />`);
    }
  }

  return tags.join('\n    ');
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
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
