import type { ParserPlugin, SourceFile, ParseResult, EndpointInfo, ServiceInfo, TypeInfo, DependencyInfo } from '@codedocs/core';

export interface ReactParserOptions {
  /** Detect Next.js App Router / Pages Router */
  detectNextjs?: boolean;
  /** Parse custom hooks */
  parseHooks?: boolean;
  /** Parse React context providers */
  parseContexts?: boolean;
}

export function reactParser(options: ReactParserOptions = {}): ParserPlugin {
  const { detectNextjs = true, parseHooks = true, parseContexts = true } = options;

  return {
    name: 'react',
    filePattern: ['**/*.tsx', '**/*.jsx', '**/*.ts', '**/*.js'],

    async parse(files: SourceFile[]): Promise<ParseResult> {
      const endpoints: EndpointInfo[] = [];
      const services: ServiceInfo[] = [];
      const types: TypeInfo[] = [];
      const dependencies: DependencyInfo[] = [];

      const isNextProject = detectNextjs && detectNextJs(files);

      for (const file of files) {
        // Next.js API routes
        if (isNextProject && isNextApiRoute(file.path)) {
          endpoints.push(...parseNextApiRoutes(file));
        }

        // Next.js App Router route handlers
        if (isNextProject && isNextAppRouteHandler(file.path, file.content)) {
          endpoints.push(...parseNextAppRouteHandlers(file));
        }

        // React components
        if (isReactComponent(file.content)) {
          const comp = parseComponent(file);
          if (comp) types.push(comp);
        }

        // Custom hooks
        if (parseHooks && hasCustomHook(file.content)) {
          services.push(...parseCustomHooks(file));
        }

        // Context providers
        if (parseContexts && hasContext(file.content)) {
          const ctx = parseContextProvider(file);
          if (ctx) {
            types.push(ctx.type);
            services.push(ctx.service);
          }
        }

        // Props interfaces / types
        if (hasPropsType(file.content)) {
          types.push(...parsePropsTypes(file));
        }

        // Import dependencies
        dependencies.push(...parseImportDeps(file));
      }

      return { endpoints, services, types, dependencies };
    },
  };
}

// ── Next.js Detection ──

function detectNextJs(files: SourceFile[]): boolean {
  return files.some((f) =>
    f.path.includes('/pages/') ||
    f.path.includes('/app/') ||
    f.content.includes('next/') ||
    f.content.includes('from \'next') ||
    f.content.includes('from "next'),
  );
}

function isNextApiRoute(path: string): boolean {
  return /\/pages\/api\//.test(path) || /\/app\/api\//.test(path);
}

function isNextAppRouteHandler(path: string, content: string): boolean {
  return /\/app\/.*\/route\.(ts|js|tsx|jsx)$/.test(path) &&
    /export\s+(?:async\s+)?function\s+(?:GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)/.test(content);
}

// ── Next.js API Route Parsing (Pages Router) ──

