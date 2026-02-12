import type { Plugin } from 'vite';
import { resolve } from 'path';
import { readFileSync, existsSync } from 'fs';
import { createMarkdownProcessor } from './markdown-loader.js';

export interface CodeDocsViteOptions {
  /** Directory containing generated markdown files */
  docsDir?: string;
  /** Theme package entry point */
  themeEntry?: string;
  /** Path to shared memos JSON file (default: .codedocs/memos.json) */
  memosFile?: string;
}

const VIRTUAL_MEMOS_ID = 'virtual:codedocs-memos';
const RESOLVED_VIRTUAL_MEMOS_ID = '\0' + VIRTUAL_MEMOS_ID;

function loadMemosJson(memosPath: string): string {
  try {
    if (existsSync(memosPath)) {
      const raw = readFileSync(memosPath, 'utf-8');
      // Validate it parses as JSON
      JSON.parse(raw);
      return raw;
    }
  } catch {
    // fall through
  }
  return '{"version":1,"memos":{}}';
}

export function codedocsPlugin(options: CodeDocsViteOptions = {}): Plugin {
  const docsDir = options.docsDir || './docs';
  const memosFile = options.memosFile || '.codedocs/memos.json';
  let mdProcessor: Awaited<ReturnType<typeof createMarkdownProcessor>> | null = null;
  let memosPath: string;

  return {
    name: 'codedocs',
    enforce: 'pre',

    config(config) {
      memosPath = resolve(process.cwd(), memosFile);
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

    resolveId(id) {
      if (id === VIRTUAL_MEMOS_ID) {
        return RESOLVED_VIRTUAL_MEMOS_ID;
      }
    },

    load(id) {
      if (id === RESOLVED_VIRTUAL_MEMOS_ID) {
        const json = loadMemosJson(memosPath);
        return `export default ${json};`;
      }
    },

    async transform(code, id) {
      // Transform .md files into importable modules
      if (id.endsWith('.md')) {
        if (!mdProcessor) {
          mdProcessor = await createMarkdownProcessor();
        }
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

      // Watch memos file for HMR during dev
      if (memosPath) {
        server.watcher.add(memosPath);
        server.watcher.on('change', (changedPath) => {
          if (changedPath === memosPath) {
            const mod = server.moduleGraph.getModuleById(RESOLVED_VIRTUAL_MEMOS_ID);
            if (mod) {
              server.moduleGraph.invalidateModule(mod);
              server.ws.send({ type: 'full-reload' });
            }
          }
        });
      }
    },
  };
}
