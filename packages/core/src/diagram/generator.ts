import type { AnalysisResult, EndpointInfo, EntityInfo, ServiceInfo, TypeInfo, DependencyInfo } from '../parser/types.js';
import type { DiagramType, DiagramOptions, DiagramResult } from './types.js';

/**
 * Auto-generates Mermaid diagrams from analysis results
 */
export class DiagramGenerator {
  constructor(private analysis: AnalysisResult) {}

  /**
   * Generate a specific diagram type
   */
  generate(options: DiagramOptions): DiagramResult {
    switch (options.type) {
      case 'er': return this.generateErDiagram(options);
      case 'class': return this.generateClassDiagram(options);
      case 'sequence': return this.generateSequenceDiagram(options);
      case 'flowchart': return this.generateFlowchart(options);
      case 'architecture': return this.generateArchitectureDiagram(options);
      case 'api-flow': return this.generateApiFlowDiagram(options);
      case 'dependency': return this.generateDependencyGraph(options);
      default: throw new Error(`Unknown diagram type: ${options.type}`);
    }
  }

  /**
   * Generate all available diagram types
   */
  generateAll(baseOptions: Partial<DiagramOptions> = {}): DiagramResult[] {
    const types: DiagramType[] = ['er', 'class', 'flowchart', 'architecture', 'dependency'];
    const results: DiagramResult[] = [];

    // Only generate if enough data exists
    if (this.analysis.entities.length > 0) {
      results.push(this.generate({ ...baseOptions, type: 'er' }));
    }
    if (this.analysis.types.length > 0) {
      results.push(this.generate({ ...baseOptions, type: 'class' }));
    }
    if (this.analysis.endpoints.length > 0) {
      results.push(this.generate({ ...baseOptions, type: 'sequence' }));
      results.push(this.generate({ ...baseOptions, type: 'api-flow' }));
    }
    if (this.analysis.services.length > 0) {
      results.push(this.generate({ ...baseOptions, type: 'flowchart' }));
    }
    if (this.analysis.dependencies.length > 0) {
      results.push(this.generate({ ...baseOptions, type: 'dependency' }));
    }
    if (this.analysis.services.length > 0 || this.analysis.endpoints.length > 0) {
      results.push(this.generate({ ...baseOptions, type: 'architecture' }));
    }

    return results;
  }

  // ── ER Diagram ──

  private generateErDiagram(options: DiagramOptions): DiagramResult {
    const entities = applyFilter(this.analysis.entities, options.filter);
    const maxNodes = options.maxNodes || 30;
    const selected = entities.slice(0, maxNodes);
    const lines: string[] = ['erDiagram'];
    let edgeCount = 0;

    for (const entity of selected) {
      lines.push(`    ${sanitizeId(entity.name)} {`);
      for (const col of entity.columns) {
        const pk = col.primaryKey ? 'PK' : '';
        const fk = entity.relations.some((r) => r.joinColumn === col.name) ? 'FK' : '';
        const constraint = pk || fk;
        lines.push(`        ${sanitizeType(col.type)} ${sanitizeId(col.name)}${constraint ? ` ${constraint}` : ''}`);
      }
      lines.push('    }');
    }

    // Relations
    if (options.includeRelations !== false) {
      const entityNames = new Set(selected.map((e) => e.name));

      for (const entity of selected) {
        for (const rel of entity.relations) {
          if (!entityNames.has(rel.target)) continue;

          const cardinality = relationToErCardinality(rel.type);
          lines.push(`    ${sanitizeId(entity.name)} ${cardinality} ${sanitizeId(rel.target)} : "${rel.type}"`);
          edgeCount++;
        }
      }
    }

    return {
      type: 'er',
      code: lines.join('\n'),
      title: 'Entity-Relationship Diagram',
      nodeCount: selected.length,
      edgeCount,
    };
  }

  // ── Class Diagram ──

  private generateClassDiagram(options: DiagramOptions): DiagramResult {
    const types = applyFilter(this.analysis.types, options.filter);
    const maxNodes = options.maxNodes || 25;
    const selected = types.slice(0, maxNodes);
    const lines: string[] = ['classDiagram'];
    let edgeCount = 0;
    const direction = options.direction || 'TB';
    lines.push(`    direction ${direction}`);

    for (const type of selected) {
      const stereotype = typeKindToStereotype(type.kind);
      if (stereotype) {
        lines.push(`    class ${sanitizeId(type.name)}${stereotype}`);
      }

      for (const field of type.fields) {
        const visibility = field.required ? '+' : '-';
        lines.push(`    ${sanitizeId(type.name)} : ${visibility}${sanitizeId(field.name)} ${sanitizeType(field.type)}`);
      }
    }

    // Dependencies between types
    const typeNames = new Set(selected.map((t) => t.name));
    for (const type of selected) {
      for (const field of type.fields) {
        const fieldType = cleanGenericType(field.type);
        if (typeNames.has(fieldType) && fieldType !== type.name) {
          lines.push(`    ${sanitizeId(type.name)} --> ${sanitizeId(fieldType)}`);
          edgeCount++;
        }
      }
    }

    // Interface implementations
    const deps = this.analysis.dependencies.filter((d) =>
      d.type === 'implement' && typeNames.has(d.source) && typeNames.has(d.target)
    );
    for (const dep of deps) {
      lines.push(`    ${sanitizeId(dep.source)} ..|> ${sanitizeId(dep.target)}`);
      edgeCount++;
    }

    return {
      type: 'class',
      code: lines.join('\n'),
      title: 'Type Diagram',
      nodeCount: selected.length,
      edgeCount,
    };
  }

