// packages/core/src/ai/grouping.ts
// AI-powered domain grouping for API endpoints and entities

import type { AiProvider } from './types.js';
import type { EndpointInfo, EntityInfo, TypeInfo, ServiceInfo } from '../parser/types.js';
import { getPrompt, fillTemplate } from './prompts/index.js';
import { extractJson } from './types.js';
import type { Locale } from '../i18n/index.js';
import { toKebab } from '../utils/index.js';

export interface DomainGroup {
  name: string;
  description: string;
  endpoints: string[];    // endpoint paths/names that belong to this group
  entities: string[];     // entity names that belong to this group
  components?: string[];  // UI component names (React/Vue/Svelte)
  services?: string[];    // hook/store/service names
}

export interface GroupingResult {
  groups: DomainGroup[];
  ungrouped: {
    endpoints: string[];
    entities: string[];
  };
}

export interface GroupingOptions {
  locale?: Locale;
  maxGroups?: number;       // max number of domain groups (default: 10)
  minGroupSize?: number;    // minimum items per group (default: 2)
}

/**
 * Group endpoints and entities into logical business domains using AI
 */
export async function groupByDomain(
  provider: AiProvider,
  endpoints: EndpointInfo[],
  entities: EntityInfo[],
  options?: GroupingOptions
): Promise<GroupingResult> {
  const locale = options?.locale || 'en';
  const maxGroups = options?.maxGroups || 10;
  const minGroupSize = options?.minGroupSize || 2;

  // Format endpoints for the prompt
  const endpointList = endpoints
    .map((ep) => {
      const method = ep.httpMethod || ep.operationType || '';
      const path = ep.path || ep.fieldName || '';
      return `- ${method} ${path} (${ep.name})`;
    })
    .join('\n');

  // Format entities for the prompt
  const entityList = entities
    .map((ent) => `- ${ent.name} (table: ${ent.tableName})`)
    .join('\n');

  // Get the prompt template
  const promptTemplate = getPrompt('domainGrouping', locale);

  // Fill in the template
  const userPrompt = fillTemplate(promptTemplate.user, {
    endpoints: endpointList || '(none)',
    entities: entityList || '(none)',
  });

  // Call AI provider
  const response = await provider.chat(
    [
      { role: 'system', content: promptTemplate.system },
      { role: 'user', content: userPrompt },
    ],
    { jsonMode: true }
  );

  // Parse JSON response
  const jsonStr = extractJson(response);
  const groups = JSON.parse(jsonStr) as DomainGroup[];

  // Validate and normalize the response
  const validatedGroups = groups
    .filter((g) => g.name && g.description && Array.isArray(g.endpoints) && Array.isArray(g.entities))
    .slice(0, maxGroups)
    .map((g) => ({
      name: g.name,
      description: g.description,
      endpoints: g.endpoints.filter((ep) => typeof ep === 'string'),
      entities: g.entities.filter((ent) => typeof ent === 'string'),
      ...(Array.isArray(g.components) ? { components: g.components.filter((c) => typeof c === 'string') } : {}),
      ...(Array.isArray(g.services) ? { services: g.services.filter((s) => typeof s === 'string') } : {}),
    }));

  // Merge small groups
  const mergedGroups = mergeGroups(validatedGroups, minGroupSize);

  // Build a set of all grouped endpoint/entity identifiers
  const groupedEndpoints = new Set<string>();
  const groupedEntities = new Set<string>();

  for (const group of mergedGroups) {
    for (const ep of group.endpoints) {
      groupedEndpoints.add(ep);
    }
    for (const ent of group.entities) {
      groupedEntities.add(ent);
    }
  }

  // Find ungrouped items
  const ungroupedEndpoints: string[] = [];
  const ungroupedEntities: string[] = [];

  for (const ep of endpoints) {
    const identifier = ep.name;
    if (!groupedEndpoints.has(identifier)) {
      ungroupedEndpoints.push(identifier);
    }
  }

  for (const ent of entities) {
    if (!groupedEntities.has(ent.name)) {
      ungroupedEntities.push(ent.name);
    }
  }

  return {
    groups: mergedGroups,
    ungrouped: {
      endpoints: ungroupedEndpoints,
      entities: ungroupedEntities,
    },
  };
}

/**
 * Fallback grouping using heuristics when no AI provider is available
 */
