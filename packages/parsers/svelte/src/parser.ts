import type { ParserPlugin, SourceFile, ParseResult, EndpointInfo, ServiceInfo, TypeInfo, DependencyInfo } from '@codedocs/core';
import { extractScriptBlock, inferTypeFromDefault } from '@codedocs/core';

export interface SvelteParserOptions {
  /** Detect SvelteKit routes and server endpoints */
  detectSvelteKit?: boolean;
  /** Parse Svelte stores */
  parseStores?: boolean;
}

export function svelteParser(options: SvelteParserOptions = {}): ParserPlugin {
  const { detectSvelteKit = true, parseStores = true } = options;

  return {
    name: 'svelte',
    filePattern: ['**/*.svelte', '**/*.ts', '**/*.js'],

    async parse(files: SourceFile[]): Promise<ParseResult> {
      const endpoints: EndpointInfo[] = [];
      const services: ServiceInfo[] = [];
      const types: TypeInfo[] = [];
      const dependencies: DependencyInfo[] = [];

      const isSvelteKit = detectSvelteKit && detectSvelteKitProject(files);

      for (const file of files) {
        // Svelte components
        if (file.path.endsWith('.svelte')) {
          const comp = parseSvelteComponent(file);
          if (comp.type) types.push(comp.type);
          dependencies.push(...comp.deps);
        }

        // SvelteKit server endpoints (+server.ts)
        if (isSvelteKit && isServerEndpoint(file.path)) {
          endpoints.push(...parseSvelteKitEndpoints(file));
        }

        // SvelteKit load functions (+page.server.ts, +layout.server.ts)
        if (isSvelteKit && isServerLoad(file.path)) {
          services.push(...parseServerLoads(file));
        }

        // SvelteKit actions (+page.server.ts)
        if (isSvelteKit && hasFormActions(file.content)) {
          endpoints.push(...parseFormActions(file));
        }

        // Svelte stores
        if (parseStores && hasSvelteStore(file.content)) {
          services.push(...parseSvelteStores(file));
        }

        // TypeScript types/interfaces
        if (hasExportedTypes(file.content)) {
          types.push(...parseExportedTypes(file));
        }
      }

      return { endpoints, services, types, dependencies };
    },
  };
}

// ── SvelteKit Detection ──

function detectSvelteKitProject(files: SourceFile[]): boolean {
  return files.some((f) =>
    f.path.includes('/routes/') ||
    f.content.includes('@sveltejs/kit') ||
    f.content.includes('$app/'),
  );
}

function isServerEndpoint(path: string): boolean {
  return /\+server\.(ts|js)$/.test(path);
}

function isServerLoad(path: string): boolean {
  return /\+(page|layout)\.server\.(ts|js)$/.test(path);
}

// ── Svelte Component Parsing ──

function parseSvelteComponent(file: SourceFile): { type: TypeInfo | null; deps: DependencyInfo[] } {
  const componentName = extractComponentName(file.path);
  const scriptContent = extractScriptBlock(file.content);
  const deps: DependencyInfo[] = [];

  if (!scriptContent) return { type: null, deps };

  const props = extractSvelteProps(scriptContent, file.content);
  const events = extractSvelteEvents(scriptContent, file.content);
  const slots = extractSvelteSlots(file.content);

  // Import dependencies
  deps.push(...extractImportDeps(scriptContent, componentName));

  const fields = [
    ...props.map((p) => ({ ...p, description: p.description ? `[prop] ${p.description}` : '[prop]' })),
    ...events.map((e) => ({ name: e, type: 'event', required: false, description: '[event]' as string })),
    ...slots.map((s) => ({ name: s, type: 'slot', required: false, description: '[slot]' as string })),
  ];

  return {
    type: fields.length > 0 ? {
      name: componentName,
      kind: 'type' as const,
      fields,
      filePath: file.path,
      description: extractComponentDescription(file.content),
    } : null,
    deps,
  };
}

function extractComponentName(filePath: string): string {
  const base = filePath.split('/').pop() || '';
  return base.replace(/\.svelte$/, '');
}

