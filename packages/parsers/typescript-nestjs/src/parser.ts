import type { ParserPlugin, SourceFile, ParseResult, EndpointInfo, EntityInfo, ServiceInfo, TypeInfo, DependencyInfo } from '@codedocs/core';

export interface NestJsParserOptions {
  /** Auto-detect ORM (TypeORM, Prisma, Mongoose) */
  detectOrm?: boolean;
  /** Parse GraphQL resolvers */
  detectGraphQL?: boolean;
  /** Parse WebSocket gateways */
  detectWebSocket?: boolean;
}

export function nestjsParser(options: NestJsParserOptions = {}): ParserPlugin {
  const { detectOrm = true, detectGraphQL = true, detectWebSocket = true } = options;

  return {
    name: 'typescript-nestjs',
    filePattern: ['**/*.ts', '**/*.tsx'],

    async parse(files: SourceFile[]): Promise<ParseResult> {
      const endpoints: EndpointInfo[] = [];
      const entities: EntityInfo[] = [];
      const services: ServiceInfo[] = [];
      const types: TypeInfo[] = [];
      const dependencies: DependencyInfo[] = [];

      for (const file of files) {
        // REST Controllers
        if (isController(file.content)) {
          endpoints.push(...parseControllerEndpoints(file));
        }

        // GraphQL Resolvers
        if (detectGraphQL && isResolver(file.content)) {
          endpoints.push(...parseResolverEndpoints(file));
        }

        // WebSocket Gateways
        if (detectWebSocket && isGateway(file.content)) {
          endpoints.push(...parseGatewayEvents(file));
        }

        // TypeORM / Mongoose Entities
        if (detectOrm && isEntity(file.content)) {
          const entity = parseEntity(file);
          if (entity) entities.push(entity);
        }

        // Prisma models (from generated client types)
        if (detectOrm && isPrismaModel(file.content)) {
          types.push(...parsePrismaTypes(file));
        }

        // Injectable Services
        if (isInjectable(file.content) && !isController(file.content) && !isResolver(file.content) && !isGateway(file.content)) {
          const svc = parseService(file);
          if (svc) {
            services.push(svc);
            dependencies.push(
              ...svc.dependencies.map((dep) => ({
                source: svc.name,
                target: dep,
                type: 'inject' as const,
              })),
            );
          }
        }

        // DTOs / Interfaces / Enums
        if (isDto(file)) {
          types.push(...parseDtos(file));
        }
        if (hasEnums(file.content)) {
          types.push(...parseEnums(file));
        }
        if (hasInterfaces(file)) {
          types.push(...parseInterfaces(file));
        }
      }

      return { endpoints, entities, services, types, dependencies };
    },
  };
}

// ── Detection helpers ──

