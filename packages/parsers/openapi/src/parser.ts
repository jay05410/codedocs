import YAML from 'yaml';
import type { ParserPlugin, SourceFile, ParseResult, EndpointInfo, EntityInfo, TypeInfo } from '@codedocs/core';

export interface OpenApiParserOptions {
  /** Parse schema definitions as entities */
  parseSchemas?: boolean;
  /** Include deprecated endpoints */
  includeDeprecated?: boolean;
}

export function openApiParser(options: OpenApiParserOptions = {}): ParserPlugin {
  const { parseSchemas = true, includeDeprecated = true } = options;

  return {
    name: 'openapi',
    filePattern: [
      '**/openapi.json', '**/openapi.yaml', '**/openapi.yml',
      '**/swagger.json', '**/swagger.yaml', '**/swagger.yml',
      '**/*.openapi.json', '**/*.openapi.yaml', '**/*.openapi.yml',
    ],

    async parse(files: SourceFile[]): Promise<ParseResult> {
      const endpoints: EndpointInfo[] = [];
      const entities: EntityInfo[] = [];
      const types: TypeInfo[] = [];

      for (const file of files) {
        const spec = parseSpec(file);
        if (!spec) continue;

        const version = detectVersion(spec);

        // Parse paths -> endpoints
        const paths = spec.paths || {};
        for (const [path, pathItem] of Object.entries(paths)) {
          if (!pathItem || typeof pathItem !== 'object') continue;

          const httpMethods = ['get', 'post', 'put', 'delete', 'patch', 'options', 'head'] as const;

          for (const method of httpMethods) {
            const operation = (pathItem as Record<string, unknown>)[method] as OperationObject | undefined;
            if (!operation) continue;
            if (!includeDeprecated && operation.deprecated) continue;

            const endpoint = parseOperation(path, method.toUpperCase(), operation, spec, version, file.path);
            endpoints.push(endpoint);
          }
        }

        // Parse schemas -> types/entities
        if (parseSchemas) {
          const schemas = version === 3
            ? (spec.components?.schemas || {})
            : (spec.definitions || {});

          for (const [name, schema] of Object.entries(schemas as Record<string, SchemaObject>)) {
            if (!schema || typeof schema !== 'object') continue;

            if (isEntitySchema(schema)) {
              const entity = schemaToEntity(name, schema, file.path);
              if (entity) entities.push(entity);
            } else {
              const type = schemaToType(name, schema, file.path);
              if (type) types.push(type);
            }
          }
        }
      }

      return { endpoints, entities, types };
    },
  };
}

// ── Types for OpenAPI spec ──

interface OperationObject {
  operationId?: string;
  summary?: string;
  description?: string;
  tags?: string[];
  deprecated?: boolean;
  parameters?: ParameterObject[];
  requestBody?: RequestBodyObject;
  responses?: Record<string, ResponseObject>;
  security?: Record<string, string[]>[];
}

interface ParameterObject {
  name: string;
  in: 'path' | 'query' | 'header' | 'cookie';
  required?: boolean;
  description?: string;
  schema?: SchemaObject;
}

interface RequestBodyObject {
  description?: string;
  required?: boolean;
  content?: Record<string, { schema?: SchemaObject }>;
}

interface ResponseObject {
  description?: string;
  content?: Record<string, { schema?: SchemaObject }>;
}

interface SchemaObject {
  type?: string;
  format?: string;
  properties?: Record<string, SchemaObject>;
  required?: string[];
  items?: SchemaObject;
  enum?: (string | number)[];
  allOf?: SchemaObject[];
  oneOf?: SchemaObject[];
  anyOf?: SchemaObject[];
  $ref?: string;
  description?: string;
  nullable?: boolean;
  'x-entity'?: boolean;
  'x-table-name'?: string;
  'x-db-type'?: string;
}

// ── Spec Parsing ──

function parseSpec(file: SourceFile): Record<string, any> | null {
  try {
    if (file.path.endsWith('.json')) {
      return JSON.parse(file.content);
    }
    return YAML.parse(file.content);
  } catch {
    return null;
  }
}

function detectVersion(spec: Record<string, any>): 2 | 3 {
  if (spec.openapi && spec.openapi.startsWith('3')) return 3;
  return 2;
}

// ── Operation -> Endpoint ──

