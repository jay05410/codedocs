import type { ParserPlugin } from '@codedocs/core';

const DEFAULT_SOURCE_PATTERNS = [
  '**/*.{ts,tsx,js,jsx,vue,svelte,py,java,kt,kts,go,php,c,h,cpp,hpp,cc,cxx,graphql,gql,json,yaml,yml}',
];

export function resolveSourcePatterns(parsers: ParserPlugin[]): string[] {
  const patterns = parsers.flatMap((parser) =>
    Array.isArray(parser.filePattern) ? parser.filePattern : [parser.filePattern]
  );

  const normalized = patterns
    .map((pattern) => pattern.trim())
    .filter((pattern) => pattern.length > 0);

  if (normalized.length === 0) {
    return DEFAULT_SOURCE_PATTERNS;
  }

  return Array.from(new Set(normalized));
}
