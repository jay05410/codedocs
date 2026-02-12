import type { ParserPlugin, SourceFile, ParseResult, EndpointInfo, EntityInfo, ServiceInfo, TypeInfo, DependencyInfo } from '@codedocs/core';

export interface JavaSpringParserOptions {
  /** Auto-detect frameworks (JPA, Hibernate, Lombok, etc.) */
  detectFrameworks?: boolean;
}

export function javaSpringParser(options: JavaSpringParserOptions = {}): ParserPlugin {
  const { detectFrameworks = true } = options;

  return {
    name: 'java-spring',
    filePattern: ['**/*.java'],

    async parse(files: SourceFile[]): Promise<ParseResult> {
      const endpoints: EndpointInfo[] = [];
      const entities: EntityInfo[] = [];
      const services: ServiceInfo[] = [];
      const types: TypeInfo[] = [];
      const dependencies: DependencyInfo[] = [];

      for (const file of files) {
        // REST Controllers
        if (isRestController(file.content)) {
          endpoints.push(...parseRestEndpoints(file));
        }

        // JPA / Hibernate Entities
        if (isEntity(file.content)) {
          const entity = parseEntity(file);
          if (entity) entities.push(entity);
        }

        // Services
        if (isService(file.content)) {
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

        // DTOs / Records / Enums
        if (detectFrameworks && isRecord(file.content)) {
          types.push(...parseRecords(file));
        }
        if (isDto(file.content)) {
          types.push(...parseDtoClasses(file));
        }
        if (isEnum(file.content)) {
          types.push(...parseEnums(file));
        }

        // Interfaces (Repository, etc.)
        if (isRepository(file.content)) {
          const repoInfo = parseRepository(file);
          if (repoInfo) {
            dependencies.push(repoInfo);
          }
        }
      }

      return { endpoints, entities, services, types, dependencies };
    },
  };
}

// ── Detection helpers ──

function isRestController(content: string): boolean {
  return /@RestController|@Controller/.test(content);
}

function isEntity(content: string): boolean {
  return /@Entity|@Document|@Table/.test(content);
}

function isService(content: string): boolean {
  return /@Service|@Component/.test(content) && !/@RestController|@Controller/.test(content);
}

function isRecord(content: string): boolean {
  return /\brecord\s+\w+\s*\(/.test(content);
}

function isDto(content: string): boolean {
  // Lombok @Data or class names ending with Dto/DTO/Request/Response
  return (/@Data|@Value|@Builder/.test(content) && /class\s+\w+/.test(content))
    || /class\s+\w+(?:Dto|DTO|Request|Response|Input|Output)\b/.test(content);
}

function isEnum(content: string): boolean {
  return /\benum\s+\w+/.test(content);
}

function isRepository(content: string): boolean {
  return /@Repository/.test(content) || /extends\s+(?:JpaRepository|CrudRepository|MongoRepository|PagingAndSortingRepository)/.test(content);
}

// ── REST Parser ──

function parseRestEndpoints(file: SourceFile): EndpointInfo[] {
  const endpoints: EndpointInfo[] = [];
  const classMatch = file.content.match(/class\s+(\w+)/);
  const className = classMatch?.[1] || 'UnknownController';

  // Base path from @RequestMapping
  const basePath = file.content.match(/@RequestMapping\(\s*(?:value\s*=\s*)?["']([^"']+)["']\s*\)/)?.[1] || '';

  // Find method mappings
  const methodPatterns = [
    { regex: /@GetMapping\(\s*(?:value\s*=\s*)?["']([^"']*?)["']\s*\)/g, method: 'GET' },
    { regex: /@PostMapping\(\s*(?:value\s*=\s*)?["']([^"']*?)["']\s*\)/g, method: 'POST' },
    { regex: /@PutMapping\(\s*(?:value\s*=\s*)?["']([^"']*?)["']\s*\)/g, method: 'PUT' },
    { regex: /@DeleteMapping\(\s*(?:value\s*=\s*)?["']([^"']*?)["']\s*\)/g, method: 'DELETE' },
    { regex: /@PatchMapping\(\s*(?:value\s*=\s*)?["']([^"']*?)["']\s*\)/g, method: 'PATCH' },
  ];

  // Also handle no-value mappings: @GetMapping without path
  const noPathPatterns = [
    { regex: /@GetMapping(?:\s*$|\s*\n)/gm, method: 'GET' },
    { regex: /@PostMapping(?:\s*$|\s*\n)/gm, method: 'POST' },
    { regex: /@PutMapping(?:\s*$|\s*\n)/gm, method: 'PUT' },
    { regex: /@DeleteMapping(?:\s*$|\s*\n)/gm, method: 'DELETE' },
    { regex: /@PatchMapping(?:\s*$|\s*\n)/gm, method: 'PATCH' },
  ];

  for (const { regex, method } of methodPatterns) {
    let match: RegExpExecArray | null;
    while ((match = regex.exec(file.content)) !== null) {
      const path = basePath + (match[1] || '');
      const afterAnnotation = file.content.slice(match.index);
      const endpoint = extractJavaEndpoint(afterAnnotation, className, method, path, file.path);
      if (endpoint) endpoints.push(endpoint);
    }
  }

  for (const { regex, method } of noPathPatterns) {
    let match: RegExpExecArray | null;
    while ((match = regex.exec(file.content)) !== null) {
      // Check it's not already caught by the path patterns
      const charAfter = file.content[match.index + match[0].trimEnd().length];
      if (charAfter === '(') continue;

      const afterAnnotation = file.content.slice(match.index);
      const endpoint = extractJavaEndpoint(afterAnnotation, className, method, basePath || '/', file.path);
      if (endpoint) endpoints.push(endpoint);
    }
  }

  return endpoints;
}

function extractJavaEndpoint(
  afterAnnotation: string,
  className: string,
  method: string,
  path: string,
  filePath: string,
): EndpointInfo | null {
  // Match Java method: [modifiers] ReturnType methodName(params)
  const methodMatch = afterAnnotation.match(
    /(?:public|protected|private)?\s*(?:static\s+)?(?:(?:ResponseEntity|CompletableFuture|Mono|Flux)<([^>]+)>|(\w+(?:<[^>]+>)?))\s+(\w+)\s*\(([^)]*)\)/,
  );
  if (!methodMatch) return null;

  const returnType = methodMatch[1] || methodMatch[2] || 'void';
  const handler = methodMatch[3];
  const paramsStr = methodMatch[4];

  const params = parseJavaMethodParameters(paramsStr);
  const serviceRef = findServiceRef(afterAnnotation);

  // Detect auth annotations
  const auth = /@PreAuthorize|@Secured|@RolesAllowed/.test(afterAnnotation.slice(0, 500));
  const deprecated = /@Deprecated/.test(afterAnnotation.slice(0, 300));

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
    filePath,
    auth,
    deprecated,
  };
}