function parseOperation(
  path: string,
  method: string,
  operation: OperationObject,
  spec: Record<string, any>,
  version: 2 | 3,
  filePath: string,
): EndpointInfo {
  const params: EndpointInfo['parameters'] = [];

  // Path/query/header parameters
  if (operation.parameters) {
    for (const param of operation.parameters) {
      const resolved = resolveRef(param, spec) as ParameterObject;
      params.push({
        name: resolved.name,
        type: schemaTypeToString(resolved.schema),
        required: resolved.required ?? (resolved.in === 'path'),
        description: resolved.description,
        location: resolved.in as 'path' | 'query' | 'header' | 'cookie',
      });
    }
  }

  // Request body (OpenAPI 3.x)
  if (version === 3 && operation.requestBody) {
    const body = resolveRef(operation.requestBody, spec) as RequestBodyObject;
    const contentType = Object.keys(body.content || {})[0];
    const schema = body.content?.[contentType]?.schema;

    if (schema) {
      const resolvedSchema = resolveRef(schema, spec) as SchemaObject;
      if (resolvedSchema.properties) {
        for (const [propName, propSchema] of Object.entries(resolvedSchema.properties)) {
          const resolved = resolveRef(propSchema, spec) as SchemaObject;
          params.push({
            name: propName,
            type: schemaTypeToString(resolved),
            required: resolvedSchema.required?.includes(propName) ?? false,
            description: resolved.description,
            location: 'body',
          });
        }
      } else {
        params.push({
          name: 'body',
          type: schemaTypeToString(resolvedSchema),
          required: body.required ?? false,
          description: body.description,
          location: 'body',
        });
      }
    }
  }

  // Swagger 2.x body parameter
  if (version === 2 && operation.parameters) {
    const bodyParam = operation.parameters.find((p) => ((resolveRef(p, spec) as ParameterObject).in as string) === 'body');
    if (bodyParam) {
      const resolved = resolveRef(bodyParam, spec) as ParameterObject & { schema?: SchemaObject };
      if (resolved.schema) {
        params.push({
          name: resolved.name || 'body',
          type: schemaTypeToString(resolveRef(resolved.schema, spec) as SchemaObject),
          required: resolved.required ?? false,
          description: resolved.description,
          location: 'body',
        });
      }
    }
  }

  // Return type from 200/201 response
  const successResponse = operation.responses?.['200'] || operation.responses?.['201'];
  let returnType = 'void';
  if (successResponse) {
    const resolved = resolveRef(successResponse, spec) as ResponseObject;
    const contentType = Object.keys(resolved.content || {})[0];
    const schema = resolved.content?.[contentType]?.schema;
    if (schema) {
      returnType = schemaTypeToString(resolveRef(schema, spec) as SchemaObject);
    }
  }

  // Auth detection
  const auth = (operation.security && operation.security.length > 0) || false;

  return {
    protocol: 'rest',
    httpMethod: method,
    path,
    name: operation.operationId || `${method} ${path}`,
    handler: operation.operationId || path.replace(/[{}\/]/g, '_').replace(/^_|_$/g, ''),
    handlerClass: operation.tags?.[0] || 'default',
    parameters: params,
    returnType,
    filePath,
    description: operation.summary || operation.description,
    tags: operation.tags,
    auth,
    deprecated: operation.deprecated,
  };
}

// ── Schema -> Entity/Type ──

function isEntitySchema(schema: SchemaObject): boolean {
  // Heuristic: if schema has x-entity marker, or has an 'id' property
  if (schema['x-entity']) return true;
  if (schema.properties?.['id'] || schema.properties?.['_id']) return true;
  return false;
}

function schemaToEntity(name: string, schema: SchemaObject, filePath: string): EntityInfo | null {
  const resolved = resolveAllOf(schema);
  if (!resolved.properties) return null;

  const requiredFields = new Set(resolved.required || []);
  const columns: EntityInfo['columns'] = [];

  for (const [propName, propSchema] of Object.entries(resolved.properties)) {
    const isId = propName === 'id' || propName === '_id';

    columns.push({
      name: propName,
      type: schemaTypeToString(propSchema),
      dbColumnName: propName,
      nullable: !requiredFields.has(propName) && !isId,
      primaryKey: isId,
      unique: isId,
      description: propSchema.description,
    });
  }

  return {
    name,
    tableName: schema['x-table-name'] || camelToSnake(name),
    dbType: schema['x-db-type'] || 'unknown',
    columns,
    relations: [],
    indexes: [],
    filePath,
    description: schema.description,
  };
}

