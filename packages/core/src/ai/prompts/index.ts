// packages/core/src/ai/prompts/index.ts
// AI prompt templates with i18n support

import type { Locale } from '../../i18n/index.js';
import { getLocaleName } from '../../i18n/index.js';

export interface PromptTemplate {
  system: string;
  user: string;
}

type PromptKey =
  | 'domainGrouping'
  | 'componentGrouping'
  | 'codeExplanation'
  | 'flowDiagram'
  | 'releaseNote'
  | 'apiSummary'
  | 'entityDescription'
  | 'componentDescription';

/**
 * Get a localized prompt template for the given key and locale
 */
export function getPrompt(key: PromptKey, locale: Locale): PromptTemplate {
  const template = prompts[key];

  // For non-English locales, append locale instruction to system prompt
  if (locale !== 'en') {
    return {
      system: `${template.system}\n\nIMPORTANT: Write all text content in ${getLocaleName(locale)}.`,
      user: template.user,
    };
  }

  return template;
}

/**
 * Get all available prompt keys
 */
export function getPromptKeys(): PromptKey[] {
  return ['domainGrouping', 'componentGrouping', 'codeExplanation', 'flowDiagram', 'releaseNote', 'apiSummary', 'entityDescription', 'componentDescription'];
}

// ── Prompt Templates ──

const prompts: Record<PromptKey, PromptTemplate> = {
  domainGrouping: {
    system: `You are a software architect analyzing a codebase. Your task is to group API endpoints and entities into logical domain groups based on their business context.

Rules:
- Each group should represent a distinct business domain (e.g., "User Management", "Order Processing", "Payment")
- Group related endpoints and entities together
- Provide a short description for each group
- Return JSON format only`,
    user: `Analyze the following endpoints and entities, then group them into logical business domains.

Endpoints:
{{endpoints}}

Entities:
{{entities}}

Return a JSON array:
[
  {
    "name": "Domain Name",
    "description": "Brief description of this domain",
    "endpoints": ["endpoint names..."],
    "entities": ["entity names..."]
  }
]`,
  },
  codeExplanation: {
    system: `You are a technical documentation writer. Your task is to explain code in a clear, concise manner suitable for API documentation.

Rules:
- Write in a professional, objective tone
- Focus on what the code does, not how it's implemented
- Highlight important business logic and constraints
- Keep explanations under 3 paragraphs`,
    user: `Explain the following code for documentation purposes:

File: {{filePath}}
Type: {{type}}
Name: {{name}}

Code:
\`\`\`
{{code}}
\`\`\`

Provide a clear explanation suitable for API documentation.`,
  },
  flowDiagram: {
    system: `You are a technical architect. Your task is to generate Mermaid.js flow diagrams from API endpoint analysis results.

Rules:
- Use Mermaid flowchart syntax (flowchart TD)
- Show the request flow from client to database
- Include middleware, controllers, services, and repositories
- Keep diagrams readable (max 15 nodes)
- Return only the Mermaid diagram code`,
    user: `Generate a Mermaid flow diagram for the following API flow:

Endpoint: {{endpoint}}
Handler: {{handler}}
Service: {{service}}
Dependencies: {{dependencies}}

Return only the Mermaid diagram code starting with \`flowchart TD\`.`,
  },
  releaseNote: {
    system: `You are a technical writer creating release notes. Your task is to summarize API changes between two versions in a user-friendly format.

Rules:
- Categorize changes as Added, Changed, Removed, Fixed, or Deprecated
- Focus on user-facing impact
- Be concise but informative
- Use bullet points`,
    user: `Generate release notes for the following API changes:

Added endpoints: {{added}}
Removed endpoints: {{removed}}
Changed endpoints: {{changed}}
Added entities: {{addedEntities}}
Removed entities: {{removedEntities}}

Generate structured release notes.`,
  },
  apiSummary: {
    system: `You are a technical writer. Your task is to generate a brief summary of an API endpoint for documentation.

Rules:
- One sentence summary of what the endpoint does
- Mention key parameters and return type
- Note any authentication requirements
- Keep it under 2 sentences`,
    user: `Summarize this API endpoint:

Method: {{method}}
Path: {{path}}
Handler: {{handler}}
Parameters: {{parameters}}
Return Type: {{returnType}}
Auth Required: {{auth}}

Provide a brief documentation summary.`,
  },
  entityDescription: {
    system: `You are a technical writer. Your task is to describe a database entity for documentation.

Rules:
- Explain the purpose of the entity
- Mention key relationships
- Note any important constraints or indexes
- Keep it under 3 sentences`,
    user: `Describe this database entity:

Name: {{name}}
Table: {{table}}
Columns: {{columns}}
Relations: {{relations}}
Indexes: {{indexes}}

Provide a brief documentation description.`,
  },
  componentGrouping: {
    system: `You are a software architect analyzing a frontend codebase. Your task is to group UI components and hooks/services into logical feature groups.

Rules:
- Each group should represent a distinct feature area (e.g., "Authentication", "Dashboard", "Navigation", "Forms")
- Group related components and hooks/services together
- Provide a short description for each group
- Return JSON format only`,
    user: `Analyze the following components and hooks/services, then group them into logical feature areas.

Components:
{{components}}

Hooks/Services:
{{services}}

Return a JSON array:
[
  {
    "name": "Feature Area Name",
    "description": "Brief description of this feature area",
    "endpoints": [],
    "entities": [],
    "components": ["component names..."],
    "services": ["hook/service names..."]
  }
]`,
  },
  componentDescription: {
    system: `You are a technical documentation writer for UI components. Your task is to describe a component's purpose and usage.

Rules:
- Explain what the component renders and when to use it
- Mention key props and their purpose
- Note any important hooks or state management
- Keep it under 3 sentences`,
    user: `Describe this UI component:

Name: {{name}}
Props: {{props}}
Hooks used: {{hooks}}
File: {{filePath}}

Provide a brief documentation description.`,
  },
};

/**
 * Fill template placeholders with values
 * Replaces {{key}} with the corresponding value
 */
export function fillTemplate(template: string, values: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(values)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
  }
  return result;
}
