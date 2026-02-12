import type { AnalysisResult, EndpointInfo, EntityInfo, TypeInfo, ServiceInfo } from '../parser/types.js';

export interface VersionComparison {
  fromVersion: string;
  toVersion: string;
  summary: ComparisonSummary;
  endpoints: ItemDiff<EndpointDiff>[];
  entities: ItemDiff<EntityDiff>[];
  types: ItemDiff<TypeDiff>[];
  services: ItemDiff<ServiceDiff>[];
  breakingChanges: BreakingChange[];
}

export interface ComparisonSummary {
  totalChanges: number;
  added: number;
  removed: number;
  modified: number;
  breakingChanges: number;
}

export type DiffStatus = 'added' | 'removed' | 'modified' | 'unchanged';

export interface ItemDiff<T> {
  status: DiffStatus;
  name: string;
  category: string;
  diff: T;
}

export interface FieldChange {
  field: string;
  from: string;
  to: string;
}

export interface EndpointDiff {
  method?: string;
  path?: string;
  prev?: EndpointInfo;
  curr?: EndpointInfo;
  paramChanges: ParamChange[];
  returnTypeChanged: boolean;
  prevReturnType?: string;
  currReturnType?: string;
  handlerChanged: boolean;
  authChanged: boolean;
  deprecatedChanged: boolean;
}

export interface ParamChange {
  status: DiffStatus;
  name: string;
  prevType?: string;
  currType?: string;
  prevRequired?: boolean;
  currRequired?: boolean;
  prevLocation?: string;
  currLocation?: string;
}

export interface EntityDiff {
  prev?: EntityInfo;
  curr?: EntityInfo;
  columnChanges: ColumnChange[];
  relationChanges: RelationChange[];
  tableRenamed: boolean;
  prevTableName?: string;
  currTableName?: string;
}

export interface ColumnChange {
  status: DiffStatus;
  name: string;
  prevType?: string;
  currType?: string;
  nullableChanged: boolean;
  pkChanged: boolean;
  uniqueChanged: boolean;
}

export interface RelationChange {
  status: DiffStatus;
  target: string;
  prevType?: string;
  currType?: string;
}

export interface TypeDiff {
  prev?: TypeInfo;
  curr?: TypeInfo;
  kindChanged: boolean;
  fieldChanges: TypeFieldChange[];
}

export interface TypeFieldChange {
  status: DiffStatus;
  name: string;
  prevType?: string;
  currType?: string;
  requiredChanged: boolean;
}

export interface ServiceDiff {
  prev?: ServiceInfo;
  curr?: ServiceInfo;
  methodChanges: { status: DiffStatus; name: string }[];
  depChanges: { status: DiffStatus; name: string }[];
}

export interface BreakingChange {
  severity: 'critical' | 'warning';
  category: string;
  name: string;
  reason: string;
}

/**
 * Generate a detailed version comparison between two analysis results
 */
export function generateVersionComparison(
  prev: AnalysisResult,
  curr: AnalysisResult,
  fromVersion: string,
  toVersion: string,
): VersionComparison {
  const endpoints = compareEndpoints(prev.endpoints, curr.endpoints);
  const entities = compareEntities(prev.entities, curr.entities);
  const types = compareTypes(prev.types, curr.types);
  const services = compareServices(prev.services, curr.services);

  const breakingChanges = detectBreakingChanges(endpoints, entities, types);

  const added = count(endpoints, 'added') + count(entities, 'added') + count(types, 'added') + count(services, 'added');
  const removed = count(endpoints, 'removed') + count(entities, 'removed') + count(types, 'removed') + count(services, 'removed');
  const modified = count(endpoints, 'modified') + count(entities, 'modified') + count(types, 'modified') + count(services, 'modified');

  return {
    fromVersion,
    toVersion,
    summary: {
      totalChanges: added + removed + modified,
      added,
      removed,
      modified,
      breakingChanges: breakingChanges.length,
    },
    endpoints,
    entities,
    types,
    services,
    breakingChanges,
  };
}

/**
 * Format version comparison as markdown
 */
