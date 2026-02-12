import { describe, it, expect } from 'vitest';
import { compareAnalysisResults } from '../changelog/differ.js';
import type { AnalysisResult, EndpointInfo, EntityInfo, ServiceInfo } from '../parser/types.js';

function createAnalysisResult(overrides: Partial<AnalysisResult> = {}): AnalysisResult {
  return {
    metadata: { timestamp: '', sourceDir: '', parsers: [], projectName: '', version: '' },
    summary: { totalFiles: 0, endpoints: 0, entities: 0, services: 0, types: 0 },
    endpoints: [],
    entities: [],
    services: [],
    types: [],
    dependencies: [],
    custom: {},
    ...overrides,
  };
}

function createEndpoint(overrides: Partial<EndpointInfo> = {}): EndpointInfo {
  return {
    name: 'getUser',
    protocol: 'rest',
    httpMethod: 'GET',
    path: '/users',
    handler: 'UserController.getUser',
    handlerClass: 'UserController',
    returnType: 'User',
    parameters: [],
    filePath: 'user.controller.ts',
    ...overrides,
  } as EndpointInfo;
}

function createEntity(overrides: Partial<EntityInfo> = {}): EntityInfo {
  return {
    name: 'User',
    tableName: 'users',
    dbType: 'postgres',
    columns: [],
    relations: [],
    indexes: [],
    filePath: 'user.entity.ts',
    ...overrides,
  };
}

function createService(overrides: Partial<ServiceInfo> = {}): ServiceInfo {
  return {
    name: 'UserService',
    methods: ['getUser', 'createUser'],
    dependencies: ['UserRepository'],
    filePath: 'user.service.ts',
    ...overrides,
  };
}

describe('compareAnalysisResults', () => {
  it('returns empty array when both results are identical', () => {
    const endpoint = createEndpoint();
    const prev = createAnalysisResult({ endpoints: [endpoint] });
    const curr = createAnalysisResult({ endpoints: [endpoint] });

    const changes = compareAnalysisResults(prev, curr);
    expect(changes).toHaveLength(0);
  });

  it('detects added endpoints', () => {
    const prev = createAnalysisResult({ endpoints: [] });
    const curr = createAnalysisResult({ endpoints: [createEndpoint()] });

    const changes = compareAnalysisResults(prev, curr);
    expect(changes).toHaveLength(1);
    expect(changes[0].type).toBe('added');
    expect(changes[0].category).toBe('endpoint');
    expect(changes[0].name).toBe('getUser');
  });

  it('detects removed endpoints', () => {
    const prev = createAnalysisResult({ endpoints: [createEndpoint()] });
    const curr = createAnalysisResult({ endpoints: [] });

    const changes = compareAnalysisResults(prev, curr);
    expect(changes).toHaveLength(1);
    expect(changes[0].type).toBe('removed');
    expect(changes[0].category).toBe('endpoint');
  });

  it('detects modified endpoints - return type change', () => {
    const prev = createAnalysisResult({ endpoints: [createEndpoint({ returnType: 'User' })] });
    const curr = createAnalysisResult({ endpoints: [createEndpoint({ returnType: 'UserDto' })] });

    const changes = compareAnalysisResults(prev, curr);
    expect(changes).toHaveLength(1);
    expect(changes[0].type).toBe('modified');
    expect(changes[0].detail).toContain('return type');
  });

  it('detects modified endpoints - parameter count change', () => {
    const prev = createAnalysisResult({ endpoints: [createEndpoint({ parameters: [] })] });
    const curr = createAnalysisResult({
      endpoints: [createEndpoint({
        parameters: [{ name: 'id', type: 'number', required: true, location: 'path' }],
      })],
    });

    const changes = compareAnalysisResults(prev, curr);
    expect(changes).toHaveLength(1);
    expect(changes[0].type).toBe('modified');
  });

  it('detects added entities', () => {
    const prev = createAnalysisResult({ entities: [] });
    const curr = createAnalysisResult({ entities: [createEntity()] });

    const changes = compareAnalysisResults(prev, curr);
    expect(changes).toHaveLength(1);
    expect(changes[0].type).toBe('added');
    expect(changes[0].category).toBe('entity');
  });

  it('detects removed entities', () => {
    const prev = createAnalysisResult({ entities: [createEntity()] });
    const curr = createAnalysisResult({ entities: [] });

    const changes = compareAnalysisResults(prev, curr);
    expect(changes).toHaveLength(1);
    expect(changes[0].type).toBe('removed');
    expect(changes[0].category).toBe('entity');
  });

  it('detects modified entities - column count change', () => {
    const prev = createAnalysisResult({ entities: [createEntity({ columns: [] })] });
    const curr = createAnalysisResult({
      entities: [createEntity({
        columns: [{ name: 'id', type: 'number', dbColumnName: 'id', nullable: false, primaryKey: true, unique: false }],
      })],
    });

    const changes = compareAnalysisResults(prev, curr);
    expect(changes).toHaveLength(1);
    expect(changes[0].type).toBe('modified');
    expect(changes[0].category).toBe('entity');
  });

  it('detects added services', () => {
    const prev = createAnalysisResult({ services: [] });
    const curr = createAnalysisResult({ services: [createService()] });

    const changes = compareAnalysisResults(prev, curr);
    expect(changes).toHaveLength(1);
    expect(changes[0].type).toBe('added');
    expect(changes[0].category).toBe('service');
  });

  it('detects modified services - method change', () => {
    const prev = createAnalysisResult({ services: [createService({ methods: ['getUser'] })] });
    const curr = createAnalysisResult({ services: [createService({ methods: ['getUser', 'deleteUser'] })] });

    const changes = compareAnalysisResults(prev, curr);
    expect(changes).toHaveLength(1);
    expect(changes[0].type).toBe('modified');
    expect(changes[0].detail).toContain('methods');
  });

  it('handles empty analysis results', () => {
    const prev = createAnalysisResult();
    const curr = createAnalysisResult();

    const changes = compareAnalysisResults(prev, curr);
    expect(changes).toHaveLength(0);
  });

  it('detects multiple types of changes simultaneously', () => {
    const prev = createAnalysisResult({
      endpoints: [createEndpoint({ name: 'oldEp', path: '/old' })],
      entities: [createEntity()],
    });
    const curr = createAnalysisResult({
      endpoints: [createEndpoint({ name: 'newEp', path: '/new' })],
      entities: [],
    });

    const changes = compareAnalysisResults(prev, curr);
    expect(changes.length).toBeGreaterThanOrEqual(3); // removed oldEp, added newEp, removed entity
  });
});
