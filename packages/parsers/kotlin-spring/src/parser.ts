import type {
  ParserPlugin, SourceFile, ParseResult,
  EndpointInfo, EntityInfo, ServiceInfo, TypeInfo, DependencyInfo,
} from '@codedocs/core';

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
      const { isTreeSitterAvailable, parseCode } = await import('@codedocs/core');

      if (!(await isTreeSitterAvailable())) {
        throw new Error(
          'Tree-sitter is required for Kotlin parsing.\n'
          + 'Install: npm install web-tree-sitter tree-sitter-kotlin',
        );
      }

      const endpoints: EndpointInfo[] = [];
      const entities: EntityInfo[] = [];
      const services: ServiceInfo[] = [];
      const types: TypeInfo[] = [];
      const dependencies: DependencyInfo[] = [];

      for (const file of files) {
        let tree: any;
        try {
          const result = await parseCode(file.content, 'kotlin');
          tree = result.tree;
        } catch {
          continue;
        }

        try {
          const root = tree.rootNode;

          for (const cls of root.descendantsOfType('class_declaration')) {
            const annotations = extractAnnotations(cls);
            const className = fieldText(cls, 'name') ?? childText(cls, 'type_identifier') ?? '';
            if (!className) continue;

            const modifiers = extractModifiers(cls);

            // REST Controller
            if (hasAnnotation(annotations, 'RestController', 'Controller')) {
              endpoints.push(...parseRestEndpoints(cls, className, annotations, file));
            }

            // DGS GraphQL
            if (detectFrameworks && hasAnnotation(annotations, 'DgsComponent')) {
              endpoints.push(...parseDgsEndpoints(cls, className, file));
            }

            // JPA / MongoDB Entity
            if (hasAnnotation(annotations, 'Entity', 'Document', 'Table')) {
              entities.push(parseEntity(cls, className, annotations, file));
            }

            // Service / Component (but not controller)
            if (hasAnnotation(annotations, 'Service', 'Component')
              && !hasAnnotation(annotations, 'RestController', 'Controller', 'DgsComponent')) {
              const svc = parseService(cls, className, file);
              services.push(svc);
              dependencies.push(...svc.dependencies.map(dep => ({
                source: svc.name, target: dep, type: 'inject' as const,
              })));
            }

            // Data class
            if (modifiers.includes('data')) {
              types.push(parseDataClass(cls, className, file));
            }

            // Enum class
            if (modifiers.includes('enum')) {
              types.push(parseEnumClass(cls, className, file));
            }

            // Sealed class
            if (modifiers.includes('sealed')) {
              types.push(parseSealedClass(cls, className, file));
            }
          }

          // Object declarations → services
          for (const obj of root.descendantsOfType('object_declaration')) {
            const objName = fieldText(obj, 'name') ?? childText(obj, 'type_identifier') ?? '';
            if (!objName) continue;
            const methods = obj.descendantsOfType('function_declaration')
              .map((f: any) => fieldText(f, 'name') ?? childText(f, 'simple_identifier') ?? '')
              .filter(Boolean);
            if (methods.length > 0) {
              services.push({ name: objName, filePath: file.path, methods, dependencies: [] });
            }
          }
        } finally {
          tree.delete();
        }
      }

      return { endpoints, entities, services, types, dependencies };
    },
  };
}

// ── AST Helpers ──

interface Annotation { name: string; args: string }

function extractAnnotations(node: any): Annotation[] {
  const result: Annotation[] = [];
  const sources = [
    ...(node.namedChildren?.filter((c: any) => c.type === 'modifiers') ?? []),
    node, // direct children
  ];
  for (const src of sources) {
    for (const annot of src.descendantsOfType?.('annotation') ?? []) {
      const userType = annot.descendantsOfType?.('user_type')?.[0];
      const name = (userType?.descendantsOfType?.('type_identifier')?.[0]
        ?? userType?.descendantsOfType?.('simple_identifier')?.[0])?.text ?? '';
      if (name) {
        result.push({ name, args: annot.descendantsOfType?.('value_arguments')?.[0]?.text ?? '' });
      }
    }
  }
  return result;
}

function extractModifiers(node: any): string[] {
  const result: string[] = [];
  for (const mod of node.namedChildren?.filter((c: any) => c.type === 'modifiers') ?? []) {
    for (const child of mod.namedChildren ?? []) {
      if (['class_modifier', 'visibility_modifier', 'inheritance_modifier'].includes(child.type)) {
        result.push(child.text);
      }
    }
  }
  return result;
}

function hasAnnotation(annotations: Annotation[], ...names: string[]): boolean {
  return annotations.some(a => names.includes(a.name));
}

function fieldText(node: any, field: string): string | undefined {
  return node.childForFieldName?.(field)?.text;
}

function childText(node: any, type: string): string | undefined {
  return node.namedChildren?.find((c: any) => c.type === type)?.text;
}