export function formatVersionComparisonMarkdown(comparison: VersionComparison): string {
  const lines: string[] = [];
  const { summary } = comparison;

  lines.push(`# API Changes: ${comparison.fromVersion} → ${comparison.toVersion}`);
  lines.push('');
  lines.push(`| Metric | Count |`);
  lines.push(`|--------|-------|`);
  lines.push(`| Total Changes | ${summary.totalChanges} |`);
  lines.push(`| Added | ${summary.added} |`);
  lines.push(`| Removed | ${summary.removed} |`);
  lines.push(`| Modified | ${summary.modified} |`);
  lines.push(`| Breaking Changes | ${summary.breakingChanges} |`);
  lines.push('');

  // Breaking changes
  if (comparison.breakingChanges.length > 0) {
    lines.push('## Breaking Changes');
    lines.push('');
    for (const bc of comparison.breakingChanges) {
      const icon = bc.severity === 'critical' ? '[CRITICAL]' : '[WARNING]';
      lines.push(`- ${icon} **${bc.category}/${bc.name}**: ${bc.reason}`);
    }
    lines.push('');
  }

  // Endpoints
  const changedEndpoints = comparison.endpoints.filter((e) => e.status !== 'unchanged');
  if (changedEndpoints.length > 0) {
    lines.push('## Endpoints');
    lines.push('');
    for (const ep of changedEndpoints) {
      const icon = statusIcon(ep.status);
      const method = ep.diff.method || '';
      const path = ep.diff.path || ep.name;
      lines.push(`### ${icon} ${method} ${path}`);
      lines.push('');

      if (ep.diff.returnTypeChanged) {
        lines.push(`- Return type: \`${ep.diff.prevReturnType}\` → \`${ep.diff.currReturnType}\``);
      }
      if (ep.diff.authChanged) {
        lines.push(`- Auth requirement changed`);
      }
      if (ep.diff.paramChanges.length > 0) {
        lines.push('- Parameters:');
        for (const pc of ep.diff.paramChanges) {
          lines.push(`  - ${statusIcon(pc.status)} \`${pc.name}\`: ${pc.prevType || 'n/a'} → ${pc.currType || 'n/a'}`);
        }
      }
      lines.push('');
    }
  }

  // Entities
  const changedEntities = comparison.entities.filter((e) => e.status !== 'unchanged');
  if (changedEntities.length > 0) {
    lines.push('## Entities');
    lines.push('');
    for (const entity of changedEntities) {
      const icon = statusIcon(entity.status);
      lines.push(`### ${icon} ${entity.name}`);
      lines.push('');

      if (entity.diff.tableRenamed) {
        lines.push(`- Table renamed: \`${entity.diff.prevTableName}\` → \`${entity.diff.currTableName}\``);
      }
      if (entity.diff.columnChanges.length > 0) {
        lines.push('- Columns:');
        for (const cc of entity.diff.columnChanges) {
          lines.push(`  - ${statusIcon(cc.status)} \`${cc.name}\`: ${cc.prevType || 'n/a'} → ${cc.currType || 'n/a'}`);
        }
      }
      lines.push('');
    }
  }

  // Types
  const changedTypes = comparison.types.filter((t) => t.status !== 'unchanged');
  if (changedTypes.length > 0) {
    lines.push('## Types');
    lines.push('');
    for (const type of changedTypes) {
      const icon = statusIcon(type.status);
      lines.push(`### ${icon} ${type.name}`);
      lines.push('');

      if (type.diff.kindChanged) {
        lines.push(`- Kind changed: \`${type.diff.prev?.kind}\` → \`${type.diff.curr?.kind}\``);
      }
      if (type.diff.fieldChanges.length > 0) {
        lines.push('- Fields:');
        for (const fc of type.diff.fieldChanges) {
          lines.push(`  - ${statusIcon(fc.status)} \`${fc.name}\`: ${fc.prevType || 'n/a'} → ${fc.currType || 'n/a'}`);
        }
      }
      lines.push('');
    }
  }

  return lines.join('\n');
}

// ── Comparison Functions ──