  // ── Sequence Diagram ──

  private generateSequenceDiagram(options: DiagramOptions): DiagramResult {
    const endpoints = applyFilter(this.analysis.endpoints, options.filter);
    const maxNodes = options.maxNodes || 10;
    const selected = endpoints.slice(0, maxNodes);
    const lines: string[] = ['sequenceDiagram'];
    let edgeCount = 0;

    // Identify participants
    const participants = new Set<string>();
    participants.add('Client');
    for (const ep of selected) {
      participants.add(sanitizeId(ep.handlerClass));
      if (ep.serviceRef) participants.add(sanitizeId(ep.serviceRef));
    }

    for (const p of participants) {
      lines.push(`    participant ${p}`);
    }

    // Generate sequences
    for (const ep of selected) {
      const method = ep.httpMethod || ep.operationType || 'CALL';
      const path = ep.path || ep.fieldName || ep.name;
      const handler = sanitizeId(ep.handlerClass);

      lines.push(`    Client->>+${handler}: ${method} ${path}`);
      edgeCount++;

      if (ep.serviceRef) {
        const svc = sanitizeId(ep.serviceRef);
        lines.push(`    ${handler}->>+${svc}: ${ep.handler}()`);
        lines.push(`    ${svc}-->>-${handler}: ${ep.returnType}`);
        edgeCount += 2;
      }

      const status = ep.httpMethod ? '200 OK' : ep.returnType;
      lines.push(`    ${handler}-->>-Client: ${status}`);
      edgeCount++;
    }

    return {
      type: 'sequence',
      code: lines.join('\n'),
      title: 'API Sequence Diagram',
      nodeCount: participants.size,
      edgeCount,
    };
  }

  // ── Flowchart (Service Dependency) ──

  private generateFlowchart(options: DiagramOptions): DiagramResult {
    const services = applyFilter(this.analysis.services, options.filter);
    const maxNodes = options.maxNodes || 30;
    const selected = services.slice(0, maxNodes);
    const direction = options.direction || 'TB';
    const lines: string[] = [`flowchart ${direction}`];
    let edgeCount = 0;

    // Nodes
    for (const svc of selected) {
      const methodCount = svc.methods.length;
      lines.push(`    ${sanitizeId(svc.name)}["${svc.name}<br/>${methodCount} methods"]`);
    }

    // Edges from dependencies
    const svcNames = new Set(selected.map((s) => s.name));
    for (const svc of selected) {
      for (const dep of svc.dependencies) {
        if (svcNames.has(dep)) {
          lines.push(`    ${sanitizeId(svc.name)} --> ${sanitizeId(dep)}`);
          edgeCount++;
        }
      }
    }

    return {
      type: 'flowchart',
      code: lines.join('\n'),
      title: 'Service Dependency Flow',
      nodeCount: selected.length,
      edgeCount,
    };
  }

  // ── Architecture Overview ──