function parseNextApiRoutes(file: SourceFile): EndpointInfo[] {
  const endpoints: EndpointInfo[] = [];
  const path = filePathToApiRoute(file.path);

  // Check for method-specific handling
  const methodCheckRe = /req\.method\s*===?\s*['"](\w+)['"]/g;
  let match: RegExpExecArray | null;
  const methods: string[] = [];

  while ((match = methodCheckRe.exec(file.content)) !== null) {
    methods.push(match[1]);
  }

  if (methods.length === 0) {
    // Default export handler
    endpoints.push({
      protocol: 'rest',
      httpMethod: 'ANY',
      path,
      name: `API ${path}`,
      handler: 'default',
      handlerClass: extractFileName(file.path),
      parameters: extractNextApiParams(file.content),
      returnType: 'NextApiResponse',
      filePath: file.path,
      description: extractLeadingComment(file.content),
      tags: ['next-api'],
    });
  } else {
    for (const method of methods) {
      endpoints.push({
        protocol: 'rest',
        httpMethod: method,
        path,
        name: `${method} ${path}`,
        handler: 'default',
        handlerClass: extractFileName(file.path),
        parameters: extractNextApiParams(file.content),
        returnType: 'NextApiResponse',
        filePath: file.path,
        description: extractLeadingComment(file.content),
        tags: ['next-api'],
      });
    }
  }

  return endpoints;
}

// ── Next.js App Router Route Handlers ──

function parseNextAppRouteHandlers(file: SourceFile): EndpointInfo[] {
  const endpoints: EndpointInfo[] = [];
  const routePath = filePathToAppRoute(file.path);

  const handlerRe = /export\s+(?:async\s+)?function\s+(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)\s*\(/g;
  let match: RegExpExecArray | null;

  while ((match = handlerRe.exec(file.content)) !== null) {
    const method = match[1];
    const description = extractFunctionComment(file.content, match.index);

    endpoints.push({
      protocol: 'rest',
      httpMethod: method,
      path: routePath,
      name: `${method} ${routePath}`,
      handler: method,
      handlerClass: extractFileName(file.path),
      parameters: extractAppRouteParams(routePath, file.content),
      returnType: 'Response',
      filePath: file.path,
      description,
      tags: ['next-app-router'],
    });
  }

  return endpoints;
}

// ── React Component Parsing ──

function isReactComponent(content: string): boolean {
  return /(?:export\s+(?:default\s+)?)?(?:function|const)\s+[A-Z]\w*/.test(content) &&
    (/(?:return|=>)\s*[\s\S]*?</.test(content) || /React\.(?:FC|Component)/.test(content));
}

function parseComponent(file: SourceFile): TypeInfo | null {
  // Match: export default function ComponentName({ prop1, prop2 }: Props)
  // or: export const ComponentName: React.FC<Props> = ({ prop1 }) =>
  // or: function ComponentName(props: Props)
  const funcCompRe = /(?:export\s+(?:default\s+)?)?(?:function|const)\s+([A-Z]\w*)\s*(?::\s*React\.FC<(\w+)>\s*=\s*)?\(/;
  const match = file.content.match(funcCompRe);
  if (!match) return null;

  const componentName = match[1];
  const propsTypeName = match[2] || findPropsTypeName(file.content, componentName);

  // Extract props from destructuring or interface
  const props = propsTypeName
    ? extractPropsFromInterface(file.content, propsTypeName)
    : extractPropsFromDestructuring(file.content, componentName);

  return {
    name: componentName,
    kind: 'type',
    fields: props,
    filePath: file.path,
    description: extractLeadingComment(file.content),
  };
}

// ── Custom Hook Parsing ──

function hasCustomHook(content: string): boolean {
  return /(?:export\s+)?(?:function|const)\s+use[A-Z]\w*/.test(content);
}

function parseCustomHooks(file: SourceFile): ServiceInfo[] {
  const hooks: ServiceInfo[] = [];
  const hookRe = /(?:export\s+)?(?:function|const)\s+(use[A-Z]\w*)/g;
  let match: RegExpExecArray | null;

  while ((match = hookRe.exec(file.content)) !== null) {
    const hookName = match[1];
    const returnType = extractHookReturnType(file.content, hookName);
    const deps = extractHookDependencies(file.content, hookName);

    hooks.push({
      name: hookName,
      filePath: file.path,
      methods: returnType ? [returnType] : [],
      dependencies: deps,
      description: extractFunctionComment(file.content, match.index),
    });
  }

  return hooks;
}

// ── Context Provider Parsing ──

function hasContext(content: string): boolean {
  return /createContext/.test(content);
}

function parseContextProvider(file: SourceFile): { type: TypeInfo; service: ServiceInfo } | null {
  const ctxMatch = file.content.match(/(?:export\s+)?const\s+(\w+)\s*=\s*(?:React\.)?createContext/);
  if (!ctxMatch) return null;

  const contextName = ctxMatch[1];

  // Find the provider component
  const providerMatch = file.content.match(
    new RegExp(`(?:export\\s+)?(?:function|const)\\s+(\\w*Provider\\w*)`)
  );
  const providerName = providerMatch?.[1] || `${contextName}Provider`;

  // Extract context value type
  const typeMatch = file.content.match(/createContext<(\w+)>/);
  const typeName = typeMatch?.[1];

  const fields = typeName
    ? extractPropsFromInterface(file.content, typeName)
    : [];

  return {
    type: {
      name: contextName,
      kind: 'type',
      fields,
      filePath: file.path,
      description: `React Context: ${contextName}`,
    },
    service: {
      name: providerName,
      filePath: file.path,
      methods: fields.map((f) => f.name),
      dependencies: extractImportedModules(file.content),
      description: `Context provider for ${contextName}`,
    },
  };
}

// ── Props Type Parsing ──

function hasPropsType(content: string): boolean {
  return /(?:interface|type)\s+\w*Props/.test(content);
}

function parsePropsTypes(file: SourceFile): TypeInfo[] {
  const types: TypeInfo[] = [];

  // Interface Props
  const ifaceRe = /(?:export\s+)?interface\s+(\w*Props\w*)\s*(?:extends\s+[\w\s,<>]+)?\s*\{([\s\S]*?)\}/g;
  let match: RegExpExecArray | null;

  while ((match = ifaceRe.exec(file.content)) !== null) {
    const [, typeName, body] = match;
    types.push({
      name: typeName,
      kind: 'interface',
      fields: parseTsInterfaceFields(body),
      filePath: file.path,
      description: extractTypeComment(file.content, match.index),
    });
  }

  // Type Props
  const typeRe = /(?:export\s+)?type\s+(\w*Props\w*)\s*=\s*\{([\s\S]*?)\}/g;

  while ((match = typeRe.exec(file.content)) !== null) {
    const [, typeName, body] = match;
    types.push({
      name: typeName,
      kind: 'type',
      fields: parseTsInterfaceFields(body),
      filePath: file.path,
      description: extractTypeComment(file.content, match.index),
    });
  }

  return types;
}

// ── Import Dependency Parsing ──

function parseImportDeps(file: SourceFile): DependencyInfo[] {
  const deps: DependencyInfo[] = [];
  const sourceName = extractFileName(file.path);

  const importRe = /import\s+(?:(?:type\s+)?\{[^}]+\}|(\w+))(?:\s*,\s*(?:\{[^}]+\}))?\s+from\s+['"]([^'"]+)['"]/g;
  let match: RegExpExecArray | null;

  while ((match = importRe.exec(file.content)) !== null) {
    const modulePath = match[2];
    // Skip external modules
    if (!modulePath.startsWith('.') && !modulePath.startsWith('@/')) continue;

    const target = extractFileName(modulePath);
    deps.push({
      source: sourceName,
      target,
      type: 'import',
    });
  }

  return deps;
}

// ── Helpers ──

function filePathToApiRoute(filePath: string): string {
  let route = filePath
    .replace(/.*\/pages\/api/, '/api')
    .replace(/\.(ts|js|tsx|jsx)$/, '')
    .replace(/\/index$/, '');

  // Convert [param] to :param
  route = route.replace(/\[\.\.\.(\w+)\]/g, ':$1*');
  route = route.replace(/\[(\w+)\]/g, ':$1');

  return route || '/api';
}

function filePathToAppRoute(filePath: string): string {
  let route = filePath
    .replace(/.*\/app/, '')
    .replace(/\/route\.(ts|js|tsx|jsx)$/, '')
    .replace(/\/page\.(ts|js|tsx|jsx)$/, '');

  route = route.replace(/\[\.\.\.(\w+)\]/g, ':$1*');
  route = route.replace(/\[(\w+)\]/g, ':$1');

  return route || '/';
}

function extractFileName(filePath: string): string {
  const base = filePath.split('/').pop() || filePath;
  return base.replace(/\.(ts|tsx|js|jsx)$/, '');
}

function extractLeadingComment(content: string): string | undefined {
  const match = content.match(/^\/\*\*\s*\n([\s\S]*?)\*\//);
  if (match) {
    return match[1].replace(/^\s*\*\s?/gm, '').trim();
  }
  const lineComment = content.match(/^\/\/\s*(.*)/);
  return lineComment ? lineComment[1] : undefined;
}

function extractFunctionComment(content: string, fnIndex: number): string | undefined {
  const before = content.substring(0, fnIndex).trimEnd();
  const lines = before.split('\n');

  // Check for JSDoc
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim();
    if (line === '*/') {
      const commentLines: string[] = [];
      for (let j = i - 1; j >= 0; j--) {
        const cl = lines[j].trim();
        if (cl.startsWith('/**')) break;
        commentLines.unshift(cl.replace(/^\*\s?/, ''));
      }
      return commentLines.join(' ').trim();
    }
    if (line.startsWith('//')) {
      return line.replace(/^\/\/\s?/, '');
    }
    break;
  }

  return undefined;
}

function extractTypeComment(content: string, typeIndex: number): string | undefined {
  return extractFunctionComment(content, typeIndex);
}

function findPropsTypeName(content: string, componentName: string): string | undefined {
  // Look for ComponentNameProps or Props parameter type
  const propsMatch = content.match(
    new RegExp(`function\\s+${componentName}\\s*\\([^)]*:\\s*(\\w+)`)
  );
  return propsMatch?.[1];
}

function extractPropsFromInterface(content: string, typeName: string): { name: string; type: string; required: boolean; description?: string }[] {
  const ifaceRe = new RegExp(`(?:interface|type)\\s+${typeName}[^{]*\\{([\\s\\S]*?)\\}`);
  const match = content.match(ifaceRe);
  if (!match) return [];
  return parseTsInterfaceFields(match[1]);
}

function extractPropsFromDestructuring(content: string, componentName: string): { name: string; type: string; required: boolean }[] {
  const destructRe = new RegExp(`function\\s+${componentName}\\s*\\(\\s*\\{([^}]*)\\}`);
  const match = content.match(destructRe);
  if (!match) return [];

  return match[1].split(',')
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => {
      const [name, defaultVal] = p.split('=').map((s) => s.trim());
      const cleanName = name.replace(/:\s*\w+/, '').trim();
      return {
        name: cleanName,
        type: 'unknown',
        required: !defaultVal,
      };
    });
}

