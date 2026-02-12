import type { ParserPlugin, SourceFile, ParseResult, EndpointInfo, EntityInfo, ServiceInfo, TypeInfo, DependencyInfo, ParameterInfo, ColumnInfo, RelationInfo } from '@codedocs/core';

export interface CppParserOptions {
  /** Include .hpp/.h header files (default: true) */
  parseHeaders?: boolean;
  /** Auto-detect web frameworks (Qt, Boost.Beast, Crow, Pistache, Drogon, cpp-httplib) */
  detectFrameworks?: boolean;
}

export function cppParser(options: CppParserOptions = {}): ParserPlugin {
  const { parseHeaders = true, detectFrameworks = true } = options;

  return {
    name: 'cpp',
    filePattern: parseHeaders
      ? ['**/*.cpp', '**/*.hpp', '**/*.cc', '**/*.hh', '**/*.cxx', '**/*.h']
      : ['**/*.cpp', '**/*.cc', '**/*.cxx'],

    async parse(files: SourceFile[]): Promise<ParseResult> {
      const endpoints: EndpointInfo[] = [];
      const entities: EntityInfo[] = [];
      const services: ServiceInfo[] = [];
      const types: TypeInfo[] = [];
      const dependencies: DependencyInfo[] = [];

      // Detect which framework is used
      const framework = detectFrameworks ? detectFramework(files) : 'none';

      // Build namespace context
      const namespaceMap = buildNamespaceMap(files);

      for (const file of files) {
        const content = stripComments(file.content);

        // Extract includes for dependencies
        dependencies.push(...parseIncludes(file, content));

        // Parse web framework routes
        if (hasRoutes(content, framework)) {
          endpoints.push(...parseRoutes(file, content, framework));
        }

        // Parse classes
        if (hasClasses(content)) {
          const classResults = parseClasses(file, content, namespaceMap);
          types.push(...classResults.types);
          services.push(...classResults.services);
          dependencies.push(...classResults.dependencies);
        }

        // Parse structs
        if (hasStructs(content)) {
          const structResults = parseStructs(file, content, namespaceMap);
          types.push(...structResults.types);
          dependencies.push(...structResults.dependencies);
        }

        // Parse enums
        if (hasEnums(content)) {
          types.push(...parseEnums(file, content, namespaceMap));
        }

        // Parse template classes
        if (hasTemplates(content)) {
          types.push(...parseTemplateTypes(file, content, namespaceMap));
        }
      }

      return { endpoints, entities, services, types, dependencies };
    },
  };
}

// ── Framework Detection ──

type CppFramework = 'crow' | 'pistache' | 'drogon' | 'boost-beast' | 'cpp-httplib' | 'qt' | 'none';

