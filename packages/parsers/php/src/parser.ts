import type { ParserPlugin, SourceFile, ParseResult, EndpointInfo, EntityInfo, ServiceInfo, TypeInfo, DependencyInfo, ParameterInfo, ColumnInfo, RelationInfo } from '@codedocs/core';

export interface PhpParserOptions {
  /** Auto-detect frameworks (Laravel, Symfony, Slim, CodeIgniter, etc.) */
  detectFrameworks?: boolean;
}

export function phpParser(options: PhpParserOptions = {}): ParserPlugin {
  const { detectFrameworks = true } = options;

  return {
    name: 'php',
    filePattern: ['**/*.php'],

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

        // Eloquent models
        if (detectFrameworks && isEloquentModel(file.content)) {
          const entity = parseEloquentModel(file);
          if (entity) entities.push(entity);
        }

        // Doctrine entities
        if (detectFrameworks && isDoctrineEntity(file.content)) {
          const entity = parseDoctrineEntity(file);
          if (entity) entities.push(entity);
        }

        // Classes (DTOs, request/response types)
        if (hasClasses(file.content)) {
          const parsedTypes = parseClasses(file);
          types.push(...parsedTypes);

          // Extract service classes
          for (const type of parsedTypes) {
            if (isServiceClass(type, file.content)) {
              const svc = classToService(type, file);
              services.push(svc);
              for (const dep of svc.dependencies) {
                dependencies.push({
                  source: svc.name,
                  target: dep,
                  type: 'use',
                });
              }
            }
          }
        }

        // Interfaces
        if (hasInterfaces(file.content)) {
          types.push(...parseInterfaces(file));
        }

        // Enums (PHP 8.1+)
        if (hasEnums(file.content)) {
          types.push(...parseEnums(file));
        }
      }

      return { endpoints, entities, services, types, dependencies };
    },
  };
}

// ── Framework Detection ──

type PhpFramework = 'laravel' | 'symfony' | 'slim' | 'codeigniter' | 'unknown';

function detectFramework(files: SourceFile[]): PhpFramework {
  for (const file of files) {
    if (file.content.includes('Illuminate\\') || file.content.includes('Laravel\\')) return 'laravel';
    if (file.content.includes('Symfony\\') || file.content.includes('@Route')) return 'symfony';
    if (file.content.includes('Slim\\App') || file.content.includes('Slim\\Factory')) return 'slim';
    if (file.content.includes('CodeIgniter\\') || file.content.includes('CI_Controller')) return 'codeigniter';
  }
  return 'unknown';
}

// ── Route Detection ──