function extractSvelteProps(script: string, fullContent: string): { name: string; type: string; required: boolean; description?: string }[] {
  const props: { name: string; type: string; required: boolean; description?: string }[] = [];

  // Svelte 5 $props() rune
  const propsRuneMatch = script.match(/let\s*\{([^}]*)\}\s*=\s*\$props\s*\(\)/);
  if (propsRuneMatch) {
    const propsList = propsRuneMatch[1].split(',');
    for (const p of propsList) {
      const trimmed = p.trim();
      if (!trimmed) continue;
      const [namepart, defaultVal] = trimmed.split('=').map((s) => s.trim());
      const nameMatch = namepart.match(/(\w+)(?:\s*:\s*(\w+))?/);
      if (nameMatch) {
        props.push({
          name: nameMatch[1],
          type: nameMatch[2] || 'unknown',
          required: !defaultVal,
        });
      }
    }
    return props;
  }

  // Svelte 4: export let propName
  const exportLetRe = /export\s+let\s+(\w+)\s*(?::\s*([\w<>\[\]|&]+))?\s*(?:=\s*([^;]+))?/g;
  let match: RegExpExecArray | null;

  while ((match = exportLetRe.exec(script)) !== null) {
    const [, name, type, defaultValue] = match;
    const comment = extractPropComment(script, match.index);

    props.push({
      name,
      type: type || inferTypeFromDefault(defaultValue),
      required: !defaultValue,
      description: comment,
    });
  }

  return props;
}

function extractSvelteEvents(script: string, fullContent: string): string[] {
  const events: string[] = [];

  // createEventDispatcher
  const dispatcherMatch = script.match(/createEventDispatcher\s*<\s*\{([^}]*)\}/);
  if (dispatcherMatch) {
    const eventRe = /(\w+)\s*:/g;
    let match: RegExpExecArray | null;
    while ((match = eventRe.exec(dispatcherMatch[1])) !== null) {
      events.push(match[1]);
    }
  }

  // dispatch('eventName') calls
  const dispatchRe = /dispatch\s*\(\s*['"](\w[\w-]*)['"]/g;
  let match: RegExpExecArray | null;
  while ((match = dispatchRe.exec(script)) !== null) {
    if (!events.includes(match[1])) events.push(match[1]);
  }

  // on: directive in template
  const onRe = /on:(\w+)/g;
  while ((match = onRe.exec(fullContent)) !== null) {
    if (!events.includes(match[1])) events.push(match[1]);
  }

  return events;
}

function extractSvelteSlots(content: string): string[] {
  const slots: string[] = [];
  const slotRe = /<slot(?:\s+name="(\w+)")?/g;
  let match: RegExpExecArray | null;

  while ((match = slotRe.exec(content)) !== null) {
    slots.push(match[1] || 'default');
  }

  // Svelte 5 {@render children()} snippet slots
  const renderRe = /\{@render\s+(\w+)\s*\(/g;
  while ((match = renderRe.exec(content)) !== null) {
    if (!slots.includes(match[1])) slots.push(match[1]);
  }

  return slots;
}

function extractComponentDescription(content: string): string | undefined {
  // HTML comment at top
  const commentMatch = content.match(/^<!--\s*([\s\S]*?)-->/);
  if (commentMatch) return commentMatch[1].trim();

  // @component jsdoc in script
  const compDoc = content.match(/@component\s+([\s\S]*?)(?:\*\/|-->)/);
  return compDoc ? compDoc[1].trim() : undefined;
}

// ── SvelteKit Server Endpoint Parsing ──

function parseSvelteKitEndpoints(file: SourceFile): EndpointInfo[] {
  const endpoints: EndpointInfo[] = [];
  const routePath = svelteKitRoutePath(file.path);

  // export function GET/POST/PUT/DELETE/PATCH
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
      parameters: extractSvelteKitParams(routePath, file.content),
      returnType: 'Response',
      filePath: file.path,
      description,
      tags: ['sveltekit'],
    });
  }

  // export const GET = ... (arrow function or RequestHandler)
  const constHandlerRe = /export\s+const\s+(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)\s*(?::\s*RequestHandler\s*)?=/g;
  while ((match = constHandlerRe.exec(file.content)) !== null) {
    const method = match[1];
    if (endpoints.some((e) => e.httpMethod === method)) continue;

    endpoints.push({
      protocol: 'rest',
      httpMethod: method,
      path: routePath,
      name: `${method} ${routePath}`,
      handler: method,
      handlerClass: extractFileName(file.path),
      parameters: extractSvelteKitParams(routePath, file.content),
      returnType: 'Response',
      filePath: file.path,
      tags: ['sveltekit'],
    });
  }

  return endpoints;
}

