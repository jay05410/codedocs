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

/**
 * Resolve parser names (strings) to actual ParserPlugin instances.
 * Accepts mixed arrays of string names and ParserPlugin objects.
 */
export async function resolveBuiltinParsers(
  parsers: (string | ParserPlugin)[],
): Promise<ParserPlugin[]> {
  const resolved: ParserPlugin[] = [];

  for (const item of parsers) {
    if (typeof item === 'string') {
      const entry = PARSER_ENTRIES[item];
      if (!entry) {
        console.warn(`Unknown parser: "${item}". Skipping.`);
        continue;
      }

      try {
        const mod = await import(entry.package);
        const factory: ParserFactory = mod[entry.exportName];
        if (typeof factory !== 'function') {
          console.warn(`Parser "${item}" does not export "${entry.exportName}". Skipping.`);
          continue;
        }
        resolved.push(factory(entry.defaultOptions));
      } catch {
        console.warn(`Failed to load parser "${item}" (${entry.package}). Is it installed?`);
      }
    } else {
      // Already a ParserPlugin object - pass through
      resolved.push(item);
    }
  }

  return resolved;
}

/** Get all registered parser names */
export function getRegisteredParserNames(): string[] {
  return Object.keys(PARSER_ENTRIES);
}

/** Get parser entry by name */
export function getParserEntry(name: string): ParserEntry | undefined {
  return PARSER_ENTRIES[name];
}

/** Map package name to short parser name */
export function packageToParserName(pkg: string): string | undefined {
  for (const [name, entry] of Object.entries(PARSER_ENTRIES)) {
    if (entry.package === pkg) return name;
  }
  return undefined;
}
