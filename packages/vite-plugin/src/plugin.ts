import type { Plugin } from 'vite';
import { resolve } from 'path';
import { createMarkdownProcessor } from './markdown-loader.js';

export interface CodeDocsViteOptions {
  /** Directory containing generated markdown files */
  docsDir?: string;
  /** Theme package entry point */
  themeEntry?: string;
}

export function codedocsPlugin(options: CodeDocsViteOptions = {}): Plugin {
  const docsDir = options.docsDir || './docs';
  const mdProcessor = createMarkdownProcessor();

  return {
    name: 'codedocs',
    enforce: 'pre',

    config(config) {
      return {
        ...config,
        resolve: {
          ...config.resolve,
          alias: {
            ...config.resolve?.alias,
            '@docs': resolve(process.cwd(), docsDir),
          },
        },
      };
    },

    async transform(code, id) {
      // Transform .md files into importable modules
      if (id.endsWith('.md')) {
        const html = await mdProcessor.process(code);
        return {
          code: `export const html = ${JSON.stringify(String(html))};\nexport const raw = ${JSON.stringify(code)};`,
          map: null,
        };
      }
      return null;
    },

    configureServer(server) {
      // Watch docs directory for changes
      server.watcher.add(resolve(process.cwd(), docsDir));
    },
  };
}