// ── Entity Parser ──

function parseEntity(file: SourceFile): EntityInfo | null {
  const classMatch = file.content.match(/class\s+(\w+)/);
  if (!classMatch) return null;
  const name = classMatch[1];

  const tableMatch = file.content.match(/@Table\(\s*name\s*=\s*["'](\w+)["']/);
  const collectionMatch = file.content.match(/@Document\(\s*collection\s*=\s*["'](\w+)["']/);
  const tableName = tableMatch?.[1] || collectionMatch?.[1] || camelToSnake(name);

  const isMongoDb = /@Document/.test(file.content);
  const dbType = isMongoDb ? 'MongoDB' : 'MySQL';

  const columns = parseEntityColumns(file.content);
  const relations = parseEntityRelations(file.content);
  const indexes = parseEntityIndexes(file.content);

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

function parseEntityColumns(content: string): EntityInfo['columns'] {
  const columns: EntityInfo['columns'] = [];

  // Java field pattern: [annotations] [modifiers] Type fieldName [= default];
  const fieldRegex = /(?:(?:@\w+(?:\([^)]*\))?)\s*)*(?:private|protected|public)?\s+(\w+(?:<[^>]+>)?)\s+(\w+)\s*[;=]/g;
  let match: RegExpExecArray | null;

  while ((match = fieldRegex.exec(content)) !== null) {
    const type = match[1];
    const fieldName = match[2];

    // Skip collection/relation fields
    if (/List|Set|Collection|Map/.test(type) && !/@ElementCollection/.test(content.slice(Math.max(0, match.index - 200), match.index))) {
      continue;
    }

    // Skip relation fields
    const beforeField = content.slice(Math.max(0, match.index - 300), match.index);
    if (/@OneToMany|@ManyToOne|@OneToOne|@ManyToMany|@Transient/.test(beforeField)) {
      continue;
    }

    const columnAnnotation = beforeField.match(/@Column\(([^)]*)\)/);
    const idAnnotation = beforeField.includes('@Id');
    const generatedValue = beforeField.includes('@GeneratedValue');

    const dbColumnName = columnAnnotation?.[1]?.match(/name\s*=\s*["'](\w+)["']/)?.[1] || camelToSnake(fieldName);
    const nullable = columnAnnotation?.[1]?.includes('nullable = true')
      ?? (columnAnnotation?.[1]?.includes('nullable = false') ? false : !idAnnotation);

    // Skip static/final constants
    if (/static\s+final|final\s+static/.test(content.slice(Math.max(0, match.index - 50), match.index))) {
      continue;
    }

    columns.push({
      name: fieldName,
      type,
      dbColumnName,
      nullable,
      primaryKey: idAnnotation,
      unique: columnAnnotation?.[1]?.includes('unique = true') ?? (generatedValue || false),
    });
  }

  return columns;
}

function parseEntityRelations(content: string): EntityInfo['relations'] {
  const relations: EntityInfo['relations'] = [];
  const relTypes = ['OneToOne', 'OneToMany', 'ManyToOne', 'ManyToMany'] as const;

  for (const relType of relTypes) {
    // Match: @RelationType ... Type fieldName; (handles generics like List<Entity>)
    const regex = new RegExp(
      `@${relType}[^;]*?(?:private|protected|public)?\\s+(?:List|Set|Collection|MutableList)?(?:<(\\w+)>)?\\s*(\\w+)?(?:\\s+(\\w+))?\\s*[;=]`,
      'g',
    );
    let match: RegExpExecArray | null;
    while ((match = regex.exec(content)) !== null) {
      const target = match[1] || match[2] || match[3] || 'Unknown';

      // Extract joinColumn and mappedBy
      const annotationSlice = content.slice(Math.max(0, match.index - 200), match.index + match[0].length);
      const joinColumn = annotationSlice.match(/@JoinColumn\(\s*name\s*=\s*["'](\w+)["']/)?.[1];
      const mappedBy = annotationSlice.match(/mappedBy\s*=\s*["'](\w+)["']/)?.[1];
      const eager = annotationSlice.includes('FetchType.EAGER');

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

function parseEntityIndexes(content: string): string[] {
  const indexes: string[] = [];

  // @Table(indexes = { @Index(name = "idx_name", columnList = "col1, col2") })
  const indexRegex = /@Index\(\s*name\s*=\s*["']([^"']+)["']\s*,\s*columnList\s*=\s*["']([^"']+)["']\)/g;
  let match: RegExpExecArray | null;
  while ((match = indexRegex.exec(content)) !== null) {
    indexes.push(`${match[1]}: ${match[2]}`);
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
  const constructorMatch = file.content.match(/(?:public\s+)?\w+\s*\(([^)]+)\)/);
  if (constructorMatch) {
    const params = constructorMatch[1];
    const depRegex = /(?:final\s+)?(\w+(?:<[^>]+>)?)\s+\w+/g;
    let depMatch: RegExpExecArray | null;
    while ((depMatch = depRegex.exec(params)) !== null) {
      const depType = depMatch[1];
      // Skip primitive types and common non-injectable types
      if (!isPrimitive(depType)) {
        deps.push(depType);
      }
    }
  }

  // @Autowired field injection
  const autowiredRegex = /@Autowired\s+(?:private\s+)?(\w+(?:<[^>]+>)?)\s+\w+/g;
  let autowiredMatch: RegExpExecArray | null;
  while ((autowiredMatch = autowiredRegex.exec(file.content)) !== null) {
    deps.push(autowiredMatch[1]);
  }

  // Find public methods
  const methodRegex = /public\s+(?:static\s+)?(?:\w+(?:<[^>]+>)?)\s+(\w+)\s*\(/g;
  let methodMatch: RegExpExecArray | null;
  while ((methodMatch = methodRegex.exec(file.content)) !== null) {
    const methodName = methodMatch[1];
    // Skip constructor (same as class name)
    if (methodName !== name) {
      methods.push(methodName);
    }
  }

  return { name, filePath: file.path, methods, dependencies: deps };
}

// ── Record Parser (Java 14+) ──

function parseRecords(file: SourceFile): TypeInfo[] {
  const types: TypeInfo[] = [];
  const recordRegex = /\brecord\s+(\w+)\s*\(([^)]*)\)/g;
  let match: RegExpExecArray | null;

  while ((match = recordRegex.exec(file.content)) !== null) {
    const name = match[1];
    const fieldsStr = match[2];
    const fields: TypeInfo['fields'] = [];

    // Record components: Type name, Type name
    const fieldRegex = /(?:@\w+(?:\([^)]*\))\s+)*(\w+(?:<[^>]+>)?)\s+(\w+)/g;
    let fieldMatch: RegExpExecArray | null;
    while ((fieldMatch = fieldRegex.exec(fieldsStr)) !== null) {
      fields.push({
        name: fieldMatch[2],
        type: fieldMatch[1],
        required: true,
      });
    }

    const kind = inferTypeKind(name);
    types.push({ name, kind, fields, filePath: file.path });
  }

  return types;
}

// ── DTO Class Parser (Lombok @Data or naming convention) ──

function parseDtoClasses(file: SourceFile): TypeInfo[] {
  const types: TypeInfo[] = [];
  const classMatch = file.content.match(/class\s+(\w+)/);
  if (!classMatch) return types;

  const name = classMatch[1];
  const fields: TypeInfo['fields'] = [];

  // Parse Java fields: [modifiers] Type fieldName;
  const fieldRegex = /(?:private|protected|public)\s+(\w+(?:<[^>]+>)?)\s+(\w+)\s*[;=]/g;
  let match: RegExpExecArray | null;
  while ((match = fieldRegex.exec(file.content)) !== null) {
    const type = match[1];
    const fieldName = match[2];

    // Skip static fields
    const beforeField = file.content.slice(Math.max(0, match.index - 50), match.index);
    if (/static\s*$/.test(beforeField)) continue;

    const hasNotNull = file.content.slice(Math.max(0, match.index - 100), match.index)
      .includes('@NotNull') || file.content.slice(Math.max(0, match.index - 100), match.index).includes('@NonNull');

    fields.push({
      name: fieldName,
      type,
      required: hasNotNull || isPrimitive(type),
    });
  }

  const kind = inferTypeKind(name);
  types.push({ name, kind, fields, filePath: file.path });

  return types;
}

// ── Enum Parser ──

function parseEnums(file: SourceFile): TypeInfo[] {
  const types: TypeInfo[] = [];
  const enumRegex = /\benum\s+(\w+)\s*\{([^}]*)\}/g;
  let match: RegExpExecArray | null;

  while ((match = enumRegex.exec(file.content)) !== null) {
    const name = match[1];
    const body = match[2];

    // Extract enum constants (before any method/field declarations)
    const constantsPart = body.split(';')[0];
    const constants = constantsPart
      .split(',')
      .map((c) => c.trim().replace(/\(.*$/, '').trim())
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

// ── Repository Parser ──

function parseRepository(file: SourceFile): DependencyInfo | null {
  const interfaceMatch = file.content.match(/interface\s+(\w+)\s+extends\s+(?:JpaRepository|CrudRepository|MongoRepository|PagingAndSortingRepository)<(\w+)/);
  if (!interfaceMatch) return null;

  return {
    source: interfaceMatch[1],
    target: interfaceMatch[2],
    type: 'use',
  };
}

// ── Shared Helpers ──

function parseJavaMethodParameters(paramsStr: string): EndpointInfo['parameters'] {
  const params: EndpointInfo['parameters'] = [];
  if (!paramsStr.trim()) return params;

  // Split by comma but respect generics
  const paramParts = splitParameters(paramsStr);

  for (const part of paramParts) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    // Match: @Annotation [Type] name
    const paramMatch = trimmed.match(
      /(?:@(\w+)(?:\([^)]*\))?\s+)*(?:final\s+)?(\w+(?:<[^>]+>)?)\s+(\w+)/,
    );
    if (!paramMatch) continue;

    // Extract all annotations
    const annotations: string[] = [];
    const annotationRegex = /@(\w+)/g;
    let annMatch: RegExpExecArray | null;
    while ((annMatch = annotationRegex.exec(trimmed)) !== null) {
      annotations.push(annMatch[1]);
    }

    const type = paramMatch[2];
    const name = paramMatch[3];

    const locationMap: Record<string, string> = {
      PathVariable: 'path',
      RequestParam: 'query',
      RequestBody: 'body',
      RequestHeader: 'header',
      CookieValue: 'cookie',
      ModelAttribute: 'body',
    };

    let location: 'path' | 'query' | 'body' | 'header' | 'cookie' | undefined;
    for (const ann of annotations) {
      if (locationMap[ann]) {
        location = locationMap[ann] as 'path' | 'query' | 'body' | 'header' | 'cookie';
        break;
      }
    }

    // Check for required = false in annotation
    const requiredFalse = trimmed.includes('required = false') || trimmed.includes('required=false');

    params.push({
      name,
      type,
      required: !requiredFalse && !type.startsWith('Optional'),
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
    if (char === '<' || char === '(') depth++;
    if (char === '>' || char === ')') depth--;
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

function findServiceRef(content: string): string | undefined {
  const match = content.match(/(?:private\s+(?:final\s+)?)?(\w+Service)\s+\w+/);
  return match?.[1];
}

function isPrimitive(type: string): boolean {
  return ['int', 'long', 'double', 'float', 'boolean', 'byte', 'short', 'char',
    'String', 'Integer', 'Long', 'Double', 'Float', 'Boolean', 'Byte', 'Short', 'Character'].includes(type);
}

function inferTypeKind(name: string): TypeInfo['kind'] {
  const lower = name.toLowerCase();
  if (lower.includes('input') || lower.includes('request') || lower.includes('command')) return 'input';
  if (lower.includes('response') || lower.includes('result') || lower.includes('output')) return 'response';
  return 'dto';
}

function camelToSnake(str: string): string {
  return str
    .replace(/([A-Z])/g, '_$1')
    .toLowerCase()
    .replace(/^_/, '');
}
