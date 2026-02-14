// packages/core/src/parser/sfc-utils.ts
// Shared utilities for Single File Component (SFC) parsing (Vue, Svelte)

/**
 * Extract <script> block content from an SFC
 */
export function extractScriptBlock(content: string): string | null {
  const match = content.match(/<script[^>]*>([\s\S]*?)<\/script>/);
  return match ? match[1] : null;
}

/**
 * Extract <template> block content from an SFC
 */
export function extractTemplateBlock(content: string): string | null {
  const match = content.match(/<template>([\s\S]*?)<\/template>/);
  return match ? match[1] : null;
}

/**
 * Extract <style> block content from an SFC
 */
export function extractStyleBlock(content: string): string | null {
  const match = content.match(/<style[^>]*>([\s\S]*?)<\/style>/);
  return match ? match[1] : null;
}

/**
 * Extract the body of a named function (handles both `function name` and `const name` forms)
 */
export function extractFunctionBody(content: string, funcName: string): string | null {
  const idx = content.indexOf(`function ${funcName}`);
  const constIdx = content.indexOf(`const ${funcName}`);
  const start = idx !== -1 ? idx : constIdx;
  if (start === -1) return null;

  const braceIdx = content.indexOf('{', start);
  if (braceIdx === -1) return null;

  let depth = 1;
  let i = braceIdx + 1;
  while (i < content.length && depth > 0) {
    if (content[i] === '{') depth++;
    else if (content[i] === '}') depth--;
    i++;
  }

  return content.substring(braceIdx + 1, i - 1);
}

/**
 * Infer TypeScript type from a default value expression
 */
export function inferTypeFromDefault(value?: string): string {
  if (!value) return 'unknown';
  const trimmed = value.trim();
  if (trimmed === 'true' || trimmed === 'false') return 'boolean';
  if (/^['"`]/.test(trimmed)) return 'string';
  if (/^\d/.test(trimmed)) return 'number';
  if (trimmed.startsWith('[')) return 'array';
  if (trimmed.startsWith('{')) return 'object';
  if (trimmed === 'null') return 'null';
  if (trimmed === 'undefined') return 'undefined';
  return 'unknown';
}