// ── SvelteKit Form Actions ──

function hasFormActions(content: string): boolean {
  return /export\s+const\s+actions/.test(content);
}

function parseFormActions(file: SourceFile): EndpointInfo[] {
  const endpoints: EndpointInfo[] = [];
  const routePath = svelteKitRoutePath(file.path);

  // export const actions = { default: ..., create: ..., delete: ... }
  const actionsMatch = file.content.match(/export\s+const\s+actions\s*(?::\s*Actions\s*)?=\s*\{([\s\S]*?)\}\s*(?:satisfies|;)/);
  if (!actionsMatch) return endpoints;

  const body = actionsMatch[1];
  const actionRe = /(\w+)\s*(?::\s*async)?\s*(?:\(|:)/g;
  let match: RegExpExecArray | null;

  while ((match = actionRe.exec(body)) !== null) {
    const actionName = match[1];
    if (['async', 'function'].includes(actionName)) continue;

    endpoints.push({
      protocol: 'rest',
      httpMethod: 'POST',
      path: actionName === 'default' ? routePath : `${routePath}?/${actionName}`,
      name: `action:${actionName}`,
      handler: actionName,
      handlerClass: extractFileName(file.path),
      parameters: [{ name: 'formData', type: 'FormData', required: true, location: 'body' }],
      returnType: 'ActionResult',
      filePath: file.path,
      tags: ['sveltekit-action'],
    });
  }

  return endpoints;
}

// ── Server Load Functions ──

function parseServerLoads(file: SourceFile): ServiceInfo[] {
  const loads: ServiceInfo[] = [];

  // export const load = ...
  const loadMatch = file.content.match(/export\s+(?:const\s+load|async\s+function\s+load|function\s+load)/);
  if (loadMatch) {
    const deps: string[] = [];

    // Find fetch calls or service dependencies
    const fetchRe = /fetch\s*\(\s*['"`]([^'"`]+)/g;
    let match: RegExpExecArray | null;
    while ((match = fetchRe.exec(file.content)) !== null) {
      deps.push(match[1]);
    }

    loads.push({
      name: `load:${extractFileName(file.path)}`,
      filePath: file.path,
      methods: ['load'],
      dependencies: deps,
      description: extractFunctionComment(file.content, loadMatch.index || 0),
    });
  }

  return loads;
}

// ── Svelte Store Parsing ──

function hasSvelteStore(content: string): boolean {
  return /(?:writable|readable|derived)\s*\(/.test(content);
}

function parseSvelteStores(file: SourceFile): ServiceInfo[] {
  const stores: ServiceInfo[] = [];

  // export const storeName = writable(...)
  const storeRe = /(?:export\s+)?const\s+(\w+)\s*=\s*(writable|readable|derived)\s*(?:<([^>]*)>)?\s*\(/g;
  let match: RegExpExecArray | null;

  while ((match = storeRe.exec(file.content)) !== null) {
    const [, name, storeType, genericType] = match;

    stores.push({
      name,
      filePath: file.path,
      methods: storeType === 'writable' ? ['subscribe', 'set', 'update'] :
               storeType === 'readable' ? ['subscribe'] :
               ['subscribe'],
      dependencies: [],
      description: `${storeType} store${genericType ? ` <${genericType}>` : ''}`,
    });
  }

  return stores;
}

// ── Type Parsing ──

function hasExportedTypes(content: string): boolean {
  return /export\s+(?:interface|type)\s+\w+/.test(content);
}

function parseExportedTypes(file: SourceFile): TypeInfo[] {
  const types: TypeInfo[] = [];

  // interfaces
  const ifaceRe = /export\s+interface\s+(\w+)\s*(?:extends\s+[\w\s,<>]+)?\s*\{([\s\S]*?)\}/g;
  let match: RegExpExecArray | null;

  while ((match = ifaceRe.exec(file.content)) !== null) {
    types.push({
      name: match[1],
      kind: 'interface',
      fields: parseTsFields(match[2]),
      filePath: file.path,
      description: extractTypeComment(file.content, match.index),
    });
  }

  // type aliases with object shape
  const typeRe = /export\s+type\s+(\w+)\s*=\s*\{([\s\S]*?)\}/g;
  while ((match = typeRe.exec(file.content)) !== null) {
    types.push({
      name: match[1],
      kind: 'type',
      fields: parseTsFields(match[2]),
      filePath: file.path,
      description: extractTypeComment(file.content, match.index),
    });
  }

  return types;
}

// ── Helpers ──

function svelteKitRoutePath(filePath: string): string {
  let path = filePath
    .replace(/.*\/routes/, '')
    .replace(/\/\+server\.(ts|js)$/, '')
    .replace(/\/\+page\.server\.(ts|js)$/, '')
    .replace(/\/\+layout\.server\.(ts|js)$/, '');

  // Convert [param] to :param
  path = path.replace(/\[\.\.\.(\w+)\]/g, ':$1*');
  path = path.replace(/\[(\w+)\]/g, ':$1');

  // SvelteKit (group) routes
  path = path.replace(/\/\([^)]+\)/g, '');

  return path || '/';
}

function extractFileName(filePath: string): string {
  return (filePath.split('/').pop() || '').replace(/\.\w+$/, '');
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

function extractTypeComment(content: string, index: number): string | undefined {
  return extractFunctionComment(content, index);
}

function extractPropComment(script: string, index: number): string | undefined {
  const before = script.substring(0, index).trimEnd();
  const lines = before.split('\n');
  const lastLine = lines[lines.length - 1]?.trim();
  if (lastLine?.startsWith('//')) return lastLine.replace(/^\/\/\s?/, '');
  return undefined;
}

function extractSvelteKitParams(routePath: string, content: string): { name: string; type: string; required: boolean; location: 'path' | 'query' | 'body' }[] {
  const params: { name: string; type: string; required: boolean; location: 'path' | 'query' | 'body' }[] = [];

  // Path params
  const pathRe = /:(\w+)/g;
  let match: RegExpExecArray | null;
  while ((match = pathRe.exec(routePath)) !== null) {
    params.push({ name: match[1], type: 'string', required: true, location: 'path' });
  }

  // URL searchParams
  if (/url\.searchParams/.test(content)) {
    const queryRe = /url\.searchParams\.get\s*\(\s*['"](\w+)['"]\s*\)/g;
    while ((match = queryRe.exec(content)) !== null) {
      params.push({ name: match[1], type: 'string', required: false, location: 'query' });
    }
  }

  // request.json() or request.formData()
  if (/request\.json\s*\(\)/.test(content)) {
    params.push({ name: 'body', type: 'object', required: true, location: 'body' });
  }
  if (/request\.formData\s*\(\)/.test(content)) {
    params.push({ name: 'formData', type: 'FormData', required: true, location: 'body' });
  }

  return params;
}

function extractImportDeps(script: string, componentName: string): DependencyInfo[] {
  const deps: DependencyInfo[] = [];
  const importRe = /import\s+.*\s+from\s+['"]([^'"]+)['"]/g;
  let match: RegExpExecArray | null;

  while ((match = importRe.exec(script)) !== null) {
    if (match[1].startsWith('.') || match[1].startsWith('$')) {
      const target = match[1].split('/').pop()?.replace(/\.\w+$/, '') || match[1];
      deps.push({ source: componentName, target, type: 'import' });
    }
  }

  return deps;
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