function isController(content: string): boolean {
  return /@Controller\(/.test(content);
}

function isResolver(content: string): boolean {
  return /@Resolver\(/.test(content);
}

function isGateway(content: string): boolean {
  return /@WebSocketGateway/.test(content);
}

function isEntity(content: string): boolean {
  return /@Entity\(/.test(content) || /@Schema\(/.test(content);
}

function isPrismaModel(content: string): boolean {
  return /Prisma\.\$\w+Payload/.test(content) || /@@map\(/.test(content);
}

function isInjectable(content: string): boolean {
  return /@Injectable\(/.test(content);
}

function isDto(file: SourceFile): boolean {
  return /\.dto\.ts$|\.input\.ts$|\.args\.ts$/.test(file.path)
    || /@IsString|@IsNumber|@IsNotEmpty|@ValidateNested/.test(file.content)
    || /class\s+\w+(?:Dto|DTO|Input|Args|Request|Response)\b/.test(file.content);
}

function hasEnums(content: string): boolean {
  return /\benum\s+\w+\s*\{/.test(content);
}

function hasInterfaces(file: SourceFile): boolean {
  return /\.interface\.ts$/.test(file.path) || /\bexport\s+interface\s+\w+/.test(file.content);
}

// ── Controller Parser ──

function parseControllerEndpoints(file: SourceFile): EndpointInfo[] {
  const endpoints: EndpointInfo[] = [];
  const classMatch = file.content.match(/class\s+(\w+)/);
  const className = classMatch?.[1] || 'UnknownController';

  // Base path from @Controller('path')
  const basePath = file.content.match(/@Controller\(\s*['"]([^'"]*)['"]\s*\)/)?.[1] || '';

  const methodPatterns = [
    { regex: /@Get\(\s*['"]([^'"]*)['"]\s*\)/g, method: 'GET' },
    { regex: /@Post\(\s*['"]([^'"]*)['"]\s*\)/g, method: 'POST' },
    { regex: /@Put\(\s*['"]([^'"]*)['"]\s*\)/g, method: 'PUT' },
    { regex: /@Delete\(\s*['"]([^'"]*)['"]\s*\)/g, method: 'DELETE' },
    { regex: /@Patch\(\s*['"]([^'"]*)['"]\s*\)/g, method: 'PATCH' },
  ];

  // No-path decorators: @Get(), @Post(), etc.
  const noPathPatterns = [
    { regex: /@Get\(\s*\)/g, method: 'GET' },
    { regex: /@Post\(\s*\)/g, method: 'POST' },
    { regex: /@Put\(\s*\)/g, method: 'PUT' },
    { regex: /@Delete\(\s*\)/g, method: 'DELETE' },
    { regex: /@Patch\(\s*\)/g, method: 'PATCH' },
  ];

  for (const { regex, method } of methodPatterns) {
    let match: RegExpExecArray | null;
    while ((match = regex.exec(file.content)) !== null) {
      const path = '/' + [basePath, match[1]].filter(Boolean).join('/').replace(/\/+/g, '/').replace(/^\//, '');
      const endpoint = extractTsEndpoint(file, match.index, className, method, path);
      if (endpoint) endpoints.push(endpoint);
    }
  }

  for (const { regex, method } of noPathPatterns) {
    let match: RegExpExecArray | null;
    while ((match = regex.exec(file.content)) !== null) {
      const path = '/' + basePath.replace(/^\//, '');
      const endpoint = extractTsEndpoint(file, match.index, className, method, path);
      if (endpoint) endpoints.push(endpoint);
    }
  }

  return endpoints;
}

function extractTsEndpoint(
  file: SourceFile,
  annotationIndex: number,
  className: string,
  method: string,
  path: string,
): EndpointInfo | null {
  const afterAnnotation = file.content.slice(annotationIndex);

  // Match: async? methodName(params): ReturnType
  const methodMatch = afterAnnotation.match(
    /(?:async\s+)?(\w+)\s*\(([^)]*)\)\s*(?::\s*(?:Promise<([^>]+)>|(\w+(?:<[^>]+>)?)))?/,
  );
  if (!methodMatch) return null;

  const handler = methodMatch[1];
  const paramsStr = methodMatch[2];
  const returnType = methodMatch[3] || methodMatch[4] || 'void';

  const params = parseTsMethodParameters(paramsStr);

  // Detect guards/auth
  const decoratorSlice = file.content.slice(Math.max(0, annotationIndex - 500), annotationIndex);
  const auth = /@UseGuards|@ApiBearerAuth|@Roles/.test(decoratorSlice) || /@UseGuards|@ApiBearerAuth|@Roles/.test(afterAnnotation.slice(0, 200));
  const deprecated = /@ApiDeprecated|@deprecated/.test(decoratorSlice);

  // Swagger description
  const descMatch = decoratorSlice.match(/@ApiOperation\(\s*\{[^}]*summary:\s*['"]([^'"]+)['"]/);
  const description = descMatch?.[1];

  const serviceRef = findServiceRef(file.content);

  return {
    protocol: 'rest',
    httpMethod: method,
    path: path || '/',
    name: `${method} ${path || '/'}`,
    handler,
    handlerClass: className,
    parameters: params,
    returnType,
    serviceRef,
    filePath: file.path,
    auth,
    deprecated,
    description,
  };
}

// ── GraphQL Resolver Parser ──

function parseResolverEndpoints(file: SourceFile): EndpointInfo[] {
  const endpoints: EndpointInfo[] = [];
  const classMatch = file.content.match(/class\s+(\w+)/);
  const className = classMatch?.[1] || 'UnknownResolver';

  const opPatterns = [
    { regex: /@Query\(/g, type: 'Query' as const },
    { regex: /@Mutation\(/g, type: 'Mutation' as const },
    { regex: /@Subscription\(/g, type: 'Subscription' as const },
  ];

  for (const { regex, type } of opPatterns) {
    let match: RegExpExecArray | null;
    while ((match = regex.exec(file.content)) !== null) {
      const afterAnnotation = file.content.slice(match.index);

      const methodMatch = afterAnnotation.match(
        /(?:async\s+)?(\w+)\s*\(([^)]*)\)\s*(?::\s*(?:Promise<([^>]+)>|(\w+(?:<[^>]+>)?)))?/,
      );
      if (!methodMatch) continue;

      const fieldName = methodMatch[1];
      const paramsStr = methodMatch[2];
      const returnType = methodMatch[3] || methodMatch[4] || 'any';

      const params = parseTsMethodParameters(paramsStr);
      const serviceRef = findServiceRef(file.content);

      endpoints.push({
        protocol: 'graphql',
        operationType: type,
        fieldName,
        name: `${type}.${fieldName}`,
        handler: fieldName,
        handlerClass: className,
        parameters: params,
        returnType,
        serviceRef,
        filePath: file.path,
      });
    }
  }

  return endpoints;
}

// ── WebSocket Gateway Parser ──

function parseGatewayEvents(file: SourceFile): EndpointInfo[] {
  const endpoints: EndpointInfo[] = [];
  const classMatch = file.content.match(/class\s+(\w+)/);
  const className = classMatch?.[1] || 'UnknownGateway';

  const eventRegex = /@SubscribeMessage\(\s*['"]([^'"]+)['"]\s*\)/g;
  let match: RegExpExecArray | null;

  while ((match = eventRegex.exec(file.content)) !== null) {
    const eventName = match[1];
    const afterAnnotation = file.content.slice(match.index);

    const methodMatch = afterAnnotation.match(
      /(?:async\s+)?(\w+)\s*\(([^)]*)\)\s*(?::\s*(?:Promise<([^>]+)>|(\w+(?:<[^>]+>)?)))?/,
    );
    if (!methodMatch) continue;

    const handler = methodMatch[1];
    const returnType = methodMatch[3] || methodMatch[4] || 'void';

    endpoints.push({
      protocol: 'websocket',
      name: `WS:${eventName}`,
      handler,
      handlerClass: className,
      parameters: [],
      returnType,
      filePath: file.path,
    });
  }

  return endpoints;
}

// ── Entity Parser (TypeORM / Mongoose) ──

function parseEntity(file: SourceFile): EntityInfo | null {
  const classMatch = file.content.match(/class\s+(\w+)/);
  if (!classMatch) return null;
  const name = classMatch[1];

  const isMongoose = /@Schema\(/.test(file.content);
  const dbType = isMongoose ? 'MongoDB' : 'PostgreSQL';

  // Table name from @Entity('name') or snake_case
  const entityNameMatch = file.content.match(/@Entity\(\s*['"](\w+)['"]\s*\)/);
  const tableName = entityNameMatch?.[1] || camelToSnake(name);

  const columns = isMongoose ? parseMongooseFields(file.content) : parseTypeOrmColumns(file.content);
  const relations = parseTypeOrmRelations(file.content);
  const indexes = parseTypeOrmIndexes(file.content);

  return {
    name,
    tableName,
    dbType,
    columns,
    relations,
    indexes,
    filePath: file.path,
  };
}

function parseTypeOrmColumns(content: string): EntityInfo['columns'] {
  const columns: EntityInfo['columns'] = [];

  // @Column() or @PrimaryGeneratedColumn() followed by field: type
  const columnRegex = /(@(?:Primary(?:Generated)?Column|Column)\([^)]*\))\s*(\w+)\s*[!?]?\s*:\s*(\w+(?:<[^>]+>)?)/g;
  let match: RegExpExecArray | null;

  while ((match = columnRegex.exec(content)) !== null) {
    const decorator = match[1];
    const fieldName = match[2];
    const type = match[3];

    const isPrimary = decorator.includes('PrimaryColumn') || decorator.includes('PrimaryGeneratedColumn');
    const nullable = decorator.includes('nullable: true');
    const unique = decorator.includes('unique: true');
    const dbColumnName = decorator.match(/name:\s*['"](\w+)['"]/)?.[1] || camelToSnake(fieldName);

    columns.push({
      name: fieldName,
      type,
      dbColumnName,
      nullable,
      primaryKey: isPrimary,
      unique: unique || isPrimary,
    });
  }

  // @CreateDateColumn, @UpdateDateColumn, @DeleteDateColumn
  const specialColumns = [
    { regex: /@CreateDateColumn\([^)]*\)\s*(\w+)\s*[!?]?\s*:\s*(\w+)/g, name: 'created_at' },
    { regex: /@UpdateDateColumn\([^)]*\)\s*(\w+)\s*[!?]?\s*:\s*(\w+)/g, name: 'updated_at' },
    { regex: /@DeleteDateColumn\([^)]*\)\s*(\w+)\s*[!?]?\s*:\s*(\w+)/g, name: 'deleted_at' },
  ];

  for (const { regex, name: defaultDbName } of specialColumns) {
    let m: RegExpExecArray | null;
    while ((m = regex.exec(content)) !== null) {
      columns.push({
        name: m[1],
        type: m[2],
        dbColumnName: defaultDbName,
        nullable: true,
        primaryKey: false,
        unique: false,
      });
    }
  }

  return columns;
}

function parseMongooseFields(content: string): EntityInfo['columns'] {
  const columns: EntityInfo['columns'] = [];

  // @Prop() fieldName: type
  const propRegex = /@Prop\(([^)]*)\)\s*(\w+)\s*[!?]?\s*:\s*(\w+(?:<[^>]+>)?)/g;
  let match: RegExpExecArray | null;

  while ((match = propRegex.exec(content)) !== null) {
    const decorator = match[1];
    const fieldName = match[2];
    const type = match[3];

    const required = decorator.includes('required: true');
    const unique = decorator.includes('unique: true');

    columns.push({
      name: fieldName,
      type,
      dbColumnName: fieldName,
      nullable: !required,
      primaryKey: false,
      unique,
    });
  }

  return columns;
}

function parseTypeOrmRelations(content: string): EntityInfo['relations'] {
  const relations: EntityInfo['relations'] = [];
  const relTypes = ['OneToOne', 'OneToMany', 'ManyToOne', 'ManyToMany'] as const;

  for (const relType of relTypes) {
    // @OneToMany(() => Entity, ...) fieldName: Entity[]
    const regex = new RegExp(
      `@${relType}\\(\\s*\\(\\)\\s*=>\\s*(\\w+)`,
      'g',
    );
    let match: RegExpExecArray | null;
    while ((match = regex.exec(content)) !== null) {
      const target = match[1];

      const annotationSlice = content.slice(match.index, match.index + 300);
      const joinColumn = annotationSlice.match(/@JoinColumn\(\s*\{\s*name:\s*['"](\w+)['"]/)?.[1];
      const mappedBy = annotationSlice.match(/\(\s*\w+\s*\)\s*=>\s*\w+\.(\w+)/)?.[1];
      const eager = annotationSlice.includes('eager: true');

      relations.push({
        type: relType,
        target,
        joinColumn,
        mappedBy,
        eager,
      });
    }
  }

  return relations;
}

function parseTypeOrmIndexes(content: string): string[] {
  const indexes: string[] = [];

  // @Index(['col1', 'col2']) or @Index('name', ['col1'])
  const indexRegex = /@Index\(\s*(?:\[([^\]]+)\]|['"](\w+)['"]\s*,\s*\[([^\]]+)\])/g;
  let match: RegExpExecArray | null;
  while ((match = indexRegex.exec(content)) !== null) {
    if (match[1]) {
      indexes.push(match[1].replace(/['"]/g, '').trim());
    } else if (match[2] && match[3]) {
      indexes.push(`${match[2]}: ${match[3].replace(/['"]/g, '').trim()}`);
    }
  }

  return indexes;
}

// ── Service Parser ──

function parseService(file: SourceFile): ServiceInfo | null {
  const classMatch = file.content.match(/class\s+(\w+)/);
  if (!classMatch) return null;

  const name = classMatch[1];
  const methods: string[] = [];
  const deps: string[] = [];

  // Constructor injection
  const constructorMatch = file.content.match(/constructor\s*\(([^)]*)\)/);
  if (constructorMatch) {
    const params = constructorMatch[1];
    // Match: private/readonly serviceName: ServiceType
    const depRegex = /(?:private|readonly|protected)\s+(?:readonly\s+)?(\w+)\s*:\s*(\w+)/g;
    let depMatch: RegExpExecArray | null;
    while ((depMatch = depRegex.exec(params)) !== null) {
      deps.push(depMatch[2]);
    }

    // @Inject() pattern
    const injectRegex = /@Inject\([^)]*\)\s+(?:private|readonly)\s+(?:readonly\s+)?(\w+)\s*:\s*(\w+)/g;
    let injectMatch: RegExpExecArray | null;
    while ((injectMatch = injectRegex.exec(params)) !== null) {
      if (!deps.includes(injectMatch[2])) {
        deps.push(injectMatch[2]);
      }
    }
  }

  // Find public/async methods (skip constructor)
  const methodRegex = /(?:async\s+)?(\w+)\s*\([^)]*\)\s*(?::\s*(?:Promise<[^>]+>|\w+(?:<[^>]+>)?))?(?:\s*\{)/g;
  let methodMatch: RegExpExecArray | null;
  while ((methodMatch = methodRegex.exec(file.content)) !== null) {
    const methodName = methodMatch[1];
    if (methodName !== 'constructor' && !methodName.startsWith('_') && methodName !== name) {
      methods.push(methodName);
    }
  }

  return { name, filePath: file.path, methods, dependencies: deps };
}

// ── DTO Parser ──

function parseDtos(file: SourceFile): TypeInfo[] {
  const types: TypeInfo[] = [];
  // Match class declarations
  const classRegex = /(?:export\s+)?class\s+(\w+)(?:\s+extends\s+\w+(?:<[^>]+>)?)?\s*\{/g;
  let match: RegExpExecArray | null;

  while ((match = classRegex.exec(file.content)) !== null) {
    const name = match[1];
    const classStart = match.index + match[0].length;
    const classBody = extractBlock(file.content, classStart - 1);
    if (!classBody) continue;

    const fields: TypeInfo['fields'] = [];

    // Match: [@decorators] fieldName[?!]: type;
    const fieldRegex = /(?:@\w+(?:\([^)]*\))\s*)*(\w+)\s*([?!])?\s*:\s*([^;=]+)/g;
    let fieldMatch: RegExpExecArray | null;
    while ((fieldMatch = fieldRegex.exec(classBody)) !== null) {
      const fieldName = fieldMatch[1];
      const optional = fieldMatch[2] === '?';
      const type = fieldMatch[3].trim();

      // Skip method signatures
      if (type.includes('=>') || type.includes('{')) continue;
      // Skip constructor
      if (fieldName === 'constructor') continue;

      const beforeField = classBody.slice(Math.max(0, fieldMatch.index - 200), fieldMatch.index);
      const hasValidation = /@IsNotEmpty|@IsString|@IsNumber|@IsBoolean|@IsDefined/.test(beforeField);

      fields.push({
        name: fieldName,
        type: type.replace(/\s*\/\/.*$/, ''),
        required: hasValidation || !optional,
      });
    }

    if (fields.length > 0) {
      const kind = inferTypeKind(name);
      types.push({ name, kind, fields, filePath: file.path });
    }
  }

  return types;
}

// ── Enum Parser ──

function parseEnums(file: SourceFile): TypeInfo[] {
  const types: TypeInfo[] = [];
  const enumRegex = /(?:export\s+)?enum\s+(\w+)\s*\{([^}]*)\}/g;
  let match: RegExpExecArray | null;

  while ((match = enumRegex.exec(file.content)) !== null) {
    const name = match[1];
    const body = match[2];

    const constants = body
      .split(',')
      .map((c) => c.trim().split('=')[0].trim())
      .filter((c) => c && !c.startsWith('//') && !c.startsWith('/*'));

    const fields = constants.map((c) => ({
      name: c,
      type: name,
      required: true,
    }));

    types.push({ name, kind: 'enum', fields, filePath: file.path });
  }

  return types;
}

// ── Interface Parser ──

function parseInterfaces(file: SourceFile): TypeInfo[] {
  const types: TypeInfo[] = [];
  const interfaceRegex = /(?:export\s+)?interface\s+(\w+)(?:\s+extends\s+[^{]+)?\s*\{/g;
  let match: RegExpExecArray | null;

  while ((match = interfaceRegex.exec(file.content)) !== null) {
    const name = match[1];
    const blockStart = match.index + match[0].length;
    const block = extractBlock(file.content, blockStart - 1);
    if (!block) continue;

    const fields: TypeInfo['fields'] = [];
    const fieldRegex = /(\w+)\s*(\?)?:\s*([^;]+)/g;
    let fieldMatch: RegExpExecArray | null;

    while ((fieldMatch = fieldRegex.exec(block)) !== null) {
      const fieldName = fieldMatch[1];
      const optional = fieldMatch[2] === '?';
      const type = fieldMatch[3].trim();

      // Skip method signatures
      if (type.includes('=>') && !type.startsWith('(')) continue;

      fields.push({
        name: fieldName,
        type,
        required: !optional,
      });
    }

    if (fields.length > 0) {
      types.push({ name, kind: 'interface', fields, filePath: file.path });
    }
  }

  return types;
}

// ── Prisma Types Parser ──

function parsePrismaTypes(file: SourceFile): TypeInfo[] {
  // Prisma generates types; we parse the model-like type definitions
  const types: TypeInfo[] = [];
  const typeRegex = /export\s+type\s+(\w+)\s*=\s*\{([^}]+)\}/g;
  let match: RegExpExecArray | null;

  while ((match = typeRegex.exec(file.content)) !== null) {
    const name = match[1];
    if (name.includes('Payload') || name.includes('Args') || name.includes('Client')) continue;

    const body = match[2];
    const fields: TypeInfo['fields'] = [];

    const fieldRegex = /(\w+)\s*(\?)?:\s*([^;\n]+)/g;
    let fieldMatch: RegExpExecArray | null;
    while ((fieldMatch = fieldRegex.exec(body)) !== null) {
      fields.push({
        name: fieldMatch[1],
        type: fieldMatch[3].trim(),
        required: fieldMatch[2] !== '?',
      });
    }

    if (fields.length > 0) {
      types.push({ name, kind: 'dto', fields, filePath: file.path });
    }
  }

  return types;
}

// ── Shared Helpers ──

function parseTsMethodParameters(paramsStr: string): EndpointInfo['parameters'] {
  const params: EndpointInfo['parameters'] = [];
  if (!paramsStr.trim()) return params;

  const paramParts = splitParameters(paramsStr);

  for (const part of paramParts) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    // Extract decorators
    const decorators: string[] = [];
    const decoratorRegex = /@(\w+)\(/g;
    let decMatch: RegExpExecArray | null;
    while ((decMatch = decoratorRegex.exec(trimmed)) !== null) {
      decorators.push(decMatch[1]);
    }

    // Match: name[?]: type
    const paramMatch = trimmed.match(/(\w+)\s*(\?)?\s*:\s*(.+)$/);
    if (!paramMatch) continue;

    const name = paramMatch[1];
    const optional = paramMatch[2] === '?';
    const type = paramMatch[3].trim();

    const locationMap: Record<string, string> = {
      Param: 'path',
      Query: 'query',
      Body: 'body',
      Headers: 'header',
      Req: 'body',
      Args: 'body',
    };

    let location: 'path' | 'query' | 'body' | 'header' | 'cookie' | undefined;
    for (const dec of decorators) {
      if (locationMap[dec]) {
        location = locationMap[dec] as 'path' | 'query' | 'body' | 'header' | 'cookie';
        break;
      }
    }

    params.push({
      name,
      type,
      required: !optional,
      location,
    });
  }

  return params;
}

function splitParameters(paramsStr: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';

  for (const char of paramsStr) {
    if (char === '<' || char === '(' || char === '{' || char === '[') depth++;
    if (char === '>' || char === ')' || char === '}' || char === ']') depth--;
    if (char === ',' && depth === 0) {
      parts.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  if (current.trim()) parts.push(current);

  return parts;
}

function extractBlock(content: string, openBraceIndex: number): string | null {
  let depth = 0;
  let start = -1;

  for (let i = openBraceIndex; i < content.length; i++) {
    if (content[i] === '{') {
      if (depth === 0) start = i + 1;
      depth++;
    }
    if (content[i] === '}') {
      depth--;
      if (depth === 0) {
        return content.slice(start, i);
      }
    }
  }

  return null;
}

function findServiceRef(content: string): string | undefined {
  const match = content.match(/(?:private|readonly)\s+(?:readonly\s+)?\w+\s*:\s*(\w+Service)\b/);
  return match?.[1];
}

function inferTypeKind(name: string): TypeInfo['kind'] {
  const lower = name.toLowerCase();
  if (lower.includes('input') || lower.includes('request') || lower.includes('args') || lower.includes('command')) return 'input';
  if (lower.includes('response') || lower.includes('result') || lower.includes('output')) return 'response';
  return 'dto';
}

function camelToSnake(str: string): string {
  return str
    .replace(/([A-Z])/g, '_$1')
    .toLowerCase()
    .replace(/^_/, '');
}
