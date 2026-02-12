import { readFile, writeFile, mkdir } from 'fs/promises';
import { createHash } from 'crypto';
import { resolve, dirname } from 'path';
import { existsSync } from 'fs';
import type { ParseResult } from './types.js';

export interface CacheEntry {
  hash: string;
  lastModified: string;
  result: ParseResult;
}

export interface CacheData {
  version: number;
  files: Record<string, CacheEntry>;
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
      version: 1,
      files: {},
    };
  }

  /**
   * Load cache from disk
   */
  async loadCache(): Promise<void> {
    try {
      if (existsSync(this.cacheFilePath)) {
        const content = await readFile(this.cacheFilePath, 'utf-8');
        this.cache = JSON.parse(content);
      }
    } catch (error) {
      console.warn('Failed to load cache, starting fresh:', error);
      this.cache = { version: 1, files: {} };
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
   * Check if a file has changed since last cache
   */
  isFileChanged(filePath: string, content: string): boolean {
    const entry = this.cache.files[filePath];
    if (!entry) {
      return true; // File not in cache
    }

    const currentHash = this.hashContent(content);
    return entry.hash !== currentHash;
  }

  /**
   * Get cached result for a file
   */
  getCachedResult(filePath: string): ParseResult | null {
    const entry = this.cache.files[filePath];
    return entry ? entry.result : null;
  }

  /**
   * Set cached result for a file
   */
  setCachedResult(filePath: string, content: string, result: ParseResult): void {
    const hash = this.hashContent(content);
    this.cache.files[filePath] = {
      hash,
      lastModified: new Date().toISOString(),
      result,
    };
  }

  /**
   * Remove a file from the cache
   */
  removeFile(filePath: string): void {
    delete this.cache.files[filePath];
  }

  /**
   * Clear all cached data
   */
  clearCache(): void {
    this.cache = {
      version: 1,
      files: {},
    };
  }

  /**
   * Get cache statistics
   */
  getStats(): { totalFiles: number; cacheSize: string } {
    const totalFiles = Object.keys(this.cache.files).length;
    const cacheSize = JSON.stringify(this.cache).length;
    const sizeKB = (cacheSize / 1024).toFixed(2);
    return {
      totalFiles,
      cacheSize: `${sizeKB} KB`,
    };
  }

  /**
   * Generate MD5 hash of content
   */
  private hashContent(content: string): string {
    return createHash('md5').update(content).digest('hex');
  }
}
