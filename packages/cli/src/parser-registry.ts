import type { ParserPlugin } from '@codedocs/core';

/**
 * Built-in parser registry
 * Maps short parser names to dynamic imports of parser packages.
 * This allows config files to use simple string names instead of direct imports.
 */

interface ParserFactory {
  (options?: Record<string, boolean>): ParserPlugin;
}

interface ParserEntry {
  package: string;
  exportName: string;
  defaultOptions?: Record<string, boolean>;
}

const PARSER_ENTRIES: Record<string, ParserEntry> = {
  react: { package: '@codedocs/parser-react', exportName: 'reactParser', defaultOptions: { detectRoutes: true } },
  vue: { package: '@codedocs/parser-vue', exportName: 'vueParser', defaultOptions: { detectRoutes: true } },
  svelte: { package: '@codedocs/parser-svelte', exportName: 'svelteParser', defaultOptions: { detectRoutes: true } },
  nestjs: { package: '@codedocs/parser-typescript-nestjs', exportName: 'nestjsParser', defaultOptions: { detectOrm: true } },
  'kotlin-spring': { package: '@codedocs/parser-kotlin-spring', exportName: 'kotlinSpringParser', defaultOptions: { detectFrameworks: true } },
  'java-spring': { package: '@codedocs/parser-java-spring', exportName: 'javaSpringParser', defaultOptions: { detectFrameworks: true } },
  'python-fastapi': { package: '@codedocs/parser-python-fastapi', exportName: 'fastApiParser', defaultOptions: { detectOrm: true, detectPydantic: true } },
  php: { package: '@codedocs/parser-php', exportName: 'phpParser', defaultOptions: { detectFrameworks: true } },
  go: { package: '@codedocs/parser-go', exportName: 'goParser', defaultOptions: { detectFrameworks: true } },
  c: { package: '@codedocs/parser-c', exportName: 'cParser' },
  cpp: { package: '@codedocs/parser-cpp', exportName: 'cppParser' },
  graphql: { package: '@codedocs/parser-graphql', exportName: 'graphqlParser', defaultOptions: { parseSchemas: true } },
  openapi: { package: '@codedocs/parser-openapi', exportName: 'openApiParser', defaultOptions: { parseSchemas: true } },
};

export interface ParserLoadError {
  name: string;
  package: string;
  reason: string;
}

export interface ResolveResult {
  parsers: ParserPlugin[];
  errors: ParserLoadError[];
}

/**
 * Resolve parser names (strings) to actual ParserPlugin instances.
 * Accepts mixed arrays of string names and ParserPlugin objects.
 * Returns both resolved parsers and any load errors so the CLI can display them.
 */
export async function resolveBuiltinParsers(
  parsers: (string | ParserPlugin)[],
): Promise<ResolveResult> {
  const resolved: ParserPlugin[] = [];
  const errors: ParserLoadError[] = [];

  for (const item of parsers) {
    if (typeof item === 'string') {
      const entry = PARSER_ENTRIES[item];
      if (!entry) {
        errors.push({ name: item, package: 'unknown', reason: `Unknown parser: "${item}"` });
        continue;
      }

      try {
        const mod = await import(entry.package);
        const factory: ParserFactory = mod[entry.exportName];
        if (typeof factory !== 'function') {
          errors.push({
            name: item,
            package: entry.package,
            reason: `Does not export "${entry.exportName}"`,
          });
          continue;
        }
        resolved.push(factory(entry.defaultOptions));
      } catch {
        errors.push({
          name: item,
          package: entry.package,
          reason: `Failed to load (${entry.package}). Is it installed?`,
        });
      }
    } else {
      // Already a ParserPlugin object - pass through
      resolved.push(item);
    }
  }

  return { parsers: resolved, errors };
}

/** Map package name to short parser name */
export function packageToParserName(pkg: string): string | undefined {
  for (const [name, entry] of Object.entries(PARSER_ENTRIES)) {
    if (entry.package === pkg) return name;
  }
  return undefined;
}