  private generateArchitectureDiagram(options: DiagramOptions): DiagramResult {
    const direction = options.direction || 'TB';
    const lines: string[] = [`flowchart ${direction}`];
    let nodeCount = 0;
    let edgeCount = 0;

    // Group endpoints by handler class
    const controllerMap = new Map<string, EndpointInfo[]>();
    for (const ep of this.analysis.endpoints) {
      const cls = ep.handlerClass;
      if (!controllerMap.has(cls)) controllerMap.set(cls, []);
      controllerMap.get(cls)!.push(ep);
    }

    // Client layer
    lines.push('    subgraph Client["Client Layer"]');
    lines.push('        CLIENT["Client / Browser"]');
    lines.push('    end');
    nodeCount++;

    // API layer
    if (controllerMap.size > 0) {
      lines.push('    subgraph API["API Layer"]');
      for (const [cls, eps] of controllerMap) {
        const id = sanitizeId(cls);
        const restCount = eps.filter((e) => e.protocol === 'rest').length;
        const gqlCount = eps.filter((e) => e.protocol === 'graphql').length;
        let label = cls;
        if (restCount > 0) label += `<br/>${restCount} REST`;
        if (gqlCount > 0) label += `<br/>${gqlCount} GraphQL`;
        lines.push(`        ${id}["${label}"]`);
        nodeCount++;
      }
      lines.push('    end');
    }

    // Service layer
    if (this.analysis.services.length > 0) {
      lines.push('    subgraph Services["Service Layer"]');
      const maxSvc = options.maxNodes || 15;
      for (const svc of this.analysis.services.slice(0, maxSvc)) {
        const id = sanitizeId(svc.name);
        lines.push(`        ${id}["${svc.name}<br/>${svc.methods.length} methods"]`);
        nodeCount++;
      }
      lines.push('    end');
    }

    // Data layer
    if (this.analysis.entities.length > 0) {
      lines.push('    subgraph Data["Data Layer"]');
      const maxEntity = options.maxNodes || 10;
      for (const entity of this.analysis.entities.slice(0, maxEntity)) {
        const id = sanitizeId(entity.name);
        lines.push(`        ${id}[("${entity.name}<br/>${entity.tableName}")]`);
        nodeCount++;
      }
      lines.push('    end');
    }

    // Edges: Client -> Controllers
    for (const cls of controllerMap.keys()) {
      lines.push(`    CLIENT --> ${sanitizeId(cls)}`);
      edgeCount++;
    }

    // Edges: Controllers -> Services (deduplicated)
    const addedEdges = new Set<string>();
    for (const ep of this.analysis.endpoints) {
      if (ep.serviceRef) {
        const edgeKey = `${sanitizeId(ep.handlerClass)}->${sanitizeId(ep.serviceRef)}`;
        if (!addedEdges.has(edgeKey)) {
          lines.push(`    ${sanitizeId(ep.handlerClass)} --> ${sanitizeId(ep.serviceRef)}`);
          addedEdges.add(edgeKey);
          edgeCount++;
        }
      }
    }

    // Edges: Services -> Entities (via dependencies)
    const entityNames = new Set(this.analysis.entities.map((e) => e.name));
    for (const svc of this.analysis.services) {
      for (const dep of svc.dependencies) {
        if (entityNames.has(dep)) {
          lines.push(`    ${sanitizeId(svc.name)} --> ${sanitizeId(dep)}`);
          edgeCount++;
        }
      }
    }

    return {
      type: 'architecture',
      code: lines.join('\n'),
      title: 'Architecture Overview',
      nodeCount,
      edgeCount,
    };
  }

  // ── API Flow Diagram ──

  private generateApiFlowDiagram(options: DiagramOptions): DiagramResult {
    const endpoints = applyFilter(this.analysis.endpoints, options.filter);
    const direction = options.direction || 'LR';
    const maxNodes = options.maxNodes || 20;
    const selected = endpoints.slice(0, maxNodes);
    const lines: string[] = [`flowchart ${direction}`];
    let nodeCount = 0;
    let edgeCount = 0;

    // Group by HTTP method
    const methodGroups = new Map<string, EndpointInfo[]>();
    for (const ep of selected) {
      const method = ep.httpMethod || ep.operationType || 'OTHER';
      if (!methodGroups.has(method)) methodGroups.set(method, []);
      methodGroups.get(method)!.push(ep);
    }

    for (const [method, eps] of methodGroups) {
      lines.push(`    subgraph ${method}["${method}"]`);
      for (const ep of eps) {
        const id = sanitizeId(`${ep.handlerClass}_${ep.name}`);
        const path = ep.path || ep.fieldName || ep.name;
        const style = methodToStyle(method);
        lines.push(`        ${id}["${path}"]${style}`);
        nodeCount++;
      }
      lines.push('    end');
    }

    // Connect endpoints to their handlers
    const handlerSet = new Set<string>();
    for (const ep of selected) {
      const epId = sanitizeId(`${ep.handlerClass}_${ep.name}`);
      const handlerId = sanitizeId(`handler_${ep.handlerClass}`);

      if (!handlerSet.has(ep.handlerClass)) {
        lines.push(`    ${handlerId}(["${ep.handlerClass}"])`);
        handlerSet.add(ep.handlerClass);
        nodeCount++;
      }

      lines.push(`    ${epId} --> ${handlerId}`);
      edgeCount++;
    }

    return {
      type: 'api-flow',
      code: lines.join('\n'),
      title: 'API Flow Diagram',
      nodeCount,
      edgeCount,
    };
  }

  // ── Dependency Graph ──

