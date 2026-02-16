import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { existsSync, readFileSync, writeFileSync, mkdirSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { CodeDocsConfig } from './schema.js';
import { DEFAULT_CONFIG } from './defaults.js';

/**
 * Deep merge utility for config objects
 */
function deepMerge<T extends Record<string, any>>(target: T, source: Partial<T>): T {
  const result = { ...target };

  for (const key in source) {
    const sourceValue = source[key];
    const targetValue = result[key];

    if (
      sourceValue &&
      typeof sourceValue === 'object' &&
      !Array.isArray(sourceValue) &&
      targetValue &&
      typeof targetValue === 'object' &&
      !Array.isArray(targetValue)
    ) {
      result[key] = deepMerge(targetValue, sourceValue) as any;
    } else if (sourceValue !== undefined) {
      result[key] = sourceValue as any;
    }
  }

  return result;
}

/**
 * Load and validate configuration from a TypeScript config file
 * @param configPath - Path to the config file (default: './codedocs.config.ts')
 * @returns Validated configuration object
 */
export async function loadConfig(configPath = './codedocs.config.ts'): Promise<CodeDocsConfig> {
  const absolutePath = resolve(process.cwd(), configPath);
  const fileUrl = pathToFileURL(absolutePath).href;

  // Check if the config file actually exists before attempting import
  if (!existsSync(absolutePath)) {
    console.warn(`Config file not found at ${configPath}, using defaults`);
    return DEFAULT_CONFIG;
  }

  let userConfig: any;

  // For .ts files, check if the project is CJS — native import() will fail
  // and emit a noisy Node warning. Skip straight to fallback in that case.
  const needsFallback = absolutePath.endsWith('.ts') && !isProjectEsm(absolutePath);

  if (needsFallback) {
    userConfig = await loadConfigFallback(absolutePath);
  } else {
    try {
      const configModule = await import(fileUrl);
      userConfig = configModule.default || configModule.config;
    } catch {
      userConfig = await loadConfigFallback(absolutePath);
    }
  }

  if (!userConfig) {
    throw new Error(
      `Config file at ${configPath} must export a default config or named 'config' export`
    );
  }

  // Merge with defaults (preserve user parsers over empty default)
  const mergedConfig = deepMerge(DEFAULT_CONFIG, userConfig);

  return mergedConfig as CodeDocsConfig;
}

/**
 * Check if the nearest package.json has "type": "module".
 */
function isProjectEsm(filePath: string): boolean {
  let dir = resolve(filePath, '..');
  const root = resolve('/');
  while (dir !== root) {
    const pkgPath = join(dir, 'package.json');
    if (existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
        return pkg.type === 'module';
      } catch {
        return false;
      }
    }
    dir = resolve(dir, '..');
  }
  return false;
}

/**
 * Fallback config loader for .ts files in CJS projects.
 * Strips JSDoc/type annotations, writes a temp .mjs file, imports it.
 */
async function loadConfigFallback(absolutePath: string): Promise<any> {
  const source = readFileSync(absolutePath, 'utf-8');

  // Strip JSDoc block comments and TS type annotations that may appear
  const cleaned = source
    .replace(/\/\*\*[\s\S]*?\*\//g, '')        // JSDoc blocks
    .replace(/:\s*import\([^)]*\)\.[^\s,;]*/g, '') // inline import() types
    .replace(/as\s+const\s*/g, '');             // as const

  // Write to a temp .mjs file so Node always treats it as ESM
  const tmpDir = join(tmpdir(), 'codedocs-config');
  mkdirSync(tmpDir, { recursive: true });
  const tmpFile = join(tmpDir, `config-${Date.now()}.mjs`);

  try {
    writeFileSync(tmpFile, cleaned, 'utf-8');
    const tmpUrl = pathToFileURL(tmpFile).href;
    const mod = await import(tmpUrl);
    return mod.default || mod.config;
  } finally {
    try { unlinkSync(tmpFile); } catch { /* ignore cleanup errors */ }
  }
}