function compareEndpoints(prev: EndpointInfo[], curr: EndpointInfo[]): ItemDiff<EndpointDiff>[] {
  const results: ItemDiff<EndpointDiff>[] = [];
  const prevMap = new Map(prev.map((ep) => [endpointId(ep), ep]));
  const currMap = new Map(curr.map((ep) => [endpointId(ep), ep]));

  // Added
  for (const [id, ep] of currMap) {
    if (!prevMap.has(id)) {
      results.push({
        status: 'added',
        name: ep.name,
        category: 'endpoint',
        diff: {
          method: ep.httpMethod,
          path: ep.path,
          curr: ep,
          paramChanges: ep.parameters.map((p) => ({
            status: 'added' as DiffStatus, name: p.name, currType: p.type, currRequired: p.required, currLocation: p.location,
          })),
          returnTypeChanged: false,
          currReturnType: ep.returnType,
          handlerChanged: false,
          authChanged: false,
          deprecatedChanged: false,
        },
      });
    }
  }

  // Removed
  for (const [id, ep] of prevMap) {
    if (!currMap.has(id)) {
      results.push({
        status: 'removed',
        name: ep.name,
        category: 'endpoint',
        diff: {
          method: ep.httpMethod,
          path: ep.path,
          prev: ep,
          paramChanges: ep.parameters.map((p) => ({
            status: 'removed' as DiffStatus, name: p.name, prevType: p.type, prevRequired: p.required, prevLocation: p.location,
          })),
          returnTypeChanged: false,
          prevReturnType: ep.returnType,
          handlerChanged: false,
          authChanged: false,
          deprecatedChanged: false,
        },
      });
    }
  }

  // Modified
  for (const [id, currEp] of currMap) {
    const prevEp = prevMap.get(id);
    if (!prevEp) continue;

    const paramChanges = compareParams(prevEp.parameters, currEp.parameters);
    const returnTypeChanged = prevEp.returnType !== currEp.returnType;
    const handlerChanged = prevEp.handler !== currEp.handler;
    const authChanged = prevEp.auth !== currEp.auth;
    const deprecatedChanged = prevEp.deprecated !== currEp.deprecated;

    const hasChanges = returnTypeChanged || handlerChanged || authChanged || deprecatedChanged || paramChanges.some((p) => p.status !== 'unchanged');

    results.push({
      status: hasChanges ? 'modified' : 'unchanged',
      name: currEp.name,
      category: 'endpoint',
      diff: {
        method: currEp.httpMethod,
        path: currEp.path,
        prev: prevEp,
        curr: currEp,
        paramChanges,
        returnTypeChanged,
        prevReturnType: prevEp.returnType,
        currReturnType: currEp.returnType,
        handlerChanged,
        authChanged,
        deprecatedChanged,
      },
    });
  }

  return results;
}

function compareParams(prev: EndpointInfo['parameters'], curr: EndpointInfo['parameters']): ParamChange[] {
  const changes: ParamChange[] = [];
  const prevMap = new Map(prev.map((p) => [p.name, p]));
  const currMap = new Map(curr.map((p) => [p.name, p]));

  for (const [name, p] of currMap) {
    if (!prevMap.has(name)) {
      changes.push({ status: 'added', name, currType: p.type, currRequired: p.required, currLocation: p.location });
    }
  }

  for (const [name, p] of prevMap) {
    if (!currMap.has(name)) {
      changes.push({ status: 'removed', name, prevType: p.type, prevRequired: p.required, prevLocation: p.location });
    }
  }

  for (const [name, currP] of currMap) {
    const prevP = prevMap.get(name);
    if (!prevP) continue;

    const changed = prevP.type !== currP.type || prevP.required !== currP.required || prevP.location !== currP.location;
    changes.push({
      status: changed ? 'modified' : 'unchanged',
      name,
      prevType: prevP.type,
      currType: currP.type,
      prevRequired: prevP.required,
      currRequired: currP.required,
      prevLocation: prevP.location,
      currLocation: currP.location,
    });
  }

  return changes;
}