function parseTsInterfaceFields(body: string): { name: string; type: string; required: boolean; description?: string }[] {
  const fields: { name: string; type: string; required: boolean; description?: string }[] = [];
  const lines = body.split('\n');
  let description: string | undefined;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed === '{' || trimmed === '}') continue;

    // JSDoc comment
    if (trimmed.startsWith('/**') || trimmed.startsWith('*')) {
      const commentText = trimmed.replace(/^\/?\*+\s*|\*\/$/g, '').trim();
      if (commentText) description = commentText;
      continue;
    }

    // Line comment
    if (trimmed.startsWith('//')) {
      description = trimmed.replace(/^\/\/\s?/, '');
      continue;
    }

    // Field: name?: type;
    const fieldMatch = trimmed.match(/^(\w+)(\?)?:\s*(.+?)(?:;|,)?\s*(?:\/\/\s*(.*))?$/);
    if (fieldMatch) {
      const [, name, optional, type, inlineComment] = fieldMatch;
      fields.push({
        name,
        type: type.trim(),
        required: !optional,
        description: inlineComment || description,
      });
      description = undefined;
    }
  }

  return fields;
}

function extractHookReturnType(content: string, hookName: string): string | undefined {
  const returnRe = new RegExp(`function\\s+${hookName}[^)]*\\)\\s*(?::\\s*([\\w<>\\[\\]|&{}]+))?`);
  const match = content.match(returnRe);
  return match?.[1];
}

