import type { ParserPlugin, SourceFile, ParseResult, EndpointInfo, EntityInfo, ServiceInfo, TypeInfo, DependencyInfo, ParameterInfo, ColumnInfo, RelationInfo } from '@codedocs/core';

export interface CParserOptions {
  /** Whether to include .h files (headers) in parsing. Default: true */
  parseHeaders?: boolean;
}

export function cParser(options: CParserOptions = {}): ParserPlugin {
  const { parseHeaders = true } = options;

  return {
    name: 'c',
    filePattern: parseHeaders ? ['**/*.c', '**/*.h'] : ['**/*.c'],

    async parse(files: SourceFile[]): Promise<ParseResult> {
      const endpoints: EndpointInfo[] = [];
      const entities: EntityInfo[] = [];
      const services: ServiceInfo[] = [];
      const types: TypeInfo[] = [];
      const dependencies: DependencyInfo[] = [];

      for (const file of files) {
        // Parse structs
        if (hasStructs(file.content)) {
          types.push(...parseStructs(file));
        }

        // Parse enums
        if (hasEnums(file.content)) {
          types.push(...parseEnums(file));
        }

        // Parse typedefs
        if (hasTypedefs(file.content)) {
          types.push(...parseTypedefs(file));
        }

        // Parse function-like macros
        if (hasMacros(file.content)) {
          types.push(...parseMacros(file));
        }

        // Parse functions
        if (hasFunctions(file.content)) {
          types.push(...parseFunctions(file));
        }

        // Parse API handler endpoints (web server callbacks)
        if (hasApiHandlers(file.content)) {
          endpoints.push(...parseApiHandlers(file));
        }

        // Group functions into modules (services)
        const moduleServices = groupFunctionsIntoModules(file);
        services.push(...moduleServices);

        // Parse dependencies (#include directives)
        if (hasIncludes(file.content)) {
          dependencies.push(...parseIncludes(file));
        }
      }

      return { endpoints, entities, services, types, dependencies };
    },
  };
}

// ── Struct Detection & Parsing ──

