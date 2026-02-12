import type { AnalysisResult, EndpointInfo, EntityInfo, ServiceInfo } from '../parser/types.js';
import type { GeneratorConfig, GeneratedPage, PageMeta } from './types.js';
export type { PageMeta } from './types.js';

/**
 * MarkdownGenerator - generates documentation markdown from AnalysisResult
 */
export class MarkdownGenerator {
  constructor(private config: GeneratorConfig) {}

  /**
   * Main generation entry point
   */
  async generate(analysis: AnalysisResult): Promise<GeneratedPage[]> {
    const pages: GeneratedPage[] = [];

    // Generate overview page
    pages.push(this.generateOverview(analysis));

    // Process each section from config
    for (const section of this.config.sections) {
      switch (section.type) {
        case 'endpoints':
          pages.push(...this.generateEndpointPages(analysis.endpoints));
          break;
        case 'entities':
          pages.push(...this.generateEntityPages(analysis.entities));
          break;
        case 'architecture':
          pages.push(this.generateArchitecturePage(analysis));
          break;
        case 'changelog':
          pages.push(this.generateChangelogPage());
          break;
        case 'auto':
          // Auto mode includes all available sections
          pages.push(...this.generateEndpointPages(analysis.endpoints));
          pages.push(...this.generateEntityPages(analysis.entities));
          pages.push(this.generateArchitecturePage(analysis));
          break;
        case 'custom':
          // Custom sections are handled by user-provided templates
          break;
      }
    }

    // Apply page overrides from config
    if (this.config.pageOverrides) {
      pages.forEach(page => {
        // Match by path, or by /path (with leading slash)
        const override = this.config.pageOverrides![page.path]
          || this.config.pageOverrides![`/${page.path}`];
        if (override) {
          page.meta = { ...page.meta, ...override };
          if (override.title) page.title = override.title;
        }
      });
    }

    // Inject frontmatter into all pages
    pages.forEach(page => {
      page.content = generateFrontmatter(page) + page.content;
    });

    return pages;
  }

  /**
   * Generate overview/dashboard page with project summary
   */
  generateOverview(analysis: AnalysisResult): GeneratedPage {
    const { metadata, summary } = analysis;

    const content = `# ${metadata.projectName} API Documentation

## Project Overview

- **Version**: ${metadata.version}
- **Last Updated**: ${new Date(metadata.timestamp).toLocaleString()}
- **Source Directory**: \`${metadata.sourceDir}\`

## Statistics

| Category | Count |
|----------|-------|
| Total Files | ${summary.totalFiles} |
| Endpoints | ${summary.endpoints} |
| Entities | ${summary.entities} |
| Services | ${summary.services} |
| Types | ${summary.types} |

## Parsers Used

${metadata.parsers.map(p => `- ${p}`).join('\n')}

## Quick Links

- [API Endpoints](#endpoints)
- [Database Entities](#entities)
- [Architecture Overview](#architecture)
- [Changelog](#changelog)
`;

    return {
      path: 'overview.md',
      title: 'Overview',
      content,
      sidebarPosition: 1,
    };
  }

  /**
   * Generate endpoint pages grouped by handler class
   */
  generateEndpointPages(endpoints: EndpointInfo[]): GeneratedPage[] {
    const pages: GeneratedPage[] = [];

    // Group endpoints by handlerClass
    const grouped = endpoints.reduce((acc, ep) => {
      const key = ep.handlerClass || 'misc';
      if (!acc[key]) acc[key] = [];
      acc[key].push(ep);
      return acc;
    }, {} as Record<string, EndpointInfo[]>);

    // Generate a page for each handler class
    Object.entries(grouped).forEach(([handlerClass, eps], index) => {
      const content = this.generateEndpointPageContent(handlerClass, eps);
      const path = `api/${toKebab(handlerClass)}.md`;

      pages.push({
        path,
        title: handlerClass,
        content,
        sidebarPosition: 10 + index,
      });
    });

    return pages;
  }

