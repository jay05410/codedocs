import type { ParserPlugin, SourceFile, ParseResult, EndpointInfo, EntityInfo, ServiceInfo, TypeInfo, DependencyInfo } from '@codedocs/core';

export interface FastApiParserOptions {
  /** Auto-detect ORM (SQLAlchemy, Tortoise, SQLModel) */
  detectOrm?: boolean;
  /** Parse Pydantic models as DTOs */
  detectPydantic?: boolean;
  /** Parse GraphQL (Strawberry, Ariadne) */
  detectGraphQL?: boolean;
}

export function fastApiParser(options: FastApiParserOptions = {}): ParserPlugin {
  const { detectOrm = true, detectPydantic = true, detectGraphQL = true } = options;

  return {
    name: 'python-fastapi',
    filePattern: ['**/*.py'],

    async parse(files: SourceFile[]): Promise<ParseResult> {
      const endpoints: EndpointInfo[] = [];
      const entities: EntityInfo[] = [];
      const services: ServiceInfo[] = [];
      const types: TypeInfo[] = [];
      const dependencies: DependencyInfo[] = [];

      for (const file of files) {
        // FastAPI / Flask-like route endpoints
        if (isRouter(file.content)) {
          endpoints.push(...parseRouteEndpoints(file));
        }

        // GraphQL (Strawberry)
        if (detectGraphQL && isStrawberryResolver(file.content)) {
          endpoints.push(...parseStrawberryEndpoints(file));
        }

        // SQLAlchemy / SQLModel entities
        if (detectOrm && isSqlAlchemyModel(file.content)) {
          const entity = parseSqlAlchemyEntity(file);
          if (entity) entities.push(entity);
        }

        // Tortoise ORM models
        if (detectOrm && isTortoiseModel(file.content)) {
          const entity = parseTortoiseEntity(file);
          if (entity) entities.push(entity);
        }

        // Pydantic models (DTOs)
        if (detectPydantic && hasPydanticModels(file.content)) {
          types.push(...parsePydanticModels(file));
        }

        // Python enums
        if (hasPythonEnums(file.content)) {
          types.push(...parsePythonEnums(file));
        }

        // Service classes (Depends injection)
        if (isServiceClass(file.content)) {
          const svc = parseServiceClass(file);
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
      }

      return { endpoints, entities, services, types, dependencies };
    },
  };
}

// ── Detection helpers ──

function isRouter(content: string): boolean {
  return /@(?:app|router)\.(get|post|put|delete|patch|options|head)\s*\(/.test(content);
}

function isStrawberryResolver(content: string): boolean {
  return /import\s+strawberry/.test(content) && /@strawberry\.type/.test(content);
}

function isSqlAlchemyModel(content: string): boolean {
  return /class\s+\w+\s*\([^)]*(?:Base|DeclarativeBase|Model)\s*[,)]/.test(content)
    && /Column\(|mapped_column\(/.test(content);
}

function isTortoiseModel(content: string): boolean {
  return /class\s+\w+\s*\([^)]*Model\s*[,)]/.test(content)
    && /fields\.\w+Field/.test(content);
}

function hasPydanticModels(content: string): boolean {
  return /class\s+\w+\s*\([^)]*(?:BaseModel|BaseSchema)\s*[,)]/.test(content);
}

function hasPythonEnums(content: string): boolean {
  return /class\s+\w+\s*\([^)]*(?:str\s*,\s*)?Enum\s*[,)]/.test(content);
}

function isServiceClass(content: string): boolean {
  return /class\s+\w+Service/.test(content) || /class\s+\w+Repository/.test(content);
}

// ── Route Endpoint Parser ──