function hasStructs(content: string): boolean {
  return /\bstruct\s+\w+\s*\{/.test(content);
}

function parseStructs(file: SourceFile): TypeInfo[] {
  const types: TypeInfo[] = [];
  const lines = file.content.split('\n');

  // Pattern 1: struct Name { ... };
  const structRe = /\bstruct\s+(\w+)\s*\{/g;
  let match: RegExpExecArray | null;

  while ((match = structRe.exec(file.content)) !== null) {
    const structName = match[1];
    const braceStart = match.index + match[0].length;
    const body = extractBraceBlock(file.content, braceStart);
    if (!body) continue;

    const fields = parseStructFields(body);
    const lineNum = getLineNumber(file.content, match.index);
    const comment = extractComment(lines, lineNum);

    if (fields.length > 0) {
      types.push({
        name: structName,
        kind: 'type',
        fields,
        filePath: file.path,
        description: comment,
      });
    }
  }

  // Pattern 2: typedef struct { ... } Name;
  const typedefStructRe = /typedef\s+struct\s*\{/g;
  let typedefMatch: RegExpExecArray | null;

  while ((typedefMatch = typedefStructRe.exec(file.content)) !== null) {
    const braceStart = typedefMatch.index + typedefMatch[0].length;
    const body = extractBraceBlock(file.content, braceStart);
    if (!body) continue;

    // Find the typedef name after closing brace
    const afterBrace = braceStart + body.length + 1;
    const nameMatch = file.content.substring(afterBrace).match(/^\s*(\w+)\s*;/);
    if (!nameMatch) continue;

    const structName = nameMatch[1];
    const fields = parseStructFields(body);
    const lineNum = getLineNumber(file.content, typedefMatch.index);
    const comment = extractComment(lines, lineNum);

    if (fields.length > 0) {
      types.push({
        name: structName,
        kind: 'type',
        fields,
        filePath: file.path,
        description: comment,
      });
    }
  }

  // Pattern 3: typedef struct Name { ... } Name;
  const typedefNamedStructRe = /typedef\s+struct\s+(\w+)\s*\{/g;
  let typedefNamedMatch: RegExpExecArray | null;

  while ((typedefNamedMatch = typedefNamedStructRe.exec(file.content)) !== null) {
    const structName = typedefNamedMatch[1];
    const braceStart = typedefNamedMatch.index + typedefNamedMatch[0].length;
    const body = extractBraceBlock(file.content, braceStart);
    if (!body) continue;

    const fields = parseStructFields(body);
    const lineNum = getLineNumber(file.content, typedefNamedMatch.index);
    const comment = extractComment(lines, lineNum);

    if (fields.length > 0) {
      types.push({
        name: structName,
        kind: 'type',
        fields,
        filePath: file.path,
        description: comment,
      });
    }
  }

  return types;
}

function parseStructFields(body: string): Array<{ name: string; type: string; required: boolean; description?: string }> {
  const fields: Array<{ name: string; type: string; required: boolean; description?: string }> = [];

  // Remove comments for cleaner parsing
  const cleanBody = removeComments(body);

  // Match field declarations: type name; or type *name; or type name[size];
  const fieldRe = /^\s*((?:const\s+|static\s+|volatile\s+|unsigned\s+|signed\s+|struct\s+|enum\s+|union\s+)*[\w_][\w\s*]*?)\s+([\w_]+(?:\s*\[\s*\d*\s*\])?)\s*;/gm;
  let match: RegExpExecArray | null;

  while ((match = fieldRe.exec(cleanBody)) !== null) {
    const [fullMatch, typeDecl, nameDecl] = match;
    const type = normalizeType(typeDecl.trim());
    const name = nameDecl.trim();

    // Extract inline comment if present
    const lineStart = match.index;
    const lineEnd = body.indexOf('\n', lineStart);
    const line = body.substring(lineStart, lineEnd === -1 ? undefined : lineEnd);
    const description = extractInlineComment(line);

    fields.push({
      name,
      type,
      required: true,
      description,
    });
  }

  return fields;
}

// ── Enum Detection & Parsing ──

function hasEnums(content: string): boolean {
  return /\benum\s+\w+\s*\{/.test(content);
}

function parseEnums(file: SourceFile): TypeInfo[] {
  const types: TypeInfo[] = [];
  const lines = file.content.split('\n');

  // Pattern 1: enum Name { ... };
  const enumRe = /\benum\s+(\w+)\s*\{/g;
  let match: RegExpExecArray | null;

  while ((match = enumRe.exec(file.content)) !== null) {
    const enumName = match[1];
    const braceStart = match.index + match[0].length;
    const body = extractBraceBlock(file.content, braceStart);
    if (!body) continue;

    const fields = parseEnumValues(body);
    const lineNum = getLineNumber(file.content, match.index);
    const comment = extractComment(lines, lineNum);

    if (fields.length > 0) {
      types.push({
        name: enumName,
        kind: 'enum',
        fields,
        filePath: file.path,
        description: comment,
      });
    }
  }

  // Pattern 2: typedef enum { ... } Name;
  const typedefEnumRe = /typedef\s+enum\s*\{/g;
  let typedefMatch: RegExpExecArray | null;

  while ((typedefMatch = typedefEnumRe.exec(file.content)) !== null) {
    const braceStart = typedefMatch.index + typedefMatch[0].length;
    const body = extractBraceBlock(file.content, braceStart);
    if (!body) continue;

    // Find the typedef name after closing brace
    const afterBrace = braceStart + body.length + 1;
    const nameMatch = file.content.substring(afterBrace).match(/^\s*(\w+)\s*;/);
    if (!nameMatch) continue;

    const enumName = nameMatch[1];
    const fields = parseEnumValues(body);
    const lineNum = getLineNumber(file.content, typedefMatch.index);
    const comment = extractComment(lines, lineNum);

    if (fields.length > 0) {
      types.push({
        name: enumName,
        kind: 'enum',
        fields,
        filePath: file.path,
        description: comment,
      });
    }
  }

  // Pattern 3: typedef enum Name { ... } Name;
  const typedefNamedEnumRe = /typedef\s+enum\s+(\w+)\s*\{/g;
  let typedefNamedMatch: RegExpExecArray | null;

  while ((typedefNamedMatch = typedefNamedEnumRe.exec(file.content)) !== null) {
    const enumName = typedefNamedMatch[1];
    const braceStart = typedefNamedMatch.index + typedefNamedMatch[0].length;
    const body = extractBraceBlock(file.content, braceStart);
    if (!body) continue;

    const fields = parseEnumValues(body);
    const lineNum = getLineNumber(file.content, typedefNamedMatch.index);
    const comment = extractComment(lines, lineNum);

    if (fields.length > 0) {
      types.push({
        name: enumName,
        kind: 'enum',
        fields,
        filePath: file.path,
        description: comment,
      });
    }
  }

  return types;
}

function parseEnumValues(body: string): Array<{ name: string; type: string; required: boolean; description?: string }> {
  const fields: Array<{ name: string; type: string; required: boolean; description?: string }> = [];

  // Remove comments for cleaner parsing
  const cleanBody = removeComments(body);

  // Match enum values: NAME, NAME = value, NAME = 0x01, etc.
  const valueRe = /^\s*(\w+)(?:\s*=\s*([^,}]+))?\s*,?/gm;
  let match: RegExpExecArray | null;

  while ((match = valueRe.exec(cleanBody)) !== null) {
    const [, name, value] = match;

    // Extract inline comment if present
    const lineStart = match.index;
    const lineEnd = body.indexOf('\n', lineStart);
    const line = body.substring(lineStart, lineEnd === -1 ? undefined : lineEnd);
    const description = extractInlineComment(line);

    fields.push({
      name,
      type: value ? value.trim() : 'auto',
      required: true,
      description,
    });
  }

  return fields;
}

// ── Typedef Detection & Parsing ──

function hasTypedefs(content: string): boolean {
  return /\btypedef\s+/.test(content);
}

function parseTypedefs(file: SourceFile): TypeInfo[] {
  const types: TypeInfo[] = [];
  const lines = file.content.split('\n');

  // Pattern: typedef old_type new_type; (simple typedefs, not struct/enum)
  const typedefRe = /typedef\s+((?:const\s+|static\s+|volatile\s+|unsigned\s+|signed\s+)*[\w_][\w\s*()[\]]*?)\s+(\w+)\s*;/g;
  let match: RegExpExecArray | null;

  while ((match = typedefRe.exec(file.content)) !== null) {
    const [fullMatch, oldType, newType] = match;

    // Skip struct/enum typedefs (handled separately)
    if (/\b(struct|enum|union)\s+\{/.test(fullMatch)) continue;

    const lineNum = getLineNumber(file.content, match.index);
    const comment = extractComment(lines, lineNum);

    types.push({
      name: newType,
      kind: 'type',
      fields: [
        {
          name: 'base_type',
          type: normalizeType(oldType.trim()),
          required: true,
          description: 'Type alias',
        },
      ],
      filePath: file.path,
      description: comment,
    });
  }

  // Pattern: typedef return_type (*funcptr_name)(params);
  const funcPtrRe = /typedef\s+([\w\s*]+?)\s*\(\s*\*\s*(\w+)\s*\)\s*\(([^)]*)\)\s*;/g;
  let funcPtrMatch: RegExpExecArray | null;

  while ((funcPtrMatch = funcPtrRe.exec(file.content)) !== null) {
    const [, returnType, funcPtrName, params] = funcPtrMatch;
    const lineNum = getLineNumber(file.content, funcPtrMatch.index);
    const comment = extractComment(lines, lineNum);
    const parameters = parseFunctionParameters(params);

    types.push({
      name: funcPtrName,
      kind: 'type',
      fields: [
        {
          name: 'return_type',
          type: normalizeType(returnType.trim()),
          required: true,
        },
        ...parameters.map((p, idx) => ({
          name: p.name || `param${idx}`,
          type: p.type,
          required: true,
          description: p.description,
        })),
      ],
      filePath: file.path,
      description: comment || 'Function pointer type',
    });
  }

  return types;
}

// ── Macro Detection & Parsing ──

function hasMacros(content: string): boolean {
  return /#define\s+\w+\s*\(/.test(content);
}

function parseMacros(file: SourceFile): TypeInfo[] {
  const types: TypeInfo[] = [];
  const lines = file.content.split('\n');

  // Match function-like macros: #define NAME(params) body
  const macroRe = /^#define\s+(\w+)\s*\(([^)]*)\)\s*(.*?)(?:\\\s*$)?/gm;
  let match: RegExpExecArray | null;

  while ((match = macroRe.exec(file.content)) !== null) {
    const [, macroName, params, body] = match;
    const lineNum = getLineNumber(file.content, match.index);
    const comment = extractComment(lines, lineNum);

    // Parse macro parameters
    const paramList = params.split(',').map((p) => p.trim()).filter((p) => p.length > 0);
    const fields: Array<{ name: string; type: string; required: boolean; description?: string }> = paramList.map((param) => ({
      name: param,
      type: 'macro_param',
      required: true,
    }));

    // Add body as a field
    if (body.trim()) {
      fields.push({
        name: 'expansion',
        type: 'macro_body',
        required: false,
        description: body.trim(),
      });
    }

    types.push({
      name: macroName,
      kind: 'type',
      fields,
      filePath: file.path,
      description: comment || 'Function-like macro',
    });
  }

  return types;
}

// ── Function Detection & Parsing ──

function hasFunctions(content: string): boolean {
  // Match function definitions (not declarations ending with ;)
  return /^\s*[\w\s*]+\s+\w+\s*\([^)]*\)\s*\{/m.test(content);
}

function parseFunctions(file: SourceFile): TypeInfo[] {
  const types: TypeInfo[] = [];
  const lines = file.content.split('\n');

  // Match function definitions: return_type function_name(params) {
  // This is a simplified pattern - real C parsing is complex
  const funcRe = /^\s*((?:static\s+|inline\s+|extern\s+|const\s+|volatile\s+)*[\w\s*]+?)\s+(\w+)\s*\(([^)]*)\)\s*\{/gm;
  let match: RegExpExecArray | null;

  while ((match = funcRe.exec(file.content)) !== null) {
    const [, returnType, funcName, paramsStr] = match;

    // Skip obvious non-functions (if, while, for, switch)
    if (/\b(if|while|for|switch|catch)\b/.test(funcName)) continue;

    const lineNum = getLineNumber(file.content, match.index);
    const comment = extractComment(lines, lineNum);
    const params = parseFunctionParameters(paramsStr);

    types.push({
      name: funcName,
      kind: 'type',
      fields: [
        {
          name: 'return_type',
          type: normalizeType(returnType.trim()),
          required: true,
        },
        ...params.map((p, idx) => ({
          name: p.name || `param${idx}`,
          type: p.type,
          required: p.required,
          description: p.description,
        })),
      ],
      filePath: file.path,
      description: comment,
    });
  }

  return types;
}

function parseFunctionParameters(paramsStr: string): Array<{ name: string; type: string; required: boolean; description?: string }> {
  const params: Array<{ name: string; type: string; required: boolean; description?: string }> = [];

  if (!paramsStr.trim() || paramsStr.trim() === 'void') {
    return params;
  }

  // Split by comma (but not inside nested parentheses)
  const paramList = splitParameters(paramsStr);

  for (const param of paramList) {
    const trimmed = param.trim();
    if (!trimmed || trimmed === 'void') continue;

    // Match: type name or type *name or type name[size]
    // This is simplified - real C parameter parsing is complex
    const paramMatch = trimmed.match(/^((?:const\s+|volatile\s+|unsigned\s+|signed\s+|struct\s+|enum\s+)*[\w\s*]+?)\s+([\w_]+(?:\s*\[\s*\d*\s*\])?)\s*$/);

    if (paramMatch) {
      const [, type, name] = paramMatch;
      params.push({
        name: name.trim(),
        type: normalizeType(type.trim()),
        required: true,
      });
    } else {
      // Just a type, no name (e.g., in function pointer declarations)
      params.push({
        name: '',
        type: normalizeType(trimmed),
        required: true,
      });
    }
  }

  return params;
}

// ── API Handler Detection & Parsing ──

function hasApiHandlers(content: string): boolean {
  // Common web server callback patterns
  return /MHD_AccessHandlerCallback|mg_handler_t|mg_event_handler_t|civetweb_handler|microhttpd_handler/.test(content);
}

function parseApiHandlers(file: SourceFile): EndpointInfo[] {
  const endpoints: EndpointInfo[] = [];
  const lines = file.content.split('\n');

  // Pattern 1: MHD (GNU libmicrohttpd) callback signatures
  // int handler(void *cls, struct MHD_Connection *connection, const char *url, ...)
  const mhdRe = /^\s*(?:static\s+)?int\s+(\w+)\s*\([^)]*MHD_Connection[^)]*\)\s*\{/gm;
  let mhdMatch: RegExpExecArray | null;

  while ((mhdMatch = mhdRe.exec(file.content)) !== null) {
    const handlerName = mhdMatch[1];
    const lineNum = getLineNumber(file.content, mhdMatch.index);
    const comment = extractComment(lines, lineNum);

    // Try to extract URL pattern from nearby code
    const urlPattern = extractUrlPatternNearFunction(file.content, mhdMatch.index);

    endpoints.push({
      protocol: 'rest',
      httpMethod: 'ANY',
      path: urlPattern || '/unknown',
      name: handlerName,
      handler: handlerName,
      handlerClass: extractFileName(file.path),
      parameters: [],
      returnType: 'int',
      filePath: file.path,
      description: comment,
      tags: ['microhttpd'],
    });
  }

  // Pattern 2: Mongoose callback signatures
  // void handler(struct mg_connection *c, int ev, void *ev_data, void *fn_data)
  const mgRe = /^\s*(?:static\s+)?void\s+(\w+)\s*\([^)]*mg_connection[^)]*\)\s*\{/gm;
  let mgMatch: RegExpExecArray | null;

  while ((mgMatch = mgRe.exec(file.content)) !== null) {
    const handlerName = mgMatch[1];
    const lineNum = getLineNumber(file.content, mgMatch.index);
    const comment = extractComment(lines, lineNum);
    const urlPattern = extractUrlPatternNearFunction(file.content, mgMatch.index);

    endpoints.push({
      protocol: 'rest',
      httpMethod: 'ANY',
      path: urlPattern || '/unknown',
      name: handlerName,
      handler: handlerName,
      handlerClass: extractFileName(file.path),
      parameters: [],
      returnType: 'void',
      filePath: file.path,
      description: comment,
      tags: ['mongoose'],
    });
  }

  // Pattern 3: Generic handler pattern (common in embedded systems)
  // Detect by looking for route registration patterns
  const routeRegRe = /(?:register_handler|add_route|route_add|mg_http_listen|MHD_add_response_header)\s*\([^,]*,\s*"([^"]+)"[^,]*,\s*(\w+)/g;
  let routeMatch: RegExpExecArray | null;

  while ((routeMatch = routeRegRe.exec(file.content)) !== null) {
    const [, path, handler] = routeMatch;
    const lineNum = getLineNumber(file.content, routeMatch.index);
    const comment = extractComment(lines, lineNum);

    endpoints.push({
      protocol: 'rest',
      httpMethod: 'ANY',
      path,
      name: handler,
      handler,
      handlerClass: extractFileName(file.path),
      parameters: [],
      returnType: 'unknown',
      filePath: file.path,
      description: comment,
      tags: ['web-server'],
    });
  }

  return endpoints;
}

function extractUrlPatternNearFunction(content: string, functionIndex: number): string | null {
  // Look for string literals before/after the function that look like URL patterns
  const searchRadius = 500; // characters
  const start = Math.max(0, functionIndex - searchRadius);
  const end = Math.min(content.length, functionIndex + searchRadius);
  const vicinity = content.substring(start, end);

  const urlMatch = vicinity.match(/"(\/[^"]*?)"/);
  return urlMatch ? urlMatch[1] : null;
}

// ── Module/Service Grouping ──

function groupFunctionsIntoModules(file: SourceFile): ServiceInfo[] {
  const services: ServiceInfo[] = [];

  // Extract all function names from the file
  const funcRe = /^\s*(?:static\s+|inline\s+|extern\s+)?[\w\s*]+?\s+(\w+)\s*\([^)]*\)\s*\{/gm;
  const functions: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = funcRe.exec(file.content)) !== null) {
    const funcName = match[1];
    if (!/\b(if|while|for|switch|catch)\b/.test(funcName)) {
      functions.push(funcName);
    }
  }

  // Group by common prefix (e.g., http_server_init, http_server_start -> http_server)
  const modules = new Map<string, string[]>();

  for (const func of functions) {
    // Extract prefix (words before last underscore)
    const parts = func.split('_');
    if (parts.length < 2) continue;

    // Try different prefix lengths
    for (let i = 1; i < parts.length; i++) {
      const prefix = parts.slice(0, i).join('_');
      if (!modules.has(prefix)) {
        modules.set(prefix, []);
      }
      modules.get(prefix)!.push(func);
    }
  }

  // Filter to keep only meaningful modules (3+ functions with same prefix)
  for (const [prefix, funcs] of modules.entries()) {
    const uniqueFuncs = [...new Set(funcs)];
    if (uniqueFuncs.length >= 3) {
      services.push({
        name: prefix,
        filePath: file.path,
        methods: uniqueFuncs,
        dependencies: [],
        description: `Module grouping for ${prefix}_* functions`,
      });
    }
  }

  return services;
}

// ── Dependency Parsing (#include) ──

function hasIncludes(content: string): boolean {
  return /#include\s+[<"]/.test(content);
}

function parseIncludes(file: SourceFile): DependencyInfo[] {
  const dependencies: DependencyInfo[] = [];

  // Match #include <file.h> or #include "file.h"
  const includeRe = /^\s*#include\s+[<"]([^>"]+)[>"]/gm;
  let match: RegExpExecArray | null;

  while ((match = includeRe.exec(file.content)) !== null) {
    const includePath = match[1];

    // Skip standard library headers
    if (isStandardLibrary(includePath)) continue;

    dependencies.push({
      source: extractFileName(file.path),
      target: includePath,
      type: 'use',
    });
  }

  return dependencies;
}

function isStandardLibrary(header: string): boolean {
  const stdHeaders = [
    'stdio.h', 'stdlib.h', 'string.h', 'math.h', 'time.h',
    'ctype.h', 'stddef.h', 'stdint.h', 'stdbool.h', 'stdarg.h',
    'assert.h', 'errno.h', 'limits.h', 'float.h', 'setjmp.h',
    'signal.h', 'locale.h', 'iso646.h', 'wchar.h', 'wctype.h',
    'complex.h', 'fenv.h', 'inttypes.h', 'tgmath.h', 'uchar.h',
    'unistd.h', 'fcntl.h', 'sys/types.h', 'sys/stat.h', 'dirent.h',
    'pthread.h', 'semaphore.h', 'sys/socket.h', 'netinet/in.h',
    'arpa/inet.h', 'netdb.h', 'sys/select.h', 'sys/time.h',
  ];

  return stdHeaders.includes(header) || header.startsWith('sys/');
}

// ── Helper Functions ──

function extractBraceBlock(content: string, startIndex: number): string | null {
  let depth = 1;
  let i = startIndex;
  let inString = false;
  let inChar = false;
  let escaped = false;

  while (i < content.length && depth > 0) {
    const char = content[i];

    if (escaped) {
      escaped = false;
      i++;
      continue;
    }

    if (char === '\\') {
      escaped = true;
      i++;
      continue;
    }

    if (char === '"' && !inChar) {
      inString = !inString;
    } else if (char === "'" && !inString) {
      inChar = !inChar;
    } else if (!inString && !inChar) {
      if (char === '{') depth++;
      else if (char === '}') depth--;
    }

    i++;
  }

  return depth === 0 ? content.substring(startIndex, i - 1) : null;
}

function getLineNumber(content: string, index: number): number {
  return content.substring(0, index).split('\n').length;
}

function extractComment(lines: string[], lineNum: number): string | undefined {
  const comments: string[] = [];

  // Look for single-line comments (//) above the line
  for (let i = lineNum - 2; i >= 0; i--) {
    const line = lines[i]?.trim();
    if (!line) break;
    if (line.startsWith('//')) {
      comments.unshift(line.replace(/^\/\/\s?/, ''));
    } else if (line.startsWith('/*') || line.endsWith('*/')) {
      // Multi-line comment
      comments.unshift(line.replace(/^\/\*\s?/, '').replace(/\s?\*\/$/, ''));
    } else if (line.includes('*/')) {
      break;
    } else {
      break;
    }
  }

  // Look for Doxygen-style comments (/** ... */ or /// ...)
  for (let i = lineNum - 2; i >= 0; i--) {
    const line = lines[i]?.trim();
    if (!line) break;
    if (line.startsWith('/**') || line.startsWith('///')) {
      const cleaned = line
        .replace(/^\/\*\*\s?/, '')
        .replace(/^\/\/\/\s?/, '')
        .replace(/\s?\*\/$/, '')
        .replace(/^\*\s?/, '');

      // Parse Doxygen tags
      if (cleaned.startsWith('@brief')) {
        comments.unshift(cleaned.replace('@brief', '').trim());
      } else if (cleaned.startsWith('@param')) {
        comments.push(cleaned);
      } else if (cleaned.startsWith('@return')) {
        comments.push(cleaned);
      } else {
        comments.unshift(cleaned);
      }
    } else if (line.startsWith('*')) {
      const cleaned = line.replace(/^\*\s?/, '');
      if (cleaned.startsWith('@brief')) {
        comments.unshift(cleaned.replace('@brief', '').trim());
      } else if (cleaned.startsWith('@param') || cleaned.startsWith('@return')) {
        comments.push(cleaned);
      } else {
        comments.push(cleaned);
      }
    } else if (line === '/*' || line.startsWith('/*')) {
      continue;
    } else {
      break;
    }
  }

  return comments.length > 0 ? comments.join(' ').trim() : undefined;
}

function extractInlineComment(line: string): string | undefined {
  // Look for // or /* comment on the same line
  const slashComment = line.match(/\/\/\s*(.*)/);
  if (slashComment) return slashComment[1].trim();

  const blockComment = line.match(/\/\*\s*(.*?)\s*\*\//);
  if (blockComment) return blockComment[1].trim();

  return undefined;
}

function removeComments(code: string): string {
  // Remove // comments
  let result = code.replace(/\/\/.*$/gm, '');

  // Remove /* */ comments (non-greedy)
  result = result.replace(/\/\*[\s\S]*?\*\//g, '');

  return result;
}

function normalizeType(type: string): string {
  // Clean up type declarations
  return type
    .replace(/\s+/g, ' ')
    .replace(/\s*\*\s*/g, '*')
    .replace(/\s*\[\s*/g, '[')
    .replace(/\s*\]\s*/g, ']')
    .trim();
}

function splitParameters(paramsStr: string): string[] {
  const params: string[] = [];
  let current = '';
  let depth = 0;
  let inString = false;

  for (let i = 0; i < paramsStr.length; i++) {
    const char = paramsStr[i];

    if (char === '"' && paramsStr[i - 1] !== '\\') {
      inString = !inString;
    }

    if (!inString) {
      if (char === '(' || char === '[') depth++;
      else if (char === ')' || char === ']') depth--;
      else if (char === ',' && depth === 0) {
        params.push(current.trim());
        current = '';
        continue;
      }
    }

    current += char;
  }

  if (current.trim()) {
    params.push(current.trim());
  }

  return params;
}

function extractFileName(path: string): string {
  const parts = path.split('/');
  return parts[parts.length - 1]?.replace(/\.[^.]+$/, '') || 'unknown';
}
