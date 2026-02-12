import type { ParserPlugin, SourceFile, ParseResult, EndpointInfo, EntityInfo, TypeInfo, DependencyInfo, ParameterInfo, ColumnInfo } from '@codedocs/core';

export interface GraphqlParserOptions {
  /** Parse directives as metadata */
  parseDirectives?: boolean;
  /** Include deprecated fields */
  includeDeprecated?: boolean;
}

export function graphqlParser(options: GraphqlParserOptions = {}): ParserPlugin {
  const { parseDirectives = true, includeDeprecated = true } = options;

  return {
    name: 'graphql',
    filePattern: ['**/*.graphql', '**/*.gql', '**/*.graphqls'],

    async parse(files: SourceFile[]): Promise<ParseResult> {
      const endpoints: EndpointInfo[] = [];
      const entities: EntityInfo[] = [];
      const types: TypeInfo[] = [];
      const dependencies: DependencyInfo[] = [];

      for (const file of files) {
        const content = stripComments(file.content);

        // Query / Mutation / Subscription
        endpoints.push(...parseOperationTypes(content, file.path));

        // type definitions
        types.push(...parseObjectTypes(content, file.path, parseDirectives));

        // input types
        types.push(...parseInputTypes(content, file.path));

        // enum types
        types.push(...parseEnumTypes(content, file.path));

        // interface types
        types.push(...parseInterfaceTypes(content, file.path));

        // union types
        types.push(...parseUnionTypes(content, file.path));

        // scalar types
        types.push(...parseScalarTypes(content, file.path));

        // schema-level entities (types with @entity or @model directive)
        if (parseDirectives) {
          entities.push(...parseEntityDirectives(content, file.path));
        }

        // Collect dependencies from field types
        dependencies.push(...extractTypeDependencies(content, file.path));
      }

      // Deduplicate endpoints from extend type Query/Mutation
      const deduped = deduplicateEndpoints(endpoints);

      return { endpoints: deduped, entities, types: deduplicateTypes(types), dependencies };
    },
  };
}

// ── Comment Stripping ──

function stripComments(content: string): string {
  // Remove single-line comments but preserve string descriptions
  return content
    .replace(/#[^\n]*/g, '')
    .replace(/"""[\s\S]*?"""/g, (match) => match); // keep doc strings
}

// ── Operation Type Parsing (Query, Mutation, Subscription) ──

function parseOperationTypes(content: string, filePath: string): EndpointInfo[] {
  const endpoints: EndpointInfo[] = [];
  const opTypes: Array<'Query' | 'Mutation' | 'Subscription'> = ['Query', 'Mutation', 'Subscription'];

  for (const opType of opTypes) {
    // Match both `type Query { ... }` and `extend type Query { ... }`
    const re = new RegExp(`(?:extend\\s+)?type\\s+${opType}\\s*\\{([\\s\\S]*?)\\}`, 'g');
    let match: RegExpExecArray | null;

    while ((match = re.exec(content)) !== null) {
      const body = match[1];
      endpoints.push(...parseOperationFields(body, opType, filePath));
    }
  }

  return endpoints;
}

function parseOperationFields(body: string, opType: 'Query' | 'Mutation' | 'Subscription', filePath: string): EndpointInfo[] {
  const endpoints: EndpointInfo[] = [];
  const lines = body.split('\n');
  let description: string | undefined;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Collect description strings
    if (line.startsWith('"""')) {
      const descLines: string[] = [];
      if (line.endsWith('"""') && line.length > 6) {
        description = line.slice(3, -3).trim();
        continue;
      }
      for (let j = i + 1; j < lines.length; j++) {
        const descLine = lines[j].trim();
        if (descLine.endsWith('"""')) {
          descLines.push(descLine.slice(0, -3));
          i = j;
          break;
        }
        descLines.push(descLine);
      }
      description = descLines.join(' ').trim();
      continue;
    }

    // Single-line description
    if (line.startsWith('"') && line.endsWith('"')) {
      description = line.slice(1, -1);
      continue;
    }

    // Parse field: fieldName(args): ReturnType
    const fieldMatch = line.match(/^(\w+)\s*(?:\(([^)]*)\))?\s*:\s*(.+?)(?:\s+@.*)?$/);
    if (!fieldMatch) continue;

    const [, fieldName, argsStr, returnType] = fieldMatch;
    const parameters = argsStr ? parseArguments(argsStr) : [];
    const isDeprecated = /@deprecated/.test(line);
    const auth = /@auth|@authenticated|@requireAuth/.test(line);

    endpoints.push({
      protocol: 'graphql',
      operationType: opType,
      fieldName,
      name: fieldName,
      handler: fieldName,
      handlerClass: opType,
      parameters,
      returnType: cleanType(returnType),
      filePath,
      description,
      tags: [opType.toLowerCase()],
      auth,
      deprecated: isDeprecated,
    });

    description = undefined;
  }

  return endpoints;
}