function stringArg(args: string): string {
  return args.match(/["']([^"']*?)["']/)?.[1] ?? '';
}

function namedArg(args: string, key: string): string | undefined {
  return args.match(new RegExp(`${key}\\s*=\\s*["']([^"']+)["']`))?.[1];
}

function annotationArg(annotations: Annotation[], name: string): string {
  const ann = annotations.find(a => a.name === name);
  return ann ? stringArg(ann.args) : '';
}

function constructorParams(cls: any): any[] {
  return cls.descendantsOfType?.('primary_constructor')?.[0]
    ?.descendantsOfType?.('class_parameter') ?? [];
}

function paramType(param: any): string {
  // Use direct children to avoid picking up types from annotations
  return (param.namedChildren?.find((c: any) => c.type === 'user_type')
    ?? param.namedChildren?.find((c: any) => c.type === 'nullable_type'))?.text?.replace('?', '') ?? 'Any';
}

function serviceRef(cls: any): string | undefined {
  for (const param of constructorParams(cls)) {
    const typeId = param.descendantsOfType?.('user_type')?.[0]
      ?.descendantsOfType?.('type_identifier')?.[0];
    if (typeId?.text?.endsWith('Service')) return typeId.text;
  }
  return undefined;
}

function returnType(fn: any): string {
  return (fn.childForFieldName?.('return_type')
    ?? fn.namedChildren?.find((c: any) => c.type === 'user_type'))?.text ?? 'Unit';
}

// ── Domain Parsers ──

function parseRestEndpoints(cls: any, className: string, annotations: Annotation[], file: SourceFile): EndpointInfo[] {
  const basePath = annotationArg(annotations, 'RequestMapping');
  const endpoints: EndpointInfo[] = [];
  const mappings = [
    { ann: 'GetMapping', method: 'GET' },
    { ann: 'PostMapping', method: 'POST' },
    { ann: 'PutMapping', method: 'PUT' },
    { ann: 'DeleteMapping', method: 'DELETE' },
    { ann: 'PatchMapping', method: 'PATCH' },
  ];

  for (const fn of cls.descendantsOfType?.('function_declaration') ?? []) {
    const fnAnnotations = extractAnnotations(fn);
    const fnName = fieldText(fn, 'name') ?? childText(fn, 'simple_identifier') ?? 'unknown';

    for (const { ann, method } of mappings) {
      const mapping = fnAnnotations.find(a => a.name === ann);
      if (!mapping) continue;
      const path = basePath + (stringArg(mapping.args) || '');
      endpoints.push({
        protocol: 'rest',
        httpMethod: method,
        path: path || '/',
        name: `${method} ${path || '/'}`,
        handler: fnName,
        handlerClass: className,
        parameters: extractParams(fn),
        returnType: returnType(fn),
        serviceRef: serviceRef(cls),
        filePath: file.path,
      });
    }
  }
  return endpoints;
}

function parseDgsEndpoints(cls: any, className: string, file: SourceFile): EndpointInfo[] {
  const endpoints: EndpointInfo[] = [];
  const opMap = [
    { ann: 'DgsQuery', type: 'Query' as const },
    { ann: 'DgsMutation', type: 'Mutation' as const },
    { ann: 'DgsSubscription', type: 'Subscription' as const },
  ];

  for (const fn of cls.descendantsOfType?.('function_declaration') ?? []) {
    const fnAnnotations = extractAnnotations(fn);
    const fnName = fieldText(fn, 'name') ?? childText(fn, 'simple_identifier') ?? 'unknown';

    for (const { ann, type } of opMap) {
      if (fnAnnotations.some(a => a.name === ann)) {
        endpoints.push({
          protocol: 'graphql',
          operationType: type,
          fieldName: fnName,
          name: `${type}.${fnName}`,
          handler: fnName,
          handlerClass: className,
          parameters: extractParams(fn),
          returnType: returnType(fn),
          serviceRef: serviceRef(cls),
          filePath: file.path,
        });
      }
    }
  }
  return endpoints;
}