function schemaToType(name: string, schema: SchemaObject, filePath: string): TypeInfo | null {
  // Enum
  if (schema.enum) {
    const fields = schema.enum.map((v) => ({
      name: String(v),
      type: schema.type || 'string',
      required: true,
    }));
    return { name, kind: 'enum', fields, filePath, description: schema.description };
  }

  // Object with properties
  const resolved = resolveAllOf(schema);
  if (!resolved.properties) return null;

  const requiredFields = new Set(resolved.required || []);
  const fields: TypeInfo['fields'] = [];

  for (const [propName, propSchema] of Object.entries(resolved.properties)) {
    fields.push({
      name: propName,
      type: schemaTypeToString(propSchema),
      required: requiredFields.has(propName),
      description: propSchema.description,
    });
  }

  const kind = inferTypeKind(name);
  return { name, kind, fields, filePath, description: schema.description };
}

// ── Helpers ──

function resolveRef(obj: any, spec: Record<string, any>): any {
  if (!obj || typeof obj !== 'object') return obj;
  if (!obj.$ref) return obj;

  const refPath = obj.$ref.replace(/^#\//, '').split('/');
  let resolved: any = spec;
  for (const segment of refPath) {
    resolved = resolved?.[segment];
  }
  return resolved || obj;
}

function resolveAllOf(schema: SchemaObject): SchemaObject {
  if (!schema.allOf) return schema;

  const merged: SchemaObject = { type: 'object', properties: {}, required: [] };

  for (const sub of schema.allOf) {
    if (sub.properties) {
      Object.assign(merged.properties!, sub.properties);
    }
    if (sub.required) {
      merged.required!.push(...sub.required);
    }
  }

  // Also merge top-level properties
  if (schema.properties) {
    Object.assign(merged.properties!, schema.properties);
  }
  if (schema.required) {
    merged.required!.push(...schema.required);
  }

  return merged;
}

function schemaTypeToString(schema?: SchemaObject): string {
  if (!schema) return 'unknown';

  if (schema.$ref) {
    const refName = schema.$ref.split('/').pop();
    return refName || 'unknown';
  }

  if (schema.allOf) {
    const names = schema.allOf
      .map((s) => (s.$ref ? s.$ref.split('/').pop() : schemaTypeToString(s)))
      .filter(Boolean);
    return names.join(' & ') || 'object';
  }

  if (schema.oneOf || schema.anyOf) {
    const variants = (schema.oneOf || schema.anyOf)!;
    const names = variants
      .map((s) => (s.$ref ? s.$ref.split('/').pop() : schemaTypeToString(s)))
      .filter(Boolean);
    return names.join(' | ') || 'unknown';
  }

  if (schema.enum) {
    return schema.enum.map((v) => (typeof v === 'string' ? `"${v}"` : String(v))).join(' | ');
  }

  switch (schema.type) {
    case 'string':
      if (schema.format === 'date-time') return 'DateTime';
      if (schema.format === 'date') return 'Date';
      if (schema.format === 'binary') return 'Binary';
      if (schema.format === 'uuid') return 'UUID';
      return 'string';
    case 'integer':
      return schema.format === 'int64' ? 'int64' : 'int';
    case 'number':
      return schema.format === 'double' ? 'double' : 'float';
    case 'boolean':
      return 'boolean';
    case 'array':
      return `${schemaTypeToString(schema.items)}[]`;
    case 'object':
      return 'object';
    default:
      return schema.type || 'unknown';
  }
}

function inferTypeKind(name: string): TypeInfo['kind'] {
  const lower = name.toLowerCase();
  if (lower.includes('input') || lower.includes('request') || lower.includes('create') || lower.includes('update')) return 'input';
  if (lower.includes('response') || lower.includes('result') || lower.includes('output') || lower.includes('list')) return 'response';
  return 'dto';
}

function camelToSnake(str: string): string {
  return str
    .replace(/([A-Z])/g, '_$1')
    .toLowerCase()
    .replace(/^_/, '');
}