function parseArguments(argsStr: string): ParameterInfo[] {
  const params: ParameterInfo[] = [];
  // Handle multi-line arguments
  const normalized = argsStr.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
  const argRe = /(\w+)\s*:\s*([\w!\[\]]+)(?:\s*=\s*([^,)]+))?/g;
  let match: RegExpExecArray | null;

  while ((match = argRe.exec(normalized)) !== null) {
    const [, name, type, defaultValue] = match;
    const required = type.endsWith('!');

    params.push({
      name,
      type: cleanType(type),
      required,
      defaultValue: defaultValue?.trim(),
      location: 'body',
    });
  }

  return params;
}

// ── Object Type Parsing ──

function parseObjectTypes(content: string, filePath: string, parseDirectives: boolean): TypeInfo[] {
  const types: TypeInfo[] = [];
  const opNames = new Set(['Query', 'Mutation', 'Subscription']);

  // Match: type TypeName (implements Interface)? @directives? { ... }
  const typeRe = /(?:extend\s+)?type\s+(\w+)(?:\s+implements\s+[\w\s&]+)?(?:\s+@[\w()\s",:=]+)*\s*\{([\s\S]*?)\}/g;
  let match: RegExpExecArray | null;

  while ((match = typeRe.exec(content)) !== null) {
    const [fullMatch, typeName] = match;
    const body = match[2];
    if (opNames.has(typeName)) continue;

    const fields = parseTypeFields(body);
    const description = extractTypeDescription(content, match.index);

    types.push({
      name: typeName,
      kind: 'type',
      fields,
      filePath,
      description,
    });
  }

  return types;
}

// ── Input Type Parsing ──

function parseInputTypes(content: string, filePath: string): TypeInfo[] {
  const types: TypeInfo[] = [];
  const inputRe = /input\s+(\w+)(?:\s+@[\w()\s",:=]+)*\s*\{([\s\S]*?)\}/g;
  let match: RegExpExecArray | null;

  while ((match = inputRe.exec(content)) !== null) {
    const [, typeName, body] = match;
    const fields = parseTypeFields(body);
    const description = extractTypeDescription(content, match.index);

    types.push({
      name: typeName,
      kind: 'input',
      fields,
      filePath,
      description,
    });
  }

  return types;
}

// ── Enum Type Parsing ──

function parseEnumTypes(content: string, filePath: string): TypeInfo[] {
  const types: TypeInfo[] = [];
  const enumRe = /enum\s+(\w+)(?:\s+@[\w()\s",:=]+)*\s*\{([\s\S]*?)\}/g;
  let match: RegExpExecArray | null;

  while ((match = enumRe.exec(content)) !== null) {
    const [, typeName, body] = match;
    const description = extractTypeDescription(content, match.index);

    const fields: { name: string; type: string; required: boolean; description?: string }[] = [];
    const lines = body.split('\n');
    let valueDesc: string | undefined;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
        valueDesc = trimmed.slice(1, -1);
        continue;
      }

      const valueMatch = trimmed.match(/^(\w+)/);
      if (valueMatch) {
        fields.push({
          name: valueMatch[1],
          type: typeName,
          required: true,
          description: valueDesc,
        });
        valueDesc = undefined;
      }
    }

    types.push({
      name: typeName,
      kind: 'enum',
      fields,
      filePath,
      description,
    });
  }

  return types;
}

// ── Interface Type Parsing ──

function parseInterfaceTypes(content: string, filePath: string): TypeInfo[] {
  const types: TypeInfo[] = [];
  const ifaceRe = /interface\s+(\w+)(?:\s+@[\w()\s",:=]+)*\s*\{([\s\S]*?)\}/g;
  let match: RegExpExecArray | null;

  while ((match = ifaceRe.exec(content)) !== null) {
    const [, typeName, body] = match;
    const fields = parseTypeFields(body);
    const description = extractTypeDescription(content, match.index);

    types.push({
      name: typeName,
      kind: 'interface',
      fields,
      filePath,
      description,
    });
  }

  return types;
}

// ── Union Type Parsing ──

function parseUnionTypes(content: string, filePath: string): TypeInfo[] {
  const types: TypeInfo[] = [];
  const unionRe = /union\s+(\w+)\s*=\s*([\w\s|]+)/g;
  let match: RegExpExecArray | null;

  while ((match = unionRe.exec(content)) !== null) {
    const [, typeName, members] = match;
    const memberList = members.split('|').map((m) => m.trim()).filter(Boolean);
    const description = extractTypeDescription(content, match.index);

    types.push({
      name: typeName,
      kind: 'type',
      fields: memberList.map((m) => ({ name: m, type: typeName, required: true })),
      filePath,
      description,
    });
  }

  return types;
}

// ── Scalar Type Parsing ──

function parseScalarTypes(content: string, filePath: string): TypeInfo[] {
  const types: TypeInfo[] = [];
  const scalarRe = /scalar\s+(\w+)/g;
  let match: RegExpExecArray | null;

  while ((match = scalarRe.exec(content)) !== null) {
    const description = extractTypeDescription(content, match.index);

    types.push({
      name: match[1],
      kind: 'type',
      fields: [],
      filePath,
      description,
    });
  }

  return types;
}

// ── Entity Directive Parsing ──

function parseEntityDirectives(content: string, filePath: string): EntityInfo[] {
  const entities: EntityInfo[] = [];

  // Match types with @entity or @model directive
  const entityRe = /type\s+(\w+)(?:\s+implements\s+[\w\s&]+)?\s+@(?:entity|model)(?:\(([^)]*)\))?\s*\{([\s\S]*?)\}/g;
  let match: RegExpExecArray | null;

  while ((match = entityRe.exec(content)) !== null) {
    const [, typeName, directiveArgs, body] = match;
    const tableName = extractDirectiveArg(directiveArgs, 'tableName') || toSnakeCase(typeName) + 's';

    const columns: ColumnInfo[] = [];
    const fieldLines = body.split('\n');

    for (const line of fieldLines) {
      const trimmed = line.trim();
      const fieldMatch = trimmed.match(/^(\w+)\s*:\s*([\w!\[\]]+)(?:\s+@(.+))?$/);
      if (!fieldMatch) continue;

      const [, fieldName, fieldType, directives] = fieldMatch;
      const isPk = directives?.includes('@id') || fieldName === 'id';
      const isUnique = directives?.includes('@unique') || false;
      const nullable = !fieldType.endsWith('!');

      columns.push({
        name: fieldName,
        type: cleanType(fieldType),
        dbColumnName: toSnakeCase(fieldName),
        nullable,
        primaryKey: isPk,
        unique: isUnique,
      });
    }

    if (columns.length > 0) {
      entities.push({
        name: typeName,
        tableName,
        dbType: 'graphql',
        columns,
        relations: [],
        indexes: [],
        filePath,
      });
    }
  }

  return entities;
}

// ── Type Field Parsing ──

function parseTypeFields(body: string): { name: string; type: string; required: boolean; description?: string }[] {
  const fields: { name: string; type: string; required: boolean; description?: string }[] = [];
  const lines = body.split('\n');
  let description: string | undefined;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Doc strings
    if (trimmed.startsWith('"""')) {
      // Inline doc string
      if (trimmed.endsWith('"""') && trimmed.length > 6) {
        description = trimmed.slice(3, -3).trim();
      }
      continue;
    }
    if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
      description = trimmed.slice(1, -1);
      continue;
    }

    // Field: name(args?): Type @directives?
    const fieldMatch = trimmed.match(/^(\w+)(?:\s*\([^)]*\))?\s*:\s*([\w!\[\]]+)/);
    if (!fieldMatch) continue;

    const [, fieldName, fieldType] = fieldMatch;
    const required = fieldType.endsWith('!');

    fields.push({
      name: fieldName,
      type: cleanType(fieldType),
      required,
      description,
    });

    description = undefined;
  }

  return fields;
}

// ── Dependency Extraction ──

function extractTypeDependencies(content: string, filePath: string): DependencyInfo[] {
  const deps: DependencyInfo[] = [];
  const seen = new Set<string>();

  // Find type references in fields
  const typeRe = /(?:extend\s+)?(?:type|input|interface)\s+(\w+)[\s\S]*?\{([\s\S]*?)\}/g;
  let match: RegExpExecArray | null;

  while ((match = typeRe.exec(content)) !== null) {
    const [, sourceName, body] = match;
    const fieldTypeRe = /:\s*\[?(\w+)/g;
    let fieldMatch: RegExpExecArray | null;

    while ((fieldMatch = fieldTypeRe.exec(body)) !== null) {
      const targetType = fieldMatch[1];
      // Skip scalar types
      if (isBuiltinScalar(targetType)) continue;
      const key = `${sourceName}->${targetType}`;
      if (seen.has(key)) continue;
      seen.add(key);

      deps.push({
        source: sourceName,
        target: targetType,
        type: 'use',
      });
    }
  }

  // implements dependencies
  const implRe = /type\s+(\w+)\s+implements\s+([\w\s&]+)/g;
  let implMatch: RegExpExecArray | null;

  while ((implMatch = implRe.exec(content)) !== null) {
    const [, typeName, interfaces] = implMatch;
    const ifaceList = interfaces.split('&').map((i) => i.trim()).filter(Boolean);
    for (const iface of ifaceList) {
      deps.push({ source: typeName, target: iface, type: 'implement' });
    }
  }

  return deps;
}

// ── Helpers ──

function cleanType(type: string): string {
  return type.replace(/[!\[\]]/g, '').trim();
}

function isBuiltinScalar(type: string): boolean {
  return ['String', 'Int', 'Float', 'Boolean', 'ID'].includes(type);
}

function toSnakeCase(str: string): string {
  return str.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');
}

function extractTypeDescription(content: string, typeIndex: number): string | undefined {
  const before = content.substring(0, typeIndex).trimEnd();
  const lines = before.split('\n');
  const lastLine = lines[lines.length - 1]?.trim();

  // Check for triple-quote description block
  if (lastLine === '"""') {
    const descLines: string[] = [];
    for (let i = lines.length - 2; i >= 0; i--) {
      const line = lines[i].trim();
      if (line === '"""') break;
      descLines.unshift(line);
    }
    return descLines.join(' ').trim() || undefined;
  }

  // Single-line description
  if (lastLine?.startsWith('"') && lastLine.endsWith('"')) {
    return lastLine.slice(1, -1);
  }

  return undefined;
}

function extractDirectiveArg(argsStr: string | undefined, key: string): string | undefined {
  if (!argsStr) return undefined;
  const match = argsStr.match(new RegExp(`${key}\\s*:\\s*"([^"]*)"`));
  return match ? match[1] : undefined;
}

function deduplicateEndpoints(endpoints: EndpointInfo[]): EndpointInfo[] {
  const seen = new Map<string, EndpointInfo>();
  for (const ep of endpoints) {
    const key = `${ep.operationType}:${ep.fieldName}`;
    if (!seen.has(key)) {
      seen.set(key, ep);
    }
  }
  return Array.from(seen.values());
}

function deduplicateTypes(types: TypeInfo[]): TypeInfo[] {
  const seen = new Map<string, TypeInfo>();
  for (const t of types) {
    const existing = seen.get(t.name);
    if (!existing) {
      seen.set(t.name, t);
    } else {
      // Merge fields from extend types
      const existingNames = new Set(existing.fields.map((f) => f.name));
      for (const field of t.fields) {
        if (!existingNames.has(field.name)) {
          existing.fields.push(field);
        }
      }
    }
  }
  return Array.from(seen.values());
}
