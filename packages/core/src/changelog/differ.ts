import type { AnalysisResult, EndpointInfo, EntityInfo, ServiceInfo } from '../parser/types.js';

export interface ChangeEntry {
  type: 'added' | 'removed' | 'modified';
  category: string;
  name: string;
  detail?: string;
  timestamp: string;
}

/**
 * Compare two analysis results and generate change entries
 */
export function compareAnalysisResults(prev: AnalysisResult, curr: AnalysisResult): ChangeEntry[] {
  const changes: ChangeEntry[] = [];
  const timestamp = new Date().toISOString();

  // Compare endpoints
  changes.push(...compareEndpoints(prev.endpoints, curr.endpoints, timestamp));

  // Compare entities
  changes.push(...compareEntities(prev.entities, curr.entities, timestamp));

  // Compare services
  changes.push(...compareServices(prev.services, curr.services, timestamp));

  return changes;
}

/**
 * Compare endpoints between two analysis results
 */
function compareEndpoints(
  prevEndpoints: EndpointInfo[],
  currEndpoints: EndpointInfo[],
  timestamp: string
): ChangeEntry[] {
  const changes: ChangeEntry[] = [];

  // Create lookup maps by unique identifier
  const prevMap = new Map(
    prevEndpoints.map(ep => [getEndpointId(ep), ep])
  );
  const currMap = new Map(
    currEndpoints.map(ep => [getEndpointId(ep), ep])
  );

  // Find added endpoints
  currMap.forEach((ep, id) => {
    if (!prevMap.has(id)) {
      changes.push({
        type: 'added',
        category: 'endpoint',
        name: ep.name,
        detail: getEndpointDetail(ep),
        timestamp,
      });
    }
  });

  // Find removed endpoints
  prevMap.forEach((ep, id) => {
    if (!currMap.has(id)) {
      changes.push({
        type: 'removed',
        category: 'endpoint',
        name: ep.name,
        detail: getEndpointDetail(ep),
        timestamp,
      });
    }
  });

  // Find modified endpoints
  currMap.forEach((currEp, id) => {
    const prevEp = prevMap.get(id);
    if (prevEp && hasEndpointChanged(prevEp, currEp)) {
      changes.push({
        type: 'modified',
        category: 'endpoint',
        name: currEp.name,
        detail: getEndpointChangeDetail(prevEp, currEp),
        timestamp,
      });
    }
  });

  return changes;
}

/**
 * Get unique identifier for an endpoint
 */
function getEndpointId(endpoint: EndpointInfo): string {
  if (endpoint.protocol === 'rest') {
    return `${endpoint.protocol}:${endpoint.httpMethod}:${endpoint.path}`;
  } else if (endpoint.protocol === 'graphql') {
    return `${endpoint.protocol}:${endpoint.operationType}:${endpoint.fieldName}`;
  }
  return `${endpoint.protocol}:${endpoint.name}`;
}

/**
 * Get endpoint detail string
 */
function getEndpointDetail(endpoint: EndpointInfo): string {
  if (endpoint.protocol === 'rest') {
    return `${endpoint.httpMethod} ${endpoint.path}`;
  } else if (endpoint.protocol === 'graphql') {
    return `${endpoint.operationType} ${endpoint.fieldName}`;
  }
  return endpoint.name;
}

/**
 * Check if endpoint has changed (excluding description/comments)
 */
function hasEndpointChanged(prev: EndpointInfo, curr: EndpointInfo): boolean {
  // Check handler change
  if (prev.handler !== curr.handler) return true;

  // Check return type change
  if (prev.returnType !== curr.returnType) return true;

  // Check parameter changes
  if (prev.parameters.length !== curr.parameters.length) return true;

  const prevParams = prev.parameters.map(p => `${p.name}:${p.type}:${p.required}`).sort();
  const currParams = curr.parameters.map(p => `${p.name}:${p.type}:${p.required}`).sort();

  return prevParams.join(',') !== currParams.join(',');
}

/**
 * Get detail about what changed in endpoint
 */
function getEndpointChangeDetail(prev: EndpointInfo, curr: EndpointInfo): string {
  const details: string[] = [];

  if (prev.returnType !== curr.returnType) {
    details.push(`return type: ${prev.returnType} → ${curr.returnType}`);
  }

  if (prev.parameters.length !== curr.parameters.length) {
    details.push(`parameters: ${prev.parameters.length} → ${curr.parameters.length}`);
  }

  return details.join('; ') || 'signature changed';
}

/**
 * Compare entities between two analysis results
 */
