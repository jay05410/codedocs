import { readdir, readFile } from 'fs/promises';
import { join, resolve, extname, basename } from 'path';
import type { AnalysisResult, EndpointInfo, EntityInfo, ServiceInfo, TypeInfo } from '../parser/types.js';
import type { GeneratorConfig, GeneratedPage, PageMeta, SectionConfig } from './types.js';
import { getStrings, type Locale } from '../i18n/index.js';
import type { I18nStrings } from '../i18n/index.js';
import { escapeHtml, escapeMd, toKebab, extractFrontmatter } from '../utils/index.js';
export type { PageMeta } from './types.js';

/**
 * MarkdownGenerator - generates documentation markdown from AnalysisResult
 */
export class MarkdownGenerator {
  private s: I18nStrings;

  constructor(private config: GeneratorConfig) {
    this.s = getStrings(config.locale as Locale);
  }

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
        case 'components':
          pages.push(...this.generateComponentPages(analysis.types));
          break;
        case 'services':
          pages.push(...this.generateServicePages(analysis.services));
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
          pages.push(...this.generateComponentPages(analysis.types));
          pages.push(...this.generateServicePages(analysis.services));
          pages.push(this.generateArchitecturePage(analysis));
          break;
        case 'custom':
          if (section.dir) {
            const customPages = await this.loadCustomPages(section);
            pages.push(...customPages);
          }
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

    const content = `# ${metadata.projectName} ${this.s.overview.title}

## ${this.s.overview.projectOverview}

- **${this.s.overview.version}**: ${metadata.version}
- **${this.s.overview.lastUpdated}**: ${new Date(metadata.timestamp).toLocaleString()}
- **${this.s.overview.sourceDirectory}**: \`${metadata.sourceDir}\`

## ${this.s.overview.statistics}

| ${this.s.overview.category} | ${this.s.overview.count} |
|----------|-------|
| ${this.s.overview.totalFiles} | ${summary.totalFiles} |
| ${this.s.overview.endpoints} | ${summary.endpoints} |
| ${this.s.overview.entities} | ${summary.entities} |
| ${this.s.overview.services} | ${summary.services} |
| ${this.s.overview.types} | ${summary.types} |

## ${this.s.overview.parsersUsed}

${metadata.parsers.map(p => `- ${p}`).join('\n')}

## ${this.s.overview.quickLinks}

${this.buildQuickLinks(analysis)}
`;

    return {
      path: 'overview.md',
      title: this.s.common.overview,
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
      if (ep.auth) badges.push(`🔒 ${this.s.endpoint.authRequired}`);
      if (ep.deprecated) badges.push(`⚠️ ${this.s.endpoint.deprecated}`);
      if (badges.length > 0) {
        content += `${badges.join(' · ')}\n\n`;
      }

      // Parameters table
      if (ep.parameters.length > 0) {
        content += `### ${this.s.endpoint.parameters}\n\n`;
        content += `| ${this.s.endpoint.name} | ${this.s.endpoint.type} | ${this.s.endpoint.required} | ${this.s.endpoint.location} | ${this.s.endpoint.defaultValue} | ${this.s.endpoint.description} |\n`;
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
      content += `**${this.s.endpoint.returnType}**: \`${escapeMd(ep.returnType)}\`\n\n`;

      // Service reference
      if (ep.serviceRef) {
        content += `**${this.s.endpoint.service}**: \`${escapeMd(ep.serviceRef)}\`\n\n`;
      }

      // Tags
      if (ep.tags && ep.tags.length > 0) {
        content += `**${this.s.endpoint.tags}**: ${ep.tags.map(t => `\`${t}\``).join(', ')}\n\n`;
      }

      // Source file
      content += `<details>\n<summary>${this.s.endpoint.source}</summary>\n\n\`${ep.filePath}\`\n\n</details>\n\n`;

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
    content += `**${this.s.entity.tableName}**: \`${entity.tableName}\`  \n`;
    content += `**${this.s.entity.databaseType}**: ${entity.dbType}\n\n`;

    // Columns table
    content += `## ${this.s.entity.columns}\n\n`;
    content += `| ${this.s.entity.column} | ${this.s.endpoint.type} | ${this.s.entity.dbName} | ${this.s.entity.nullable} | ${this.s.entity.primary} | ${this.s.entity.unique} | ${this.s.endpoint.defaultValue} | ${this.s.endpoint.description} |\n`;
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
      content += `## ${this.s.entity.relations}\n\n`;
      content += `| ${this.s.endpoint.type} | ${this.s.entity.target} | ${this.s.entity.joinColumn} | ${this.s.entity.mappedBy} | ${this.s.entity.eager} |\n`;
      content += `|------|--------|-------------|-----------|-------|\n`;

      entity.relations.forEach(rel => {
        const join = rel.joinColumn ? `\`${rel.joinColumn}\`` : '-';
        const mapped = rel.mappedBy ? `\`${rel.mappedBy}\`` : '-';
        const eager = rel.eager ? '✓' : '';
        content += `| ${rel.type} | \`${rel.target}\` | ${join} | ${mapped} | ${eager} |\n`;
      });
      content += '\n';

      // Generate ER diagram with mermaid
      content += `### ${this.s.entity.erDiagram}\n\n`;
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
      content += `## ${this.s.entity.indexes}\n\n`;
      entity.indexes.forEach(idx => {
        content += `- \`${idx}\`\n`;
      });
      content += '\n';
    }

