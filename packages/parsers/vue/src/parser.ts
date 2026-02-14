import type { ParserPlugin, SourceFile, ParseResult, EndpointInfo, ServiceInfo, TypeInfo, DependencyInfo } from '@codedocs/core';
import { extractScriptBlock, extractTemplateBlock, extractFunctionBody } from '@codedocs/core';

export interface VueParserOptions {
  /** Detect Nuxt.js server routes and pages */
  detectNuxt?: boolean;
  /** Parse composables */
  parseComposables?: boolean;
}

export function vueParser(options: VueParserOptions = {}): ParserPlugin {
  const { detectNuxt = true, parseComposables = true } = options;

  return {
    name: 'vue',
    filePattern: ['**/*.vue', '**/*.ts', '**/*.js'],

    async parse(files: SourceFile[]): Promise<ParseResult> {
      const endpoints: EndpointInfo[] = [];
      const services: ServiceInfo[] = [];
      const types: TypeInfo[] = [];
      const dependencies: DependencyInfo[] = [];

      const isNuxt = detectNuxt && detectNuxtProject(files);

      for (const file of files) {
        // Vue SFC components
        if (file.path.endsWith('.vue')) {
          const comp = parseVueComponent(file);
          if (comp.type) types.push(comp.type);
          dependencies.push(...comp.deps);
        }

        // Nuxt server routes
        if (isNuxt && isNuxtServerRoute(file.path)) {
          endpoints.push(...parseNuxtServerRoutes(file));
        }

        // Nuxt API routes
        if (isNuxt && isNuxtApiRoute(file.path)) {
          endpoints.push(...parseNuxtApiRoutes(file));
        }

        // Composables (use* functions)
        if (parseComposables && hasComposable(file.content)) {
          services.push(...parseComposables_(file));
        }

        // Pinia stores
        if (isPiniaStore(file.content)) {
          const store = parsePiniaStore(file);
          if (store) services.push(store);
        }

        // Props types from .ts files
        if (hasPropsType(file.content)) {
          types.push(...parsePropsTypes(file));
        }
      }

      return { endpoints, services, types, dependencies };
    },
  };
}

// ── Nuxt Detection ──

function detectNuxtProject(files: SourceFile[]): boolean {
  return files.some((f) =>
    f.path.includes('/server/') ||
    f.path.includes('/composables/') ||
    f.content.includes('nuxt') ||
    f.content.includes('defineNuxtConfig'),
  );
}

function isNuxtServerRoute(path: string): boolean {
  return /\/server\/(?:api|routes)\//.test(path);
}

function isNuxtApiRoute(path: string): boolean {
  return /\/server\/api\//.test(path);
}

// ── Vue SFC Parsing ──

function parseVueComponent(file: SourceFile): { type: TypeInfo | null; deps: DependencyInfo[] } {
  const componentName = extractComponentName(file.path);
  const scriptContent = extractScriptBlock(file.content);
  const templateContent = extractTemplateBlock(file.content);
  const deps: DependencyInfo[] = [];

  if (!scriptContent && !templateContent) return { type: null, deps };

  // Extract props
  const props = scriptContent ? extractVueProps(scriptContent) : [];

  // Extract emits
  const emits = scriptContent ? extractVueEmits(scriptContent) : [];

  // Extract slots from template
  const slots = templateContent ? extractVueSlots(templateContent) : [];

  // Import dependencies
  if (scriptContent) {
    deps.push(...extractVueImportDeps(scriptContent, componentName));
  }

  const fields = [
    ...props.map((p) => ({ ...p, description: p.description ? `[prop] ${p.description}` : '[prop]' })),
    ...emits.map((e) => ({ name: e, type: 'event', required: false, description: '[emit]' })),
    ...slots.map((s) => ({ name: s, type: 'slot', required: false, description: '[slot]' })),
  ];

  return {
    type: fields.length > 0 ? {
      name: componentName,
      kind: 'type' as const,
      fields,
      filePath: file.path,
      description: extractVueComponentDescription(file.content),
    } : null,
    deps,
  };
}

function extractComponentName(filePath: string): string {
  const base = filePath.split('/').pop() || '';
  return base.replace(/\.vue$/, '');
}

