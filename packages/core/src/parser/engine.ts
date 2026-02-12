import { minimatch } from 'minimatch';
import type {
  ParserPlugin,
  SourceFile,
  AnalysisResult,
  ParseResult,
} from './types.js';
import type { AnalysisCache } from './cache.js';
import { logger } from '../logger.js';

export class ParserEngine {
  private logger = logger.child('ParserEngine');

  constructor(private parsers: ParserPlugin[]) {}

  async analyze(files: SourceFile[], cache?: AnalysisCache): Promise<AnalysisResult> {
    const results: ParseResult[] = [];
    const errors: Array<{ parser: string; error: string; files: string[] }> = [];

    // Run each parser on matching files
    for (const parser of this.parsers) {
      const matchedFiles = this.matchFiles(files, parser.filePattern);
      if (matchedFiles.length > 0) {
        try {
          this.logger.debug(`Running parser "${parser.name}" on ${matchedFiles.length} files`);
          const result = await parser.parse(matchedFiles);
          results.push(result);
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          this.logger.error(
            `Parser "${parser.name}" failed: ${errorMsg}`,
            `Files: ${matchedFiles.map(f => f.path).join(', ')}`
          );
          errors.push({
            parser: parser.name,
            error: errorMsg,
            files: matchedFiles.map(f => f.path),
          });
          // Continue processing other parsers
        }
      }
    }

    // Merge all results
    const merged = this.mergeResults(results);

    // Generate metadata and summary
    const analysisResult: AnalysisResult = {
      metadata: {
        timestamp: new Date().toISOString(),
        sourceDir: this.extractSourceDir(files),
        parsers: this.parsers.map((p) => p.name),
        projectName: this.extractProjectName(files),
        version: '1.0.0',
      },
      summary: {
        totalFiles: files.length,
        endpoints: merged.endpoints?.length ?? 0,
        entities: merged.entities?.length ?? 0,
        services: merged.services?.length ?? 0,
        types: merged.types?.length ?? 0,
      },
      endpoints: merged.endpoints ?? [],
      entities: merged.entities ?? [],
      services: merged.services ?? [],
      types: merged.types ?? [],
      dependencies: merged.dependencies ?? [],
      custom: merged.custom ?? {},
      errors: errors.length > 0 ? errors : undefined,
    };

    return analysisResult;
  }

  private matchFiles(files: SourceFile[], pattern: string | string[]): SourceFile[] {
    const patterns = Array.isArray(pattern) ? pattern : [pattern];
    return files.filter((file) =>
      patterns.some((p) => minimatch(file.path, p, { matchBase: true }))
    );
  }

  private mergeResults(results: ParseResult[]): ParseResult {
    const merged: ParseResult = {
      endpoints: [],
      entities: [],
      services: [],
      types: [],
      dependencies: [],
      custom: {},
    };

    for (const result of results) {
      if (result.endpoints) {
        merged.endpoints!.push(...result.endpoints);
      }
      if (result.entities) {
        merged.entities!.push(...result.entities);
      }
      if (result.services) {
        merged.services!.push(...result.services);
      }
      if (result.types) {
        merged.types!.push(...result.types);
      }
      if (result.dependencies) {
        merged.dependencies!.push(...result.dependencies);
      }
      if (result.custom) {
        merged.custom = { ...merged.custom, ...result.custom };
      }
    }

    return merged;
  }

  private extractSourceDir(files: SourceFile[]): string {
    if (files.length === 0) return '';

    // Find common directory prefix
    const paths = files.map((f) => f.path);
    const parts = paths[0].split('/');

    for (let i = parts.length - 1; i >= 0; i--) {
      const prefix = parts.slice(0, i).join('/');
      if (paths.every((p) => p.startsWith(prefix))) {
        return prefix || '/';
      }
    }

    return '/';
  }

  private extractProjectName(files: SourceFile[]): string {
    const sourceDir = this.extractSourceDir(files);
    const parts = sourceDir.split('/').filter(Boolean);
    return parts[parts.length - 1] || 'unknown';
  }
}