function parseRouteEndpoints(file: SourceFile): EndpointInfo[] {
  const endpoints: EndpointInfo[] = [];

  // Detect router prefix: router = APIRouter(prefix="/api/v1/users")
  const prefixMatch = file.content.match(/(?:router|app)\s*=\s*APIRouter\([^)]*prefix\s*=\s*["']([^"']+)["']/);
  const routerPrefix = prefixMatch?.[1] || '';

  // Match: @app.get("/path") or @router.post("/path", ...)
  const routeRegex = /@(?:app|router)\.(get|post|put|delete|patch|options|head)\s*\(\s*["']([^"']*?)["'](?:\s*,\s*[^)]*)?(?:\s*,\s*tags\s*=\s*\[([^\]]*)\])?\s*[^)]*\)/g;
  let match: RegExpExecArray | null;

  while ((match = routeRegex.exec(file.content)) !== null) {
    const method = match[1].toUpperCase();
    const path = routerPrefix + (match[2] || '/');
    const tagsStr = match[3];

    const afterDecorator = file.content.slice(match.index);

    // Find the function definition: async def func_name(params) -> ReturnType:
    const funcMatch = afterDecorator.match(
      /(?:async\s+)?def\s+(\w+)\s*\(([^)]*)\)(?:\s*->\s*([^:]+))?\s*:/,
    );
    if (!funcMatch) continue;

    const handler = funcMatch[1];
    const paramsStr = funcMatch[2];
    const returnType = funcMatch[3]?.trim() || 'None';

    const params = parsePythonParameters(paramsStr);

    // Extract docstring for description
    const funcBody = afterDecorator.slice(afterDecorator.indexOf(':') + 1);
    const docstringMatch = funcBody.match(/^\s*"""([^"]*?)"""|^\s*'''([^']*?)'''/);
    const description = (docstringMatch?.[1] || docstringMatch?.[2])?.trim();

    // Tags
    const tags = tagsStr
      ? tagsStr.split(',').map((t) => t.trim().replace(/['"]/g, '')).filter(Boolean)
      : undefined;

    // Detect auth dependencies
    const auth = /Depends\(\s*(?:get_current_user|auth|verify_token|require_auth)/.test(paramsStr);
    const deprecated = /@(?:app|router)\.[^(]*deprecated\s*=\s*True/.test(afterDecorator.slice(0, 300));

    // Detect service dependency
    const serviceRef = findPythonServiceRef(paramsStr);

    endpoints.push({
      protocol: 'rest',
      httpMethod: method,
      path: path || '/',
      name: `${method} ${path || '/'}`,
      handler,
      handlerClass: extractModuleName(file.path),
      parameters: params,
      returnType,
      serviceRef,
      filePath: file.path,
      description,
      tags,
      auth,
      deprecated,
    });
  }

  return endpoints;
}

// ── Strawberry GraphQL Parser ──

function parseStrawberryEndpoints(file: SourceFile): EndpointInfo[] {
  const endpoints: EndpointInfo[] = [];

  // Match @strawberry.type class Query/Mutation
  const typeBlockRegex = /@strawberry\.type\s*\nclass\s+(Query|Mutation|Subscription)\s*:/g;
  let typeMatch: RegExpExecArray | null;

  while ((typeMatch = typeBlockRegex.exec(file.content)) !== null) {
    const operationType = typeMatch[1] as 'Query' | 'Mutation' | 'Subscription';
    const classBody = extractPythonClassBody(file.content, typeMatch.index);
    if (!classBody) continue;

    // Find methods with @strawberry.field or @strawberry.mutation
    const methodRegex = /(?:@strawberry\.(?:field|mutation)\s*(?:\([^)]*\))?\s*)?def\s+(\w+)\s*\(([^)]*)\)(?:\s*->\s*([^:]+))?\s*:/g;
    let methodMatch: RegExpExecArray | null;

    while ((methodMatch = methodRegex.exec(classBody)) !== null) {
      const fieldName = methodMatch[1];
      if (fieldName === '__init__') continue;

      const paramsStr = methodMatch[2];
      const returnType = methodMatch[3]?.trim() || 'Any';

      // Filter out 'self' and 'info' params
      const params = parsePythonParameters(paramsStr)
        .filter((p) => p.name !== 'self' && p.name !== 'info');

      endpoints.push({
        protocol: 'graphql',
        operationType,
        fieldName,
        name: `${operationType}.${fieldName}`,
        handler: fieldName,
        handlerClass: operationType,
        parameters: params,
        returnType,
        filePath: file.path,
      });
    }
  }

  return endpoints;
}

// ── SQLAlchemy Entity Parser ──

function parseSqlAlchemyEntity(file: SourceFile): EntityInfo | null {
  const classMatch = file.content.match(/class\s+(\w+)\s*\([^)]*(?:Base|DeclarativeBase|Model)/);
  if (!classMatch) return null;
  const name = classMatch[1];

  // __tablename__
  const tableNameMatch = file.content.match(/__tablename__\s*=\s*["'](\w+)["']/);
  const tableName = tableNameMatch?.[1] || camelToSnake(name);

  const columns = parseSqlAlchemyColumns(file.content);
  const relations = parseSqlAlchemyRelations(file.content);
  const indexes = parseSqlAlchemyIndexes(file.content);

  return {
    name,
    tableName,
    dbType: 'PostgreSQL',
    columns,
    relations,
    indexes,
    filePath: file.path,
  };
}

function parseSqlAlchemyColumns(content: string): EntityInfo['columns'] {
  const columns: EntityInfo['columns'] = [];

  // Pattern: field_name = Column(Type, ...) or field_name: Mapped[type] = mapped_column(...)
  const columnPatterns = [
    // SQLAlchemy 2.0 style: field: Mapped[str] = mapped_column(...)
    /(\w+)\s*:\s*Mapped\[([^\]]+)\]\s*=\s*mapped_column\(([^)]*)\)/g,
    // Classic style: field = Column(Type, ...)
    /(\w+)\s*=\s*Column\(\s*(\w+)(?:\([^)]*\))?\s*(?:,\s*([^)]*))?\)/g,
  ];

  for (const regex of columnPatterns) {
    let match: RegExpExecArray | null;
    while ((match = regex.exec(content)) !== null) {
      const fieldName = match[1];
      const type = match[2].trim();
      const options = match[3] || '';

      if (fieldName.startsWith('__')) continue;

      const isPrimary = options.includes('primary_key=True') || options.includes('primary_key = True');
      const nullable = options.includes('nullable=True') || options.includes('nullable = True')
        || (!options.includes('nullable=False') && !options.includes('nullable = False') && !isPrimary);
      const unique = options.includes('unique=True') || options.includes('unique = True');

      columns.push({
        name: fieldName,
        type: mapPythonType(type),
        dbColumnName: fieldName,
        nullable,
        primaryKey: isPrimary,
        unique: unique || isPrimary,
      });
    }
  }

  return columns;
}