function extractVueProps(script: string): { name: string; type: string; required: boolean; description?: string }[] {
  const props: { name: string; type: string; required: boolean; description?: string }[] = [];

  // defineProps<Interface>() pattern
  const genericMatch = script.match(/defineProps<(\w+)>/);
  if (genericMatch) {
    return extractInterfaceFields(script, genericMatch[1]);
  }

  // defineProps({ ... }) pattern
  const definePropsMatch = script.match(/defineProps\s*\(\s*\{([\s\S]*?)\}\s*\)/);
  if (definePropsMatch) {
    const body = definePropsMatch[1];
    const propRe = /(\w+)\s*:\s*\{([^}]*)\}/g;
    let match: RegExpExecArray | null;

    while ((match = propRe.exec(body)) !== null) {
      const [, name, config] = match;
      const typeMatch = config.match(/type:\s*(\w+)/);
      const requiredMatch = config.match(/required:\s*(true|false)/);

      props.push({
        name,
        type: typeMatch?.[1] || 'unknown',
        required: requiredMatch?.[1] === 'true',
      });
    }

    // Simple props: propName: Type
    const simplePropRe = /(\w+)\s*:\s*(String|Number|Boolean|Array|Object|Function|Date|Symbol)/g;
    while ((match = simplePropRe.exec(body)) !== null) {
      if (!props.some((p) => p.name === match![1])) {
        props.push({
          name: match[1],
          type: match[2].toLowerCase(),
          required: false,
        });
      }
    }
  }

  // defineProps with array
  const arrayMatch = script.match(/defineProps\s*\(\s*\[([\s\S]*?)\]\s*\)/);
  if (arrayMatch) {
    const names = arrayMatch[1].match(/'(\w+)'|"(\w+)"/g);
    if (names) {
      for (const n of names) {
        props.push({ name: n.replace(/['"]/g, ''), type: 'unknown', required: false });
      }
    }
  }

  return props;
}

function extractVueEmits(script: string): string[] {
  const emits: string[] = [];

  // defineEmits<...>() or defineEmits([...])
  const arrayMatch = script.match(/defineEmits\s*\(\s*\[([\s\S]*?)\]\s*\)/);
  if (arrayMatch) {
    const names = arrayMatch[1].match(/'(\w[\w-]*)'|"(\w[\w-]*)"/g);
    if (names) {
      for (const n of names) {
        emits.push(n.replace(/['"]/g, ''));
      }
    }
  }

  // emit('eventName') usage
  const emitRe = /emit\s*\(\s*['"](\w[\w-]*)['"]/g;
  let match: RegExpExecArray | null;
  while ((match = emitRe.exec(script)) !== null) {
    if (!emits.includes(match[1])) emits.push(match[1]);
  }

  return emits;
}

function extractVueSlots(template: string): string[] {
  const slots: string[] = [];
  const slotRe = /<slot(?:\s+name="(\w+)")?/g;
  let match: RegExpExecArray | null;

  while ((match = slotRe.exec(template)) !== null) {
    slots.push(match[1] || 'default');
  }

  return slots;
}

function extractVueComponentDescription(content: string): string | undefined {
  // Check for <!-- Description --> comment at the top
  const commentMatch = content.match(/^<!--\s*([\s\S]*?)-->/);
  if (commentMatch) return commentMatch[1].trim();

  // Check for @description in script
  const descMatch = content.match(/@description\s+(.*)/);
  return descMatch ? descMatch[1] : undefined;
}

function extractVueImportDeps(script: string, componentName: string): DependencyInfo[] {
  const deps: DependencyInfo[] = [];
  const importRe = /import\s+.*\s+from\s+['"]([^'"]+)['"]/g;
  let match: RegExpExecArray | null;

  while ((match = importRe.exec(script)) !== null) {
    if (match[1].startsWith('.')) {
      const target = match[1].split('/').pop()?.replace(/\.\w+$/, '') || match[1];
      deps.push({ source: componentName, target, type: 'import' });
    }
  }

  return deps;
}

// ── Nuxt Server Route Parsing ──

function parseNuxtServerRoutes(file: SourceFile): EndpointInfo[] {
  const endpoints: EndpointInfo[] = [];
  const routePath = nuxtServerPath(file.path);

  // defineEventHandler pattern
  const handlerMatch = file.content.match(/export\s+default\s+defineEventHandler/);
  if (handlerMatch) {
    const method = detectNuxtMethod(file.path, file.content);
    endpoints.push({
      protocol: 'rest',
      httpMethod: method,
      path: routePath,
      name: `${method} ${routePath}`,
      handler: 'defineEventHandler',
      handlerClass: extractFileName(file.path),
      parameters: extractNuxtParams(routePath, file.content),
      returnType: extractNuxtReturnType(file.content),
      filePath: file.path,
      description: extractLeadingComment(file.content),
      tags: ['nuxt-server'],
    });
  }

  return endpoints;
}

function parseNuxtApiRoutes(file: SourceFile): EndpointInfo[] {
  return parseNuxtServerRoutes(file);
}

function nuxtServerPath(filePath: string): string {
  let path = filePath
    .replace(/.*\/server\/(?:api|routes)/, '/api')
    .replace(/\.(ts|js)$/, '')
    .replace(/\/index$/, '');

  // Method prefix: e.g., users.get.ts -> GET /api/users
  path = path.replace(/\.(get|post|put|delete|patch)$/i, '');

  // Dynamic params: [id] -> :id
  path = path.replace(/\[\.\.\.(\w+)\]/g, ':$1*');
  path = path.replace(/\[(\w+)\]/g, ':$1');

  return path || '/api';
}

function detectNuxtMethod(filePath: string, content: string): string {
  // Method from filename: users.get.ts
  const methodMatch = filePath.match(/\.(get|post|put|delete|patch)\.(ts|js)$/i);
  if (methodMatch) return methodMatch[1].toUpperCase();

  // Method check in code
  if (/getMethod\s*\(.*\)\s*===?\s*['"](\w+)['"]/.test(content)) {
    const m = content.match(/getMethod\s*\(.*\)\s*===?\s*['"](\w+)['"]/);
    return m ? m[1].toUpperCase() : 'GET';
  }

  return 'GET';
}

function extractNuxtParams(routePath: string, content: string): { name: string; type: string; required: boolean; location: 'path' | 'query' | 'body' }[] {
  const params: { name: string; type: string; required: boolean; location: 'path' | 'query' | 'body' }[] = [];

  // Path params
  const pathRe = /:(\w+)/g;
  let match: RegExpExecArray | null;
  while ((match = pathRe.exec(routePath)) !== null) {
    params.push({ name: match[1], type: 'string', required: true, location: 'path' });
  }

  // Query params: getQuery(event)
  const queryRe = /getQuery\s*\(/;
  if (queryRe.test(content)) {
    params.push({ name: 'query', type: 'object', required: false, location: 'query' });
  }

  // Body: readBody(event)
  if (/readBody\s*\(/.test(content)) {
    params.push({ name: 'body', type: 'object', required: true, location: 'body' });
  }

  return params;
}

function extractNuxtReturnType(content: string): string {
  const match = content.match(/defineEventHandler<(\w+)>/);
  return match ? match[1] : 'unknown';
}

// ── Composable Parsing ──

function hasComposable(content: string): boolean {
  return /(?:export\s+)?(?:function|const)\s+use[A-Z]\w*/.test(content);
}

function parseComposables_(file: SourceFile): ServiceInfo[] {
  const composables: ServiceInfo[] = [];
  const compRe = /(?:export\s+)?(?:function|const)\s+(use[A-Z]\w*)/g;
  let match: RegExpExecArray | null;

  while ((match = compRe.exec(file.content)) !== null) {
    const name = match[1];
    const deps: string[] = [];

    // Find inner composable calls
    const body = extractFunctionBody(file.content, name);
    if (body) {
      const innerRe = /\b(use\w+)\s*\(/g;
      let innerMatch: RegExpExecArray | null;
      while ((innerMatch = innerRe.exec(body)) !== null) {
        if (innerMatch[1] !== name && !deps.includes(innerMatch[1])) {
          deps.push(innerMatch[1]);
        }
      }
    }

    composables.push({
      name,
      filePath: file.path,
      methods: extractReturnedMethods(file.content, name),
      dependencies: deps,
      description: extractFunctionComment(file.content, match.index),
    });
  }

  return composables;
}

// ── Pinia Store Parsing ──

function isPiniaStore(content: string): boolean {
  return /defineStore/.test(content);
}

function parsePiniaStore(file: SourceFile): ServiceInfo | null {
  const storeMatch = file.content.match(/defineStore\s*\(\s*['"](\w+)['"]/);
  if (!storeMatch) return null;

  const storeName = storeMatch[1];
  const methods: string[] = [];

  // Extract actions
  const actionsMatch = file.content.match(/actions:\s*\{([\s\S]*?)\}\s*(?:,|\})/);
  if (actionsMatch) {
    const actionRe = /(\w+)\s*\(/g;
    let match: RegExpExecArray | null;
    while ((match = actionRe.exec(actionsMatch[1])) !== null) {
      methods.push(match[1]);
    }
  }

  // Extract getters
  const gettersMatch = file.content.match(/getters:\s*\{([\s\S]*?)\}\s*(?:,|\})/);
  if (gettersMatch) {
    const getterRe = /(\w+)\s*(?:\(|:)/g;
    let match: RegExpExecArray | null;
    while ((match = getterRe.exec(gettersMatch[1])) !== null) {
      methods.push(`get:${match[1]}`);
    }
  }

  // Setup store pattern
  const setupRe = /(?:function|const)\s+\w+\s*\(\)\s*\{([\s\S]*?)return\s*\{([\s\S]*?)\}/;
  const setupMatch = file.content.match(setupRe);
  if (setupMatch) {
    const returned = setupMatch[2];
    const names = returned.match(/\b(\w+)\b/g);
    if (names) methods.push(...names);
  }

  return {
    name: storeName,
    filePath: file.path,
    methods,
    dependencies: extractImportedModules(file.content),
    description: extractLeadingComment(file.content),
  };
}

// ── Shared Helpers ──

function hasPropsType(content: string): boolean {
  return /(?:interface|type)\s+\w*Props/.test(content);
}

function parsePropsTypes(file: SourceFile): TypeInfo[] {
  const types: TypeInfo[] = [];
  const ifaceRe = /(?:export\s+)?interface\s+(\w*Props\w*)\s*(?:extends\s+[\w\s,<>]+)?\s*\{([\s\S]*?)\}/g;
  let match: RegExpExecArray | null;

  while ((match = ifaceRe.exec(file.content)) !== null) {
    types.push({
      name: match[1],
      kind: 'interface',
      fields: parseTsFields(match[2]),
      filePath: file.path,
    });
  }

  return types;
}

function extractInterfaceFields(content: string, typeName: string): { name: string; type: string; required: boolean }[] {
  const re = new RegExp(`(?:interface|type)\\s+${typeName}[^{]*\\{([\\s\\S]*?)\\}`);
  const match = content.match(re);
  if (!match) return [];
  return parseTsFields(match[1]);
}

function parseTsFields(body: string): { name: string; type: string; required: boolean }[] {
  const fields: { name: string; type: string; required: boolean }[] = [];
  const fieldRe = /(\w+)(\?)?:\s*(.+?)(?:;|,|\n)/g;
  let match: RegExpExecArray | null;

  while ((match = fieldRe.exec(body)) !== null) {
    fields.push({
      name: match[1],
      type: match[3].trim(),
      required: !match[2],
    });
  }

  return fields;
}

function extractFileName(filePath: string): string {
  return (filePath.split('/').pop() || '').replace(/\.\w+$/, '');
}

function extractLeadingComment(content: string): string | undefined {
  const match = content.match(/^\/\*\*\s*\n([\s\S]*?)\*\//);
  if (match) return match[1].replace(/^\s*\*\s?/gm, '').trim();
  const line = content.match(/^\/\/\s*(.*)/);
  return line ? line[1] : undefined;
}

function extractFunctionComment(content: string, index: number): string | undefined {
  const before = content.substring(0, index).trimEnd();
  const lines = before.split('\n');
  const lastLine = lines[lines.length - 1]?.trim();

  if (lastLine === '*/') {
    const commentLines: string[] = [];
    for (let i = lines.length - 2; i >= 0; i--) {
      const cl = lines[i].trim();
      if (cl.startsWith('/**')) break;
      commentLines.unshift(cl.replace(/^\*\s?/, ''));
    }
    return commentLines.join(' ').trim();
  }
  if (lastLine?.startsWith('//')) return lastLine.replace(/^\/\/\s?/, '');
  return undefined;
}

function extractReturnedMethods(content: string, funcName: string): string[] {
  const body = extractFunctionBody(content, funcName);
  if (!body) return [];

  const returnMatch = body.match(/return\s*\{([\s\S]*?)\}/);
  if (!returnMatch) return [];

  const names = returnMatch[1].match(/\b(\w+)\b/g);
  return names || [];
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