function hasRoutes(content: string, framework: PhpFramework): boolean {
  switch (framework) {
    case 'laravel':
      return /Route::(get|post|put|delete|patch|options|any)\s*\(/i.test(content);
    case 'symfony':
      return /@Route\s*\(/.test(content) || /\$routes->add\s*\(/.test(content);
    case 'slim':
      return /\$(app|router)->(get|post|put|delete|patch|options|any)\s*\(/i.test(content);
    case 'codeigniter':
      return /\$routes->(get|post|put|delete|patch|options|add)\s*\(/i.test(content);
    default:
      return /Route::|@Route|\$app->(get|post|put|delete)|\$routes->/i.test(content);
  }
}

function parseRoutes(file: SourceFile, framework: PhpFramework): EndpointInfo[] {
  switch (framework) {
    case 'laravel': return parseLaravelRoutes(file);
    case 'symfony': return parseSymfonyRoutes(file);
    case 'slim': return parseSlimRoutes(file);
    case 'codeigniter': return parseCodeIgniterRoutes(file);
    default: return parseGenericRoutes(file);
  }
}

// ── Laravel Routes ──

function parseLaravelRoutes(file: SourceFile): EndpointInfo[] {
  const endpoints: EndpointInfo[] = [];
  const lines = file.content.split('\n');

  // Detect route group prefixes
  const groupPrefixes = extractLaravelGroupPrefixes(file.content);

  // Match: Route::get('/path', [Controller::class, 'method']) or Route::post('/path', 'Controller@method')
  const routeRe = /Route::(get|post|put|delete|patch|options|any)\s*\(\s*['"]([^'"]*)['"]\s*,\s*(?:\[([^\]]+)\]|['"]([^'"]*)['"]\s*)/gi;
  let match: RegExpExecArray | null;

  while ((match = routeRe.exec(file.content)) !== null) {
    const [, method, path, arrayHandler, stringHandler] = match;
    const lineNum = getLineNumber(file.content, match.index);
    const comment = extractComment(lines, lineNum);

    let handler = 'anonymous';
    let handlerClass = '';

    if (arrayHandler) {
      // [Controller::class, 'method'] format
      const classMatch = arrayHandler.match(/(\w+)::class/);
      const methodMatch = arrayHandler.match(/['"]([\w]+)['"]/);
      if (classMatch && methodMatch) {
        handlerClass = classMatch[1];
        handler = methodMatch[1];
      }
    } else if (stringHandler) {
      // 'Controller@method' format
      const parts = stringHandler.split('@');
      if (parts.length === 2) {
        handlerClass = parts[0].replace(/['"]/g, '');
        handler = parts[1].replace(/['"]/g, '');
      } else {
        handler = stringHandler;
      }
    }

    const fullPath = resolveGroupPath(groupPrefixes, path);

    // Check for route name
    const nameMatch = file.content.slice(match.index, match.index + 200).match(/->name\s*\(\s*['"]([^'"]+)['"]\s*\)/);
    const routeName = nameMatch ? nameMatch[1] : undefined;

    // Check for middleware
    const middlewareMatch = file.content.slice(match.index, match.index + 200).match(/->middleware\s*\(\s*['"]([^'"]+)['"]\s*\)/);
    const middleware = middlewareMatch ? middlewareMatch[1].split(',').map(m => m.trim()) : undefined;

    endpoints.push({
      protocol: 'rest',
      httpMethod: method.toUpperCase() === 'ANY' ? 'ANY' : method.toUpperCase(),
      path: fullPath,
      name: routeName || `${handler}`,
      handler,
      handlerClass: handlerClass || extractNamespace(file.content),
      parameters: extractLaravelParams(fullPath, file.content, handler),
      returnType: 'Illuminate\\Http\\Response',
      filePath: file.path,
      description: comment,
      tags: middleware || [extractNamespace(file.content)],
    });
  }

  // Resource routes: Route::resource('photos', PhotoController::class)
  const resourceRe = /Route::resource\s*\(\s*['"]([^'"]*)['"]\s*,\s*([^\)]+)\)/gi;
  let resourceMatch: RegExpExecArray | null;

  while ((resourceMatch = resourceRe.exec(file.content)) !== null) {
    const [, resourcePath, controllerRef] = resourceMatch;
    const controllerMatch = controllerRef.match(/(\w+)::class/);
    const controller = controllerMatch ? controllerMatch[1] : resourcePath;

    // Generate standard RESTful endpoints
    const resourceEndpoints = [
      { method: 'GET', path: `/${resourcePath}`, handler: 'index' },
      { method: 'GET', path: `/${resourcePath}/create`, handler: 'create' },
      { method: 'POST', path: `/${resourcePath}`, handler: 'store' },
      { method: 'GET', path: `/${resourcePath}/{id}`, handler: 'show' },
      { method: 'GET', path: `/${resourcePath}/{id}/edit`, handler: 'edit' },
      { method: 'PUT', path: `/${resourcePath}/{id}`, handler: 'update' },
      { method: 'DELETE', path: `/${resourcePath}/{id}`, handler: 'destroy' },
    ];

    for (const endpoint of resourceEndpoints) {
      endpoints.push({
        protocol: 'rest',
        httpMethod: endpoint.method,
        path: endpoint.path,
        name: `${controller}.${endpoint.handler}`,
        handler: endpoint.handler,
        handlerClass: controller,
        parameters: extractPathParams(endpoint.path),
        returnType: 'Illuminate\\Http\\Response',
        filePath: file.path,
        description: `RESTful ${endpoint.handler} action`,
        tags: [controller],
      });
    }
  }

  return endpoints;
}

// ── Symfony Routes ──

function parseSymfonyRoutes(file: SourceFile): EndpointInfo[] {
  const endpoints: EndpointInfo[] = [];
  const lines = file.content.split('\n');

  // Match @Route annotations: @Route("/path", methods={"GET", "POST"})
  const routeRe = /@Route\s*\(\s*['"]([^'"]*)['"]\s*(?:,\s*(?:name\s*=\s*['"]([^'"]*)['"]\s*)?(?:,\s*)?methods\s*=\s*\{([^\}]+)\})?\s*\)/gi;
  let match: RegExpExecArray | null;

  while ((match = routeRe.exec(file.content)) !== null) {
    const [, path, name, methodsStr] = match;
    const lineNum = getLineNumber(file.content, match.index);
    const comment = extractComment(lines, lineNum);

    // Parse methods
    const methods = methodsStr
      ? methodsStr.split(',').map(m => m.replace(/['"]/g, '').trim())
      : ['GET'];

    // Find the method this annotation belongs to
    const methodMatch = file.content.slice(match.index).match(/public\s+function\s+(\w+)\s*\(/);
    const handler = methodMatch ? methodMatch[1] : 'anonymous';

    // Find the class this belongs to
    const classMatch = file.content.match(/class\s+(\w+)/);
    const handlerClass = classMatch ? classMatch[1] : '';

    for (const method of methods) {
      endpoints.push({
        protocol: 'rest',
        httpMethod: method.toUpperCase(),
        path,
        name: name || handler,
        handler,
        handlerClass,
        parameters: extractSymfonyParams(path, file.content, handler),
        returnType: 'Symfony\\Component\\HttpFoundation\\Response',
        filePath: file.path,
        description: comment,
        tags: [handlerClass],
      });
    }
  }

  // PHP 8 Attribute syntax: #[Route('/path', methods: ['GET'])]
  const attrRouteRe = /#\[Route\s*\(\s*['"]([^'"]*)['"]\s*(?:,\s*(?:name:\s*['"]([^'"]*)['"]\s*)?(?:,\s*)?methods:\s*\[([^\]]+)\])?\s*\)\]/gi;
  let attrMatch: RegExpExecArray | null;

  while ((attrMatch = attrRouteRe.exec(file.content)) !== null) {
    const [, path, name, methodsStr] = attrMatch;
    const lineNum = getLineNumber(file.content, attrMatch.index);
    const comment = extractComment(lines, lineNum);

    const methods = methodsStr
      ? methodsStr.split(',').map(m => m.replace(/['"]/g, '').trim())
      : ['GET'];

    const methodMatch = file.content.slice(attrMatch.index).match(/public\s+function\s+(\w+)\s*\(/);
    const handler = methodMatch ? methodMatch[1] : 'anonymous';

    const classMatch = file.content.match(/class\s+(\w+)/);
    const handlerClass = classMatch ? classMatch[1] : '';

    for (const method of methods) {
      endpoints.push({
        protocol: 'rest',
        httpMethod: method.toUpperCase(),
        path,
        name: name || handler,
        handler,
        handlerClass,
        parameters: extractSymfonyParams(path, file.content, handler),
        returnType: 'Symfony\\Component\\HttpFoundation\\Response',
        filePath: file.path,
        description: comment,
        tags: [handlerClass],
      });
    }
  }

  return endpoints;
}

// ── Slim Routes ──

function parseSlimRoutes(file: SourceFile): EndpointInfo[] {
  const endpoints: EndpointInfo[] = [];
  const lines = file.content.split('\n');

  // Match: $app->get('/path', function() {...}) or $app->post('/path', [Controller::class, 'method'])
  const routeRe = /\$(app|router)->(get|post|put|delete|patch|options|any)\s*\(\s*['"]([^'"]*)['"]\s*,\s*(?:function|(\[[\s\S]*?\])|['"]([^'"]*)['"]\s*)/gi;
  let match: RegExpExecArray | null;

  while ((match = routeRe.exec(file.content)) !== null) {
    const [, , method, path, arrayHandler, stringHandler] = match;
    const lineNum = getLineNumber(file.content, match.index);
    const comment = extractComment(lines, lineNum);

    let handler = 'anonymous';
    let handlerClass = '';

    if (arrayHandler) {
      const classMatch = arrayHandler.match(/(\w+)::class/);
      const methodMatch = arrayHandler.match(/['"]([\w]+)['"]/);
      if (classMatch && methodMatch) {
        handlerClass = classMatch[1];
        handler = methodMatch[1];
      }
    } else if (stringHandler) {
      handler = stringHandler;
    }

    endpoints.push({
      protocol: 'rest',
      httpMethod: method.toUpperCase() === 'ANY' ? 'ANY' : method.toUpperCase(),
      path,
      name: handler,
      handler,
      handlerClass: handlerClass || 'SlimApp',
      parameters: extractPathParams(path),
      returnType: 'Psr\\Http\\Message\\ResponseInterface',
      filePath: file.path,
      description: comment,
      tags: ['slim'],
    });
  }

  return endpoints;
}

// ── CodeIgniter Routes ──

function parseCodeIgniterRoutes(file: SourceFile): EndpointInfo[] {
  const endpoints: EndpointInfo[] = [];
  const lines = file.content.split('\n');

  // Match: $routes->get('path', 'Controller::method')
  const routeRe = /\$routes->(get|post|put|delete|patch|options|add)\s*\(\s*['"]([^'"]*)['"]\s*,\s*['"]([^'"]*)['"]\s*(?:,\s*\[(?:[^\]]+)\])?\)/gi;
  let match: RegExpExecArray | null;

  while ((match = routeRe.exec(file.content)) !== null) {
    const [, method, path, handler] = match;
    const lineNum = getLineNumber(file.content, match.index);
    const comment = extractComment(lines, lineNum);

    let handlerClass = '';
    let handlerMethod = handler;

    if (handler.includes('::')) {
      const parts = handler.split('::');
      handlerClass = parts[0];
      handlerMethod = parts[1];
    }

    endpoints.push({
      protocol: 'rest',
      httpMethod: method.toUpperCase() === 'ADD' ? 'ANY' : method.toUpperCase(),
      path: '/' + path,
      name: handler,
      handler: handlerMethod,
      handlerClass,
      parameters: extractPathParams(path),
      returnType: 'CodeIgniter\\HTTP\\Response',
      filePath: file.path,
      description: comment,
      tags: [handlerClass],
    });
  }

  return endpoints;
}

// ── Generic Route fallback ──

function parseGenericRoutes(file: SourceFile): EndpointInfo[] {
  const endpoints: EndpointInfo[] = [];
  const lines = file.content.split('\n');

  // Generic pattern matching
  const routeRe = /(?:Route::|@Route|\$(?:app|routes)->)(get|post|put|delete|patch)\s*\(\s*['"]([^'"]*)['"]/gi;
  let match: RegExpExecArray | null;

  while ((match = routeRe.exec(file.content)) !== null) {
    const [, method, path] = match;
    const lineNum = getLineNumber(file.content, match.index);
    const comment = extractComment(lines, lineNum);

    endpoints.push({
      protocol: 'rest',
      httpMethod: method.toUpperCase(),
      path,
      name: `${method.toUpperCase()} ${path}`,
      handler: 'unknown',
      handlerClass: extractNamespace(file.content),
      parameters: extractPathParams(path),
      returnType: 'unknown',
      filePath: file.path,
      description: comment,
      tags: ['php'],
    });
  }

  return endpoints;
}

// ── Eloquent Model Parsing ──

function isEloquentModel(content: string): boolean {
  return /extends\s+Model|use\s+HasFactory|Illuminate\\Database\\Eloquent/.test(content);
}

function parseEloquentModel(file: SourceFile): EntityInfo | null {
  const lines = file.content.split('\n');

  // Match: class ModelName extends Model
  const classRe = /class\s+(\w+)\s+extends\s+Model/;
  const match = file.content.match(classRe);
  if (!match) return null;

  const className = match[1];
  const columns: ColumnInfo[] = [];
  const relations: RelationInfo[] = [];
  const indexes: string[] = [];

  // Extract table name
  const tableMatch = file.content.match(/protected\s+\$table\s*=\s*['"]([^'"]+)['"]/);
  const tableName = tableMatch ? tableMatch[1] : toSnakeCase(className) + 's';

  // Extract fillable fields
  const fillableMatch = file.content.match(/protected\s+\$fillable\s*=\s*\[([\s\S]*?)\]/);
  const fillableFields: string[] = [];
  if (fillableMatch) {
    const fillableContent = fillableMatch[1];
    const fieldMatches = fillableContent.matchAll(/['"](\w+)['"]/g);
    for (const fm of fieldMatches) {
      fillableFields.push(fm[1]);
    }
  }

  // Extract casts
  const castsMatch = file.content.match(/protected\s+\$casts\s*=\s*\[([\s\S]*?)\]/);
  const casts = new Map<string, string>();
  if (castsMatch) {
    const castsContent = castsMatch[1];
    const castMatches = castsContent.matchAll(/['"](\w+)['"]\s*=>\s*['"](\w+)['"]/g);
    for (const cm of castMatches) {
      casts.set(cm[1], cm[2]);
    }
  }

  // Extract hidden fields
  const hiddenMatch = file.content.match(/protected\s+\$hidden\s*=\s*\[([\s\S]*?)\]/);
  const hiddenFields: string[] = [];
  if (hiddenMatch) {
    const hiddenContent = hiddenMatch[1];
    const fieldMatches = hiddenContent.matchAll(/['"](\w+)['"]/g);
    for (const fm of fieldMatches) {
      hiddenFields.push(fm[1]);
    }
  }

  // Default timestamps (id, created_at, updated_at)
  const hasTimestamps = !/public\s+\$timestamps\s*=\s*false/.test(file.content);

  columns.push({
    name: 'id',
    type: 'bigint',
    dbColumnName: 'id',
    nullable: false,
    primaryKey: true,
    unique: true,
  });

  if (hasTimestamps) {
    columns.push(
      {
        name: 'created_at',
        type: 'timestamp',
        dbColumnName: 'created_at',
        nullable: true,
        primaryKey: false,
        unique: false,
      },
      {
        name: 'updated_at',
        type: 'timestamp',
        dbColumnName: 'updated_at',
        nullable: true,
        primaryKey: false,
        unique: false,
      },
    );
  }

  // Add fillable fields as columns
  for (const field of fillableFields) {
    const phpType = casts.get(field) || 'string';
    const dbType = phpTypeToDatabaseType(phpType);

    columns.push({
      name: field,
      type: dbType,
      dbColumnName: toSnakeCase(field),
      nullable: true,
      primaryKey: false,
      unique: false,
    });
  }

  // Parse relationships
  const relationPatterns = [
    { method: 'hasOne', type: 'OneToOne' as const },
    { method: 'hasMany', type: 'OneToMany' as const },
    { method: 'belongsTo', type: 'ManyToOne' as const },
    { method: 'belongsToMany', type: 'ManyToMany' as const },
    { method: 'hasOneThrough', type: 'OneToOne' as const },
    { method: 'hasManyThrough', type: 'OneToMany' as const },
    { method: 'morphTo', type: 'ManyToOne' as const },
    { method: 'morphOne', type: 'OneToOne' as const },
    { method: 'morphMany', type: 'OneToMany' as const },
  ];

  for (const pattern of relationPatterns) {
    const relRe = new RegExp(`function\\s+(\\w+)\\s*\\(\\)\\s*(?::\\s*\\w+\\s*)?\\{[^}]*return\\s+\\$this->${pattern.method}\\s*\\(\\s*(\\w+)::class`, 'g');
    let relMatch: RegExpExecArray | null;

    while ((relMatch = relRe.exec(file.content)) !== null) {
      const [, relationName, targetClass] = relMatch;

      // Extract foreign key if specified
      const fullMatch = file.content.slice(relMatch.index, relMatch.index + 300);
      const fkMatch = fullMatch.match(/,\s*['"](\w+)['"]\s*[,)]/);
      const foreignKey = fkMatch ? fkMatch[1] : undefined;

      relations.push({
        type: pattern.type,
        target: targetClass,
        joinColumn: foreignKey,
      });
    }
  }

  // Extract scopes as indexes (common pattern)
  const scopeRe = /function\s+scope(\w+)\s*\(/g;
  let scopeMatch: RegExpExecArray | null;
  while ((scopeMatch = scopeRe.exec(file.content)) !== null) {
    indexes.push(scopeMatch[1]);
  }

  const lineNum = getLineNumber(file.content, match.index ?? 0);

  return {
    name: className,
    tableName,
    dbType: 'mysql',
    columns,
    relations,
    indexes,
    filePath: file.path,
    description: extractComment(lines, lineNum),
  };
}

// ── Doctrine Entity Parsing ──

function isDoctrineEntity(content: string): boolean {
  return /@Entity|@Table|@ORM\\Entity|#\[ORM\\Entity\]/.test(content);
}

function parseDoctrineEntity(file: SourceFile): EntityInfo | null {
  const lines = file.content.split('\n');

  // Match: @Entity or #[ORM\Entity]
  const entityMatch = file.content.match(/@Entity|#\[ORM\\Entity\]/);
  if (!entityMatch) return null;

  // Find class name
  const classMatch = file.content.match(/class\s+(\w+)/);
  if (!classMatch) return null;

  const className = classMatch[1];
  const columns: ColumnInfo[] = [];
  const relations: RelationInfo[] = [];
  const indexes: string[] = [];

  // Extract table name from @Table or #[ORM\Table]
  const tableMatch = file.content.match(/@Table\s*\(\s*name\s*=\s*["']([^"']+)["']/i) ||
                      file.content.match(/#\[ORM\\Table\s*\(\s*name:\s*["']([^"']+)["']/i);
  const tableName = tableMatch ? tableMatch[1] : toSnakeCase(className);

  // Parse columns with @Column or #[ORM\Column]
  const columnRe = /(?:@Column|#\[ORM\\Column)\s*\([^)]*type\s*[=:]\s*["'](\w+)["'][^)]*\)[\s\S]*?(?:private|protected|public)\s+(?:\?)?(\$?\w+)\s+\$(\w+)/g;
  let colMatch: RegExpExecArray | null;

  while ((colMatch = columnRe.exec(file.content)) !== null) {
    const [fullMatch, dbType, phpType, fieldName] = colMatch;

    const checkStart = Math.max(0, colMatch.index - 100);
    const isPrimary = /@Id|#\[ORM\\Id\]/.test(file.content.slice(checkStart, colMatch.index));
    const isNullable = fullMatch.includes('nullable') && (fullMatch.includes('nullable=true') || fullMatch.includes('nullable: true'));
    const isUnique = fullMatch.includes('unique') && (fullMatch.includes('unique=true') || fullMatch.includes('unique: true'));

    const columnNameMatch = fullMatch.match(/name\s*[=:]\s*["'](\w+)["']/);
    const columnName = columnNameMatch ? columnNameMatch[1] : toSnakeCase(fieldName);

    columns.push({
      name: fieldName,
      type: dbType,
      dbColumnName: columnName,
      nullable: isNullable || phpType?.startsWith('?'),
      primaryKey: isPrimary,
      unique: isUnique,
    });
  }

  // Parse relationships
  const relationPatterns = [
    { annotation: 'OneToOne', type: 'OneToOne' as const },
    { annotation: 'OneToMany', type: 'OneToMany' as const },
    { annotation: 'ManyToOne', type: 'ManyToOne' as const },
    { annotation: 'ManyToMany', type: 'ManyToMany' as const },
  ];

  for (const pattern of relationPatterns) {
    const relRe = new RegExp(`@${pattern.annotation}\\s*\\([^)]*targetEntity\\s*=\\s*["']?(\\w+)["']?[^)]*\\)[\\s\\S]*?(?:private|protected|public)\\s+(?:\\?)?\\$?(\\w+)\\s+\\$(\\w+)`, 'g');
    const attrRelRe = new RegExp(`#\\[ORM\\\\${pattern.annotation}\\s*\\([^)]*targetEntity:\\s*["']?(\\w+)["']?[^)]*\\)[\\s\\S]*?(?:private|protected|public)\\s+(?:\\?)?\\$?(\\w+)\\s+\\$(\\w+)`, 'g');

    let relMatch: RegExpExecArray | null;

    while ((relMatch = relRe.exec(file.content)) !== null) {
      const [fullMatch, targetEntity, , fieldName] = relMatch;

      const joinColMatch = fullMatch.match(/JoinColumn\s*\([^)]*name\s*[=:]\s*["'](\w+)["']/i);
      const joinColumn = joinColMatch ? joinColMatch[1] : undefined;

      relations.push({
        type: pattern.type,
        target: targetEntity,
        joinColumn,
      });
    }

    while ((relMatch = attrRelRe.exec(file.content)) !== null) {
      const [fullMatch, targetEntity, , fieldName] = relMatch;

      const joinColMatch = fullMatch.match(/JoinColumn\s*\([^)]*name:\s*["'](\w+)["']/i);
      const joinColumn = joinColMatch ? joinColMatch[1] : undefined;

      relations.push({
        type: pattern.type,
        target: targetEntity,
        joinColumn,
      });
    }
  }

  // Extract indexes from @Index or #[ORM\Index]
  const indexRe = /@Index|#\[ORM\\Index\]/g;
  let indexMatch: RegExpExecArray | null;
  while ((indexMatch = indexRe.exec(file.content)) !== null) {
    indexes.push('composite_index');
  }

  const lineNum = getLineNumber(file.content, entityMatch.index ?? 0);

  return {
    name: className,
    tableName,
    dbType: 'postgresql',
    columns,
    relations,
    indexes,
    filePath: file.path,
    description: extractComment(lines, lineNum),
  };
}

// ── Class Parsing (DTOs, Services) ──

function hasClasses(content: string): boolean {
  return /class\s+\w+/.test(content);
}

function parseClasses(file: SourceFile): TypeInfo[] {
  const types: TypeInfo[] = [];
  const lines = file.content.split('\n');

  const classRe = /class\s+(\w+)(?:\s+extends\s+(\w+))?(?:\s+implements\s+([\w,\s]+))?\s*\{/g;
  let match: RegExpExecArray | null;

  while ((match = classRe.exec(file.content)) !== null) {
    const className = match[1];
    const extendsClass = match[2];
    const implementsInterfaces = match[3];

    // Skip Eloquent models and Doctrine entities (handled separately)
    if (extendsClass === 'Model' || /extends\s+Model|@Entity|#\[ORM\\Entity\]/.test(file.content.slice(match.index, match.index + 500))) {
      continue;
    }

    const braceStart = match.index + match[0].length;
    const body = extractBraceBlock(file.content, braceStart);
    if (!body) continue;

    const fields: { name: string; type: string; required: boolean; description?: string }[] = [];

    // Parse properties
    const propRe = /(?:private|protected|public)\s+(?:static\s+)?(?:readonly\s+)?(?:\?)?(\$?\w+|\w+\|\w+|\w+\[\])\s+\$(\w+)(?:\s*=\s*([^;]+))?;/g;
    let propMatch: RegExpExecArray | null;

    while ((propMatch = propRe.exec(body)) !== null) {
      const [fullMatch, phpType, fieldName, defaultValue] = propMatch;
      const isNullable = fullMatch.includes('?') || phpType.includes('null');
      const hasDefault = !!defaultValue;

      // Extract PHPDoc
      const docComment = extractPhpDoc(body, propMatch.index);
      const docType = extractPhpDocType(docComment);

      fields.push({
        name: fieldName,
        type: docType || phpType.replace('$', ''),
        required: !isNullable && !hasDefault,
        description: extractPhpDocDescription(docComment),
      });
    }

    // Constructor property promotion (PHP 8)
    const constructorRe = /function\s+__construct\s*\(([\s\S]*?)\)/;
    const constructorMatch = body.match(constructorRe);
    if (constructorMatch) {
      const params = constructorMatch[1];
      const paramRe = /(?:private|protected|public)\s+(?:readonly\s+)?(?:\?)?(\w+|\w+\|\w+)\s+\$(\w+)/g;
      let paramMatch: RegExpExecArray | null;

      while ((paramMatch = paramRe.exec(params)) !== null) {
        const [fullMatch, phpType, paramName] = paramMatch;
        const isNullable = fullMatch.includes('?');

        // Avoid duplicates
        if (!fields.some(f => f.name === paramName)) {
          fields.push({
            name: paramName,
            type: phpType,
            required: !isNullable,
          });
        }
      }
    }

    if (fields.length > 0 || implementsInterfaces || extendsClass) {
      const kind = detectClassKind(className, file.content, extendsClass);
      const lineNum = getLineNumber(file.content, match.index);

      types.push({
        name: className,
        kind,
        fields,
        filePath: file.path,
        description: extractComment(lines, lineNum),
      });
    }
  }

  return types;
}

// ── Interface Parsing ──

function hasInterfaces(content: string): boolean {
  return /interface\s+\w+/.test(content);
}

function parseInterfaces(file: SourceFile): TypeInfo[] {
  const types: TypeInfo[] = [];
  const lines = file.content.split('\n');

  const interfaceRe = /interface\s+(\w+)(?:\s+extends\s+([\w,\s]+))?\s*\{/g;
  let match: RegExpExecArray | null;

  while ((match = interfaceRe.exec(file.content)) !== null) {
    const interfaceName = match[1];
    const extendsInterfaces = match[2];

    const braceStart = match.index + match[0].length;
    const body = extractBraceBlock(file.content, braceStart);
    if (!body) continue;

    const fields: { name: string; type: string; required: boolean }[] = [];

    // Parse method signatures
    const methodRe = /public\s+function\s+(\w+)\s*\([^)]*\)(?:\s*:\s*(\?)?(\w+|\w+\[\]))?;/g;
    let methodMatch: RegExpExecArray | null;

    while ((methodMatch = methodRe.exec(body)) !== null) {
      const [, methodName, isNullable, returnType] = methodMatch;
      fields.push({
        name: methodName,
        type: returnType || 'void',
        required: !isNullable,
      });
    }

    const lineNum = getLineNumber(file.content, match.index);

    types.push({
      name: interfaceName,
      kind: 'interface',
      fields,
      filePath: file.path,
      description: extractComment(lines, lineNum),
    });
  }

  return types;
}

// ── Enum Parsing (PHP 8.1+) ──

function hasEnums(content: string): boolean {
  return /enum\s+\w+/.test(content);
}

function parseEnums(file: SourceFile): TypeInfo[] {
  const types: TypeInfo[] = [];
  const lines = file.content.split('\n');

  // Match: enum Status: int { case Active = 1; }
  const enumRe = /enum\s+(\w+)(?:\s*:\s*(\w+))?\s*\{/g;
  let match: RegExpExecArray | null;

  while ((match = enumRe.exec(file.content)) !== null) {
    const enumName = match[1];
    const backingType = match[2];

    const braceStart = match.index + match[0].length;
    const body = extractBraceBlock(file.content, braceStart);
    if (!body) continue;

    const fields: { name: string; type: string; required: boolean }[] = [];

    // Parse cases
    const caseRe = /case\s+(\w+)(?:\s*=\s*([^;]+))?;/g;
    let caseMatch: RegExpExecArray | null;

    while ((caseMatch = caseRe.exec(body)) !== null) {
      const [, caseName, caseValue] = caseMatch;
      fields.push({
        name: caseName,
        type: backingType || enumName,
        required: true,
      });
    }

    const lineNum = getLineNumber(file.content, match.index);

    types.push({
      name: enumName,
      kind: 'enum',
      fields,
      filePath: file.path,
      description: extractComment(lines, lineNum),
    });
  }

  return types;
}

// ── Helper Functions ──

function extractNamespace(content: string): string {
  const match = content.match(/namespace\s+([\w\\]+)/);
  return match ? match[1] : '';
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
    } else if (line.startsWith('*') || line.startsWith('/*')) {
      comments.unshift(line.replace(/^[/*\s*]+/, '').replace(/\*\/$/, ''));
    } else if (line === '*/') {
      continue;
    } else {
      break;
    }
  }
  return comments.length > 0 ? comments.join(' ').trim() : undefined;
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

function toSnakeCase(str: string): string {
  return str.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');
}

function phpTypeToDatabaseType(phpType: string): string {
  const typeMap: Record<string, string> = {
    'int': 'integer',
    'integer': 'integer',
    'bool': 'boolean',
    'boolean': 'boolean',
    'float': 'float',
    'double': 'float',
    'string': 'varchar',
    'array': 'json',
    'object': 'json',
    'datetime': 'timestamp',
    'date': 'date',
    'timestamp': 'timestamp',
  };
  return typeMap[phpType.toLowerCase()] || 'varchar';
}

function extractPhpDoc(body: string, propIndex: number): string | undefined {
  // Look backwards for /** ... */
  const before = body.substring(0, propIndex);
  const docMatch = before.match(/\/\*\*([\s\S]*?)\*\/\s*$/);
  return docMatch ? docMatch[1] : undefined;
}

function extractPhpDocType(docComment: string | undefined): string | undefined {
  if (!docComment) return undefined;
  const typeMatch = docComment.match(/@var\s+(\S+)/);
  return typeMatch ? typeMatch[1] : undefined;
}

function extractPhpDocDescription(docComment: string | undefined): string | undefined {
  if (!docComment) return undefined;
  const lines = docComment.split('\n').map(l => l.replace(/^\s*\*\s?/, '').trim()).filter(l => !l.startsWith('@'));
  return lines.length > 0 ? lines.join(' ').trim() : undefined;
}

function detectClassKind(name: string, content: string, extendsClass?: string): 'dto' | 'input' | 'response' | 'interface' | 'type' {
  const lower = name.toLowerCase();
  if (lower.includes('request') || lower.includes('input') || lower.includes('command')) return 'input';
  if (lower.includes('response') || lower.includes('resource') || lower.includes('result')) return 'response';
  if (lower.includes('dto') || lower.includes('data')) return 'dto';
  if (extendsClass && (extendsClass.includes('Controller') || extendsClass.includes('Service'))) return 'type';
  return 'type';
}

function isServiceClass(type: TypeInfo, content: string): boolean {
  const name = type.name.toLowerCase();
  if (name.includes('service') || name.includes('repository') || name.includes('manager')) return true;
  if (content.includes('@Injectable') || content.includes('#[Service]')) return true;
  return false;
}

function classToService(type: TypeInfo, file: SourceFile): ServiceInfo {
  const methods: string[] = [];
  const dependencies: string[] = [];

  // Extract methods from class body
  const classMatch = file.content.match(new RegExp(`class\\s+${type.name}[\\s\\S]*?\\{([\\s\\S]*?)(?:\\n\\}|$)`));
  if (classMatch) {
    const body = classMatch[1];
    const methodRe = /(?:public|protected|private)\s+function\s+(\w+)\s*\(/g;
    let methodMatch: RegExpExecArray | null;

    while ((methodMatch = methodRe.exec(body)) !== null) {
      const methodName = methodMatch[1];
      if (methodName !== '__construct') {
        methods.push(methodName);
      }
    }

    // Extract dependencies from constructor
    const constructorRe = /function\s+__construct\s*\(([\s\S]*?)\)/;
    const constructorMatch = body.match(constructorRe);
    if (constructorMatch) {
      const params = constructorMatch[1];
      const paramRe = /(?:private|protected|public)?\s*(?:\?)?(\w+)\s+\$\w+/g;
      let paramMatch: RegExpExecArray | null;

      while ((paramMatch = paramRe.exec(params)) !== null) {
        const typeName = paramMatch[1];
        if (/^[A-Z]/.test(typeName) && typeName !== 'string' && typeName !== 'int' && typeName !== 'bool' && typeName !== 'array') {
          dependencies.push(typeName);
        }
      }
    }
  }

  return {
    name: type.name,
    filePath: file.path,
    methods,
    dependencies,
    description: type.description,
  };
}

// ── Route Group Helpers ──

function extractLaravelGroupPrefixes(content: string): Map<string, string> {
  const map = new Map<string, string>();
  // Match: Route::prefix('/api')->group(function() { ... })
  const prefixRe = /Route::(?:prefix|group)\s*\(\s*['"]([^'"]*)['"]\s*\)/g;
  let match: RegExpExecArray | null;
  let currentPrefix = '';
  while ((match = prefixRe.exec(content)) !== null) {
    currentPrefix = match[1];
    map.set('default', currentPrefix);
  }
  return map;
}

function resolveGroupPath(prefixes: Map<string, string>, path: string): string {
  const prefix = prefixes.get('default');
  if (prefix && !path.startsWith('/')) {
    return prefix + '/' + path;
  }
  if (prefix && path.startsWith('/')) {
    return prefix + path;
  }
  return path;
}

// ── Parameter Extraction ──

function extractPathParams(path: string): ParameterInfo[] {
  const params: ParameterInfo[] = [];
  // Match {param} or :param
  const paramRe = /[{:](\w+)}?/g;
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

function extractLaravelParams(path: string, content: string, handler?: string): ParameterInfo[] {
  const params = extractPathParams(path);

  // Look for $request->input('key') or $request->get('key')
  if (handler) {
    const queryRe = /\$request->(?:input|get|query)\s*\(\s*['"](\w+)['"]/g;
    let match: RegExpExecArray | null;
    while ((match = queryRe.exec(content)) !== null) {
      if (!params.some(p => p.name === match![1])) {
        params.push({
          name: match[1],
          type: 'string',
          required: false,
          location: 'query',
        });
      }
    }

    // Request validation
    const validateMatch = content.match(/\$request->validate\s*\(\s*\[([^\]]+)\]/);
    if (validateMatch) {
      params.push({
        name: 'body',
        type: 'array',
        required: true,
        location: 'body',
      });
    }
  }

  return params;
}

function extractSymfonyParams(path: string, content: string, handler?: string): ParameterInfo[] {
  const params = extractPathParams(path);

  // Look for Request $request parameters
  if (handler) {
    const methodMatch = content.match(new RegExp(`function\\s+${handler}\\s*\\(([^)]*)\\)`));
    if (methodMatch) {
      const paramsStr = methodMatch[1];
      const paramMatches = paramsStr.matchAll(/(?:\?)?(\w+)\s+\$(\w+)/g);
      for (const pm of paramMatches) {
        const [, typeName, paramName] = pm;
        if (typeName !== 'Request' && !params.some(p => p.name === paramName)) {
          params.push({
            name: paramName,
            type: typeName,
            required: !pm[0].startsWith('?'),
            location: 'body',
          });
        }
      }
    }
  }

  return params;
}