  /**
   * Generate content for a single endpoint page (handler class)
   */
  private generateEndpointPageContent(handlerClass: string, endpoints: EndpointInfo[]): string {
    let content = `# ${handlerClass}\n\n`;

    // Sort endpoints by protocol and path/fieldName
    const sorted = endpoints.sort((a, b) => {
      if (a.protocol !== b.protocol) return a.protocol.localeCompare(b.protocol);
      const aKey = a.path || a.fieldName || '';
      const bKey = b.path || b.fieldName || '';
      return aKey.localeCompare(bKey);
    });

    sorted.forEach((ep, idx) => {
      content += `\n## ${ep.name}\n\n`;

      if (ep.description) {
        content += `${ep.description}\n\n`;
      }

      // Protocol-specific header
      if (ep.protocol === 'rest' && ep.httpMethod && ep.path) {
        content += `${methodBadge(ep.httpMethod)} \`${ep.path}\`\n\n`;
      } else if (ep.protocol === 'graphql' && ep.operationType && ep.fieldName) {
        content += `**GraphQL ${ep.operationType}**: \`${ep.fieldName}\`\n\n`;
      } else {
        content += `**Protocol**: ${ep.protocol}\n\n`;
      }

      // Metadata badges
      const badges: string[] = [];
      if (ep.auth) badges.push('🔒 Auth Required');
      if (ep.deprecated) badges.push('⚠️ Deprecated');
      if (badges.length > 0) {
        content += `${badges.join(' · ')}\n\n`;
      }

      // Parameters table
      if (ep.parameters.length > 0) {
        content += `### Parameters\n\n`;
        content += `| Name | Type | Required | Location | Default | Description |\n`;
        content += `|------|------|----------|----------|---------|-------------|\n`;

        ep.parameters.forEach(param => {
          const req = param.required ? '✓' : '';
          const loc = param.location || '-';
          const def = param.defaultValue ? `\`${escapeMd(param.defaultValue)}\`` : '-';
          const desc = param.description ? escapeMd(param.description) : '';
          content += `| ${escapeMd(param.name)} | \`${escapeMd(param.type)}\` | ${req} | ${loc} | ${def} | ${desc} |\n`;
        });
        content += '\n';
      }

      // Return type
      content += `**Return Type**: \`${escapeMd(ep.returnType)}\`\n\n`;

      // Service reference
      if (ep.serviceRef) {
        content += `**Service**: \`${escapeMd(ep.serviceRef)}\`\n\n`;
      }

      // Tags
      if (ep.tags && ep.tags.length > 0) {
        content += `**Tags**: ${ep.tags.map(t => `\`${t}\``).join(', ')}\n\n`;
      }

      // Source file
      content += `<details>\n<summary>Source</summary>\n\n\`${ep.filePath}\`\n\n</details>\n\n`;

      if (idx < sorted.length - 1) {
        content += '---\n\n';
      }
    });

