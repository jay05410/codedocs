// packages/core/src/parser/tree-sitter-engine.ts
// Tree-sitter WASM engine for accurate AST-based code parsing
// Provides shared utilities for parsers to use tree-sitter instead of regex

import { createRequire } from 'node:module';
import { logger } from '../logger.js';

// Optional dependency — variable indirection prevents TS static module resolution
const WEB_TREE_SITTER = 'web-tree-sitter';

// ESM-compatible require.resolve for locating .wasm files
const esmRequire = createRequire(import.meta.url);

const engineLogger = logger.child('TreeSitter');

// Lazy-loaded tree-sitter types
let Parser: any = null;

/**
 * Tree-sitter query match result
 */
export interface TsQueryMatch {
  pattern: number;
  captures: Array<{
    name: string;
    node: TsNode;
  }>;
}

/**
 * Simplified tree-sitter node interface
 */
export interface TsNode {
  type: string;
  text: string;
  startPosition: { row: number; column: number };
  endPosition: { row: number; column: number };
  children: TsNode[];
  childCount: number;
  namedChildren: TsNode[];
  namedChildCount: number;
  parent: TsNode | null;
  firstChild: TsNode | null;
  lastChild: TsNode | null;
  nextSibling: TsNode | null;
  previousSibling: TsNode | null;
  firstNamedChild: TsNode | null;
  lastNamedChild: TsNode | null;
  nextNamedSibling: TsNode | null;
  previousNamedSibling: TsNode | null;
  childForFieldName(fieldName: string): TsNode | null;
  descendantsOfType(type: string): TsNode[];
}

/**
 * Supported language grammars
 */
export type TsLanguage =
  | 'typescript'
  | 'tsx'
  | 'python'
  | 'go'
  | 'java'
  | 'kotlin'
  | 'php'
  | 'c'
  | 'cpp';

/**
 * Map of language to npm package name containing the .wasm grammar
 */
const GRAMMAR_PACKAGES: Record<TsLanguage, string> = {
  typescript: 'tree-sitter-typescript',
  tsx: 'tree-sitter-typescript',
  python: 'tree-sitter-python',
  go: 'tree-sitter-go',
  java: 'tree-sitter-java',
  kotlin: 'tree-sitter-kotlin',
  php: 'tree-sitter-php',
  c: 'tree-sitter-c',
  cpp: 'tree-sitter-cpp',
};

/**
 * Cached language instances (load once, reuse)
 */
const languageCache = new Map<string, any>();

/**
 * Whether tree-sitter is available (web-tree-sitter installed)
 */
let treeSitterAvailable: boolean | null = null;

/**
 * Check if tree-sitter WASM is available
 */
export async function isTreeSitterAvailable(): Promise<boolean> {
  if (treeSitterAvailable !== null) return treeSitterAvailable;

  try {
    const mod = await import(WEB_TREE_SITTER);
    Parser = mod.default;
    await Parser.init();
    treeSitterAvailable = true;
    engineLogger.debug('Tree-sitter WASM initialized');
  } catch {
    treeSitterAvailable = false;
    engineLogger.debug(
      'Tree-sitter not available (web-tree-sitter not installed)',
    );
  }

  return treeSitterAvailable;
}

/**
 * Load a language grammar (cached)
 */
export async function loadLanguage(lang: TsLanguage): Promise<any> {
  if (languageCache.has(lang)) {
    return languageCache.get(lang);
  }

  if (!(await isTreeSitterAvailable())) {
    throw new Error(
      'Tree-sitter is not available. Install: npm install web-tree-sitter',
    );
  }

  const packageName = GRAMMAR_PACKAGES[lang];
  if (!packageName) {
    throw new Error(`No grammar available for language: ${lang}`);
  }

  try {
    // Resolve .wasm file path using ESM-compatible require
    let wasmPath: string;

    if (lang === 'tsx') {
      wasmPath = esmRequire.resolve(`${packageName}/tsx.wasm`);
    } else if (lang === 'typescript') {
      wasmPath = esmRequire.resolve(`${packageName}/typescript.wasm`);
    } else {
      // Most grammars: package-name/tree-sitter-lang.wasm
      const wasmFile = `tree-sitter-${lang}.wasm`;
      wasmPath = esmRequire.resolve(`${packageName}/${wasmFile}`);
    }

    const language = await Parser.Language.load(wasmPath);
    languageCache.set(lang, language);
    engineLogger.debug(`Loaded grammar: ${lang}`);
    return language;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Failed to load ${lang} grammar. Install: npm install ${packageName}\n${msg}`,
    );
  }
}

/**
 * Parse source code into a tree-sitter AST.
 * Caller is responsible for calling tree.delete() when done to free WASM memory.
 */
export async function parseCode(
  code: string,
  lang: TsLanguage,
): Promise<{ tree: any; language: any }> {
  const language = await loadLanguage(lang);
  const parser = new Parser();
  parser.setLanguage(language);
  const tree = parser.parse(code);
  parser.delete();
  return { tree, language };
}

/**
 * Run a tree-sitter query against parsed code and return matches.
 * Handles WASM tree cleanup internally.
 */
export async function queryCode(
  code: string,
  lang: TsLanguage,
  querySource: string,
): Promise<TsQueryMatch[]> {
  const { tree, language } = await parseCode(code, lang);
  try {
    const query = language.query(querySource);
    const matches = query.matches(tree.rootNode);
    return matches;
  } finally {
    tree.delete();
  }
}

/**
 * Get all nodes of a specific type from parsed code.
 * Handles WASM tree cleanup internally.
 */
export async function findNodes(
  code: string,
  lang: TsLanguage,
  nodeType: string,
): Promise<TsNode[]> {
  const { tree } = await parseCode(code, lang);
  try {
    return tree.rootNode.descendantsOfType(nodeType);
  } finally {
    tree.delete();
  }
}

/**
 * Extract text from a capture in a query match
 */
export function captureText(
  match: TsQueryMatch,
  captureName: string,
): string | undefined {
  const capture = match.captures.find((c) => c.name === captureName);
  return capture?.node.text;
}

/**
 * Extract all texts from captures with a given name
 */
export function captureAllTexts(
  matches: TsQueryMatch[],
  captureName: string,
): string[] {
  return matches
    .map((m) => captureText(m, captureName))
    .filter((t): t is string => t !== undefined);
}

/**
 * Detect language from file extension
 */
export function detectLanguage(filePath: string): TsLanguage | null {
  const ext = filePath.split('.').pop()?.toLowerCase();
  const extMap: Record<string, TsLanguage> = {
    ts: 'typescript',
    tsx: 'tsx',
    py: 'python',
    go: 'go',
    java: 'java',
    kt: 'kotlin',
    kts: 'kotlin',
    php: 'php',
    c: 'c',
    h: 'c',
    cpp: 'cpp',
    cc: 'cpp',
    cxx: 'cpp',
    hpp: 'cpp',
  };
  return extMap[ext || ''] || null;
}
