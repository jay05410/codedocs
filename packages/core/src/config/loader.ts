import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
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

  try {
    // Dynamic import of the config file
    const configModule = await import(fileUrl);
    const userConfig = configModule.default || configModule.config;

    if (!userConfig) {
      throw new Error(
        `Config file at ${configPath} must export a default config or named 'config' export`
      );
    }

    // Merge with defaults (preserve user parsers over empty default)
    const mergedConfig = deepMerge(DEFAULT_CONFIG, userConfig);

    return mergedConfig as CodeDocsConfig;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to load config from ${configPath}: ${msg}`);
  }
}