  private generateDependencyGraph(options: DiagramOptions): DiagramResult {
    const direction = options.direction || 'LR';
    const maxNodes = options.maxNodes || 40;
    const lines: string[] = [`flowchart ${direction}`];
    let nodeCount = 0;
    let edgeCount = 0;

    // Collect all unique nodes
    const nodes = new Set<string>();
    const deps = this.analysis.dependencies.slice(0, maxNodes * 2);

    for (const dep of deps) {
      nodes.add(dep.source);
      nodes.add(dep.target);
    }

    // Group by module if enabled
    if (options.groupByModule) {
      const modules = groupByModule([...nodes], this.analysis);
      for (const [mod, members] of modules) {
        lines.push(`    subgraph ${sanitizeId(mod)}["${mod}"]`);
        for (const member of members) {
          lines.push(`        ${sanitizeId(member)}["${member}"]`);
          nodeCount++;
        }
        lines.push('    end');
      }
    } else {
      for (const node of nodes) {
        const shape = getNodeShape(node, this.analysis);
        lines.push(`    ${sanitizeId(node)}${shape}`);
        nodeCount++;
      }
    }

    // Edges
    for (const dep of deps) {
      const edgeStyle = depTypeToEdge(dep.type);
      lines.push(`    ${sanitizeId(dep.source)} ${edgeStyle} ${sanitizeId(dep.target)}`);
      edgeCount++;
    }

    // Legend
    lines.push('    subgraph Legend');
    lines.push('        L1["─── import"]');
    lines.push('        L2["-·- inject"]');
    lines.push('        L3["=== inherit"]');
    lines.push('    end');

    return {
      type: 'dependency',
      code: lines.join('\n'),
      title: 'Dependency Graph',
      nodeCount,
      edgeCount,
    };
  }
}

// ── Helper Functions ──

function sanitizeId(name: string): string {
  return name.replace(/[^a-zA-Z0-9_]/g, '_');
}

function sanitizeType(type: string): string {
  return type.replace(/[<>[\]{}]/g, '_').replace(/\s/g, '_');
}

function relationToErCardinality(relType: string): string {
  switch (relType) {
    case 'OneToOne': return '||--||';
    case 'OneToMany': return '||--o{';
    case 'ManyToOne': return '}o--||';
    case 'ManyToMany': return '}o--o{';
    default: return '||--||';
  }
}

function typeKindToStereotype(kind: string): string {
  switch (kind) {
    case 'interface': return '~interface~';
    case 'enum': return '~enumeration~';
    case 'dto': return '~DTO~';
    case 'input': return '~input~';
    case 'response': return '~response~';
    default: return '';
  }
}

function cleanGenericType(type: string): string {
  // Extract base type from generics: List<User> -> User, Optional<String> -> String
  const match = type.match(/(?:\w+<)?(\w+)>?/);
  return match ? match[1] : type;
}

function methodToStyle(method: string): string {
  switch (method.toUpperCase()) {
    case 'GET': return ':::get';
    case 'POST': return ':::post';
    case 'PUT': return ':::put';
    case 'DELETE': return ':::delete';
    case 'PATCH': return ':::patch';
    default: return '';
  }
}

function depTypeToEdge(type: string): string {
  switch (type) {
    case 'import': return '-->';
    case 'inject': return '-.->';
    case 'inherit': return '==>';
    case 'implement': return '-.->|impl|';
    case 'use': return '-->|use|';
    default: return '-->';
  }
}

function getNodeShape(name: string, analysis: AnalysisResult): string {
  if (analysis.entities.some((e) => e.name === name)) return `[("${name}")]`;
  if (analysis.services.some((s) => s.name === name)) return `(["${name}"])`;
  if (analysis.types.some((t) => t.name === name && t.kind === 'enum')) return `{{"${name}"}}`;
  return `["${name}"]`;
}

function groupByModule(nodes: string[], analysis: AnalysisResult): Map<string, string[]> {
  const modules = new Map<string, string[]>();

  for (const node of nodes) {
    // Infer module from file path
    let module = 'other';

    const entity = analysis.entities.find((e) => e.name === node);
    if (entity) module = pathToModule(entity.filePath);

    const service = analysis.services.find((s) => s.name === node);
    if (service) module = pathToModule(service.filePath);

    const type = analysis.types.find((t) => t.name === node);
    if (type) module = pathToModule(type.filePath);

    if (!modules.has(module)) modules.set(module, []);
    modules.get(module)!.push(node);
  }

  return modules;
}

function pathToModule(filePath: string): string {
  const parts = filePath.split('/');
  // Use the parent directory as module name
  return parts.length >= 2 ? parts[parts.length - 2] : 'root';
}

function applyFilter<T extends { name: string }>(items: T[], filter?: string[]): T[] {
  if (!filter?.length) return items;
  return items.filter((item) => filter.some((f) =>
    item.name.toLowerCase().includes(f.toLowerCase())
  ));
}