function extractHookDependencies(content: string, hookName: string): string[] {
  const deps: string[] = [];

  // Find hooks used inside this hook
  const hookBody = extractFunctionBody(content, hookName);
  if (!hookBody) return deps;

  const usedHooksRe = /\b(use\w+)\s*\(/g;
  let match: RegExpExecArray | null;
  const seen = new Set<string>();

  while ((match = usedHooksRe.exec(hookBody)) !== null) {
    const dep = match[1];
    if (dep !== hookName && !seen.has(dep)) {
      seen.add(dep);
      deps.push(dep);
    }
  }

  return deps;
}

function extractFunctionBody(content: string, funcName: string): string | null {
  const funcStart = content.indexOf(`function ${funcName}`);
  if (funcStart === -1) return null;

  const braceStart = content.indexOf('{', funcStart);
  if (braceStart === -1) return null;

  let depth = 1;
  let i = braceStart + 1;
  while (i < content.length && depth > 0) {
    if (content[i] === '{') depth++;
    else if (content[i] === '}') depth--;
    i++;
  }

  return content.substring(braceStart + 1, i - 1);
}

function extractImportedModules(content: string): string[] {
  const modules: string[] = [];
  const importRe = /import\s+.*\s+from\s+['"]([^'"]+)['"]/g;
  let match: RegExpExecArray | null;

  while ((match = importRe.exec(content)) !== null) {
    if (match[1].startsWith('.')) {
      modules.push(extractFileName(match[1]));
    }
  }

  return modules;
}

function extractNextApiParams(content: string): { name: string; type: string; required: boolean; location: 'query' | 'body' }[] {
  const params: { name: string; type: string; required: boolean; location: 'query' | 'body' }[] = [];

  // req.query.paramName
  const queryRe = /req\.query\.(\w+)/g;
  let match: RegExpExecArray | null;
  const seen = new Set<string>();

  while ((match = queryRe.exec(content)) !== null) {
    if (!seen.has(match[1])) {
      seen.add(match[1]);
      params.push({ name: match[1], type: 'string', required: false, location: 'query' });
    }
  }

  // req.body
  if (/req\.body/.test(content)) {
    params.push({ name: 'body', type: 'object', required: true, location: 'body' });
  }

  return params;
}

function extractAppRouteParams(routePath: string, content: string): { name: string; type: string; required: boolean; location: 'path' | 'query' | 'body' }[] {
  const params: { name: string; type: string; required: boolean; location: 'path' | 'query' | 'body' }[] = [];

  // Path params from route
  const pathParamRe = /:(\w+)/g;
  let match: RegExpExecArray | null;
  while ((match = pathParamRe.exec(routePath)) !== null) {
    params.push({ name: match[1], type: 'string', required: true, location: 'path' });
  }

  // searchParams
  if (/searchParams|nextUrl\.searchParams/.test(content)) {
    const queryRe = /searchParams\.get\s*\(\s*['"](\w+)['"]\s*\)/g;
    while ((match = queryRe.exec(content)) !== null) {
      params.push({ name: match[1], type: 'string', required: false, location: 'query' });
    }
  }

  // request.json()
  if (/(?:request|req)\.json\s*\(\)/.test(content)) {
    params.push({ name: 'body', type: 'object', required: true, location: 'body' });
  }

  return params;
}
