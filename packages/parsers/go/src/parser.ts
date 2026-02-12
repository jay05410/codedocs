import type { ParserPlugin, SourceFile, ParseResult, EndpointInfo, EntityInfo, ServiceInfo, TypeInfo, DependencyInfo, ParameterInfo, ColumnInfo, RelationInfo } from '@codedocs/core';

export interface GoParserOptions {
  /** Auto-detect frameworks (Gin, Echo, Fiber, Chi, GORM, etc.) */
  detectFrameworks?: boolean;
}

export function goParser(options: GoParserOptions = {}): ParserPlugin {
  const { detectFrameworks = true } = options;

  return {
    name: 'go',
    filePattern: ['**/*.go'],

    async parse(files: SourceFile[]): Promise<ParseResult> {
      const endpoints: EndpointInfo[] = [];
      const entities: EntityInfo[] = [];
      const services: ServiceInfo[] = [];
      const types: TypeInfo[] = [];
      const dependencies: DependencyInfo[] = [];

      // Detect which framework is used
      const framework = detectFramework(files);

      for (const file of files) {
        // Route handlers
        if (hasRoutes(file.content, framework)) {
          endpoints.push(...parseRoutes(file, framework));
        }

        // GORM models
        if (detectFrameworks && isGormModel(file.content)) {
          const entity = parseGormModel(file);
          if (entity) entities.push(entity);
        }

        // Structs (DTOs, request/response types)
        if (hasStructs(file.content)) {
          types.push(...parseStructs(file));
        }

        // Interfaces (service interfaces)
        if (hasInterfaces(file.content)) {
          const svc = parseServiceInterfaces(file);
          services.push(...svc);
          for (const s of svc) {
            dependencies.push(
              ...s.dependencies.map((dep) => ({
                source: s.name,
                target: dep,
                type: 'use' as const,
              })),
            );
          }
        }

        // Enums (iota patterns)
        if (hasEnumPattern(file.content)) {
          types.push(...parseEnums(file));
        }
      }

      return { endpoints, entities, services, types, dependencies };
    },
  };
}

// ── Framework Detection ──

type GoFramework = 'gin' | 'echo' | 'fiber' | 'chi' | 'gorilla' | 'net-http' | 'unknown';

function detectFramework(files: SourceFile[]): GoFramework {
  for (const file of files) {
    if (file.content.includes('"github.com/gin-gonic/gin"')) return 'gin';
    if (file.content.includes('"github.com/labstack/echo')) return 'echo';
    if (file.content.includes('"github.com/gofiber/fiber')) return 'fiber';
    if (file.content.includes('"github.com/go-chi/chi')) return 'chi';
    if (file.content.includes('"github.com/gorilla/mux"')) return 'gorilla';
    if (file.content.includes('"net/http"')) return 'net-http';
  }
  return 'unknown';
}

// ── Route Detection ──