function parseEntity(cls: any, className: string, annotations: Annotation[], file: SourceFile): EntityInfo {
  const tableName = namedArg(
    annotations.find(a => a.name === 'Table')?.args ?? '', 'name',
  ) ?? className.toLowerCase();
  const isMongoDb = hasAnnotation(annotations, 'Document');

  const columns: EntityInfo['columns'] = [];
  const relations: EntityInfo['relations'] = [];
  const relTypes = ['OneToOne', 'OneToMany', 'ManyToOne', 'ManyToMany'] as const;

  for (const param of constructorParams(cls)) {
    const paramAnnotations = extractAnnotations(param);
    const name = param.namedChildren?.find((c: any) => c.type === 'simple_identifier')?.text ?? '';
    if (!name) continue;

    const matchedRel = relTypes.find(r => paramAnnotations.some(a => a.name === r));
    if (matchedRel) {
      // Use direct child user_type to avoid picking up type_identifiers from annotations
      const paramUserType = param.namedChildren?.find((c: any) => c.type === 'user_type');
      const typeIds = paramUserType?.descendantsOfType?.('type_identifier') ?? [];
      relations.push({ type: matchedRel, target: typeIds[typeIds.length - 1]?.text ?? 'Unknown' });
      continue;
    }

    const type = paramType(param);
    const nullable = param.text.includes('?');
    const isId = paramAnnotations.some(a => a.name === 'Id');
    const colAnnotation = paramAnnotations.find(a => a.name === 'Column');
    columns.push({
      name,
      type,
      dbColumnName: namedArg(colAnnotation?.args ?? '', 'name') ?? name,
      nullable,
      primaryKey: isId,
      unique: colAnnotation?.args.includes('unique = true') ?? false,
    });
  }

  return { name: className, tableName, dbType: isMongoDb ? 'MongoDB' : 'MySQL', columns, relations, indexes: [], filePath: file.path };
}

function parseService(cls: any, className: string, file: SourceFile): ServiceInfo {
  const deps: string[] = [];
  for (const param of constructorParams(cls)) {
    const typeId = param.descendantsOfType?.('user_type')?.[0]
      ?.descendantsOfType?.('type_identifier')?.[0];
    if (typeId) deps.push(typeId.text);
  }

  const methods = (cls.descendantsOfType?.('function_declaration') ?? [])
    .map((fn: any) => fieldText(fn, 'name') ?? childText(fn, 'simple_identifier') ?? '')
    .filter(Boolean);

  return { name: className, filePath: file.path, methods, dependencies: deps };
}

function parseDataClass(cls: any, className: string, file: SourceFile): TypeInfo {
  const fields: TypeInfo['fields'] = [];
  for (const param of constructorParams(cls)) {
    const name = param.namedChildren?.find((c: any) => c.type === 'simple_identifier')?.text ?? '';
    if (name) {
      fields.push({ name, type: paramType(param), required: !param.text.includes('?') });
    }
  }
  return { name: className, kind: inferKind(className), fields, filePath: file.path };
}

function parseEnumClass(cls: any, className: string, file: SourceFile): TypeInfo {
  const fields = (cls.descendantsOfType?.('enum_entry') ?? [])
    .map((e: any) => ({
      name: fieldText(e, 'name') ?? childText(e, 'simple_identifier') ?? '',
      type: className,
      required: true,
    }))
    .filter((f: any) => f.name);
  return { name: className, kind: 'enum', fields, filePath: file.path };
}

function parseSealedClass(cls: any, className: string, file: SourceFile): TypeInfo {
  const fields = (cls.descendantsOfType?.('class_declaration') ?? [])
    .map((sub: any) => fieldText(sub, 'name') ?? childText(sub, 'type_identifier') ?? '')
    .filter((n: string) => n && n !== className)
    .map((n: string) => ({ name: n, type: className, required: true }));
  return { name: className, kind: 'type', fields, filePath: file.path };
}

function extractParams(fn: any): EndpointInfo['parameters'] {
  const locationMap: Record<string, 'path' | 'query' | 'body' | 'header' | 'cookie'> = {
    PathVariable: 'path', RequestParam: 'query', RequestBody: 'body',
    RequestHeader: 'header', CookieValue: 'cookie', InputArgument: 'body',
  };

  // In Kotlin tree-sitter, function parameter annotations are in sibling
  // `parameter_modifiers` nodes, NOT inside the `parameter` node itself.
  // Walk function_value_parameters children and pair modifiers with params.
  const valParams = fn.descendantsOfType?.('function_value_parameters')?.[0];
  if (!valParams) return [];

  const result: EndpointInfo['parameters'] = [];
  const children: any[] = valParams.namedChildren ?? [];
  let pendingModifiers: Annotation[] = [];

  for (const child of children) {
    if (child.type === 'parameter_modifiers') {
      pendingModifiers = extractAnnotations(child);
    } else if (child.type === 'parameter') {
      const name = child.namedChildren?.find((c: any) => c.type === 'simple_identifier')?.text ?? '';
      const type = paramType(child);
      const annotation = pendingModifiers[0]?.name;
      if (name) {
        result.push({ name, type, required: !child.text.includes('?'), location: annotation ? locationMap[annotation] : undefined });
      }
      pendingModifiers = [];
    }
  }
  return result;
}

function inferKind(name: string): 'dto' | 'input' | 'response' | 'enum' | 'interface' | 'type' {
  const lower = name.toLowerCase();
  if (lower.includes('input')) return 'input';
  if (lower.includes('response') || lower.includes('dto')) return 'response';
  return 'dto';
}