export function groupByHeuristic(
  endpoints: EndpointInfo[],
  entities: EntityInfo[]
): GroupingResult {
  const groupMap = new Map<string, DomainGroup>();

  // Group endpoints by path prefix
  for (const ep of endpoints) {
    const path = ep.path || ep.fieldName || '';
    const parts = path.split('/').filter((p) => p.length > 0);

    // Extract the first meaningful path segment
    const prefix = parts.length > 0 ? parts[0] : 'Other';
    const groupName = capitalize(prefix);

    if (!groupMap.has(groupName)) {
      groupMap.set(groupName, {
        name: groupName,
        description: `API endpoints related to ${groupName.toLowerCase()}`,
        endpoints: [],
        entities: [],
      });
    }

    groupMap.get(groupName)!.endpoints.push(ep.name);
  }

  // Group entities and try to match with endpoint groups
  for (const ent of entities) {
    const entityName = ent.name;
    let matched = false;

    // Try to find a matching group by name similarity
    for (const [groupName, group] of groupMap.entries()) {
      if (
        entityName.toLowerCase().includes(groupName.toLowerCase()) ||
        groupName.toLowerCase().includes(entityName.toLowerCase())
      ) {
        group.entities.push(entityName);
        matched = true;
        break;
      }
    }

    // If no match, create a new group for this entity
    if (!matched) {
      const groupName = capitalize(entityName);
      if (!groupMap.has(groupName)) {
        groupMap.set(groupName, {
          name: groupName,
          description: `Entities and endpoints related to ${groupName.toLowerCase()}`,
          endpoints: [],
          entities: [],
        });
      }
      groupMap.get(groupName)!.entities.push(entityName);
    }
  }

  const groups = Array.from(groupMap.values());
  const mergedGroups = mergeGroups(groups, 2);

  // All items should be grouped by heuristic (no ungrouped)
  return {
    groups: mergedGroups,
    ungrouped: {
      endpoints: [],
      entities: [],
    },
  };
}

/**
 * Merge small groups into an "Other" group
 */
export function mergeGroups(groups: DomainGroup[], minGroupSize: number): DomainGroup[] {
  const largeGroups: DomainGroup[] = [];
  const smallGroups: DomainGroup[] = [];

  for (const group of groups) {
    const totalItems = group.endpoints.length + group.entities.length
      + (group.components?.length || 0) + (group.services?.length || 0);
    if (totalItems >= minGroupSize) {
      largeGroups.push(group);
    } else {
      smallGroups.push(group);
    }
  }

  // If there are small groups, merge them into "Other"
  if (smallGroups.length > 0) {
    const otherGroup: DomainGroup = {
      name: 'Other',
      description: 'Miscellaneous endpoints and entities',
      endpoints: [],
      entities: [],
      components: [],
      services: [],
    };

    for (const group of smallGroups) {
      otherGroup.endpoints.push(...group.endpoints);
      otherGroup.entities.push(...group.entities);
      if (group.components) otherGroup.components!.push(...group.components);
      if (group.services) otherGroup.services!.push(...group.services);
    }

    // Only include components/services arrays if they have items
    if (otherGroup.components!.length === 0) delete otherGroup.components;
    if (otherGroup.services!.length === 0) delete otherGroup.services;

    largeGroups.push(otherGroup);
  }

  return largeGroups;
}

/**
 * Fallback grouping for UI components and services by file path directory
 */
export function groupComponentsByHeuristic(
  types: TypeInfo[],
  services: ServiceInfo[]
): DomainGroup[] {
  const groupMap = new Map<string, DomainGroup>();

  // Filter to actual UI components (PascalCase, exclude Props/DTO suffixes)
  const components = types.filter((t) => {
    if (t.kind === 'enum' || t.kind === 'dto' || t.kind === 'input' || t.kind === 'response') {
      return false;
    }
    if (/Props$|DTO$|Dto$|Request$|Response$|Input$|Args$/.test(t.name)) {
      return false;
    }
    return /^[A-Z]/.test(t.name);
  });

  // Group components by parent directory
  for (const comp of components) {
    const parts = comp.filePath.replace(/\\/g, '/').split('/');
    // Use the directory name containing the component file
    const dirName = parts.length >= 2 ? parts[parts.length - 2] : 'Other';
    const groupName = capitalize(dirName);

    if (!groupMap.has(groupName)) {
      groupMap.set(groupName, {
        name: groupName,
        description: `UI components in ${groupName.toLowerCase()}`,
        endpoints: [],
        entities: [],
        components: [],
        services: [],
      });
    }

    groupMap.get(groupName)!.components!.push(comp.name);
  }

  // Group services/hooks by parent directory
  for (const svc of services) {
    const parts = svc.filePath.replace(/\\/g, '/').split('/');
    const dirName = parts.length >= 2 ? parts[parts.length - 2] : 'Other';
    const groupName = capitalize(dirName);

    if (!groupMap.has(groupName)) {
      groupMap.set(groupName, {
        name: groupName,
        description: `Services and hooks in ${groupName.toLowerCase()}`,
        endpoints: [],
        entities: [],
        components: [],
        services: [],
      });
    }

    groupMap.get(groupName)!.services!.push(svc.name);
  }

  return Array.from(groupMap.values());
}

/**
 * Capitalize the first letter of a string
 */
function capitalize(str: string): string {
  if (str.length === 0) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}