function parseSqlAlchemyRelations(content: string): EntityInfo['relations'] {
  const relations: EntityInfo['relations'] = [];

  // relationship("Entity", ...) or relationship(Entity, ...)
  const relRegex = /(\w+)\s*=\s*relationship\(\s*["']?(\w+)["']?\s*(?:,\s*([^)]*))?\)/g;
  let match: RegExpExecArray | null;

  while ((match = relRegex.exec(content)) !== null) {
    const target = match[2];
    const options = match[3] || '';

    const uselist = !options.includes('uselist=False') && !options.includes('uselist = False');
    const backPopulates = options.match(/back_populates\s*=\s*["'](\w+)["']/)?.[1];

    // Infer relation type from uselist and foreign key
    let relType: 'OneToOne' | 'OneToMany' | 'ManyToOne' | 'ManyToMany';
    if (!uselist) {
      relType = 'OneToOne';
    } else if (options.includes('secondary')) {
      relType = 'ManyToMany';
    } else {
      relType = 'OneToMany';
    }

    relations.push({
      type: relType,
      target,
      mappedBy: backPopulates,
    });
  }

  // ForeignKey references indicate ManyToOne
  const fkRegex = /(\w+)\s*=\s*(?:Column|mapped_column)\([^)]*ForeignKey\(\s*["']([^"']+)["']\)/g;
  let fkMatch: RegExpExecArray | null;
  while ((fkMatch = fkRegex.exec(content)) !== null) {
    const fkTable = fkMatch[2].split('.')[0];
    const targetEntity = snakeToCamel(fkTable);

    // Avoid duplicate if already covered by relationship()
    if (!relations.some((r) => r.target === targetEntity && r.type === 'ManyToOne')) {
      relations.push({
        type: 'ManyToOne',
        target: targetEntity,
        joinColumn: fkMatch[1],
      });
    }
  }

  return relations;
}

function parseSqlAlchemyIndexes(content: string): string[] {
  const indexes: string[] = [];

  // Index('idx_name', 'col1', 'col2')
  const indexRegex = /Index\(\s*["'](\w+)["']\s*,\s*([^)]+)\)/g;
  let match: RegExpExecArray | null;
  while ((match = indexRegex.exec(content)) !== null) {
    const cols = match[2].replace(/["']/g, '').trim();
    indexes.push(`${match[1]}: ${cols}`);
  }

  // UniqueConstraint
  const uniqueRegex = /UniqueConstraint\(\s*["']?(\w+)?["']?\s*,?\s*columns?\s*=?\s*\[([^\]]+)\]/g;
  let uMatch: RegExpExecArray | null;
  while ((uMatch = uniqueRegex.exec(content)) !== null) {
    const name = uMatch[1] || 'unique';
    indexes.push(`${name}: ${uMatch[2].replace(/["']/g, '').trim()} (unique)`);
  }

  return indexes;
}

// ── Tortoise ORM Entity Parser ──

function parseTortoiseEntity(file: SourceFile): EntityInfo | null {
  const classMatch = file.content.match(/class\s+(\w+)\s*\([^)]*Model/);
  if (!classMatch) return null;
  const name = classMatch[1];

  // Meta class table name
  const tableMatch = file.content.match(/class\s+Meta[^{]*:\s*\n\s*table\s*=\s*["'](\w+)["']/);
  const tableName = tableMatch?.[1] || camelToSnake(name);

  const columns: EntityInfo['columns'] = [];

  // fields.CharField, fields.IntField, etc.
  const fieldRegex = /(\w+)\s*=\s*fields\.(\w+Field)\(([^)]*)\)/g;
  let match: RegExpExecArray | null;
  while ((match = fieldRegex.exec(file.content)) !== null) {
    const fieldName = match[1];
    const fieldType = match[2];
    const options = match[3];

    const isPrimary = fieldType === 'IntField' && options.includes('pk=True');
    const nullable = options.includes('null=True');

    columns.push({
      name: fieldName,
      type: tortoisFieldToType(fieldType),
      dbColumnName: fieldName,
      nullable,
      primaryKey: isPrimary,
      unique: options.includes('unique=True'),
    });
  }

  return {
    name,
    tableName,
    dbType: 'PostgreSQL',
    columns,
    relations: [],
    indexes: [],
    filePath: file.path,
  };
}

// ── Pydantic Model Parser ──

function parsePydanticModels(file: SourceFile): TypeInfo[] {
  const types: TypeInfo[] = [];

  const classRegex = /class\s+(\w+)\s*\([^)]*(?:BaseModel|BaseSchema)\s*[,)]/g;
  let match: RegExpExecArray | null;

  while ((match = classRegex.exec(file.content)) !== null) {
    const name = match[1];
    const classBody = extractPythonClassBody(file.content, match.index);
    if (!classBody) continue;

    const fields: TypeInfo['fields'] = [];

    // field: type [= default | = Field(...)]
    const fieldRegex = /^[ \t]+(\w+)\s*:\s*([^=\n]+?)(?:\s*=\s*(.+))?$/gm;
    let fieldMatch: RegExpExecArray | null;

    while ((fieldMatch = fieldRegex.exec(classBody)) !== null) {
      const fieldName = fieldMatch[1];
      const type = fieldMatch[2].trim();
      const defaultValue = fieldMatch[3]?.trim();

      // Skip class methods, Config, model_config
      if (fieldName === 'class' || fieldName === 'def' || fieldName === 'model_config' || fieldName === 'Config') continue;
      if (fieldName.startsWith('_')) continue;

      const isOptional = type.startsWith('Optional[') || type.includes('| None') || type.includes('None |');
      const hasDefault = defaultValue !== undefined && defaultValue !== '...';

      fields.push({
        name: fieldName,
        type: type.replace(/Optional\[([^\]]+)\]/, '$1').replace(/\s*\|\s*None/, '').trim(),
        required: !isOptional && !hasDefault,
      });
    }

    if (fields.length > 0) {
      const kind = inferTypeKind(name);
      types.push({ name, kind, fields, filePath: file.path });
    }
  }

  return types;
}

// ── Python Enum Parser ──

function parsePythonEnums(file: SourceFile): TypeInfo[] {
  const types: TypeInfo[] = [];

  const enumRegex = /class\s+(\w+)\s*\([^)]*Enum\s*[,)]/g;
  let match: RegExpExecArray | null;

  while ((match = enumRegex.exec(file.content)) !== null) {
    const name = match[1];
    const classBody = extractPythonClassBody(file.content, match.index);
    if (!classBody) continue;

    const fields: TypeInfo['fields'] = [];

    // CONSTANT = "value" or CONSTANT = auto()
    const constRegex = /^[ \t]+([A-Z_]\w*)\s*=\s*(.+)$/gm;
    let constMatch: RegExpExecArray | null;
    while ((constMatch = constRegex.exec(classBody)) !== null) {
      fields.push({
        name: constMatch[1],
        type: name,
        required: true,
      });
    }

    if (fields.length > 0) {
      types.push({ name, kind: 'enum', fields, filePath: file.path });
    }
  }

  return types;
}

// ── Service Class Parser ──

function parseServiceClass(file: SourceFile): ServiceInfo | null {
  const classMatch = file.content.match(/class\s+(\w+(?:Service|Repository))/);
  if (!classMatch) return null;

  const name = classMatch[1];
  const classBody = extractPythonClassBody(file.content, classMatch.index);
  if (!classBody) return null;

  const methods: string[] = [];
  const deps: string[] = [];

  // __init__ dependencies
  const initMatch = classBody.match(/def\s+__init__\s*\(\s*self\s*,\s*([^)]*)\)/);
  if (initMatch) {
    const params = initMatch[1];
    const depRegex = /(\w+)\s*:\s*(\w+)/g;
    let depMatch: RegExpExecArray | null;
    while ((depMatch = depRegex.exec(params)) !== null) {
      deps.push(depMatch[2]);
    }
  }

  // Public methods (not starting with _)
  const methodRegex = /def\s+(\w+)\s*\(/g;
  let methodMatch: RegExpExecArray | null;
  while ((methodMatch = methodRegex.exec(classBody)) !== null) {
    const methodName = methodMatch[1];
    if (!methodName.startsWith('_')) {
      methods.push(methodName);
    }
  }

  return { name, filePath: file.path, methods, dependencies: deps };
}

// ── Shared Helpers ──

function parsePythonParameters(paramsStr: string): EndpointInfo['parameters'] {
  const params: EndpointInfo['parameters'] = [];
  if (!paramsStr.trim()) return params;

  const parts = splitParameters(paramsStr);

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed || trimmed === 'self' || trimmed === 'cls') continue;

    // Skip *args, **kwargs
    if (trimmed.startsWith('*')) continue;

    // Match: name: type [= default]
    const paramMatch = trimmed.match(/(\w+)\s*:\s*([^=]+?)(?:\s*=\s*(.+))?$/);
    if (!paramMatch) continue;

    const name = paramMatch[1];
    const type = paramMatch[2].trim();
    const defaultValue = paramMatch[3]?.trim();

    // Determine location from FastAPI dependency injection
    let location: 'path' | 'query' | 'body' | 'header' | 'cookie' | undefined;
    if (/Path\(/.test(type) || /Path\(/.test(defaultValue || '')) location = 'path';
    else if (/Query\(/.test(type) || /Query\(/.test(defaultValue || '')) location = 'query';
    else if (/Body\(/.test(type) || /Body\(/.test(defaultValue || '')) location = 'body';
    else if (/Header\(/.test(type) || /Header\(/.test(defaultValue || '')) location = 'header';
    else if (/Cookie\(/.test(type) || /Cookie\(/.test(defaultValue || '')) location = 'cookie';

    // Skip Depends() parameters (these are injected services)
    if (/Depends\(/.test(type) || /Depends\(/.test(defaultValue || '')) continue;
    // Skip Request, Response objects
    if (['Request', 'Response', 'WebSocket', 'BackgroundTasks'].includes(type)) continue;

    const isOptional = type.startsWith('Optional[') || type.includes('| None');

    params.push({
      name,
      type: type
        .replace(/Optional\[([^\]]+)\]/, '$1')
        .replace(/\s*\|\s*None/, '')
        .replace(/\s*=\s*.*$/, '')
        .trim(),
      required: !isOptional && defaultValue === undefined,
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
    if (char === '[' || char === '(' || char === '{') depth++;
    if (char === ']' || char === ')' || char === '}') depth--;
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

function extractPythonClassBody(content: string, classStart: number): string | null {
  const afterClass = content.slice(classStart);
  const colonIndex = afterClass.indexOf(':');
  if (colonIndex === -1) return null;

  const bodyStart = classStart + colonIndex + 1;
  const lines = content.slice(bodyStart).split('\n');

  // Find indentation of first non-empty line
  let baseIndent = -1;
  const bodyLines: string[] = [];

  for (const line of lines) {
    if (line.trim() === '') {
      bodyLines.push(line);
      continue;
    }

    const indent = line.match(/^(\s*)/)?.[1].length || 0;

    if (baseIndent === -1) {
      baseIndent = indent;
      bodyLines.push(line);
    } else if (indent >= baseIndent) {
      bodyLines.push(line);
    } else {
      break;
    }
  }

  return bodyLines.join('\n');
}

function findPythonServiceRef(paramsStr: string): string | undefined {
  const match = paramsStr.match(/(\w+Service)\s*=\s*Depends|(\w+Service)/);
  return match?.[1] || match?.[2];
}

function extractModuleName(filePath: string): string {
  const parts = filePath.split('/');
  const fileName = parts[parts.length - 1];
  return fileName.replace(/\.py$/, '');
}

function mapPythonType(type: string): string {
  const mapping: Record<string, string> = {
    String: 'str', Integer: 'int', Float: 'float', Boolean: 'bool',
    Text: 'str', DateTime: 'datetime', Date: 'date', Time: 'time',
    JSON: 'dict', ARRAY: 'list', Numeric: 'Decimal', BigInteger: 'int',
    SmallInteger: 'int', UUID: 'uuid', LargeBinary: 'bytes',
    str: 'str', int: 'int', float: 'float', bool: 'bool',
    'Optional[str]': 'str', 'Optional[int]': 'int',
  };
  return mapping[type] || type;
}

function tortoisFieldToType(fieldType: string): string {
  const mapping: Record<string, string> = {
    CharField: 'str', TextField: 'str', IntField: 'int',
    BigIntField: 'int', SmallIntField: 'int', FloatField: 'float',
    DecimalField: 'Decimal', BooleanField: 'bool',
    DatetimeField: 'datetime', DateField: 'date', TimeField: 'time',
    JSONField: 'dict', UUIDField: 'uuid', BinaryField: 'bytes',
    ForeignKeyField: 'FK', OneToOneField: 'FK',
  };
  return mapping[fieldType] || fieldType;
}

function inferTypeKind(name: string): TypeInfo['kind'] {
  const lower = name.toLowerCase();
  if (lower.includes('input') || lower.includes('request') || lower.includes('create') || lower.includes('update')) return 'input';
  if (lower.includes('response') || lower.includes('result') || lower.includes('output') || lower.includes('read')) return 'response';
  return 'dto';
}

function camelToSnake(str: string): string {
  return str
    .replace(/([A-Z])/g, '_$1')
    .toLowerCase()
    .replace(/^_/, '');
}

function snakeToCamel(str: string): string {
  return str
    .split('_')
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join('');
}