function detectFramework(files: SourceFile[]): CppFramework {
  for (const file of files) {
    const content = file.content;
    if (/#include\s*[<"]crow[>/"]/.test(content)) return 'crow';
    if (/#include\s*[<"]pistache\//.test(content)) return 'pistache';
    if (/#include\s*[<"]drogon\//.test(content)) return 'drogon';
    if (/#include\s*<boost\/beast\//.test(content)) return 'boost-beast';
    if (/#include\s*[<"]httplib\.h[>"]/.test(content)) return 'cpp-httplib';
    if (/#include\s*<Q\w+>/.test(content)) return 'qt';
  }
  return 'none';
}

// ── Comment Stripping ──

function stripComments(content: string): string {
  // Remove single-line comments
  let result = content.replace(/\/\/.*$/gm, '');
  // Remove multi-line comments (preserve for doc extraction elsewhere)
  result = result.replace(/\/\*[\s\S]*?\*\//g, '');
  return result;
}

// ── Include Parsing ──

function parseIncludes(file: SourceFile, content: string): DependencyInfo[] {
  const dependencies: DependencyInfo[] = [];
  const includeRe = /#include\s*[<"]([^>"]+)[>"]/g;
  let match: RegExpExecArray | null;

  while ((match = includeRe.exec(content)) !== null) {
    const includePath = match[1];
    // Filter out standard library includes
    if (!isStdLibInclude(includePath)) {
      dependencies.push({
        source: file.path,
        target: includePath,
        type: 'import',
      });
    }
  }

  return dependencies;
}

function isStdLibInclude(path: string): boolean {
  const stdLibs = [
    'iostream', 'string', 'vector', 'map', 'set', 'unordered_map', 'unordered_set',
    'algorithm', 'memory', 'functional', 'utility', 'tuple', 'array', 'deque',
    'list', 'queue', 'stack', 'bitset', 'valarray', 'numeric', 'iterator',
    'exception', 'stdexcept', 'cassert', 'cctype', 'cerrno', 'cfloat', 'ciso646',
    'climits', 'clocale', 'cmath', 'csetjmp', 'csignal', 'cstdarg', 'cstddef',
    'cstdint', 'cstdio', 'cstdlib', 'cstring', 'ctime', 'cwchar', 'cwctype',
    'chrono', 'codecvt', 'condition_variable', 'filesystem', 'fstream', 'future',
    'initializer_list', 'iomanip', 'ios', 'iosfwd', 'istream', 'limits', 'locale',
    'mutex', 'new', 'ostream', 'random', 'ratio', 'regex', 'scoped_allocator',
    'sstream', 'streambuf', 'system_error', 'thread', 'typeindex', 'typeinfo',
    'type_traits', 'optional', 'variant', 'any', 'string_view', 'span',
  ];

  const baseName = path.split('/').pop() || path;
  return stdLibs.includes(baseName) || /^std\//.test(path) || /^c\w+$/.test(baseName);
}

// ── Namespace Context ──

interface NamespaceContext {
  path: string;
  namespace: string[];
}

function buildNamespaceMap(files: SourceFile[]): Map<string, string[]> {
  const map = new Map<string, string[]>();

  for (const file of files) {
    const namespaces = extractNamespaces(file.content);
    map.set(file.path, namespaces);
  }

  return map;
}

function extractNamespaces(content: string): string[] {
  const namespaces: string[] = [];
  const nsRe = /namespace\s+(\w+)/g;
  let match: RegExpExecArray | null;

  while ((match = nsRe.exec(content)) !== null) {
    namespaces.push(match[1]);
  }

  return namespaces;
}

// ── Route Detection and Parsing ──

function hasRoutes(content: string, framework: CppFramework): boolean {
  switch (framework) {
    case 'crow':
      return /CROW_ROUTE/.test(content);
    case 'pistache':
      return /Routes::(Get|Post|Put|Delete|Patch)/.test(content);
    case 'drogon':
      return /ADD_METHOD_TO|app\(\)\.registerHandler/.test(content);
    case 'cpp-httplib':
      return /svr\.(Get|Post|Put|Delete|Patch)/.test(content);
    case 'boost-beast':
      return /handle_request|http::verb/.test(content);
    default:
      return false;
  }
}

function parseRoutes(file: SourceFile, content: string, framework: CppFramework): EndpointInfo[] {
  switch (framework) {
    case 'crow': return parseCrowRoutes(file, content);
    case 'pistache': return parsePistacheRoutes(file, content);
    case 'drogon': return parseDrogonRoutes(file, content);
    case 'cpp-httplib': return parseCppHttplibRoutes(file, content);
    case 'boost-beast': return parseBoostBeastRoutes(file, content);
    default: return [];
  }
}

// ── Crow Routes ──

function parseCrowRoutes(file: SourceFile, content: string): EndpointInfo[] {
  const endpoints: EndpointInfo[] = [];
  const lines = file.content.split('\n');

  // Match: CROW_ROUTE(app, "/path")
  const routeRe = /CROW_ROUTE\s*\(\s*(\w+)\s*,\s*"([^"]*)"\s*\)(?:\s*\.\s*(methods?)\s*\(\s*(?:crow::HTTPMethod::)?(\w+))?/g;
  let match: RegExpExecArray | null;

  while ((match = routeRe.exec(content)) !== null) {
    const [fullMatch, app, path, methodsKeyword, method] = match;
    const httpMethod = method ? method.toUpperCase() : 'GET';
    const lineNum = getLineNumber(file.content, match.index);
    const comment = extractDoxygenComment(lines, lineNum);

    // Try to find lambda or function body
    const bodyStart = match.index + fullMatch.length;
    const handler = extractRouteHandler(content, bodyStart);

    endpoints.push({
      protocol: 'rest',
      httpMethod,
      path,
      name: `${httpMethod} ${path}`,
      handler: handler || 'lambda',
      handlerClass: extractClassName(file.content, match.index) || 'crow',
      parameters: extractPathParams(path),
      returnType: 'crow::response',
      filePath: file.path,
      description: comment?.brief,
      tags: comment?.tags || [],
    });
  }

  return endpoints;
}

// ── Pistache Routes ──

function parsePistacheRoutes(file: SourceFile, content: string): EndpointInfo[] {
  const endpoints: EndpointInfo[] = [];
  const lines = file.content.split('\n');

  // Match: Routes::Get(router, "/path", Routes::bind(&Handler::method))
  const routeRe = /Routes::(Get|Post|Put|Delete|Patch|Options|Head)\s*\(\s*\w+\s*,\s*"([^"]*)"\s*,\s*Routes::bind\s*\(\s*&(\w+)::(\w+)/g;
  let match: RegExpExecArray | null;

  while ((match = routeRe.exec(content)) !== null) {
    const [, method, path, className, methodName] = match;
    const lineNum = getLineNumber(file.content, match.index);
    const comment = extractDoxygenComment(lines, lineNum);

    endpoints.push({
      protocol: 'rest',
      httpMethod: method.toUpperCase(),
      path,
      name: `${className}::${methodName}`,
      handler: methodName,
      handlerClass: className,
      parameters: extractPistacheParams(path),
      returnType: 'Pistache::Http::ResponseWriter',
      filePath: file.path,
      description: comment?.brief,
      tags: comment?.tags || [],
    });
  }

  return endpoints;
}

// ── Drogon Routes ──

function parseDrogonRoutes(file: SourceFile, content: string): EndpointInfo[] {
  const endpoints: EndpointInfo[] = [];
  const lines = file.content.split('\n');

  // Match: ADD_METHOD_TO(Controller, "/path", Get);
  const addMethodRe = /ADD_METHOD_TO\s*\(\s*(\w+)\s*,\s*"([^"]*)"\s*,\s*(\w+)\s*\)/g;
  let match: RegExpExecArray | null;

  while ((match = addMethodRe.exec(content)) !== null) {
    const [, controller, path, method] = match;
    const lineNum = getLineNumber(file.content, match.index);
    const comment = extractDoxygenComment(lines, lineNum);

    endpoints.push({
      protocol: 'rest',
      httpMethod: method.toUpperCase(),
      path,
      name: `${controller}::${method.toLowerCase()}`,
      handler: method.toLowerCase(),
      handlerClass: controller,
      parameters: extractDrogonParams(path),
      returnType: 'HttpResponsePtr',
      filePath: file.path,
      description: comment?.brief,
      tags: comment?.tags || [],
    });
  }

  // Match: app().registerHandler("/path", &Controller::method, {Get})
  const registerRe = /registerHandler\s*\(\s*"([^"]*)"\s*,\s*&(\w+)::(\w+)(?:\s*,\s*\{([^}]*)\})?/g;

  while ((match = registerRe.exec(content)) !== null) {
    const [, path, className, methodName, methods] = match;
    const lineNum = getLineNumber(file.content, match.index);
    const comment = extractDoxygenComment(lines, lineNum);
    const methodList = methods ? methods.split(',').map(m => m.trim()) : ['Get'];

    for (const method of methodList) {
      endpoints.push({
        protocol: 'rest',
        httpMethod: method.replace(/^drogon::(Get|Post|Put|Delete|Patch)/, '$1').toUpperCase(),
        path,
        name: `${className}::${methodName}`,
        handler: methodName,
        handlerClass: className,
        parameters: extractDrogonParams(path),
        returnType: 'HttpResponsePtr',
        filePath: file.path,
        description: comment?.brief,
        tags: comment?.tags || [],
      });
    }
  }

  return endpoints;
}

// ── cpp-httplib Routes ──

function parseCppHttplibRoutes(file: SourceFile, content: string): EndpointInfo[] {
  const endpoints: EndpointInfo[] = [];
  const lines = file.content.split('\n');

  // Match: svr.Get("/path", [](const Request& req, Response& res) { ... })
  const routeRe = /svr\.(Get|Post|Put|Delete|Patch|Options)\s*\(\s*"([^"]*)"/g;
  let match: RegExpExecArray | null;

  while ((match = routeRe.exec(content)) !== null) {
    const [, method, path] = match;
    const lineNum = getLineNumber(file.content, match.index);
    const comment = extractDoxygenComment(lines, lineNum);

    endpoints.push({
      protocol: 'rest',
      httpMethod: method.toUpperCase(),
      path,
      name: `${method.toUpperCase()} ${path}`,
      handler: 'lambda',
      handlerClass: 'httplib::Server',
      parameters: extractPathParams(path),
      returnType: 'void',
      filePath: file.path,
      description: comment?.brief,
      tags: comment?.tags || [],
    });
  }

  return endpoints;
}

// ── Boost.Beast Routes (heuristic) ──

function parseBoostBeastRoutes(file: SourceFile, content: string): EndpointInfo[] {
  const endpoints: EndpointInfo[] = [];
  const lines = file.content.split('\n');

  // Match: case http::verb::get: if (target == "/path")
  const routeRe = /case\s+http::verb::(\w+).*?target\s*==\s*"([^"]*)"/g;
  let match: RegExpExecArray | null;

  while ((match = routeRe.exec(content)) !== null) {
    const [, method, path] = match;
    const lineNum = getLineNumber(file.content, match.index);
    const comment = extractDoxygenComment(lines, lineNum);

    endpoints.push({
      protocol: 'rest',
      httpMethod: method.toUpperCase(),
      path,
      name: `${method.toUpperCase()} ${path}`,
      handler: 'handle_request',
      handlerClass: extractClassName(file.content, match.index) || 'session',
      parameters: extractPathParams(path),
      returnType: 'http::response<http::string_body>',
      filePath: file.path,
      description: comment?.brief,
      tags: comment?.tags || [],
    });
  }

  return endpoints;
}

