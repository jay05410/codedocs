import { readFile, writeFile, mkdir } from 'fs/promises';
import { createHash } from 'crypto';
import { resolve, dirname } from 'path';
import { existsSync } from 'fs';
import type { ParseResult, SourceFile } from './types.js';

export interface CacheData {
  version: number;
  parserResults: Record<string, ParserCacheEntry>;
}

export interface ParserCacheEntry {
  hash: string;
  lastModified: string;
  result: ParseResult;
}

/**
 * AnalysisCache - manages caching of parsed file results
 */
export class AnalysisCache {
  private cache: CacheData;
  private readonly cacheFilePath: string;

  constructor(cacheDir: string = '.codedocs/cache') {
    this.cacheFilePath = resolve(process.cwd(), cacheDir, 'analysis-cache.json');
    this.cache = {
      version: 2,
      parserResults: {},
    };
  }

  /**
   * Load cache from disk
   */
  async loadCache(): Promise<void> {
    try {
      if (existsSync(this.cacheFilePath)) {
        const content = await readFile(this.cacheFilePath, 'utf-8');
        const parsed = JSON.parse(content) as Partial<CacheData>;
        this.cache = {
          version: 2,
          parserResults: parsed.parserResults || {},
        };
      }
    } catch (error) {
      console.warn('Failed to load cache, starting fresh:', error);
      this.cache = { version: 2, parserResults: {} };
    }
  }

  /**
   * Save cache to disk
   */
  async saveCache(): Promise<void> {
    try {
      // Ensure directory exists
      const dir = dirname(this.cacheFilePath);
      if (!existsSync(dir)) {
        await mkdir(dir, { recursive: true });
      }

      await writeFile(this.cacheFilePath, JSON.stringify(this.cache, null, 2), 'utf-8');
    } catch (error) {
      console.warn('Failed to save cache:', error);
    }
  }

  /**
   * Get the full cache data
   */
  getCache(): CacheData {
    return this.cache;
  }

  /**
   * Clear all cached data
   */
  clearCache(): void {
    this.cache = {
      version: 2,
      parserResults: {},
    };
  }

  /**
   * Get cache statistics
   */
  getStats(): { totalFiles: number; cacheSize: string } {
    const totalParserEntries = Object.keys(this.cache.parserResults).length;
    const cacheSize = JSON.stringify(this.cache).length;
    const sizeKB = (cacheSize / 1024).toFixed(2);
    return {
      totalFiles: totalParserEntries,
      cacheSize: `${sizeKB} KB`,
    };
  }

  /**
   * Get cached parse result for a parser + current input file set.
   */
  getParserResult(parserName: string, files: SourceFile[]): ParseResult | null {
    const key = this.parserKey(parserName);
    const entry = this.cache.parserResults[key];
    if (!entry) return null;

    const currentHash = this.hashParserInput(parserName, files);
    return entry.hash === currentHash ? entry.result : null;
  }

  /**
   * Save parse result for a parser + current input file set.
   */
  setParserResult(parserName: string, files: SourceFile[], result: ParseResult): void {
    const key = this.parserKey(parserName);
    this.cache.parserResults[key] = {
      hash: this.hashParserInput(parserName, files),
      lastModified: new Date().toISOString(),
      result,
    };
  }

  /**
   * Generate MD5 hash of content
   */
  private hashContent(content: string): string {
    return createHash('md5').update(content).digest('hex');
  }

  private hashParserInput(parserName: string, files: SourceFile[]): string {
    const normalized = files
      .map((file) => `${file.path}:${this.hashContent(file.content)}`)
      .sort()
      .join('|');
    return createHash('md5').update(`${parserName}|${normalized}`).digest('hex');
  }

  private parserKey(parserName: string): string {
    return `parser:${parserName}`;
  }
}
