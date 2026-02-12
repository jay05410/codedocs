// packages/core/src/ai/grouping.ts
// AI-powered domain grouping for API endpoints and entities

import type { AiProvider } from './types.js';
import type { EndpointInfo, EntityInfo } from '../parser/types.js';
import { getPrompt, fillTemplate } from './prompts/index.js';
import { extractJson } from './types.js';
import type { Locale } from '../i18n/index.js';

export interface DomainGroup {
  name: string;
  description: string;
  endpoints: string[];  // endpoint paths/names that belong to this group
  entities: string[];   // entity names that belong to this group
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
    const totalItems = group.endpoints.length + group.entities.length;
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
    };

    for (const group of smallGroups) {
      otherGroup.endpoints.push(...group.endpoints);
      otherGroup.entities.push(...group.entities);
    }

    largeGroups.push(otherGroup);
  }

  return largeGroups;
}

/**
 * Capitalize the first letter of a string
 */
function capitalize(str: string): string {
  if (str.length === 0) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}
