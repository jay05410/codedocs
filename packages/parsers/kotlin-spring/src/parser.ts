import type { ParserPlugin, SourceFile, ParseResult, EndpointInfo, EntityInfo, ServiceInfo, TypeInfo, DependencyInfo } from '@codedocs/core';

export interface KotlinSpringParserOptions {
  /** Auto-detect frameworks (DGS GraphQL, JPA, etc.) */
  detectFrameworks?: boolean;
}

export function kotlinSpringParser(options: KotlinSpringParserOptions = {}): ParserPlugin {
  const { detectFrameworks = true } = options;

  return {
    name: 'kotlin-spring',
    filePattern: ['**/*.kt', '**/*.kts'],

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

        // DGS GraphQL Fetchers
        if (detectFrameworks && isDgsFetcher(file.content)) {
          endpoints.push(...parseDgsOperations(file));
        }

        // JPA / MongoDB Entities
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

        // Data classes (DTOs, Inputs, Filters)
        if (isDataClass(file.content)) {
          types.push(...parseDataClasses(file));
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

function isDgsFetcher(content: string): boolean {
  return /@DgsComponent|@DgsQuery|@DgsMutation|@DgsSubscription/.test(content);
}

function isEntity(content: string): boolean {
  return /@Entity|@Document|@Table/.test(content);
}

function isService(content: string): boolean {
  return /@Service|@Component/.test(content) && !/@RestController|@Controller|@DgsComponent/.test(content);
}

function isDataClass(content: string): boolean {
  return /^data class /m.test(content);
}

// ── REST Parser ──

function parseRestEndpoints(file: SourceFile): EndpointInfo[] {
  const endpoints: EndpointInfo[] = [];
  const classMatch = file.content.match(/class\s+(\w+)/);
  const className = classMatch?.[1] || 'UnknownController';

  // Base path from @RequestMapping
  const basePath = file.content.match(/@RequestMapping\(["']([^"']+)["']\)/)?.[1] || '';

  // Find method mappings
  const methodPatterns = [
    { regex: /@GetMapping\(["']([^"']*?)["']\)/g, method: 'GET' },
    { regex: /@PostMapping\(["']([^"']*?)["']\)/g, method: 'POST' },
    { regex: /@PutMapping\(["']([^"']*?)["']\)/g, method: 'PUT' },
    { regex: /@DeleteMapping\(["']([^"']*?)["']\)/g, method: 'DELETE' },
    { regex: /@PatchMapping\(["']([^"']*?)["']\)/g, method: 'PATCH' },
  ];

  for (const { regex, method } of methodPatterns) {
    let match: RegExpExecArray | null;
    while ((match = regex.exec(file.content)) !== null) {
      const path = basePath + (match[1] || '');
      // Find the function name after the annotation
      const afterAnnotation = file.content.slice(match.index);
      const funMatch = afterAnnotation.match(/fun\s+(\w+)/);
      const handler = funMatch?.[1] || 'unknown';

      // Find return type
      const returnMatch = afterAnnotation.match(/fun\s+\w+\([^)]*\)\s*:\s*([^\s{]+)/);
      const returnType = returnMatch?.[1] || 'Unit';

      // Find parameters
      const params = parseMethodParameters(afterAnnotation);

      // Find service reference
      const serviceRef = findServiceRef(file.content);

      endpoints.push({
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
      });
    }
  }

  return endpoints;
}

// ── DGS GraphQL Parser ──

function parseDgsOperations(file: SourceFile): EndpointInfo[] {
  const endpoints: EndpointInfo[] = [];
  const classMatch = file.content.match(/class\s+(\w+)/);
  const className = classMatch?.[1] || 'UnknownFetcher';

  const opPatterns = [
    { regex: /@DgsQuery/g, type: 'Query' as const },
    { regex: /@DgsMutation/g, type: 'Mutation' as const },
    { regex: /@DgsSubscription/g, type: 'Subscription' as const },
  ];

  for (const { regex, type } of opPatterns) {
    let match: RegExpExecArray | null;
    while ((match = regex.exec(file.content)) !== null) {
      const afterAnnotation = file.content.slice(match.index);
      const funMatch = afterAnnotation.match(/fun\s+(\w+)/);
      const fieldName = funMatch?.[1] || 'unknown';

      const returnMatch = afterAnnotation.match(/fun\s+\w+\([^)]*\)\s*:\s*([^\s{]+)/);
      const returnType = returnMatch?.[1] || 'Any';

      const params = parseMethodParameters(afterAnnotation);
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

// ── Entity Parser ──

function parseEntity(file: SourceFile): EntityInfo | null {
  const classMatch = file.content.match(/class\s+(\w+)/);
  if (!classMatch) return null;
  const name = classMatch[1];

  const tableMatch = file.content.match(/@Table\(name\s*=\s*["'](\w+)["']\)/);
  const collectionMatch = file.content.match(/@Document\(collection\s*=\s*["'](\w+)["']\)/);
  const tableName = tableMatch?.[1] || collectionMatch?.[1] || name.toLowerCase();

  const isMongoDb = /@Document/.test(file.content);
  const dbType = isMongoDb ? 'MongoDB' : 'MySQL';

  // Parse columns (var/val fields)
  const columns = parseEntityColumns(file.content);

  // Parse relations
  const relations = parseEntityRelations(file.content);

  // Parse indexes
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
  const fieldRegex = /(?:val|var)\s+(\w+)\s*:\s*([^=\n,)]+)/g;
  let match: RegExpExecArray | null;

  while ((match = fieldRegex.exec(content)) !== null) {
    const fieldName = match[1];
    const type = match[2].trim();

    // Skip relation fields
    if (/@OneToMany|@ManyToOne|@OneToOne|@ManyToMany/.test(content.slice(Math.max(0, match.index - 200), match.index))) {
      continue;
    }

    const beforeField = content.slice(Math.max(0, match.index - 300), match.index);
    const columnAnnotation = beforeField.match(/@Column\(([^)]*)\)/);
    const idAnnotation = beforeField.includes('@Id');

    const dbColumnName = columnAnnotation?.[1]?.match(/name\s*=\s*["'](\w+)["']/)?.[1] || fieldName;
    const nullable = type.endsWith('?') || (columnAnnotation?.[1]?.includes('nullable = true') ?? false);

    columns.push({
      name: fieldName,
      type: type.replace('?', ''),
      dbColumnName,
      nullable,
      primaryKey: idAnnotation,
      unique: columnAnnotation?.[1]?.includes('unique = true') ?? false,
    });
  }

  return columns;
}

function parseEntityRelations(content: string): EntityInfo['relations'] {
  const relations: EntityInfo['relations'] = [];
  const relTypes = ['OneToOne', 'OneToMany', 'ManyToOne', 'ManyToMany'] as const;

  for (const relType of relTypes) {
    const regex = new RegExp(`@${relType}[^)]*\\)\\s*(?:val|var)\\s+\\w+\\s*:\\s*(?:List<|Set<|MutableList<)?(\\w+)`, 'g');
    let match: RegExpExecArray | null;
    while ((match = regex.exec(content)) !== null) {
      relations.push({
        type: relType,
        target: match[1],
      });
    }
  }

  return relations;
}

function parseEntityIndexes(content: string): string[] {
  const indexes: string[] = [];
  const indexRegex = /@Index\(name\s*=\s*["']([^"']+)["']\s*,\s*columnList\s*=\s*["']([^"']+)["']\)/g;
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

  // Find injected dependencies (constructor parameters)
  const constructorMatch = file.content.match(/class\s+\w+\s*\(([^)]*)\)/);
  if (constructorMatch) {
    const params = constructorMatch[1];
    const depRegex = /(?:private\s+)?(?:val|var)\s+\w+\s*:\s*(\w+)/g;
    let depMatch: RegExpExecArray | null;
    while ((depMatch = depRegex.exec(params)) !== null) {
      deps.push(depMatch[1]);
    }
  }

  // Find public functions
  const funRegex = /fun\s+(\w+)\s*\(/g;
  let funMatch: RegExpExecArray | null;
  while ((funMatch = funRegex.exec(file.content)) !== null) {
    methods.push(funMatch[1]);
  }

  return { name, filePath: file.path, methods, dependencies: deps };
}

// ── Data Class Parser ──

function parseDataClasses(file: SourceFile): TypeInfo[] {
  const types: TypeInfo[] = [];
  const classRegex = /data class\s+(\w+)\s*\(([^)]*)\)/g;
  let match: RegExpExecArray | null;

  while ((match = classRegex.exec(file.content)) !== null) {
    const name = match[1];
    const fieldsStr = match[2];
    const fields: TypeInfo['fields'] = [];

    const fieldRegex = /(?:val|var)\s+(\w+)\s*:\s*([^,=]+?)(?:\s*=\s*[^,]+)?(?:,|$)/g;
    let fieldMatch: RegExpExecArray | null;
    while ((fieldMatch = fieldRegex.exec(fieldsStr)) !== null) {
      const fieldType = fieldMatch[2].trim();
      fields.push({
        name: fieldMatch[1],
        type: fieldType.replace('?', ''),
        required: !fieldType.endsWith('?'),
      });
    }

    const kind = name.toLowerCase().includes('input') ? 'input'
      : name.toLowerCase().includes('response') || name.toLowerCase().includes('dto') ? 'response'
      : 'dto';

    types.push({ name, kind, fields, filePath: file.path });
  }

  return types;
}

// ── Shared Helpers ──

function parseMethodParameters(codeAfterAnnotation: string): EndpointInfo['parameters'] {
  const params: EndpointInfo['parameters'] = [];
  const funMatch = codeAfterAnnotation.match(/fun\s+\w+\(([^)]*)\)/);
  if (!funMatch) return params;

  const paramsStr = funMatch[1];
  const paramRegex = /(?:@(\w+)(?:\([^)]*\))?\s+)?(\w+)\s*:\s*([^,=]+)/g;
  let match: RegExpExecArray | null;

  while ((match = paramRegex.exec(paramsStr)) !== null) {
    const annotation = match[1];
    const name = match[2];
    const type = match[3].trim();

    const locationMap: Record<string, string> = {
      PathVariable: 'path',
      RequestParam: 'query',
      RequestBody: 'body',
      RequestHeader: 'header',
      CookieValue: 'cookie',
      InputArgument: 'body',
    };

    params.push({
      name,
      type: type.replace('?', ''),
      required: !type.endsWith('?'),
      location: (annotation && locationMap[annotation] as 'path' | 'query' | 'body' | 'header' | 'cookie') || undefined,
    });
  }

  return params;
}

function findServiceRef(content: string): string | undefined {
  // Look for injected service in constructor
  const match = content.match(/(?:private\s+)?(?:val|var)\s+\w+\s*:\s*(\w+Service)\b/);
  return match?.[1];
}