// ── Class Parsing ──

function hasClasses(content: string): boolean {
  return /\bclass\s+\w+/.test(content);
}

interface ClassParseResult {
  types: TypeInfo[];
  services: ServiceInfo[];
  dependencies: DependencyInfo[];
}

function parseClasses(file: SourceFile, content: string, namespaceMap: Map<string, string[]>): ClassParseResult {
  const types: TypeInfo[] = [];
  const services: ServiceInfo[] = [];
  const dependencies: DependencyInfo[] = [];
  const lines = file.content.split('\n');

  // Match: class Name : public Base, private Mixin { ... }
  const classRe = /\bclass\s+(\w+)(?:\s*:\s*([^{]+))?\s*\{/g;
  let match: RegExpExecArray | null;

  while ((match = classRe.exec(content)) !== null) {
    const className = match[1];
    const inheritance = match[2];
    const braceStart = match.index + match[0].length;
    const body = extractBraceBlock(content, braceStart);
    if (!body) continue;

    const lineNum = getLineNumber(file.content, match.index);
    const comment = extractDoxygenComment(lines, lineNum);
    const namespacePath = namespaceMap.get(file.path) || [];
    const fullName = [...namespacePath, className].join('::');

    // Parse inheritance
    const bases = parseInheritance(inheritance);
    for (const base of bases) {
      dependencies.push({
        source: fullName,
        target: base.name,
        type: 'inherit',
      });
    }

    // Parse members and methods
    const { members, methods, accessSpecifiers } = parseClassBody(body);

    // Detect if this is a service class
    const isService = isServiceClass(className, methods);

    // Extract member dependencies
    for (const member of members) {
      const cleanType = cleanTypeName(member.type);
      if (isUserDefinedType(cleanType)) {
        dependencies.push({
          source: fullName,
          target: cleanType,
          type: 'use',
        });
      }
    }

    if (isService) {
      const methodNames = methods.map(m => m.name);
      const serviceDeps = members
        .filter(m => isUserDefinedType(cleanTypeName(m.type)))
        .map(m => cleanTypeName(m.type));

      services.push({
        name: fullName,
        filePath: file.path,
        methods: methodNames,
        dependencies: serviceDeps,
        description: comment?.brief,
      });
    } else {
      const fields = members.map(m => ({
        name: m.name,
        type: m.type,
        required: !m.optional,
        description: m.description,
      }));

      types.push({
        name: fullName,
        kind: 'type',
        fields,
        filePath: file.path,
        description: comment?.brief,
      });
    }
  }

  return { types, services, dependencies };
}

// ── Struct Parsing ──

function hasStructs(content: string): boolean {
  return /\bstruct\s+\w+/.test(content);
}

interface StructParseResult {
  types: TypeInfo[];
  dependencies: DependencyInfo[];
}

function parseStructs(file: SourceFile, content: string, namespaceMap: Map<string, string[]>): StructParseResult {
  const types: TypeInfo[] = [];
  const dependencies: DependencyInfo[] = [];
  const lines = file.content.split('\n');

  // Match: struct Name { ... } or struct Name : Base { ... }
  const structRe = /\bstruct\s+(\w+)(?:\s*:\s*([^{]+))?\s*\{/g;
  let match: RegExpExecArray | null;

  while ((match = structRe.exec(content)) !== null) {
    const structName = match[1];
    const inheritance = match[2];
    const braceStart = match.index + match[0].length;
    const body = extractBraceBlock(content, braceStart);
    if (!body) continue;

    const lineNum = getLineNumber(file.content, match.index);
    const comment = extractDoxygenComment(lines, lineNum);
    const namespacePath = namespaceMap.get(file.path) || [];
    const fullName = [...namespacePath, structName].join('::');

    // Parse inheritance
    const bases = parseInheritance(inheritance);
    for (const base of bases) {
      dependencies.push({
        source: fullName,
        target: base.name,
        type: 'inherit',
      });
    }

    // Parse members (structs default to public)
    const { members } = parseClassBody(body, 'public');

    // Extract dependencies
    for (const member of members) {
      const cleanType = cleanTypeName(member.type);
      if (isUserDefinedType(cleanType)) {
        dependencies.push({
          source: fullName,
          target: cleanType,
          type: 'use',
        });
      }
    }

    const fields = members.map(m => ({
      name: m.name,
      type: m.type,
      required: !m.optional,
      description: m.description,
    }));

    types.push({
      name: fullName,
      kind: 'type',
      fields,
      filePath: file.path,
      description: comment?.brief,
    });
  }

  return { types, dependencies };
}

// ── Enum Parsing ──

function hasEnums(content: string): boolean {
  return /\benum\s+(class\s+)?\w+/.test(content);
}

function parseEnums(file: SourceFile, content: string, namespaceMap: Map<string, string[]>): TypeInfo[] {
  const types: TypeInfo[] = [];
  const lines = file.content.split('\n');

  // Match: enum class Name : Type { ... } or enum Name { ... }
  const enumRe = /\benum\s+(class\s+)?(\w+)(?:\s*:\s*(\w+))?\s*\{/g;
  let match: RegExpExecArray | null;

  while ((match = enumRe.exec(content)) !== null) {
    const isScoped = !!match[1];
    const enumName = match[2];
    const underlyingType = match[3] || 'int';
    const braceStart = match.index + match[0].length;
    const body = extractBraceBlock(content, braceStart);
    if (!body) continue;

    const lineNum = getLineNumber(file.content, match.index);
    const comment = extractDoxygenComment(lines, lineNum);
    const namespacePath = namespaceMap.get(file.path) || [];
    const fullName = [...namespacePath, enumName].join('::');

    // Parse enum values
    const fields: { name: string; type: string; required: boolean; description?: string }[] = [];
    const valueRe = /(\w+)(?:\s*=\s*[^,}]+)?/g;
    let valueMatch: RegExpExecArray | null;

    while ((valueMatch = valueRe.exec(body)) !== null) {
      const valueName = valueMatch[1];
      if (valueName) {
        fields.push({
          name: valueName,
          type: underlyingType,
          required: true,
        });
      }
    }

    if (fields.length > 0) {
      types.push({
        name: fullName,
        kind: 'enum',
        fields,
        filePath: file.path,
        description: comment?.brief,
      });
    }
  }

  return types;
}

// ── Template Type Parsing ──

function hasTemplates(content: string): boolean {
  return /\btemplate\s*</.test(content);
}

function parseTemplateTypes(file: SourceFile, content: string, namespaceMap: Map<string, string[]>): TypeInfo[] {
  const types: TypeInfo[] = [];
  const lines = file.content.split('\n');

  // Match: template<typename T, typename U> class Name { ... }
  const templateRe = /\btemplate\s*<([^>]+)>\s*(?:class|struct)\s+(\w+)(?:\s*:\s*([^{]+))?\s*\{/g;
  let match: RegExpExecArray | null;

  while ((match = templateRe.exec(content)) !== null) {
    const templateParams = match[1];
    const className = match[2];
    const inheritance = match[3];
    const braceStart = match.index + match[0].length;
    const body = extractBraceBlock(content, braceStart);
    if (!body) continue;

    const lineNum = getLineNumber(file.content, match.index);
    const comment = extractDoxygenComment(lines, lineNum);
    const namespacePath = namespaceMap.get(file.path) || [];
    const fullName = [...namespacePath, className].join('::');

    // Parse template parameters
    const tparams = parseTemplateParams(templateParams);

    // Parse class body
    const { members, methods } = parseClassBody(body);

    const fields = members.map(m => ({
      name: m.name,
      type: m.type,
      required: !m.optional,
      description: m.description,
    }));

    types.push({
      name: fullName,
      kind: 'type',
      fields,
      filePath: file.path,
      description: comment?.brief,
    });
  }

  return types;
}

// ── Helper Functions ──

function getLineNumber(content: string, index: number): number {
  return content.substring(0, index).split('\n').length;
}

interface DoxygenComment {
  brief?: string;
  params?: string[];
  returns?: string;
  tags?: string[];
}

function extractDoxygenComment(lines: string[], lineNum: number): DoxygenComment | undefined {
  const comments: string[] = [];
  let inBlock = false;

  // Check for block comment above
  for (let i = lineNum - 2; i >= 0; i--) {
    const line = lines[i]?.trim();
    if (!line) continue;

    if (line === '/**' || line.startsWith('/**')) {
      inBlock = true;
      if (line.length > 3) {
        comments.unshift(line.substring(3).replace(/\*\/$/, '').trim());
      }
      break;
    }

    if (line.endsWith('*/')) {
      comments.unshift(line.substring(0, line.length - 2).replace(/^\*\s?/, '').trim());
    } else if (line.startsWith('*')) {
      comments.unshift(line.substring(1).trim());
    } else if (line.startsWith('///')) {
      comments.unshift(line.substring(3).trim());
    } else {
      break;
    }
  }

  if (comments.length === 0) return undefined;

  const brief = comments.find(c => c && !c.startsWith('@'))?.trim();
  const params = comments.filter(c => c.startsWith('@param')).map(c => c.substring(6).trim());
  const returns = comments.find(c => c.startsWith('@return'))?.substring(7).trim();
  const tags = comments
    .filter(c => c.startsWith('@') && !c.startsWith('@param') && !c.startsWith('@return'))
    .map(c => c.substring(1).split(/\s+/)[0]);

  return { brief, params, returns, tags };
}

interface BaseClass {
  access: 'public' | 'private' | 'protected';
  name: string;
}

function parseInheritance(inheritance?: string): BaseClass[] {
  if (!inheritance) return [];

  const bases: BaseClass[] = [];
  const parts = inheritance.split(',');

  for (const part of parts) {
    const trimmed = part.trim();
    const match = trimmed.match(/^(public|private|protected)?\s*(\w+(?:::\w+)*)/);
    if (match) {
      const access = (match[1] as 'public' | 'private' | 'protected') || 'private';
      const name = match[2];
      bases.push({ access, name });
    }
  }

  return bases;
}

interface Member {
  name: string;
  type: string;
  optional: boolean;
  description?: string;
}

interface Method {
  name: string;
  returnType: string;
  params: string;
  isConst: boolean;
  isVirtual: boolean;
  isStatic: boolean;
}

interface ClassBodyResult {
  members: Member[];
  methods: Method[];
  accessSpecifiers: Map<string, 'public' | 'private' | 'protected'>;
}

function parseClassBody(body: string, defaultAccess: 'public' | 'private' | 'protected' = 'private'): ClassBodyResult {
  const members: Member[] = [];
  const methods: Method[] = [];
  const accessSpecifiers = new Map<string, 'public' | 'private' | 'protected'>();

  let currentAccess = defaultAccess;
  const lines = body.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Access specifier
    if (/^(public|private|protected)\s*:/.test(line)) {
      const match = line.match(/^(public|private|protected)\s*:/);
      if (match) {
        currentAccess = match[1] as 'public' | 'private' | 'protected';
      }
      continue;
    }

    // Skip empty lines and preprocessor
    if (!line || line.startsWith('#')) continue;

    // Method declaration
    const methodMatch = line.match(/^(virtual\s+)?(static\s+)?([\w:<>,\s*&]+)\s+(\w+)\s*\(([^)]*)\)\s*(const)?\s*(override)?\s*(=\s*0)?\s*[;{]/);
    if (methodMatch) {
      const [, isVirtual, isStatic, returnType, methodName, params, isConst] = methodMatch;

      // Skip constructors and destructors
      if (methodName.startsWith('~') || methodName === returnType.trim()) continue;

      methods.push({
        name: methodName,
        returnType: returnType.trim(),
        params: params.trim(),
        isConst: !!isConst,
        isVirtual: !!isVirtual,
        isStatic: !!isStatic,
      });
      accessSpecifiers.set(methodName, currentAccess);
      continue;
    }

    // Member variable
    const memberMatch = line.match(/^(static\s+)?(const\s+)?([\w:<>,\s*&]+)\s+(\w+)(?:\s*=\s*[^;]+)?\s*;/);
    if (memberMatch) {
      const [, , , type, name] = memberMatch;

      members.push({
        name,
        type: type.trim(),
        optional: false,
      });
      accessSpecifiers.set(name, currentAccess);
    }
  }

  return { members, methods, accessSpecifiers };
}

function parseTemplateParams(params: string): string[] {
  const result: string[] = [];
  const parts = params.split(',');

  for (const part of parts) {
    const trimmed = part.trim();
    // Match: typename T, class U, int N, typename T = default
    const match = trimmed.match(/(?:typename|class)\s+(\w+)|(\w+)\s+(\w+)/);
    if (match) {
      result.push(match[1] || match[3]);
    }
  }

  return result;
}

function extractBraceBlock(content: string, startIndex: number): string | null {
  let depth = 1;
  let i = startIndex;

  while (i < content.length && depth > 0) {
    const char = content[i];
    if (char === '{') depth++;
    else if (char === '}') depth--;
    i++;
  }

  return depth === 0 ? content.substring(startIndex, i - 1) : null;
}

function extractClassName(content: string, position: number): string | null {
  // Look backwards for class/struct definition
  const before = content.substring(Math.max(0, position - 500), position);
  const match = before.match(/\b(?:class|struct)\s+(\w+)/);
  return match ? match[1] : null;
}

function extractRouteHandler(content: string, position: number): string | null {
  // Try to find handler function name after route definition
  const after = content.substring(position, position + 200);
  const match = after.match(/\[.*?\]\s*\(.*?\)|&(\w+)::(\w+)|(\w+)/);
  return match ? (match[2] || match[3] || null) : null;
}

function isServiceClass(name: string, methods: Method[]): boolean {
  const lowerName = name.toLowerCase();

  // Check naming patterns
  if (lowerName.endsWith('service') ||
      lowerName.endsWith('manager') ||
      lowerName.endsWith('controller') ||
      lowerName.endsWith('handler') ||
      lowerName.endsWith('repository')) {
    return true;
  }

  // Check if has business logic methods
  const businessMethods = methods.filter(m =>
    !m.name.startsWith('get') &&
    !m.name.startsWith('set') &&
    !m.name.startsWith('is') &&
    m.returnType !== 'void' &&
    m.params.length > 0
  );

  return businessMethods.length >= 2;
}

function cleanTypeName(type: string): string {
  // Remove const, &, *, std::, template params
  let clean = type.replace(/^const\s+/, '')
    .replace(/\s*[&*]+$/, '')
    .replace(/^std::/, '')
    .trim();

  // Remove template parameters
  const bracketIndex = clean.indexOf('<');
  if (bracketIndex !== -1) {
    clean = clean.substring(0, bracketIndex);
  }

  return clean;
}

function isUserDefinedType(type: string): boolean {
  // Check if starts with uppercase (convention for user types)
  if (!/^[A-Z]/.test(type)) return false;

  // Exclude common STL types
  const stdTypes = [
    'String', 'Vector', 'Map', 'Set', 'List', 'Queue', 'Stack',
    'Deque', 'Array', 'Optional', 'Variant', 'Any', 'Tuple',
    'Function', 'Shared_ptr', 'Unique_ptr', 'Weak_ptr',
  ];

  return !stdTypes.includes(type);
}

// ── Parameter Extraction ──

function extractPathParams(path: string): ParameterInfo[] {
  const params: ParameterInfo[] = [];

  // Match :param, {param}, or <param>
  const paramRe = /[:{\<](\w+)[}>\]?]/g;
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

function extractPistacheParams(path: string): ParameterInfo[] {
  return extractPathParams(path);
}

function extractDrogonParams(path: string): ParameterInfo[] {
  const params: ParameterInfo[] = [];

  // Drogon uses {param} or {1}, {2} for positional params
  const paramRe = /\{(\w+)\}/g;
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