function hasRoutes(content: string, framework: GoFramework): boolean {
  switch (framework) {
    case 'gin':
      return /\.(GET|POST|PUT|DELETE|PATCH|OPTIONS|HEAD|Any|Handle)\s*\(/.test(content);
    case 'echo':
      return /\.(GET|POST|PUT|DELETE|PATCH|OPTIONS|HEAD|Add)\s*\(/.test(content);
    case 'fiber':
      return /\.(Get|Post|Put|Delete|Patch|Options|Head|All)\s*\(/.test(content);
    case 'chi':
      return /\.(Get|Post|Put|Delete|Patch|Options|Head|Method|HandleFunc|Handle)\s*\(/.test(content);
    case 'gorilla':
      return /\.(HandleFunc|Handle)\s*\(/.test(content) && /\.Methods\s*\(/.test(content);
    case 'net-http':
      return /http\.(HandleFunc|Handle)\s*\(/.test(content);
    default:
      return /\.(GET|POST|PUT|DELETE|PATCH|Get|Post|Put|Delete|Patch|HandleFunc)\s*\(/.test(content);
  }
}

function parseRoutes(file: SourceFile, framework: GoFramework): EndpointInfo[] {
  switch (framework) {
    case 'gin': return parseGinRoutes(file);
    case 'echo': return parseEchoRoutes(file);
    case 'fiber': return parseFiberRoutes(file);
    case 'chi': return parseChiRoutes(file);
    case 'gorilla': return parseGorillaRoutes(file);
    case 'net-http': return parseNetHttpRoutes(file);
    default: return parseGenericRoutes(file);
  }
}

// ── Gin Routes ──

function parseGinRoutes(file: SourceFile): EndpointInfo[] {
  const endpoints: EndpointInfo[] = [];
  const lines = file.content.split('\n');

  // Detect route group prefix
  const groupPrefixes = extractGroupPrefixes(file.content);

  // Match: router.GET("/path", handlerFunc) or group.POST("/path", handler)
  const routeRe = /(\w+)\.(GET|POST|PUT|DELETE|PATCH|OPTIONS|HEAD|Any)\s*\(\s*"([^"]*)"(?:\s*,\s*(\w+(?:\.\w+)?))?/g;
  let match: RegExpExecArray | null;

  while ((match = routeRe.exec(file.content)) !== null) {
    const [, receiver, method, path, handler] = match;
    const fullPath = resolveGroupPath(groupPrefixes, receiver, path);
    const lineNum = getLineNumber(file.content, match.index);
    const comment = extractComment(lines, lineNum);

    endpoints.push({
      protocol: 'rest',
      httpMethod: method === 'Any' ? 'ANY' : method,
      path: fullPath,
      name: handler || `${method} ${fullPath}`,
      handler: handler || 'anonymous',
      handlerClass: extractPackageName(file.content),
      parameters: extractGinParams(fullPath, file.content, handler),
      returnType: 'gin.Context',
      filePath: file.path,
      description: comment,
      tags: [extractPackageName(file.content)],
    });
  }

  return endpoints;
}

// ── Echo Routes ──

function parseEchoRoutes(file: SourceFile): EndpointInfo[] {
  const endpoints: EndpointInfo[] = [];
  const lines = file.content.split('\n');

  // Match: e.GET("/path", handler) or g.POST("/path", handler)
  const routeRe = /(\w+)\.(GET|POST|PUT|DELETE|PATCH|OPTIONS|HEAD|Add)\s*\(\s*"([^"]*)"(?:\s*,\s*(\w+(?:\.\w+)?))?/g;
  let match: RegExpExecArray | null;
  const groupPrefixes = extractEchoGroupPrefixes(file.content);

  while ((match = routeRe.exec(file.content)) !== null) {
    const [, receiver, method, path, handler] = match;
    const fullPath = resolveGroupPath(groupPrefixes, receiver, path);
    const lineNum = getLineNumber(file.content, match.index);
    const comment = extractComment(lines, lineNum);

    endpoints.push({
      protocol: 'rest',
      httpMethod: method === 'Add' ? 'ANY' : method,
      path: fullPath,
      name: handler || `${method} ${fullPath}`,
      handler: handler || 'anonymous',
      handlerClass: extractPackageName(file.content),
      parameters: extractPathParams(fullPath),
      returnType: 'echo.Context',
      filePath: file.path,
      description: comment,
      tags: [extractPackageName(file.content)],
    });
  }

  return endpoints;
}

// ── Fiber Routes ──

function parseFiberRoutes(file: SourceFile): EndpointInfo[] {
  const endpoints: EndpointInfo[] = [];
  const lines = file.content.split('\n');

  // Match: app.Get("/path", handler) or group.Post("/path", handler)
  const routeRe = /(\w+)\.(Get|Post|Put|Delete|Patch|Options|Head|All)\s*\(\s*"([^"]*)"(?:\s*,\s*(\w+(?:\.\w+)?))?/g;
  let match: RegExpExecArray | null;
  const groupPrefixes = extractFiberGroupPrefixes(file.content);

  while ((match = routeRe.exec(file.content)) !== null) {
    const [, receiver, method, path, handler] = match;
    const fullPath = resolveGroupPath(groupPrefixes, receiver, path);
    const lineNum = getLineNumber(file.content, match.index);
    const comment = extractComment(lines, lineNum);

    endpoints.push({
      protocol: 'rest',
      httpMethod: method === 'All' ? 'ANY' : method.toUpperCase(),
      path: fullPath,
      name: handler || `${method.toUpperCase()} ${fullPath}`,
      handler: handler || 'anonymous',
      handlerClass: extractPackageName(file.content),
      parameters: extractFiberParams(fullPath),
      returnType: 'fiber.Ctx',
      filePath: file.path,
      description: comment,
      tags: [extractPackageName(file.content)],
    });
  }

  return endpoints;
}

// ── Chi Routes ──

function parseChiRoutes(file: SourceFile): EndpointInfo[] {
  const endpoints: EndpointInfo[] = [];
  const lines = file.content.split('\n');

  // Match: r.Get("/path", handler) or r.Route("/prefix", func(r chi.Router) { ... })
  const routeRe = /(\w+)\.(Get|Post|Put|Delete|Patch|Options|Head|HandleFunc|Method)\s*\(\s*"([^"]*)"(?:\s*,\s*(?:"([^"]*)"(?:\s*,\s*)?)?(\w+(?:\.\w+)?))?/g;
  let match: RegExpExecArray | null;

  while ((match = routeRe.exec(file.content)) !== null) {
    const [, , method, path, httpMethod, handler] = match;
    const lineNum = getLineNumber(file.content, match.index);
    const comment = extractComment(lines, lineNum);
    const resolvedMethod = method === 'Method' ? (httpMethod || 'GET') : method.toUpperCase();
    const resolvedHandler = method === 'Method' ? (handler || 'anonymous') : (httpMethod || handler || 'anonymous');

    endpoints.push({
      protocol: 'rest',
      httpMethod: resolvedMethod === 'HANDLEFUNC' ? 'GET' : resolvedMethod,
      path,
      name: resolvedHandler || `${resolvedMethod} ${path}`,
      handler: resolvedHandler || 'anonymous',
      handlerClass: extractPackageName(file.content),
      parameters: extractChiParams(path),
      returnType: 'http.ResponseWriter',
      filePath: file.path,
      description: comment,
      tags: [extractPackageName(file.content)],
    });
  }

  return endpoints;
}

// ── Gorilla Mux Routes ──

function parseGorillaRoutes(file: SourceFile): EndpointInfo[] {
  const endpoints: EndpointInfo[] = [];
  const lines = file.content.split('\n');

  // Match: r.HandleFunc("/path", handler).Methods("GET", "POST")
  const routeRe = /(\w+)\.(HandleFunc|Handle)\s*\(\s*"([^"]*)"(?:\s*,\s*(\w+(?:\.\w+)?))?\s*\)(?:\.Methods\s*\(\s*"([^"]*)")?/g;
  let match: RegExpExecArray | null;

  while ((match = routeRe.exec(file.content)) !== null) {
    const [, , , path, handler, methods] = match;
    const lineNum = getLineNumber(file.content, match.index);
    const comment = extractComment(lines, lineNum);
    const methodList = methods ? methods.split(/"\s*,\s*"/) : ['GET'];

    for (const method of methodList) {
      endpoints.push({
        protocol: 'rest',
        httpMethod: method.trim().toUpperCase(),
        path,
        name: handler || `${method} ${path}`,
        handler: handler || 'anonymous',
        handlerClass: extractPackageName(file.content),
        parameters: extractGorillaParams(path),
        returnType: 'http.ResponseWriter',
        filePath: file.path,
        description: comment,
        tags: [extractPackageName(file.content)],
      });
    }
  }

  return endpoints;
}

// ── net/http Routes ──

function parseNetHttpRoutes(file: SourceFile): EndpointInfo[] {
  const endpoints: EndpointInfo[] = [];
  const lines = file.content.split('\n');

  // Match: http.HandleFunc("/path", handler)
  const routeRe = /http\.(HandleFunc|Handle)\s*\(\s*"([^"]*)"(?:\s*,\s*(\w+(?:\.\w+)?))?/g;
  let match: RegExpExecArray | null;

  while ((match = routeRe.exec(file.content)) !== null) {
    const [, , path, handler] = match;
    const lineNum = getLineNumber(file.content, match.index);
    const comment = extractComment(lines, lineNum);

    endpoints.push({
      protocol: 'rest',
      httpMethod: 'GET',
      path,
      name: handler || `GET ${path}`,
      handler: handler || 'anonymous',
      handlerClass: extractPackageName(file.content),
      parameters: [],
      returnType: 'http.ResponseWriter',
      filePath: file.path,
      description: comment,
      tags: [extractPackageName(file.content)],
    });
  }

  return endpoints;
}

// ── Generic Route fallback ──

function parseGenericRoutes(file: SourceFile): EndpointInfo[] {
  const endpoints: EndpointInfo[] = [];
  const lines = file.content.split('\n');

  const routeRe = /(\w+)\.(GET|POST|PUT|DELETE|PATCH|Get|Post|Put|Delete|Patch|HandleFunc)\s*\(\s*"([^"]*)"(?:\s*,\s*(\w+(?:\.\w+)?))?/g;
  let match: RegExpExecArray | null;

  while ((match = routeRe.exec(file.content)) !== null) {
    const [, , method, path, handler] = match;
    const lineNum = getLineNumber(file.content, match.index);
    const comment = extractComment(lines, lineNum);

    endpoints.push({
      protocol: 'rest',
      httpMethod: method.toUpperCase(),
      path,
      name: handler || `${method.toUpperCase()} ${path}`,
      handler: handler || 'anonymous',
      handlerClass: extractPackageName(file.content),
      parameters: extractPathParams(path),
      returnType: 'unknown',
      filePath: file.path,
      description: comment,
      tags: [extractPackageName(file.content)],
    });
  }

  return endpoints;
}

// ── GORM Model Parsing ──

function isGormModel(content: string): boolean {
  return /gorm\.Model|gorm:"/.test(content);
}

function parseGormModel(file: SourceFile): EntityInfo | null {
  const lines = file.content.split('\n');

  // Match: type ModelName struct { ... }
  const structRe = /type\s+(\w+)\s+struct\s*\{/g;
  let match: RegExpExecArray | null;

  while ((match = structRe.exec(file.content)) !== null) {
    const structName = match[1];
    const braceStart = match.index + match[0].length;
    const body = extractBraceBlock(file.content, braceStart);
    if (!body) continue;

    // Must have gorm.Model or gorm tags
    if (!/gorm\.Model|gorm:"/.test(body)) continue;

    const columns: ColumnInfo[] = [];
    const relations: RelationInfo[] = [];
    const indexes: string[] = [];
    const tableName = toSnakeCase(structName) + 's';

    // Parse gorm.Model embedded fields
    if (/gorm\.Model/.test(body)) {
      columns.push(
        { name: 'ID', type: 'uint', dbColumnName: 'id', nullable: false, primaryKey: true, unique: true },
        { name: 'CreatedAt', type: 'time.Time', dbColumnName: 'created_at', nullable: false, primaryKey: false, unique: false },
        { name: 'UpdatedAt', type: 'time.Time', dbColumnName: 'updated_at', nullable: false, primaryKey: false, unique: false },
        { name: 'DeletedAt', type: 'gorm.DeletedAt', dbColumnName: 'deleted_at', nullable: true, primaryKey: false, unique: false },
      );
    }

    // Parse fields
    const fieldRe = /^\s+(\w+)\s+([\w.*\[\]]+)(?:\s+`([^`]*)`)?/gm;
    let fieldMatch: RegExpExecArray | null;

    while ((fieldMatch = fieldRe.exec(body)) !== null) {
      const [, fieldName, fieldType, tags] = fieldMatch;
      if (fieldName === 'gorm') continue; // skip gorm.Model line

      const gormTag = extractGormTag(tags || '');
      const isPk = gormTag.includes('primaryKey') || gormTag.includes('primarykey');
      const isUnique = gormTag.includes('unique');
      const isNullable = fieldType.startsWith('*') || gormTag.includes('default:null');
      const colName = extractColumnName(gormTag) || toSnakeCase(fieldName);

      // Detect relations
      const relType = detectGormRelation(fieldType, gormTag);
      if (relType) {
        relations.push(relType);
        continue;
      }

      // Detect indexes
      if (gormTag.includes('index')) {
        indexes.push(fieldName);
      }

      columns.push({
        name: fieldName,
        type: goTypeToString(fieldType),
        dbColumnName: colName,
        nullable: isNullable,
        primaryKey: isPk,
        unique: isUnique,
        defaultValue: extractGormDefault(gormTag),
      });
    }

    if (columns.length > 0) {
      return {
        name: structName,
        tableName,
        dbType: 'postgresql',
        columns,
        relations,
        indexes,
        filePath: file.path,
        description: extractStructComment(lines, getLineNumber(file.content, match.index)),
      };
    }
  }

  return null;
}

// ── Struct Parsing (DTOs) ──

function hasStructs(content: string): boolean {
  return /type\s+\w+\s+struct\s*\{/.test(content);
}

function parseStructs(file: SourceFile): TypeInfo[] {
  const types: TypeInfo[] = [];
  const lines = file.content.split('\n');

  const structRe = /type\s+(\w+)\s+struct\s*\{/g;
  let match: RegExpExecArray | null;

  while ((match = structRe.exec(file.content)) !== null) {
    const structName = match[1];
    const braceStart = match.index + match[0].length;
    const body = extractBraceBlock(file.content, braceStart);
    if (!body) continue;

    // Skip GORM models (handled separately)
    if (/gorm\.Model|gorm:"/.test(body)) continue;

    const fields: { name: string; type: string; required: boolean; description?: string }[] = [];
    const fieldRe = /^\s+(\w+)\s+([\w.*\[\]{}]+)(?:\s+`([^`]*)`)?/gm;
    let fieldMatch: RegExpExecArray | null;

    while ((fieldMatch = fieldRe.exec(body)) !== null) {
      const [, fieldName, fieldType, tags] = fieldMatch;
      const jsonTag = extractJsonTag(tags || '');
      const isOmitempty = jsonTag.includes('omitempty');

      fields.push({
        name: jsonTag.split(',')[0] || fieldName,
        type: goTypeToString(fieldType),
        required: !isOmitempty && !fieldType.startsWith('*'),
        description: extractFieldComment(body, fieldMatch.index),
      });
    }

    if (fields.length > 0) {
      const kind = detectStructKind(structName, file.content);
      const lineNum = getLineNumber(file.content, match.index);

      types.push({
        name: structName,
        kind,
        fields,
        filePath: file.path,
        description: extractStructComment(lines, lineNum),
      });
    }
  }

  return types;
}

// ── Interface Parsing (Services) ──

function hasInterfaces(content: string): boolean {
  return /type\s+\w+\s+interface\s*\{/.test(content);
}

function parseServiceInterfaces(file: SourceFile): ServiceInfo[] {
  const services: ServiceInfo[] = [];
  const lines = file.content.split('\n');

  const ifaceRe = /type\s+(\w+)\s+interface\s*\{/g;
  let match: RegExpExecArray | null;

  while ((match = ifaceRe.exec(file.content)) !== null) {
    const ifaceName = match[1];
    const braceStart = match.index + match[0].length;
    const body = extractBraceBlock(file.content, braceStart);
    if (!body) continue;

    const methods: string[] = [];
    const methodRe = /^\s+(\w+)\s*\(/gm;
    let methodMatch: RegExpExecArray | null;

    while ((methodMatch = methodRe.exec(body)) !== null) {
      methods.push(methodMatch[1]);
    }

    // Find struct that implements this interface
    const deps = findImplementationDeps(file.content, ifaceName);
    const lineNum = getLineNumber(file.content, match.index);

    if (methods.length > 0) {
      services.push({
        name: ifaceName,
        filePath: file.path,
        methods,
        dependencies: deps,
        description: extractStructComment(lines, lineNum),
      });
    }
  }

  return services;
}

// ── Enum Parsing (iota) ──

function hasEnumPattern(content: string): boolean {
  return /iota/.test(content);
}

function parseEnums(file: SourceFile): TypeInfo[] {
  const types: TypeInfo[] = [];

  // Match: type Status int \n const ( ... )
  const typeRe = /type\s+(\w+)\s+(?:int|uint|int8|int16|int32|int64|string)\s*\n\s*const\s*\(/g;
  let match: RegExpExecArray | null;

  while ((match = typeRe.exec(file.content)) !== null) {
    const typeName = match[1];
    const constStart = file.content.indexOf('(', match.index + match[0].length - 1) + 1;
    const constBody = extractParenBlock(file.content, constStart);
    if (!constBody) continue;

    const fields: { name: string; type: string; required: boolean }[] = [];
    const valueRe = /^\s+(\w+)/gm;
    let valueMatch: RegExpExecArray | null;

    while ((valueMatch = valueRe.exec(constBody)) !== null) {
      const valueName = valueMatch[1];
      if (valueName === '_' || valueName === typeName) continue;
      fields.push({ name: valueName, type: typeName, required: true });
    }

    if (fields.length > 0) {
      types.push({
        name: typeName,
        kind: 'enum',
        fields,
        filePath: file.path,
      });
    }
  }

  // Simpler pattern: const ( ... = iota )
  const iotaBlockRe = /const\s*\(\s*\n([\s\S]*?iota[\s\S]*?)\)/g;
  let iotaMatch: RegExpExecArray | null;

  while ((iotaMatch = iotaBlockRe.exec(file.content)) !== null) {
    const block = iotaMatch[1];
    // Check if already captured by typed pattern
    const firstLine = block.trim().split('\n')[0];
    const typeNameMatch = firstLine.match(/(\w+)\s+(\w+)\s*=\s*iota/);
    if (!typeNameMatch) continue;

    const [, , enumTypeName] = typeNameMatch;
    // Skip if already parsed via the typed pattern
    if (types.some((t) => t.name === enumTypeName)) continue;

    const fields: { name: string; type: string; required: boolean }[] = [];
    const valueRe = /^\s+(\w+)/gm;
    let valueMatch: RegExpExecArray | null;

    while ((valueMatch = valueRe.exec(block)) !== null) {
      const valueName = valueMatch[1];
      if (valueName === '_') continue;
      fields.push({ name: valueName, type: enumTypeName, required: true });
    }

    if (fields.length > 0) {
      types.push({
        name: enumTypeName,
        kind: 'enum',
        fields,
        filePath: file.path,
      });
    }
  }

  return types;
}

// ── Helper Functions ──

function extractPackageName(content: string): string {
  const match = content.match(/^package\s+(\w+)/m);
  return match ? match[1] : 'main';
}

function getLineNumber(content: string, index: number): number {
  return content.substring(0, index).split('\n').length;
}

function extractComment(lines: string[], lineNum: number): string | undefined {
  const comments: string[] = [];
  for (let i = lineNum - 2; i >= 0; i--) {
    const line = lines[i]?.trim();
    if (!line) break;
    if (line.startsWith('//')) {
      comments.unshift(line.replace(/^\/\/\s?/, ''));
    } else {
      break;
    }
  }
  return comments.length > 0 ? comments.join(' ') : undefined;
}

function extractStructComment(lines: string[], lineNum: number): string | undefined {
  return extractComment(lines, lineNum);
}

function extractBraceBlock(content: string, startIndex: number): string | null {
  let depth = 1;
  let i = startIndex;
  while (i < content.length && depth > 0) {
    if (content[i] === '{') depth++;
    else if (content[i] === '}') depth--;
    i++;
  }
  return depth === 0 ? content.substring(startIndex, i - 1) : null;
}

function extractParenBlock(content: string, startIndex: number): string | null {
  let depth = 1;
  let i = startIndex;
  while (i < content.length && depth > 0) {
    if (content[i] === '(') depth++;
    else if (content[i] === ')') depth--;
    i++;
  }
  return depth === 0 ? content.substring(startIndex, i - 1) : null;
}

function toSnakeCase(str: string): string {
  return str.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');
}

function goTypeToString(goType: string): string {
  return goType.replace(/^\*/, '');
}

function extractGormTag(tags: string): string {
  const match = tags.match(/gorm:"([^"]*)"/);
  return match ? match[1] : '';
}

function extractJsonTag(tags: string): string {
  const match = tags.match(/json:"([^"]*)"/);
  return match ? match[1] : '';
}

function extractColumnName(gormTag: string): string | null {
  const match = gormTag.match(/column:(\w+)/);
  return match ? match[1] : null;
}

function extractGormDefault(gormTag: string): string | undefined {
  const match = gormTag.match(/default:([^;]+)/);
  return match ? match[1] : undefined;
}

function detectGormRelation(fieldType: string, gormTag: string): RelationInfo | null {
  const isSlice = fieldType.startsWith('[]');
  const isPointer = fieldType.startsWith('*');
  const baseType = fieldType.replace(/^\*|\[\]/, '');

  if (gormTag.includes('foreignKey') || gormTag.includes('references')) {
    const joinCol = gormTag.match(/foreignKey:(\w+)/)?.[1];
    if (isSlice) {
      return { type: 'OneToMany', target: baseType, joinColumn: joinCol };
    }
    return { type: 'ManyToOne', target: baseType, joinColumn: joinCol };
  }

  if (gormTag.includes('many2many')) {
    return { type: 'ManyToMany', target: baseType, joinColumn: gormTag.match(/many2many:(\w+)/)?.[1] };
  }

  // Infer from type shape
  if (isSlice && /^[A-Z]/.test(baseType)) {
    return { type: 'OneToMany', target: baseType };
  }

  if ((isPointer || /^[A-Z]/.test(fieldType)) && gormTag && /^[A-Z]/.test(baseType)) {
    // Only if the type looks like another model
    if (!/^(string|int|uint|float|bool|time|byte)/.test(baseType.toLowerCase())) {
      return { type: 'ManyToOne', target: baseType };
    }
  }

  return null;
}

function extractFieldComment(body: string, fieldIndex: number): string | undefined {
  // Check for inline comment after field
  const lineEnd = body.indexOf('\n', fieldIndex);
  const line = body.substring(fieldIndex, lineEnd === -1 ? undefined : lineEnd);
  const commentMatch = line.match(/\/\/\s*(.*)/);
  return commentMatch ? commentMatch[1] : undefined;
}

function detectStructKind(name: string, content: string): 'dto' | 'input' | 'response' | 'interface' | 'type' {
  const lower = name.toLowerCase();
  if (lower.includes('request') || lower.includes('input') || lower.includes('create') || lower.includes('update')) return 'input';
  if (lower.includes('response') || lower.includes('output') || lower.includes('result')) return 'response';
  if (lower.includes('dto')) return 'dto';
  return 'type';
}

// ── Route Group Helpers ──

function extractGroupPrefixes(content: string): Map<string, string> {
  const map = new Map<string, string>();
  // Match: varName := router.Group("/prefix")
  const groupRe = /(\w+)\s*:?=\s*\w+\.Group\s*\(\s*"([^"]*)"/g;
  let match: RegExpExecArray | null;
  while ((match = groupRe.exec(content)) !== null) {
    map.set(match[1], match[2]);
  }
  return map;
}

function extractEchoGroupPrefixes(content: string): Map<string, string> {
  const map = new Map<string, string>();
  const groupRe = /(\w+)\s*:?=\s*\w+\.Group\s*\(\s*"([^"]*)"/g;
  let match: RegExpExecArray | null;
  while ((match = groupRe.exec(content)) !== null) {
    map.set(match[1], match[2]);
  }
  return map;
}

function extractFiberGroupPrefixes(content: string): Map<string, string> {
  const map = new Map<string, string>();
  const groupRe = /(\w+)\s*:?=\s*\w+\.Group\s*\(\s*"([^"]*)"/g;
  let match: RegExpExecArray | null;
  while ((match = groupRe.exec(content)) !== null) {
    map.set(match[1], match[2]);
  }
  return map;
}

function resolveGroupPath(prefixes: Map<string, string>, receiver: string, path: string): string {
  const prefix = prefixes.get(receiver);
  if (prefix) {
    return prefix + path;
  }
  return path;
}

// ── Parameter Extraction ──

function extractPathParams(path: string): ParameterInfo[] {
  const params: ParameterInfo[] = [];
  // Match :param or {param}
  const paramRe = /[:{](\w+)}?/g;
  let match: RegExpExecArray | null;
  while ((match = paramRe.exec(path)) !== null) {
    params.push({
      name: match[1],
      type: 'string',
      required: true,
      location: 'path',
    });
  }
  return params;
}

function extractGinParams(path: string, content: string, handler?: string): ParameterInfo[] {
  const params = extractPathParams(path);

  // Look for c.Query("key") or c.DefaultQuery("key", "default") in handler
  if (handler) {
    const queryRe = /c\.(?:Query|DefaultQuery)\s*\(\s*"(\w+)"/g;
    let match: RegExpExecArray | null;
    while ((match = queryRe.exec(content)) !== null) {
      params.push({
        name: match[1],
        type: 'string',
        required: false,
        location: 'query',
      });
    }

    // ShouldBindJSON / BindJSON
    const bindMatch = content.match(/ShouldBind(?:JSON|Uri|Query)\s*\(\s*&(\w+)/);
    if (bindMatch) {
      params.push({
        name: 'body',
        type: bindMatch[1],
        required: true,
        location: 'body',
      });
    }
  }

  return params;
}

function extractFiberParams(path: string): ParameterInfo[] {
  return extractPathParams(path);
}

function extractChiParams(path: string): ParameterInfo[] {
  return extractPathParams(path);
}

function extractGorillaParams(path: string): ParameterInfo[] {
  return extractPathParams(path);
}

// ── Implementation Dependency Detection ──

function findImplementationDeps(content: string, ifaceName: string): string[] {
  const deps: string[] = [];
  // Look for struct implementing the interface with field deps
  // type serviceImpl struct { repo Repository; cache Cache }
  const implRe = new RegExp(`type\\s+(\\w+)\\s+struct\\s*\\{([^}]*)\\}`, 'g');
  let match: RegExpExecArray | null;

  while ((match = implRe.exec(content)) !== null) {
    const body = match[2];
    // Check if struct methods match interface methods (simplified check)
    const fieldRe = /(\w+)\s+([\w.*]+)/g;
    let fieldMatch: RegExpExecArray | null;
    while ((fieldMatch = fieldRe.exec(body)) !== null) {
      const [, , fieldType] = fieldMatch;
      const cleanType = fieldType.replace(/^\*/, '');
      if (/^[A-Z]/.test(cleanType) && cleanType !== ifaceName) {
        deps.push(cleanType);
      }
    }
  }

  return deps;
}