function compareEntities(prev: EntityInfo[], curr: EntityInfo[]): ItemDiff<EntityDiff>[] {
  const results: ItemDiff<EntityDiff>[] = [];
  const prevMap = new Map(prev.map((e) => [e.name, e]));
  const currMap = new Map(curr.map((e) => [e.name, e]));

  for (const [name, e] of currMap) {
    if (!prevMap.has(name)) {
      results.push({
        status: 'added', name, category: 'entity',
        diff: {
          curr: e, columnChanges: e.columns.map((c) => ({
            status: 'added' as DiffStatus, name: c.name, currType: c.type,
            nullableChanged: false, pkChanged: false, uniqueChanged: false,
          })),
          relationChanges: e.relations.map((r) => ({
            status: 'added' as DiffStatus, target: r.target, currType: r.type,
          })),
          tableRenamed: false,
        },
      });
    }
  }

  for (const [name, e] of prevMap) {
    if (!currMap.has(name)) {
      results.push({
        status: 'removed', name, category: 'entity',
        diff: {
          prev: e, columnChanges: e.columns.map((c) => ({
            status: 'removed' as DiffStatus, name: c.name, prevType: c.type,
            nullableChanged: false, pkChanged: false, uniqueChanged: false,
          })),
          relationChanges: e.relations.map((r) => ({
            status: 'removed' as DiffStatus, target: r.target, prevType: r.type,
          })),
          tableRenamed: false,
        },
      });
    }
  }

  for (const [name, currE] of currMap) {
    const prevE = prevMap.get(name);
    if (!prevE) continue;

    const columnChanges = compareColumns(prevE.columns, currE.columns);
    const relationChanges = compareRelations(prevE.relations, currE.relations);
    const tableRenamed = prevE.tableName !== currE.tableName;
    const hasChanges = tableRenamed || columnChanges.some((c) => c.status !== 'unchanged') || relationChanges.some((r) => r.status !== 'unchanged');

    results.push({
      status: hasChanges ? 'modified' : 'unchanged', name, category: 'entity',
      diff: {
        prev: prevE, curr: currE, columnChanges, relationChanges, tableRenamed,
        prevTableName: prevE.tableName, currTableName: currE.tableName,
      },
    });
  }

  return results;
}

function compareColumns(prev: EntityInfo['columns'], curr: EntityInfo['columns']): ColumnChange[] {
  const changes: ColumnChange[] = [];
  const prevMap = new Map(prev.map((c) => [c.name, c]));
  const currMap = new Map(curr.map((c) => [c.name, c]));

  for (const [name, c] of currMap) {
    if (!prevMap.has(name)) {
      changes.push({ status: 'added', name, currType: c.type, nullableChanged: false, pkChanged: false, uniqueChanged: false });
    }
  }
  for (const [name, c] of prevMap) {
    if (!currMap.has(name)) {
      changes.push({ status: 'removed', name, prevType: c.type, nullableChanged: false, pkChanged: false, uniqueChanged: false });
    }
  }
  for (const [name, currC] of currMap) {
    const prevC = prevMap.get(name);
    if (!prevC) continue;
    const typeChanged = prevC.type !== currC.type;
    const nullableChanged = prevC.nullable !== currC.nullable;
    const pkChanged = prevC.primaryKey !== currC.primaryKey;
    const uniqueChanged = prevC.unique !== currC.unique;
    const changed = typeChanged || nullableChanged || pkChanged || uniqueChanged;
    changes.push({
      status: changed ? 'modified' : 'unchanged', name,
      prevType: prevC.type, currType: currC.type,
      nullableChanged, pkChanged, uniqueChanged,
    });
  }

  return changes;
}

function compareRelations(prev: EntityInfo['relations'], curr: EntityInfo['relations']): RelationChange[] {
  const changes: RelationChange[] = [];
  const prevMap = new Map(prev.map((r) => [r.target, r]));
  const currMap = new Map(curr.map((r) => [r.target, r]));

  for (const [target, r] of currMap) {
    if (!prevMap.has(target)) changes.push({ status: 'added', target, currType: r.type });
  }
  for (const [target, r] of prevMap) {
    if (!currMap.has(target)) changes.push({ status: 'removed', target, prevType: r.type });
  }
  for (const [target, currR] of currMap) {
    const prevR = prevMap.get(target);
    if (!prevR) continue;
    const changed = prevR.type !== currR.type;
    changes.push({ status: changed ? 'modified' : 'unchanged', target, prevType: prevR.type, currType: currR.type });
  }

  return changes;
}