    return content;
  }

  /**
   * Generate entity pages with column tables and relation diagrams
   */
  generateEntityPages(entities: EntityInfo[]): GeneratedPage[] {
    const pages: GeneratedPage[] = [];

    entities.forEach((entity, index) => {
      const content = this.generateEntityPageContent(entity);
      const path = `entities/${toKebab(entity.name)}.md`;

      pages.push({
        path,
        title: entity.name,
        content,
        sidebarPosition: 100 + index,
      });
    });

    return pages;
  }

  /**
   * Generate content for a single entity page
   */
  private generateEntityPageContent(entity: EntityInfo): string {
    let content = `# ${entity.name}\n\n`;

    if (entity.description) {
      content += `${entity.description}\n\n`;
    }

    // Entity metadata
    content += `**Table Name**: \`${entity.tableName}\`  \n`;
    content += `**Database Type**: ${entity.dbType}\n\n`;

    // Columns table
    content += `## Columns\n\n`;
    content += `| Column | Type | DB Name | Nullable | Primary | Unique | Default | Description |\n`;
    content += `|--------|------|---------|----------|---------|--------|---------|-------------|\n`;

    entity.columns.forEach(col => {
      const nullable = col.nullable ? '✓' : '';
      const pk = col.primaryKey ? '🔑' : '';
      const unique = col.unique ? '✓' : '';
      const def = col.defaultValue ? `\`${escapeMd(col.defaultValue)}\`` : '-';
      const desc = col.description ? escapeMd(col.description) : '';
      content += `| ${escapeMd(col.name)} | \`${escapeMd(col.type)}\` | \`${escapeMd(col.dbColumnName)}\` | ${nullable} | ${pk} | ${unique} | ${def} | ${desc} |\n`;
    });
    content += '\n';

    // Relations
    if (entity.relations.length > 0) {
      content += `## Relations\n\n`;
      content += `| Type | Target | Join Column | Mapped By | Eager |\n`;
      content += `|------|--------|-------------|-----------|-------|\n`;

      entity.relations.forEach(rel => {
        const join = rel.joinColumn ? `\`${rel.joinColumn}\`` : '-';
        const mapped = rel.mappedBy ? `\`${rel.mappedBy}\`` : '-';
        const eager = rel.eager ? '✓' : '';
        content += `| ${rel.type} | \`${rel.target}\` | ${join} | ${mapped} | ${eager} |\n`;
      });
      content += '\n';

      // Generate ER diagram with mermaid
      content += `### Entity Relationship Diagram\n\n`;
      content += '```mermaid\nerDiagram\n';
      content += `    ${entity.name} {\n`;
      entity.columns.forEach(col => {
        const pk = col.primaryKey ? 'PK' : '';
        content += `        ${col.type} ${col.dbColumnName} ${pk}\n`;
      });
      content += '    }\n';

      entity.relations.forEach(rel => {
        const relType = this.mapRelationType(rel.type);
        content += `    ${entity.name} ${relType} ${rel.target} : "${rel.type}"\n`;
      });
      content += '```\n\n';
    }

    // Indexes
    if (entity.indexes.length > 0) {
      content += `## Indexes\n\n`;
      entity.indexes.forEach(idx => {
        content += `- \`${idx}\`\n`;
      });
      content += '\n';
    }

    // Source file
    content += `<details>\n<summary>Source</summary>\n\n\`${entity.filePath}\`\n\n</details>\n`;

    return content;
  }

  /**
   * Map relation type to mermaid ER diagram notation
   */
  private mapRelationType(relType: string): string {
    switch (relType) {
      case 'OneToOne': return '||--||';
      case 'OneToMany': return '||--o{';
      case 'ManyToOne': return '}o--||';
      case 'ManyToMany': return '}o--o{';
      default: return '--';
    }
  }

  /**
   * Generate architecture overview page with dependency graph
   */
  generateArchitecturePage(analysis: AnalysisResult): GeneratedPage {
    let content = `# Architecture Overview\n\n`;

    // Service summary
    content += `## Services\n\n`;
    if (analysis.services.length > 0) {
      content += `Total services: ${analysis.services.length}\n\n`;

      // Service → Entity mapping
      content += `### Service Dependencies\n\n`;
      content += `| Service | Dependencies | Methods |\n`;
      content += `|---------|--------------|----------|\n`;

      analysis.services.forEach(svc => {
        const deps = svc.dependencies.length > 0 ? svc.dependencies.map(d => `\`${d}\``).join(', ') : '-';
        const methods = svc.methods.length;
        content += `| \`${escapeMd(svc.name)}\` | ${deps} | ${methods} |\n`;
      });
      content += '\n';
    }

    // Dependency graph
    if (analysis.dependencies.length > 0) {
      content += `## Dependency Graph\n\n`;
      content += '```mermaid\nflowchart TD\n';

      const nodes = new Set<string>();
      analysis.dependencies.forEach(dep => {
        nodes.add(dep.source);
        nodes.add(dep.target);
      });

      // Shorten node names for readability
      const nodeMap = new Map<string, string>();
      nodes.forEach(node => {
        const short = node.split('.').pop() || node;
        nodeMap.set(node, short.replace(/[^a-zA-Z0-9]/g, '_'));
      });

      analysis.dependencies.forEach(dep => {
        const srcId = nodeMap.get(dep.source) || 'unknown';
        const tgtId = nodeMap.get(dep.target) || 'unknown';
        const srcLabel = dep.source.split('.').pop() || dep.source;
        const tgtLabel = dep.target.split('.').pop() || dep.target;
        content += `    ${srcId}["${srcLabel}"] -->|${dep.type}| ${tgtId}["${tgtLabel}"]\n`;
      });

      content += '```\n\n';
    }

    // Module statistics
    content += `## Module Statistics\n\n`;
    content += `| Category | Count |\n`;
    content += `|----------|-------|\n`;
    content += `| Services | ${analysis.services.length} |\n`;
    content += `| Entities | ${analysis.entities.length} |\n`;
    content += `| Types | ${analysis.types.length} |\n`;
    content += `| Dependencies | ${analysis.dependencies.length} |\n`;

    return {
      path: 'architecture.md',
      title: 'Architecture',
      content,
      sidebarPosition: 1000,
    };
  }

  /**
   * Generate changelog page
   */
  generateChangelogPage(): GeneratedPage {
    const content = `# Changelog

All notable changes to this project will be documented here.

## [Unreleased]

Changes not yet released.

## How to Use

The changelog is automatically generated by comparing analysis snapshots.
Run \`codedocs changelog\` to update this file.
`;

    return {
      path: 'changelog.md',
      title: 'Changelog',
      content,
      sidebarPosition: 9999,
    };
  }
}

/**
 * Generate YAML frontmatter block from a GeneratedPage
 */