    // Source file
    content += `<details>\n<summary>${this.s.endpoint.source}</summary>\n\n\`${entity.filePath}\`\n\n</details>\n`;

    return content;
  }

  /**
   * Build conditional quick links based on available data
   */
  private buildQuickLinks(analysis: AnalysisResult): string {
    const links: string[] = [];
    if (analysis.endpoints.length > 0) {
      links.push(`- [${this.s.overview.apiEndpoints}](./api/)`);
    }
    if (analysis.entities.length > 0) {
      links.push(`- [${this.s.overview.databaseEntities}](./entities/)`);
    }
    const components = this.filterComponents(analysis.types);
    if (components.length > 0) {
      links.push(`- [${this.s.overview.components}](./components/)`);
    }
    if (analysis.services.length > 0) {
      links.push(`- [${this.s.overview.hooksAndServices}](./hooks/)`);
    }
    links.push(`- [${this.s.overview.architectureOverview}](./architecture.md)`);
    links.push(`- [${this.s.overview.changelog}](./changelog.md)`);
    return links.join('\n');
  }

  /**
   * Filter TypeInfo to extract UI components (exclude DTOs, enums, Props interfaces)
   */
  private filterComponents(types: TypeInfo[]): TypeInfo[] {
    return types.filter((t) => {
      // Include 'type' kind (React components are stored as kind: 'type')
      // Also include 'interface' that look like components (PascalCase, no Props/DTO suffix)
      if (t.kind === 'enum' || t.kind === 'dto' || t.kind === 'input' || t.kind === 'response') {
        return false;
      }
      // Exclude Props/DTO/Request/Response type interfaces
      const name = t.name;
      if (/Props$|DTO$|Dto$|Request$|Response$|Input$|Args$/.test(name)) {
        return false;
      }
      // Must be PascalCase (starts with uppercase)
      return /^[A-Z]/.test(name);
    });
  }

  /**
   * Generate component documentation pages from TypeInfo
   */
  generateComponentPages(types: TypeInfo[]): GeneratedPage[] {
    const pages: GeneratedPage[] = [];
    const components = this.filterComponents(types);

    components.forEach((comp, index) => {
      const content = this.generateComponentPageContent(comp, types);
      const path = `components/${toKebab(comp.name)}.md`;

      pages.push({
        path,
        title: comp.name,
        content,
        sidebarPosition: 200 + index,
      });
    });

    return pages;
  }

  /**
   * Generate content for a single component page
   */
  private generateComponentPageContent(comp: TypeInfo, allTypes: TypeInfo[]): string {
    let content = `# ${comp.name}\n\n`;

    if (comp.description) {
      content += `${comp.description}\n\n`;
    }

    // Props table - find matching Props interface
    const propsType = allTypes.find(
      (t) => t.name === `${comp.name}Props` || t.name === `${comp.name}Property`
    );
    const propsFields = propsType?.fields || comp.fields;

    content += `## ${this.s.component.props}\n\n`;

    if (propsFields.length > 0) {
      content += `| ${this.s.endpoint.name} | ${this.s.endpoint.type} | ${this.s.endpoint.required} | ${this.s.endpoint.description} |\n`;
      content += `|------|------|----------|-------------|\n`;

      propsFields.forEach((field) => {
        const req = field.required ? '✓' : '';
        const desc = field.description ? escapeMd(field.description) : '';
        content += `| ${escapeMd(field.name)} | \`${escapeMd(field.type)}\` | ${req} | ${desc} |\n`;
      });
      content += '\n';
    } else {
      content += `${this.s.component.noProps}\n\n`;
    }

    // Source file
    content += `<details>\n<summary>${this.s.endpoint.source}</summary>\n\n\`${comp.filePath}\`\n\n</details>\n`;

    return content;
  }

  /**
   * Generate service/hook documentation pages from ServiceInfo
   */
  generateServicePages(services: ServiceInfo[]): GeneratedPage[] {
    const pages: GeneratedPage[] = [];

    services.forEach((svc, index) => {
      const content = this.generateServicePageContent(svc);
      const path = `hooks/${toKebab(svc.name)}.md`;

      pages.push({
        path,
        title: svc.name,
        content,
        sidebarPosition: 300 + index,
      });
    });

    return pages;
  }

  /**
   * Generate content for a single service/hook page
   */
  private generateServicePageContent(svc: ServiceInfo): string {
    let content = `# ${svc.name}\n\n`;

    if (svc.description) {
      content += `${svc.description}\n\n`;
    }

    // Methods
    if (svc.methods.length > 0) {
      content += `## ${this.s.component.methods}\n\n`;
      svc.methods.forEach((method) => {
        content += `- \`${escapeMd(method)}\`\n`;
      });
      content += '\n';
    }

    // Dependencies
    if (svc.dependencies.length > 0) {
      content += `## ${this.s.component.dependencies}\n\n`;
      svc.dependencies.forEach((dep) => {
        content += `- \`${escapeMd(dep)}\`\n`;
      });
      content += '\n';
    }

    // Source file
    content += `<details>\n<summary>${this.s.endpoint.source}</summary>\n\n\`${svc.filePath}\`\n\n</details>\n`;

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
    let content = `# ${this.s.architecture.title}\n\n`;

    // Service summary
    content += `## ${this.s.architecture.services}\n\n`;
    if (analysis.services.length > 0) {
      content += `${this.s.architecture.totalServices}: ${analysis.services.length}\n\n`;

      // Service → Entity mapping
      content += `### ${this.s.architecture.serviceDependencies}\n\n`;
      content += `| ${this.s.architecture.services} | ${this.s.architecture.dependencies} | ${this.s.architecture.methods} |\n`;
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
      content += `## ${this.s.architecture.dependencyGraph}\n\n`;
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
    content += `## ${this.s.architecture.moduleStatistics}\n\n`;
    content += `| ${this.s.overview.category} | ${this.s.overview.count} |\n`;
    content += `|----------|-------|\n`;
    content += `| ${this.s.overview.services} | ${analysis.services.length} |\n`;
    content += `| ${this.s.overview.entities} | ${analysis.entities.length} |\n`;
    content += `| ${this.s.overview.types} | ${analysis.types.length} |\n`;
    content += `| ${this.s.architecture.dependencies} | ${analysis.dependencies.length} |\n`;

    return {
      path: 'architecture.md',
      title: this.s.common.architecture,
      content,
      sidebarPosition: 1000,
    };
  }

  /**
   * Load custom markdown pages from a directory
   */
  private async loadCustomPages(section: SectionConfig): Promise<GeneratedPage[]> {
    const pages: GeneratedPage[] = [];

    if (!section.dir) {
      return pages;
    }

    // Resolve directory path relative to baseDir
    const dirPath = this.config.baseDir
      ? resolve(this.config.baseDir, section.dir)
      : resolve(section.dir);

    try {
      // Read all files in the directory
      const files = await readdir(dirPath);
      const mdFiles = files.filter(f => extname(f) === '.md');

      for (const file of mdFiles) {
        const filePath = join(dirPath, file);
        const content = await readFile(filePath, 'utf-8');

        // Parse frontmatter if present
        const { meta: frontmatter, body } = extractFrontmatter(content);
        const title = frontmatter.title || basename(file, '.md');
        const description = frontmatter.description;

        // Build page path: section.id/filename
        const pagePath = `${section.id}/${file}`;

        // Create PageMeta from frontmatter
        const meta: PageMeta = {
          title,
          description,
          tags: frontmatter.tags ? frontmatter.tags.split(',').map((t: string) => t.trim()) : undefined,
          canonical: frontmatter.canonical,
          robots: frontmatter.robots,
          ogTitle: frontmatter.og_title,
          ogDescription: frontmatter.og_description,
          ogImage: frontmatter.og_image,
          ogType: frontmatter.og_type,
          twitterCard: frontmatter.twitter_card,
          twitterTitle: frontmatter.twitter_title,
          twitterDescription: frontmatter.twitter_description,
          twitterImage: frontmatter.twitter_image,
        };

        pages.push({
          path: pagePath,
          title,
          content: body,
          meta,
          sidebarPosition: frontmatter.sidebar_position ? Number(frontmatter.sidebar_position) : undefined,
        });
      }
    } catch (error) {
      console.warn(`Warning: Could not read custom pages from ${dirPath}:`, error);
    }

    return pages;
  }

  /**
   * Generate changelog page
   */
  generateChangelogPage(): GeneratedPage {
    const content = `# ${this.s.changelog.title}

All notable changes to this project will be documented here.

## [${this.s.changelog.unreleased}]

${this.s.changelog.unreleasedDesc}

## ${this.s.changelog.howToUse}

${this.s.changelog.howToUseDesc}
`;

    return {
      path: 'changelog.md',
      title: this.s.changelog.title,
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

  // Stable page identifier derived from file path (used by memo system)
  const pageId = page.path.replace(/\.md$/, '');
  lines.push(`page_id: "${pageId}"`);

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