function compareTypes(prev: TypeInfo[], curr: TypeInfo[]): ItemDiff<TypeDiff>[] {
  const results: ItemDiff<TypeDiff>[] = [];
  const prevMap = new Map(prev.map((t) => [t.name, t]));
  const currMap = new Map(curr.map((t) => [t.name, t]));

  for (const [name, t] of currMap) {
    if (!prevMap.has(name)) {
      results.push({
        status: 'added', name, category: 'type',
        diff: {
          curr: t, kindChanged: false,
          fieldChanges: t.fields.map((f) => ({
            status: 'added' as DiffStatus, name: f.name, currType: f.type, requiredChanged: false,
          })),
        },
      });
    }
  }
  for (const [name, t] of prevMap) {
    if (!currMap.has(name)) {
      results.push({
        status: 'removed', name, category: 'type',
        diff: {
          prev: t, kindChanged: false,
          fieldChanges: t.fields.map((f) => ({
            status: 'removed' as DiffStatus, name: f.name, prevType: f.type, requiredChanged: false,
          })),
        },
      });
    }
  }
  for (const [name, currT] of currMap) {
    const prevT = prevMap.get(name);
    if (!prevT) continue;
    const kindChanged = prevT.kind !== currT.kind;
    const fieldChanges = compareTypeFields(prevT.fields, currT.fields);
    const hasChanges = kindChanged || fieldChanges.some((f) => f.status !== 'unchanged');
    results.push({
      status: hasChanges ? 'modified' : 'unchanged', name, category: 'type',
      diff: { prev: prevT, curr: currT, kindChanged, fieldChanges },
    });
  }

  return results;
}

function compareTypeFields(
  prev: TypeInfo['fields'],
  curr: TypeInfo['fields'],
): TypeFieldChange[] {
  const changes: TypeFieldChange[] = [];
  const prevMap = new Map(prev.map((f) => [f.name, f]));
  const currMap = new Map(curr.map((f) => [f.name, f]));

  for (const [name, f] of currMap) {
    if (!prevMap.has(name)) changes.push({ status: 'added', name, currType: f.type, requiredChanged: false });
  }
  for (const [name, f] of prevMap) {
    if (!currMap.has(name)) changes.push({ status: 'removed', name, prevType: f.type, requiredChanged: false });
  }
  for (const [name, currF] of currMap) {
    const prevF = prevMap.get(name);
    if (!prevF) continue;
    const typeChanged = prevF.type !== currF.type;
    const requiredChanged = prevF.required !== currF.required;
    changes.push({
      status: typeChanged || requiredChanged ? 'modified' : 'unchanged',
      name, prevType: prevF.type, currType: currF.type, requiredChanged,
    });
  }

  return changes;
}

function compareServices(prev: ServiceInfo[], curr: ServiceInfo[]): ItemDiff<ServiceDiff>[] {
  const results: ItemDiff<ServiceDiff>[] = [];
  const prevMap = new Map(prev.map((s) => [s.name, s]));
  const currMap = new Map(curr.map((s) => [s.name, s]));

  for (const [name, s] of currMap) {
    if (!prevMap.has(name)) {
      results.push({
        status: 'added', name, category: 'service',
        diff: {
          curr: s,
          methodChanges: s.methods.map((m) => ({ status: 'added' as DiffStatus, name: m })),
          depChanges: s.dependencies.map((d) => ({ status: 'added' as DiffStatus, name: d })),
        },
      });
    }
  }
  for (const [name, s] of prevMap) {
    if (!currMap.has(name)) {
      results.push({
        status: 'removed', name, category: 'service',
        diff: {
          prev: s,
          methodChanges: s.methods.map((m) => ({ status: 'removed' as DiffStatus, name: m })),
          depChanges: s.dependencies.map((d) => ({ status: 'removed' as DiffStatus, name: d })),
        },
      });
    }
  }
  for (const [name, currS] of currMap) {
    const prevS = prevMap.get(name);
    if (!prevS) continue;
    const methodChanges = diffStringList(prevS.methods, currS.methods);
    const depChanges = diffStringList(prevS.dependencies, currS.dependencies);
    const hasChanges = methodChanges.some((m) => m.status !== 'unchanged') || depChanges.some((d) => d.status !== 'unchanged');
    results.push({
      status: hasChanges ? 'modified' : 'unchanged', name, category: 'service',
      diff: { prev: prevS, curr: currS, methodChanges, depChanges },
    });
  }

  return results;
}

