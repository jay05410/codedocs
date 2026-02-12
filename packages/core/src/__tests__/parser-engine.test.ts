import { describe, it, expect, vi } from 'vitest';
import { ParserEngine } from '../parser/engine.js';
import type { ParserPlugin, SourceFile, ParseResult } from '../parser/types.js';

function createMockFile(path: string, content = ''): SourceFile {
  return { path, content, language: 'typescript' };
}

function createMockParser(name: string, pattern: string, result: Partial<ParseResult> = {}): ParserPlugin {
  return {
    name,
    filePattern: pattern,
    parse: vi.fn().mockResolvedValue({
      endpoints: [],
      entities: [],
      services: [],
      types: [],
      dependencies: [],
      ...result,
    }),
  };
}

describe('ParserEngine', () => {
  it('analyzes files with matching parser', async () => {
    const parser = createMockParser('test', '**/*.ts', {
      endpoints: [{ name: 'getUser', protocol: 'rest', httpMethod: 'GET', path: '/users', handler: 'getUser', handlerClass: 'UserController', returnType: 'User', parameters: [], filePath: 'test.ts' }],
    });
    const engine = new ParserEngine([parser]);
    const files = [createMockFile('src/test.ts')];

    const result = await engine.analyze(files);

    expect(parser.parse).toHaveBeenCalledWith(files);
    expect(result.endpoints).toHaveLength(1);
    expect(result.endpoints[0].name).toBe('getUser');
  });

  it('skips parsers with no matching files', async () => {
    const parser = createMockParser('test', '**/*.kt');
    const engine = new ParserEngine([parser]);
    const files = [createMockFile('src/test.ts')];

    await engine.analyze(files);

    expect(parser.parse).not.toHaveBeenCalled();
  });

  it('merges results from multiple parsers', async () => {
    const parser1 = createMockParser('p1', '**/*.ts', {
      endpoints: [{ name: 'ep1', protocol: 'rest', httpMethod: 'GET', path: '/a', handler: 'h1', handlerClass: 'C1', returnType: 'string', parameters: [], filePath: 'a.ts' }],
    });
    const parser2 = createMockParser('p2', '**/*.ts', {
      entities: [{ name: 'User', tableName: 'users', dbType: 'postgres', columns: [], relations: [], indexes: [], filePath: 'b.ts' }],
    });
    const engine = new ParserEngine([parser1, parser2]);
    const files = [createMockFile('src/a.ts'), createMockFile('src/b.ts')];

    const result = await engine.analyze(files);

    expect(result.endpoints).toHaveLength(1);
    expect(result.entities).toHaveLength(1);
  });

  it('produces correct metadata', async () => {
    const parser = createMockParser('test-parser', '**/*.ts');
    const engine = new ParserEngine([parser]);
    const files = [createMockFile('src/app/test.ts'), createMockFile('src/app/other.ts')];

    const result = await engine.analyze(files);

    expect(result.metadata.parsers).toEqual(['test-parser']);
    expect(result.summary.totalFiles).toBe(2);
  });

  it('handles empty file list', async () => {
    const parser = createMockParser('test', '**/*.ts');
    const engine = new ParserEngine([parser]);

    const result = await engine.analyze([]);

    expect(result.endpoints).toEqual([]);
    expect(result.entities).toEqual([]);
    expect(result.summary.totalFiles).toBe(0);
  });

  it('produces correct summary counts', async () => {
    const parser = createMockParser('test', '**/*.ts', {
      endpoints: [
        { name: 'ep1', protocol: 'rest', httpMethod: 'GET', path: '/a', handler: 'h', handlerClass: 'C', returnType: 'void', parameters: [], filePath: 'a.ts' },
        { name: 'ep2', protocol: 'rest', httpMethod: 'POST', path: '/b', handler: 'h', handlerClass: 'C', returnType: 'void', parameters: [], filePath: 'a.ts' },
      ],
      entities: [
        { name: 'User', tableName: 'users', dbType: 'pg', columns: [], relations: [], indexes: [], filePath: 'b.ts' },
      ],
      services: [
        { name: 'UserService', methods: ['getUser'], dependencies: [], filePath: 'c.ts' },
      ],
    });
    const engine = new ParserEngine([parser]);

    const result = await engine.analyze([createMockFile('src/test.ts')]);

    expect(result.summary.endpoints).toBe(2);
    expect(result.summary.entities).toBe(1);
    expect(result.summary.services).toBe(1);
  });
});