export function generateFrontmatter(page: GeneratedPage): string {
  const lines: string[] = [];
  lines.push('---');
  lines.push(`title: "${page.title.replace(/"/g, '\\"')}"`);

  if (page.meta?.description) {
    lines.push(`description: "${page.meta.description.replace(/"/g, '\\"')}"`);
  }
  if (page.meta?.tags && page.meta.tags.length > 0) {
    lines.push(`tags: [${page.meta.tags.map(t => `"${t}"`).join(', ')}]`);
  }
  if (page.meta?.canonical) {
    lines.push(`canonical: "${page.meta.canonical}"`);
  }
  if (page.meta?.robots) {
    lines.push(`robots: "${page.meta.robots}"`);
  }
  if (page.meta?.ogTitle) {
    lines.push(`og_title: "${page.meta.ogTitle.replace(/"/g, '\\"')}"`);
  }
  if (page.meta?.ogDescription) {
    lines.push(`og_description: "${page.meta.ogDescription.replace(/"/g, '\\"')}"`);
  }
  if (page.meta?.ogImage) {
    lines.push(`og_image: "${page.meta.ogImage}"`);
  }
  if (page.meta?.ogType) {
    lines.push(`og_type: "${page.meta.ogType}"`);
  }
  if (page.meta?.twitterCard) {
    lines.push(`twitter_card: "${page.meta.twitterCard}"`);
  }
  if (page.meta?.twitterTitle) {
    lines.push(`twitter_title: "${page.meta.twitterTitle.replace(/"/g, '\\"')}"`);
  }
  if (page.meta?.twitterDescription) {
    lines.push(`twitter_description: "${page.meta.twitterDescription.replace(/"/g, '\\"')}"`);
  }
  if (page.meta?.twitterImage) {
    lines.push(`twitter_image: "${page.meta.twitterImage}"`);
  }
  if (page.meta?.custom) {
    for (const [key, value] of Object.entries(page.meta.custom)) {
      lines.push(`${key}: "${value.replace(/"/g, '\\"')}"`);
    }
  }
  if (page.sidebarPosition !== undefined) {
    lines.push(`sidebar_position: ${page.sidebarPosition}`);
  }

  lines.push('---');
  lines.push('');

  return lines.join('\n');
}

/**
 * Generate HTML <meta> tags from PageMeta for injection into <head>
 */
export function generateMetaTags(meta: PageMeta, siteTitle?: string): string {
  const tags: string[] = [];

  const title = meta.title || siteTitle || '';
  if (title) {
    tags.push(`<title>${escapeHtml(title)}</title>`);
  }
  if (meta.description) {
    tags.push(`<meta name="description" content="${escapeHtml(meta.description)}" />`);
  }
  if (meta.tags && meta.tags.length > 0) {
    tags.push(`<meta name="keywords" content="${escapeHtml(meta.tags.join(', '))}" />`);
  }
  if (meta.canonical) {
    tags.push(`<link rel="canonical" href="${escapeHtml(meta.canonical)}" />`);
  }
  if (meta.robots) {
    tags.push(`<meta name="robots" content="${escapeHtml(meta.robots)}" />`);
  }

  // Open Graph
  const ogTitle = meta.ogTitle || title;
  if (ogTitle) {
    tags.push(`<meta property="og:title" content="${escapeHtml(ogTitle)}" />`);
  }
  if (meta.ogDescription || meta.description) {
    tags.push(`<meta property="og:description" content="${escapeHtml(meta.ogDescription || meta.description!)}" />`);
  }
  if (meta.ogImage) {
    tags.push(`<meta property="og:image" content="${escapeHtml(meta.ogImage)}" />`);
  }
  tags.push(`<meta property="og:type" content="${escapeHtml(meta.ogType || 'article')}" />`);

  // Twitter Card
  if (meta.twitterCard || meta.ogImage) {
    tags.push(`<meta name="twitter:card" content="${escapeHtml(meta.twitterCard || 'summary')}" />`);
  }
  if (meta.twitterTitle || ogTitle) {
    tags.push(`<meta name="twitter:title" content="${escapeHtml(meta.twitterTitle || ogTitle)}" />`);
  }
  if (meta.twitterDescription || meta.ogDescription || meta.description) {
    tags.push(`<meta name="twitter:description" content="${escapeHtml(meta.twitterDescription || meta.ogDescription || meta.description!)}" />`);
  }
  if (meta.twitterImage || meta.ogImage) {
    tags.push(`<meta name="twitter:image" content="${escapeHtml(meta.twitterImage || meta.ogImage!)}" />`);
  }

  // Custom meta tags
  if (meta.custom) {
    for (const [name, content] of Object.entries(meta.custom)) {
      tags.push(`<meta name="${escapeHtml(name)}" content="${escapeHtml(content)}" />`);
    }
  }

  return tags.join('\n    ');
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Convert CamelCase to kebab-case
 */
export function toKebab(name: string): string {
  return name
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase();
}

/**
 * Escape markdown special characters
 */
export function escapeMd(text: string): string {
  return text
    .replace(/\|/g, '\\|')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]')
    .replace(/`/g, '\\`');
}

/**
 * Generate method badge for HTTP methods
 */
export function methodBadge(method: string): string {
  const upper = method.toUpperCase();
  const colors: Record<string, string> = {
    GET: '🟢',
    POST: '🔵',
    PUT: '🟡',
    PATCH: '🟠',
    DELETE: '🔴',
  };
  const icon = colors[upper] || '⚪';
  return `${icon} **${upper}**`;
}