function diffStringList(prev: string[], curr: string[]): { status: DiffStatus; name: string }[] {
  const prevSet = new Set(prev);
  const currSet = new Set(curr);
  const changes: { status: DiffStatus; name: string }[] = [];

  for (const name of currSet) {
    changes.push({ status: prevSet.has(name) ? 'unchanged' : 'added', name });
  }
  for (const name of prevSet) {
    if (!currSet.has(name)) changes.push({ status: 'removed', name });
  }

  return changes;
}

// ── Breaking Change Detection ──

function detectBreakingChanges(
  endpoints: ItemDiff<EndpointDiff>[],
  entities: ItemDiff<EntityDiff>[],
  types: ItemDiff<TypeDiff>[],
): BreakingChange[] {
  const breaking: BreakingChange[] = [];

  // Removed endpoints
  for (const ep of endpoints.filter((e) => e.status === 'removed')) {
    breaking.push({
      severity: 'critical',
      category: 'endpoint',
      name: ep.name,
      reason: `Endpoint removed: ${ep.diff.method} ${ep.diff.path}`,
    });
  }

  // Modified endpoints with breaking param changes
  for (const ep of endpoints.filter((e) => e.status === 'modified')) {
    if (ep.diff.returnTypeChanged) {
      breaking.push({
        severity: 'warning',
        category: 'endpoint',
        name: ep.name,
        reason: `Return type changed: ${ep.diff.prevReturnType} → ${ep.diff.currReturnType}`,
      });
    }
    // New required params
    for (const pc of ep.diff.paramChanges) {
      if (pc.status === 'added' && pc.currRequired) {
        breaking.push({
          severity: 'critical',
          category: 'endpoint',
          name: ep.name,
          reason: `New required parameter: ${pc.name} (${pc.currType})`,
        });
      }
      if (pc.status === 'removed') {
        breaking.push({
          severity: 'warning',
          category: 'endpoint',
          name: ep.name,
          reason: `Parameter removed: ${pc.name}`,
        });
      }
      if (pc.status === 'modified' && !pc.prevRequired && pc.currRequired) {
        breaking.push({
          severity: 'critical',
          category: 'endpoint',
          name: ep.name,
          reason: `Parameter became required: ${pc.name}`,
        });
      }
    }
  }

  // Removed entities
  for (const e of entities.filter((e) => e.status === 'removed')) {
    breaking.push({
      severity: 'critical',
      category: 'entity',
      name: e.name,
      reason: 'Entity/table removed',
    });
  }

  // Entity column removals or non-nullable additions
  for (const e of entities.filter((e) => e.status === 'modified')) {
    for (const cc of e.diff.columnChanges) {
      if (cc.status === 'removed') {
        breaking.push({
          severity: 'warning',
          category: 'entity',
          name: e.name,
          reason: `Column removed: ${cc.name}`,
        });
      }
      if (cc.nullableChanged) {
        breaking.push({
          severity: 'warning',
          category: 'entity',
          name: e.name,
          reason: `Column nullability changed: ${cc.name}`,
        });
      }
    }
  }

  // Removed types
  for (const t of types.filter((t) => t.status === 'removed')) {
    breaking.push({
      severity: 'warning',
      category: 'type',
      name: t.name,
      reason: 'Type removed',
    });
  }

  // Required field additions in types
  for (const t of types.filter((t) => t.status === 'modified')) {
    for (const fc of t.diff.fieldChanges) {
      if (fc.status === 'added' && fc.requiredChanged) {
        breaking.push({
          severity: 'warning',
          category: 'type',
          name: t.name,
          reason: `New required field: ${fc.name}`,
        });
      }
    }
  }

  return breaking;
}

// ── Helpers ──

function endpointId(ep: EndpointInfo): string {
  if (ep.protocol === 'rest') return `${ep.httpMethod}:${ep.path}`;
  if (ep.protocol === 'graphql') return `${ep.operationType}:${ep.fieldName}`;
  return ep.name;
}

function count<T extends { status: DiffStatus }>(items: T[], status: DiffStatus): number {
  return items.filter((i) => i.status === status).length;
}

function statusIcon(status: DiffStatus): string {
  switch (status) {
    case 'added': return '[+]';
    case 'removed': return '[-]';
    case 'modified': return '[~]';
    default: return '';
  }
}