function compareEntities(
  prevEntities: EntityInfo[],
  currEntities: EntityInfo[],
  timestamp: string
): ChangeEntry[] {
  const changes: ChangeEntry[] = [];

  const prevMap = new Map(prevEntities.map(e => [e.name, e]));
  const currMap = new Map(currEntities.map(e => [e.name, e]));

  // Find added entities
  currMap.forEach((entity, name) => {
    if (!prevMap.has(name)) {
      changes.push({
        type: 'added',
        category: 'entity',
        name: entity.name,
        detail: `table: ${entity.tableName}`,
        timestamp,
      });
    }
  });

  // Find removed entities
  prevMap.forEach((entity, name) => {
    if (!currMap.has(name)) {
      changes.push({
        type: 'removed',
        category: 'entity',
        name: entity.name,
        detail: `table: ${entity.tableName}`,
        timestamp,
      });
    }
  });

  // Find modified entities
  currMap.forEach((currEntity, name) => {
    const prevEntity = prevMap.get(name);
    if (prevEntity && hasEntityChanged(prevEntity, currEntity)) {
      changes.push({
        type: 'modified',
        category: 'entity',
        name: currEntity.name,
        detail: getEntityChangeDetail(prevEntity, currEntity),
        timestamp,
      });
    }
  });

  return changes;
}

/**
 * Check if entity has changed
 */
function hasEntityChanged(prev: EntityInfo, curr: EntityInfo): boolean {
  // Check table name change
  if (prev.tableName !== curr.tableName) return true;

  // Check column changes
  if (prev.columns.length !== curr.columns.length) return true;

  const prevCols = prev.columns.map(c => `${c.name}:${c.type}:${c.nullable}`).sort();
  const currCols = curr.columns.map(c => `${c.name}:${c.type}:${c.nullable}`).sort();

  if (prevCols.join(',') !== currCols.join(',')) return true;

  // Check relation changes
  if (prev.relations.length !== curr.relations.length) return true;

  return false;
}

/**
 * Get detail about what changed in entity
 */
function getEntityChangeDetail(prev: EntityInfo, curr: EntityInfo): string {
  const details: string[] = [];

  if (prev.tableName !== curr.tableName) {
    details.push(`table: ${prev.tableName} → ${curr.tableName}`);
  }

  if (prev.columns.length !== curr.columns.length) {
    details.push(`columns: ${prev.columns.length} → ${curr.columns.length}`);
  }

  if (prev.relations.length !== curr.relations.length) {
    details.push(`relations: ${prev.relations.length} → ${curr.relations.length}`);
  }

  return details.join('; ') || 'schema changed';
}

/**
 * Compare services between two analysis results
 */
function compareServices(
  prevServices: ServiceInfo[],
  currServices: ServiceInfo[],
  timestamp: string
): ChangeEntry[] {
  const changes: ChangeEntry[] = [];

  const prevMap = new Map(prevServices.map(s => [s.name, s]));
  const currMap = new Map(currServices.map(s => [s.name, s]));

  // Find added services
  currMap.forEach((service, name) => {
    if (!prevMap.has(name)) {
      changes.push({
        type: 'added',
        category: 'service',
        name: service.name,
        detail: `methods: ${service.methods.length}`,
        timestamp,
      });
    }
  });

  // Find removed services
  prevMap.forEach((service, name) => {
    if (!currMap.has(name)) {
      changes.push({
        type: 'removed',
        category: 'service',
        name: service.name,
        detail: `methods: ${service.methods.length}`,
        timestamp,
      });
    }
  });

  // Find modified services
  currMap.forEach((currService, name) => {
    const prevService = prevMap.get(name);
    if (prevService && hasServiceChanged(prevService, currService)) {
      changes.push({
        type: 'modified',
        category: 'service',
        name: currService.name,
        detail: getServiceChangeDetail(prevService, currService),
        timestamp,
      });
    }
  });

  return changes;
}

/**
 * Check if service has changed
 */
function hasServiceChanged(prev: ServiceInfo, curr: ServiceInfo): boolean {
  // Check method changes
  if (prev.methods.length !== curr.methods.length) return true;

  const prevMethods = [...prev.methods].sort();
  const currMethods = [...curr.methods].sort();

  if (prevMethods.join(',') !== currMethods.join(',')) return true;

  // Check dependency changes
  if (prev.dependencies.length !== curr.dependencies.length) return true;

  const prevDeps = [...prev.dependencies].sort();
  const currDeps = [...curr.dependencies].sort();

  return prevDeps.join(',') !== currDeps.join(',');
}

/**
 * Get detail about what changed in service
 */
function getServiceChangeDetail(prev: ServiceInfo, curr: ServiceInfo): string {
  const details: string[] = [];

  if (prev.methods.length !== curr.methods.length) {
    details.push(`methods: ${prev.methods.length} → ${curr.methods.length}`);
  }

  if (prev.dependencies.length !== curr.dependencies.length) {
    details.push(`dependencies: ${prev.dependencies.length} → ${curr.dependencies.length}`);
  }

  return details.join('; ') || 'implementation changed';
}
