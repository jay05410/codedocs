import { describe, it, expect } from 'vitest';
import { openApiParser } from '../parser.js';
import type { SourceFile } from '@codedocs/core';

function createFile(path: string, content: string): SourceFile {
  return { path, content, language: 'json' };
}

describe('openapi parser', () => {
  const parser = openApiParser();

  it('has correct name', () => {
    expect(parser.name).toBe('openapi');
  });

  it('has correct file pattern', () => {
    expect(parser.filePattern).toContain('**/openapi.json');
    expect(parser.filePattern).toContain('**/swagger.yaml');
  });

  it('parses OpenAPI 3.0 endpoints', async () => {
    const spec = JSON.stringify({
      openapi: '3.0.0',
      info: { title: 'Test API', version: '1.0.0' },
      paths: {
        '/pets': {
          get: {
            operationId: 'listPets',
            summary: 'List all pets',
            tags: ['pets'],
            parameters: [
              { name: 'limit', in: 'query', schema: { type: 'integer' }, required: false }
            ],
            responses: {
              '200': {
                description: 'OK',
                content: {
                  'application/json': {
                    schema: { type: 'array', items: { $ref: '#/components/schemas/Pet' } }
                  }
                }
              }
            }
          },
          post: {
            operationId: 'createPet',
            summary: 'Create a pet',
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Pet' }
                }
              }
            },
            responses: {
              '201': { description: 'Created' }
            }
          }
        },
        '/pets/{petId}': {
          get: {
            operationId: 'getPet',
            parameters: [
              { name: 'petId', in: 'path', required: true, schema: { type: 'string' } }
            ],
            responses: {
              '200': { description: 'OK' }
            }
          }
        }
      },
      components: {
        schemas: {
          Pet: {
            type: 'object',
            required: ['id', 'name'],
            properties: {
              id: { type: 'integer' },
              name: { type: 'string' },
              tag: { type: 'string' }
            }
          }
        }
      }
    });

    const files = [createFile('openapi.json', spec)];
    const result = await parser.parse(files);

    expect(result.endpoints).toBeDefined();
    expect(result.endpoints!.length).toBe(3);

    const getEndpoint = result.endpoints![0];
    expect(getEndpoint.httpMethod).toBe('GET');
    expect(getEndpoint.path).toBe('/pets');
    expect(getEndpoint.handler).toBe('listPets');
    expect(getEndpoint.description).toBe('List all pets');
    expect(getEndpoint.tags).toContain('pets');
    expect(getEndpoint.parameters!.length).toBe(1);
    expect(getEndpoint.parameters![0].name).toBe('limit');
    expect(getEndpoint.parameters![0].location).toBe('query');
    expect(getEndpoint.parameters![0].required).toBe(false);

    const postEndpoint = result.endpoints![1];
    expect(postEndpoint.httpMethod).toBe('POST');
    expect(postEndpoint.handler).toBe('createPet');

    const getByIdEndpoint = result.endpoints![2];
    expect(getByIdEndpoint.path).toBe('/pets/{petId}');
    expect(getByIdEndpoint.parameters![0].location).toBe('path');
    expect(getByIdEndpoint.parameters![0].required).toBe(true);
  });

  it('parses OpenAPI schemas as types', async () => {
    const spec = JSON.stringify({
      openapi: '3.0.0',
      info: { title: 'Test API', version: '1.0.0' },
      paths: {},
      components: {
        schemas: {
          Pet: {
            type: 'object',
            required: ['id', 'name'],
            properties: {
              id: { type: 'integer', format: 'int64' },
              name: { type: 'string' },
              status: { type: 'string', enum: ['available', 'pending', 'sold'] }
            }
          },
          Status: {
            type: 'string',
            enum: ['available', 'pending', 'sold']
          }
        }
      }
    });

    const files = [createFile('openapi.json', spec)];
    const result = await parser.parse(files);

    expect(result.types).toBeDefined();
    expect(result.types!.length).toBeGreaterThan(0);

    const statusEnum = result.types!.find(t => t.name === 'Status');
    expect(statusEnum?.kind).toBe('enum');
    expect(statusEnum?.fields.length).toBe(3);
  });

  it('parses schemas with x-entity directive as entities', async () => {
    const spec = JSON.stringify({
      openapi: '3.0.0',
      info: { title: 'Test API', version: '1.0.0' },
      paths: {},
      components: {
        schemas: {
          User: {
            type: 'object',
            'x-entity': true,
            'x-table-name': 'users',
            properties: {
              id: { type: 'integer' },
              name: { type: 'string' },
              email: { type: 'string' }
            },
            required: ['id', 'name']
          }
        }
      }
    });

    const files = [createFile('openapi.json', spec)];
    const result = await parser.parse(files);

    expect(result.entities).toBeDefined();
    expect(result.entities!.length).toBe(1);

    const entity = result.entities![0];
    expect(entity.name).toBe('User');
    expect(entity.tableName).toBe('users');
    expect(entity.columns.length).toBe(3);
    expect(entity.columns[0].name).toBe('id');
    expect(entity.columns[0].primaryKey).toBe(true);
  });
});
