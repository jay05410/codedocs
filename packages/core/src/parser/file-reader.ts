import { readFile } from 'fs/promises';
import { glob } from 'glob';
import type { SourceFile } from './types.js';

export class FileReader {
  private readonly languageMap: Record<string, string> = {
    '.ts': 'typescript',
    '.tsx': 'typescript',
    '.js': 'javascript',
    '.jsx': 'javascript',
    '.py': 'python',
    '.java': 'java',
    '.kt': 'kotlin',
    '.go': 'go',
    '.rs': 'rust',
    '.rb': 'ruby',
    '.php': 'php',
    '.cs': 'csharp',
    '.cpp': 'cpp',
    '.c': 'c',
    '.h': 'c',
    '.hpp': 'cpp',
    '.swift': 'swift',
    '.m': 'objectivec',
    '.scala': 'scala',
    '.graphql': 'graphql',
    '.gql': 'graphql',
    '.proto': 'protobuf',
    '.json': 'json',
    '.yaml': 'yaml',
    '.yml': 'yaml',
    '.xml': 'xml',
    '.md': 'markdown',
  };

  async readFiles(sourceDir: string, patterns?: string[]): Promise<SourceFile[]> {
    // Default patterns if none provided
    const searchPatterns = patterns ?? ['**/*.{ts,tsx,js,jsx,py,java,kt,go,rs}'];

    // Resolve all matching files
    const allFiles: string[] = [];
    for (const pattern of searchPatterns) {
      const files = await glob(pattern, {
        cwd: sourceDir,
        absolute: true,
        nodir: true,
        ignore: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.git/**'],
      });
      allFiles.push(...files);
    }

    // Remove duplicates
    const uniqueFiles = [...new Set(allFiles)];

    // Read and process each file
    const sourceFiles: SourceFile[] = await Promise.all(
      uniqueFiles.map(async (filePath) => {
        const content = await readFile(filePath, 'utf-8');
        const language = this.detectLanguage(filePath);

        return {
          path: filePath,
          content,
          language,
        };
      })
    );

    return sourceFiles;
  }

  private detectLanguage(filePath: string): string {
    const ext = filePath.substring(filePath.lastIndexOf('.'));
    return this.languageMap[ext] ?? 'unknown';
  }
}
