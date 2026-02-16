import { readdir, readFile } from 'fs/promises';
import { join, resolve, extname, basename } from 'path';
import type { AnalysisResult, DependencyInfo, EndpointInfo, EntityInfo, ServiceInfo, TypeInfo } from '../parser/types.js';
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
          pages.push(...this.generateComponentPages(analysis.types, analysis.dependencies));
          break;
        case 'services':
          pages.push(...this.generateServicePages(analysis.services, analysis.dependencies, analysis.types));
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
          pages.push(...this.generateComponentPages(analysis.types, analysis.dependencies));
          pages.push(...this.generateServicePages(analysis.services, analysis.dependencies, analysis.types));
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
    const components = this.filterComponents(analysis.types);
    const hooks = analysis.services.filter(s => s.name.startsWith('use') && s.name.match(/^use[A-Z]/));
    const regularServices = analysis.services.filter(s => !(s.name.startsWith('use') && s.name.match(/^use[A-Z]/)));

    let content = `# ${metadata.projectName}\n\n`;

    // Compact project info
    content += `> **v${metadata.version}** · Updated ${new Date(metadata.timestamp).toLocaleDateString()} · Source: \`${metadata.sourceDir}\`\n\n`;

    // At-a-glance stats as a single line
    const stats: string[] = [];
    if (components.length > 0) stats.push(`**${components.length}** Components`);
    if (hooks.length > 0) stats.push(`**${hooks.length}** Hooks`);
    if (regularServices.length > 0) stats.push(`**${regularServices.length}** Services`);
    if (analysis.endpoints.length > 0) stats.push(`**${analysis.endpoints.length}** Endpoints`);
    if (analysis.entities.length > 0) stats.push(`**${analysis.entities.length}** Entities`);
    if (stats.length > 0) content += stats.join(' · ') + '\n\n';

    content += `---\n\n`;

    // Quick navigation
    content += `## Quick Navigation\n\n`;
    content += this.buildQuickLinks(analysis);
    content += '\n\n';

    // Component overview for frontend projects
    if (components.length > 0) {
      content += `## Components\n\n`;

      // Top components table with links
      const topComponents = components.slice(0, 15);
      content += `| Component | Type | Props | File |\n`;
      content += `|-----------|------|-------|------|\n`;
      topComponents.forEach(c => {
        const kebab = toKebab(c.name);
        let typeBadge = 'component';
        if (c.name.startsWith('use') && c.name.match(/^use[A-Z]/)) typeBadge = 'hook';
        else if (c.name.endsWith('Provider') || c.name.endsWith('Context')) typeBadge = 'provider';
        else if (c.name.endsWith('Layout') || c.name.endsWith('Page')) typeBadge = 'layout';
        const propCount = c.fields.length;
        const shortPath = c.filePath.split('/').slice(-2).join('/');
        content += `| [\`${c.name}\`](./components/${kebab}.md) | ${typeBadge} | ${propCount} | \`${shortPath}\` |\n`;
      });
      if (components.length > 15) {
        content += `\n*...and ${components.length - 15} more. [View all components](./components/index.md)*\n`;
      }
      content += '\n';
    }

    // Hooks / Services overview
    if (analysis.services.length > 0) {
      content += `## Hooks / Services\n\n`;

      const topServices = analysis.services.slice(0, 10);
      content += `| Name | Type | Methods | Dependencies |\n`;
      content += `|------|------|---------|---------------|\n`;
      topServices.forEach(svc => {
        const kebab = toKebab(svc.name);
        const isHook = svc.name.startsWith('use') && svc.name.match(/^use[A-Z]/);
        content += `| [\`${svc.name}\`](./hooks/${kebab}.md) | ${isHook ? 'hook' : 'service'} | ${svc.methods.length} | ${svc.dependencies.length} |\n`;
      });
      if (analysis.services.length > 10) {
        content += `\n*...and ${analysis.services.length - 10} more. [View all](./hooks/index.md)*\n`;
      }
      content += '\n';
    }

    // API endpoints overview
    if (analysis.endpoints.length > 0) {
      const byProtocol = analysis.endpoints.reduce((acc, ep) => {
        const p = ep.protocol?.toUpperCase() || 'OTHER';
        acc[p] = (acc[p] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      content += `## API Endpoints\n\n`;
      Object.entries(byProtocol).forEach(([protocol, count]) => {
        content += `- **${protocol}**: ${count} endpoint${count !== 1 ? 's' : ''}\n`;
      });
      content += '\n';
    }

    // Data Models overview
    if (analysis.entities.length > 0) {
      content += `## Data Models\n\n`;
      content += `| Entity | Columns | Relations |\n`;
      content += `|--------|---------|----------|\n`;
      analysis.entities.slice(0, 10).forEach(e => {
        content += `| \`${e.name}\` | ${e.columns.length} | ${e.relations.length} |\n`;
      });
      if (analysis.entities.length > 10) {
        content += `\n*...and ${analysis.entities.length - 10} more*\n`;
      }
      content += '\n';
    }

    // Parsers
    content += `## Parsers Used\n\n`;
    content += metadata.parsers.map(p => `- ${p}`).join('\n');
    content += '\n';

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
      content += `    ${this.sanitizeMermaidLabel(entity.name)} {\n`;
      entity.columns.forEach(col => {
        const pk = col.primaryKey ? 'PK' : '';
        const sanitizedType = this.sanitizeMermaidLabel(col.type);
        const sanitizedCol = this.sanitizeMermaidLabel(col.dbColumnName);
        content += `        ${sanitizedType} ${sanitizedCol} ${pk}\n`;
      });
      content += '    }\n';

      entity.relations.forEach(rel => {
        const relType = this.mapRelationType(rel.type);
        const sanitizedEntity = this.sanitizeMermaidLabel(entity.name);
        const sanitizedTarget = this.sanitizeMermaidLabel(rel.target);
        const sanitizedRelType = this.sanitizeMermaidLabel(rel.type);
        content += `    ${sanitizedEntity} ${relType} ${sanitizedTarget} : "${sanitizedRelType}"\n`;
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
   * Generate component documentation — individual page per component + index catalog
   */
  generateComponentPages(types: TypeInfo[], dependencies: DependencyInfo[]): GeneratedPage[] {
    const components = this.filterComponents(types).sort((a, b) =>
      a.name.localeCompare(b.name)
    );

    if (components.length === 0) {
      return [];
    }

    const pages: GeneratedPage[] = [];
    const componentNames = new Set(components.map(c => c.name));

    // Build usage/dependency maps between components
    const usedByMap = new Map<string, Set<string>>();
    const importsMap = new Map<string, Set<string>>();

    dependencies.forEach(dep => {
      if (dep.type === 'import' && componentNames.has(dep.source) && componentNames.has(dep.target)) {
        if (!importsMap.has(dep.source)) importsMap.set(dep.source, new Set());
        importsMap.get(dep.source)!.add(dep.target);
        if (!usedByMap.has(dep.target)) usedByMap.set(dep.target, new Set());
        usedByMap.get(dep.target)!.add(dep.source);
      }
    });

    // Index page — component catalog
    pages.push(this.generateComponentIndexPage(components, types, usedByMap, importsMap));

    // Individual component detail pages
    components.forEach((comp, index) => {
      pages.push(this.generateComponentDetailPage(comp, components, types, usedByMap, importsMap, index));
    });

    return pages;
  }

  /**
   * Component catalog index page
   */
  private generateComponentIndexPage(
    components: TypeInfo[],
    allTypes: TypeInfo[],
    usedByMap: Map<string, Set<string>>,
    importsMap: Map<string, Set<string>>,
  ): GeneratedPage {
    let content = `# ${this.s.overview.components}\n\n`;
    content += `> ${components.length} components documented\n\n`;

    // Category breakdown
    const categories = new Map<string, TypeInfo[]>();
    components.forEach(comp => {
      let typeBadge = 'component';
      if (comp.name.startsWith('use') && comp.name.match(/^use[A-Z]/)) typeBadge = 'hook';
      else if (comp.name.endsWith('Provider') || comp.name.endsWith('Context')) typeBadge = 'provider';
      else if (comp.name.endsWith('Layout') || comp.name.endsWith('Page')) typeBadge = 'layout';
      if (!categories.has(typeBadge)) categories.set(typeBadge, []);
      categories.get(typeBadge)!.push(comp);
    });

    // Stats line
    const catStats = Array.from(categories.entries()).map(([cat, items]) => `**${items.length}** ${cat}s`);
    if (catStats.length > 0) content += catStats.join(' · ') + '\n\n';

    // Component table with links to detail pages
    content += `| Component | Type | Props | Used By | Imports |\n`;
    content += `|-----------|------|-------|---------|----------|\n`;

    components.forEach(comp => {
      const kebab = toKebab(comp.name);
      let typeBadge = 'component';
      if (comp.name.startsWith('use') && comp.name.match(/^use[A-Z]/)) typeBadge = 'hook';
      else if (comp.name.endsWith('Provider') || comp.name.endsWith('Context')) typeBadge = 'provider';
      else if (comp.name.endsWith('Layout') || comp.name.endsWith('Page')) typeBadge = 'layout';

      const propsType = allTypes.find(t => t.name === `${comp.name}Props` || t.name === `${comp.name}Property`);
      const propsCount = (propsType?.fields || comp.fields).length;
      const usedByCount = usedByMap.get(comp.name)?.size || 0;
      const importsCount = importsMap.get(comp.name)?.size || 0;

      content += `| [\`${comp.name}\`](./${kebab}.md) | ${typeBadge} | ${propsCount} | ${usedByCount} | ${importsCount} |\n`;
    });
    content += '\n';

    return {
      path: 'components/index.md',
      title: this.s.overview.components,
      content,
      sidebarPosition: 200,
    };
  }

  /**
   * Individual component detail page
   */
  private generateComponentDetailPage(
    comp: TypeInfo,
    allComponents: TypeInfo[],
    allTypes: TypeInfo[],
    usedByMap: Map<string, Set<string>>,
    importsMap: Map<string, Set<string>>,
    index: number,
  ): GeneratedPage {
    const kebabName = toKebab(comp.name);

    // Determine component type
    let typeBadge = 'Component';
    if (comp.name.startsWith('use') && comp.name.match(/^use[A-Z]/)) {
      typeBadge = 'Hook';
    } else if (comp.name.endsWith('Provider') || comp.name.endsWith('Context')) {
      typeBadge = 'Provider';
    } else if (comp.name.endsWith('Layout') || comp.name.endsWith('Page')) {
      typeBadge = 'Layout';
    }

    let content = `# ${comp.name}\n\n`;
    const shortPath = comp.filePath.split('/').slice(-2).join('/');
    content += `**Type**: ${typeBadge} · **File**: \`${shortPath}\`\n\n`;

    if (comp.description) {
      content += `${comp.description}\n\n`;
    }

    content += `---\n\n`;

    // Props table
    const propsType = allTypes.find(t => t.name === `${comp.name}Props` || t.name === `${comp.name}Property`);
    const propsFields = propsType?.fields || comp.fields;

    content += `## ${this.s.component.props}\n\n`;
    if (propsFields.length > 0) {
      content += `| ${this.s.endpoint.name} | ${this.s.endpoint.type} | ${this.s.endpoint.required} | ${this.s.endpoint.description} |\n`;
      content += `|------|------|----------|-------------|\n`;
      propsFields.forEach(field => {
        const req = field.required ? '✓' : '';
        const desc = field.description ? escapeMd(field.description) : '';
        content += `| ${escapeMd(field.name)} | \`${escapeMd(field.type)}\` | ${req} | ${desc} |\n`;
      });
      content += '\n';
    } else {
      content += `${this.s.component.noProps}\n\n`;
    }

    // Used By section
    const usedBySet = usedByMap.get(comp.name);
    if (usedBySet && usedBySet.size > 0) {
      content += `## Used By\n\n`;
      Array.from(usedBySet).sort().forEach(name => {
        const target = allComponents.find(c => c.name === name);
        const kebab = toKebab(name);
        content += `- [\`${name}\`](./${kebab}.md)`;
        if (target) {
          const sp = target.filePath.split('/').slice(-2).join('/');
          content += ` — \`${sp}\``;
        }
        content += '\n';
      });
      content += '\n';
    }

    // Dependencies section
    const importsSet = importsMap.get(comp.name);
    if (importsSet && importsSet.size > 0) {
      content += `## Dependencies\n\n`;
      Array.from(importsSet).sort().forEach(name => {
        const target = allComponents.find(c => c.name === name);
        const kebab = toKebab(name);
        content += `- [\`${name}\`](./${kebab}.md)`;
        if (target) {
          const sp = target.filePath.split('/').slice(-2).join('/');
          content += ` — \`${sp}\``;
        }
        content += '\n';
      });
      content += '\n';
    }

    // Relationship diagram (show both usedBy and imports)
    const hasUsedBy = usedBySet && usedBySet.size > 0;
    const hasImports = importsSet && importsSet.size > 0;
    if (hasUsedBy || hasImports) {
      content += `## Relationship Diagram\n\n`;
      content += '```mermaid\nflowchart TD\n';
      const compId = this.sanitizeMermaidNodeId(comp.name);
      const compLabel = this.sanitizeMermaidLabel(comp.name);
      content += `    ${compId}["${compLabel}"]:::current\n`;

      if (hasUsedBy) {
        usedBySet!.forEach(name => {
          const srcId = this.sanitizeMermaidNodeId(name);
          const srcLabel = this.sanitizeMermaidLabel(name);
          content += `    ${srcId}["${srcLabel}"] --> ${compId}\n`;
        });
      }
      if (hasImports) {
        importsSet!.forEach(name => {
          const tgtId = this.sanitizeMermaidNodeId(name);
          const tgtLabel = this.sanitizeMermaidLabel(name);
          content += `    ${compId} --> ${tgtId}["${tgtLabel}"]\n`;
        });
      }

      content += `    classDef current fill:#4299e1,stroke:#2b6cb0,color:#fff\n`;
      content += '```\n\n';
    }

    // Source
    content += `## Source\n\n\`${comp.filePath}\`\n`;

    return {
      path: `components/${kebabName}.md`,
      title: comp.name,
      content,
      sidebarPosition: 201 + index,
    };
  }

  /**
   * Generate service/hook documentation — individual page per service + index catalog
   */
  generateServicePages(services: ServiceInfo[], dependencies: DependencyInfo[], types: TypeInfo[]): GeneratedPage[] {
    const sortedServices = [...services].sort((a, b) =>
      a.name.localeCompare(b.name)
    );

    if (sortedServices.length === 0) {
      return [];
    }

    const pages: GeneratedPage[] = [];
    const serviceNames = new Set(sortedServices.map(s => s.name));
    const componentNames = new Set(this.filterComponents(types).map(c => c.name));

    // Build usage map: which components use each service
    const usedByComponents = new Map<string, Set<string>>();
    dependencies.forEach(dep => {
      if (dep.type === 'import' && componentNames.has(dep.source) && serviceNames.has(dep.target)) {
        if (!usedByComponents.has(dep.target)) usedByComponents.set(dep.target, new Set());
        usedByComponents.get(dep.target)!.add(dep.source);
      }
    });

    // Index page
    pages.push(this.generateServiceIndexPage(sortedServices, usedByComponents));

    // Individual service detail pages
    sortedServices.forEach((svc, index) => {
      pages.push(this.generateServiceDetailPage(svc, sortedServices, usedByComponents, index));
    });

    return pages;
  }

  /**
   * Service/hook catalog index page
   */
  private generateServiceIndexPage(
    services: ServiceInfo[],
    usedByComponents: Map<string, Set<string>>,
  ): GeneratedPage {
    const hooks = services.filter(s => s.name.startsWith('use') && s.name.match(/^use[A-Z]/));
    const regularServices = services.filter(s => !(s.name.startsWith('use') && s.name.match(/^use[A-Z]/)));

    let content = `# Hooks / Services\n\n`;
    content += `> ${services.length} total — **${hooks.length}** hooks, **${regularServices.length}** services\n\n`;

    // Service table with links
    content += `| Name | Type | Methods | Dependencies | Used By |\n`;
    content += `|------|------|---------|--------------|----------|\n`;

    services.forEach(svc => {
      const kebab = toKebab(svc.name);
      const isHook = svc.name.startsWith('use') && svc.name.match(/^use[A-Z]/);
      const usedByCount = usedByComponents.get(svc.name)?.size || 0;
      content += `| [\`${svc.name}\`](./${kebab}.md) | ${isHook ? 'hook' : 'service'} | ${svc.methods.length} | ${svc.dependencies.length} | ${usedByCount} |\n`;
    });
    content += '\n';

    return {
      path: 'hooks/index.md',
      title: 'Hooks / Services',
      content,
      sidebarPosition: 300,
    };
  }

  /**
   * Individual service/hook detail page
   */
  private generateServiceDetailPage(
    svc: ServiceInfo,
    allServices: ServiceInfo[],
    usedByComponents: Map<string, Set<string>>,
    index: number,
  ): GeneratedPage {
    const kebabName = toKebab(svc.name);
    const isHook = svc.name.startsWith('use') && svc.name.match(/^use[A-Z]/);
    const typeBadge = isHook ? 'Hook' : 'Service';

    let content = `# ${svc.name}\n\n`;
    const shortPath = svc.filePath.split('/').slice(-2).join('/');
    content += `**Type**: ${typeBadge} · **File**: \`${shortPath}\` · **Methods**: ${svc.methods.length} · **Dependencies**: ${svc.dependencies.length}\n\n`;

    if (svc.description) {
      content += `${svc.description}\n\n`;
    }

    content += `---\n\n`;

    // Methods
    if (svc.methods.length > 0) {
      content += `## ${this.s.component.methods}\n\n`;
      content += `| Method |\n`;
      content += `|--------|\n`;
      svc.methods.forEach(method => {
        content += `| \`${escapeMd(method)}\` |\n`;
      });
      content += '\n';
    }

    // Dependencies with cross-references
    if (svc.dependencies.length > 0) {
      content += `## ${this.s.component.dependencies}\n\n`;
      svc.dependencies.forEach(dep => {
        const linkedSvc = allServices.find(s => s.name === dep);
        if (linkedSvc) {
          const depKebab = toKebab(dep);
          content += `- [\`${escapeMd(dep)}\`](./${depKebab}.md)\n`;
        } else {
          content += `- \`${escapeMd(dep)}\`\n`;
        }
      });
      content += '\n';
    }

    // Used by components
    const usedBySet = usedByComponents.get(svc.name);
    if (usedBySet && usedBySet.size > 0) {
      content += `## Used By Components\n\n`;
      Array.from(usedBySet).sort().forEach(name => {
        const kebab = toKebab(name);
        content += `- [\`${name}\`](../components/${kebab}.md)\n`;
      });
      content += '\n';
    }

    // Dependency diagram
    if (svc.dependencies.length > 0 && svc.dependencies.length <= 10) {
      content += `## Dependency Graph\n\n`;
      content += '```mermaid\nflowchart LR\n';
      const svcId = this.sanitizeMermaidNodeId(svc.name);
      const svcLabel = this.sanitizeMermaidLabel(svc.name);
      content += `    ${svcId}["${svcLabel}"]:::current\n`;
      svc.dependencies.forEach(dep => {
        const depId = this.sanitizeMermaidNodeId(dep);
        const depLabel = this.sanitizeMermaidLabel(dep);
        content += `    ${svcId} --> ${depId}["${depLabel}"]\n`;
      });
      content += `    classDef current fill:#48bb78,stroke:#276749,color:#fff\n`;
      content += '```\n\n';
    }

    // Source
    content += `## Source\n\n\`${svc.filePath}\`\n`;

    return {
      path: `hooks/${kebabName}.md`,
      title: svc.name,
      content,
      sidebarPosition: 301 + index,
    };
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
   * Sanitize a label for use inside mermaid diagram quotes.
   * Removes characters that break mermaid syntax.
   */
  private sanitizeMermaidLabel(label: string): string {
    let sanitized = label
      .replace(/"/g, "'")
      .replace(/[[\]{}()<>|&;#`%]/g, '')
      .replace(/\n/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    // Prevent empty labels which break mermaid syntax
    if (!sanitized) sanitized = 'unnamed';
    return sanitized;
  }

  /**
   * Sanitize a string for use as a mermaid node ID.
   * Returns only alphanumeric chars and underscores; never empty.
   */
  private sanitizeMermaidNodeId(name: string): string {
    let id = name.replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
    if (!id) id = 'node_' + Math.random().toString(36).slice(2, 6);
    return id;
  }

  /**
   * Generate architecture overview page with dependency graph
   */
  generateArchitecturePage(analysis: AnalysisResult): GeneratedPage {
    let content = `# ${this.s.architecture.title}\n\n`;

    // 1. Tech Stack Overview section (NEW)
    content += this.generateTechStackOverview(analysis);

    // Determine if backend exists
    const hasBackend = analysis.services.filter(s => !(s.name.startsWith('use') && s.name.match(/^use[A-Z]/))).length > 0
      || analysis.entities.length > 0
      || analysis.endpoints.length > 0;

    // Frontend Architecture section (ENHANCED)
    const components = this.filterComponents(analysis.types);
    if (components.length > 0) {
      content += `## Frontend Architecture\n\n`;
      content += `**Component Count**: ${components.length}\n\n`;

      // Component categories (group by file path patterns)
      const categories = new Map<string, number>();
      components.forEach(comp => {
        const pathParts = comp.filePath.split('/');
        const category = pathParts.includes('components')
          ? pathParts[pathParts.indexOf('components') + 1] || 'root'
          : 'other';
        categories.set(category, (categories.get(category) || 0) + 1);
      });

      if (categories.size > 0) {
        content += `### Component Categories\n\n`;
        Array.from(categories.entries())
          .sort((a, b) => b[1] - a[1])
          .forEach(([category, count]) => {
            content += `- **${category}**: ${count} component${count !== 1 ? 's' : ''}\n`;
          });
        content += '\n';
      }

      // Component Hierarchy Diagram (NEW)
      content += this.generateComponentHierarchyDiagram(components, analysis.dependencies);

      // Routing Structure (NEW)
      content += this.generateRoutingStructure(analysis.types);

      // State management patterns (detect hooks, context, store)
      const statePatterns: string[] = [];
      components.forEach(comp => {
        if (comp.filePath.includes('context') || comp.name.includes('Context')) {
          if (!statePatterns.includes('Context API')) statePatterns.push('Context API');
        }
        if (comp.filePath.includes('store') || comp.name.includes('Store')) {
          if (!statePatterns.includes('Store')) statePatterns.push('Store');
        }
      });
      analysis.services.forEach(svc => {
        if (svc.name.startsWith('use') && svc.name.match(/^use[A-Z]/)) {
          if (!statePatterns.includes('Custom Hooks')) statePatterns.push('Custom Hooks');
        }
      });

      if (statePatterns.length > 0) {
        content += `### State Management Patterns\n\n`;
        statePatterns.forEach(pattern => {
          content += `- ${pattern}\n`;
        });
        content += '\n';
      }

      // Key frontend dependencies (from component imports)
      const frontendDeps = new Set<string>();
      analysis.dependencies
        .filter(dep => dep.type === 'import')
        .forEach(dep => {
          if (dep.target.includes('react') || dep.target.includes('vue') ||
              dep.target.includes('svelte') || dep.target.includes('angular')) {
            frontendDeps.add(dep.target);
          }
        });

      if (frontendDeps.size > 0) {
        content += `### Key Dependencies\n\n`;
        Array.from(frontendDeps).slice(0, 10).forEach(dep => {
          content += `- \`${dep}\`\n`;
        });
        content += '\n';
      }

      // For Backend Developers (NEW)
      if (hasBackend && components.length > 0) {
        content += this.generateFrontendSummaryForBackend(components, statePatterns, analysis);
      }
    }

    // Backend Architecture section (ENHANCED)
    if (hasBackend) {
      content += `## Backend Architecture\n\n`;

      if (analysis.services.length > 0) {
        content += `**Service Count**: ${analysis.services.length}\n\n`;

        // Service dependencies summary
        const totalDeps = analysis.services.reduce((sum, svc) => sum + svc.dependencies.length, 0);
        content += `**Total Service Dependencies**: ${totalDeps}\n\n`;
      }

      // Entity-to-Service mapping
      if (analysis.entities.length > 0 && analysis.services.length > 0) {
        content += `### Entity-to-Service Mapping\n\n`;

        const entityServiceMap = new Map<string, string[]>();
        analysis.services.forEach(svc => {
          svc.dependencies.forEach(dep => {
            const matchingEntity = analysis.entities.find(e =>
              dep.includes(e.name) || e.name.includes(dep)
            );
            if (matchingEntity) {
              const existing = entityServiceMap.get(matchingEntity.name) || [];
              if (!existing.includes(svc.name)) {
                existing.push(svc.name);
                entityServiceMap.set(matchingEntity.name, existing);
              }
            }
          });
        });

        if (entityServiceMap.size > 0) {
          content += `| Entity | Services |\n`;
          content += `|--------|----------|\n`;
          Array.from(entityServiceMap.entries())
            .sort((a, b) => a[0].localeCompare(b[0]))
            .forEach(([entity, services]) => {
              const svcList = services.map(s => `\`${s}\``).join(', ');
              content += `| \`${entity}\` | ${svcList} |\n`;
            });
          content += '\n';
        }
      }

      // Service Layer Diagram (NEW - Enhanced)
      content += this.generateServiceLayerDiagram(analysis.services);

      // Data Flow Diagram (NEW)
      content += this.generateDataFlowDiagram(analysis.entities, analysis.services, analysis.endpoints);

      // API endpoint grouping
      if (analysis.endpoints.length > 0) {
        content += `### API Endpoint Grouping\n\n`;

        const endpointsByProtocol = analysis.endpoints.reduce((acc, ep) => {
          const protocol = ep.protocol || 'unknown';
          acc[protocol] = (acc[protocol] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);

        content += `| Protocol | Count |\n`;
        content += `|----------|-------|\n`;
        Object.entries(endpointsByProtocol)
          .sort((a, b) => b[1] - a[1])
          .forEach(([protocol, count]) => {
            content += `| ${protocol.toUpperCase()} | ${count} |\n`;
          });
        content += '\n';

        // Group by handler class
        const handlerGroups = analysis.endpoints.reduce((acc, ep) => {
          const handler = ep.handlerClass || 'misc';
          acc[handler] = (acc[handler] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);

        if (Object.keys(handlerGroups).length > 1) {
          content += `**Endpoint Handlers**: ${Object.keys(handlerGroups).length}\n\n`;
        }
      }

      // For Frontend Developers (NEW)
      if (hasBackend && components.length > 0) {
        content += this.generateBackendSummaryForFrontend(analysis.services, analysis.endpoints, analysis.entities);
      }
    }

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

    // Cross-Reference Section (NEW)
    if (hasBackend && components.length > 0) {
      content += this.generateCrossReferenceSection(analysis);
    }

    // Dependency graph (limit to top 30 edges to keep diagram readable)
    if (analysis.dependencies.length > 0) {
      content += `## ${this.s.architecture.dependencyGraph}\n\n`;
      content += '```mermaid\nflowchart TD\n';

      // Limit edges for readability
      const deps = analysis.dependencies.slice(0, 30);

      // Build unique node IDs — handle collisions from short names
      const nodeMap = new Map<string, string>();
      const usedIds = new Set<string>();
      const allNodes = new Set<string>();
      deps.forEach(dep => { allNodes.add(dep.source); allNodes.add(dep.target); });

      allNodes.forEach(node => {
        const short = node.split('.').pop() || node;
        let id = this.sanitizeMermaidNodeId(short);
        let attempt = 1;
        while (usedIds.has(id) && nodeMap.get(node) !== id) {
          id = this.sanitizeMermaidNodeId(short) + '_' + attempt++;
        }
        usedIds.add(id);
        nodeMap.set(node, id);
      });

      const renderedEdges = new Set<string>();
      deps.forEach(dep => {
        const srcId = nodeMap.get(dep.source) || 'unknown';
        const tgtId = nodeMap.get(dep.target) || 'unknown';
        const edgeKey = `${srcId}_${tgtId}`;
        if (renderedEdges.has(edgeKey) || srcId === tgtId) return;
        renderedEdges.add(edgeKey);
        const srcLabel = this.sanitizeMermaidLabel(dep.source.split('.').pop() || dep.source);
        const tgtLabel = this.sanitizeMermaidLabel(dep.target.split('.').pop() || dep.target);
        content += `    ${srcId}["${srcLabel}"] -->|${this.sanitizeMermaidLabel(dep.type)}| ${tgtId}["${tgtLabel}"]\n`;
      });

      content += '```\n\n';

      if (analysis.dependencies.length > 30) {
        content += `*Showing 30 of ${analysis.dependencies.length} dependencies.*\n\n`;
      }
    }

    // Module statistics (ENHANCED with percentages)
    content += `## ${this.s.architecture.moduleStatistics}\n\n`;
    const total = analysis.services.length + analysis.entities.length + analysis.types.length + analysis.dependencies.length;
    content += `| ${this.s.overview.category} | ${this.s.overview.count} | Percentage |\n`;
    content += `|----------|-------|------------|\n`;
    content += `| ${this.s.overview.services} | ${analysis.services.length} | ${total > 0 ? ((analysis.services.length / total) * 100).toFixed(1) : 0}% |\n`;
    content += `| ${this.s.overview.entities} | ${analysis.entities.length} | ${total > 0 ? ((analysis.entities.length / total) * 100).toFixed(1) : 0}% |\n`;
    content += `| ${this.s.overview.types} | ${analysis.types.length} | ${total > 0 ? ((analysis.types.length / total) * 100).toFixed(1) : 0}% |\n`;
    content += `| ${this.s.architecture.dependencies} | ${analysis.dependencies.length} | ${total > 0 ? ((analysis.dependencies.length / total) * 100).toFixed(1) : 0}% |\n`;

    return {
      path: 'architecture.md',
      title: this.s.common.architecture,
      content,
      sidebarPosition: 1000,
    };
  }

  /**
   * Generate Tech Stack Overview section
   */
  private generateTechStackOverview(analysis: AnalysisResult): string {
    let content = `## Tech Stack Overview\n\n`;

    // Detect frameworks from file paths and dependencies
    const frameworks = new Set<string>();
    const libraries = new Set<string>();

    // Detect from dependencies
    analysis.dependencies.forEach(dep => {
      const target = dep.target.toLowerCase();
      if (target.includes('react')) frameworks.add('React');
      else if (target.includes('vue')) frameworks.add('Vue');
      else if (target.includes('angular')) frameworks.add('Angular');
      else if (target.includes('svelte')) frameworks.add('Svelte');
      else if (target.includes('nestjs') || target.includes('@nestjs')) frameworks.add('NestJS');
      else if (target.includes('express')) frameworks.add('Express');
      else if (target.includes('fastify')) frameworks.add('Fastify');
      else if (target.includes('next')) frameworks.add('Next.js');
      else if (target.includes('nuxt')) frameworks.add('Nuxt.js');

      // Key libraries
      if (target.includes('typeorm')) libraries.add('TypeORM');
      else if (target.includes('prisma')) libraries.add('Prisma');
      else if (target.includes('mongoose')) libraries.add('Mongoose');
      else if (target.includes('axios')) libraries.add('Axios');
      else if (target.includes('graphql')) libraries.add('GraphQL');
      else if (target.includes('redux')) libraries.add('Redux');
      else if (target.includes('mobx')) libraries.add('MobX');
      else if (target.includes('zustand')) libraries.add('Zustand');
    });

    // Detect from file paths
    analysis.types.forEach(type => {
      const path = type.filePath.toLowerCase();
      if (path.includes('.tsx') || path.includes('.jsx')) {
        if (!frameworks.has('Vue') && !frameworks.has('Angular') && !frameworks.has('Svelte')) {
          frameworks.add('React');
        }
      }
    });

    if (frameworks.size > 0 || libraries.size > 0) {
      content += `**Detected Technologies:**\n\n`;

      if (frameworks.size > 0) {
        content += `**Frameworks:** ${Array.from(frameworks).join(', ')}\n\n`;
      }

      if (libraries.size > 0) {
        content += `**Key Libraries:** ${Array.from(libraries).join(', ')}\n\n`;
      }
    } else {
      content += `*No frameworks or libraries automatically detected. Check dependencies manually.*\n\n`;
    }

    return content;
  }

  /**
   * Generate Component Hierarchy Diagram
   */
  private generateComponentHierarchyDiagram(components: TypeInfo[], dependencies: DependencyInfo[]): string {
    if (components.length === 0) return '';

    let content = `### Component Hierarchy Diagram\n\n`;

    // Build import graph for components
    const componentNames = new Set(components.map(c => c.name));
    const componentImports = new Map<string, Set<string>>();

    dependencies.forEach(dep => {
      if (dep.type === 'import' && componentNames.has(dep.source) && componentNames.has(dep.target)) {
        if (!componentImports.has(dep.source)) {
          componentImports.set(dep.source, new Set());
        }
        componentImports.get(dep.source)!.add(dep.target);
      }
    });

    // Get top 15 most connected components
    const componentsByConnections = Array.from(componentImports.entries())
      .map(([name, imports]) => ({ name, connections: imports.size }))
      .sort((a, b) => b.connections - a.connections)
      .slice(0, 15);

    if (componentsByConnections.length > 0) {
      content += '```mermaid\nflowchart TD\n';

      const rendered = new Set<string>();
      componentsByConnections.forEach(({ name }) => {
        const imports = componentImports.get(name) || new Set();
        const srcId = this.sanitizeMermaidNodeId(name);

        imports.forEach(target => {
          const tgtId = this.sanitizeMermaidNodeId(target);
          const edge = `${srcId}_${tgtId}`;
          if (!rendered.has(edge)) {
            const srcLabel = this.sanitizeMermaidLabel(name);
            const tgtLabel = this.sanitizeMermaidLabel(target);
            content += `    ${srcId}["${srcLabel}"] --> ${tgtId}["${tgtLabel}"]\n`;
            rendered.add(edge);
          }
        });
      });

      content += '```\n\n';
    } else {
      content += `*No component import relationships detected.*\n\n`;
    }

    return content;
  }

  /**
   * Generate Routing Structure section
   */
  private generateRoutingStructure(types: TypeInfo[]): string {
    const routeFiles = types.filter(t =>
      t.filePath.toLowerCase().includes('route') ||
      t.filePath.toLowerCase().includes('page') ||
      t.filePath.toLowerCase().includes('screen')
    );

    if (routeFiles.length === 0) return '';

    let content = `### Routing Structure\n\n`;
    content += `**Detected Route Components:** ${routeFiles.length}\n\n`;

    // Group by directory
    const routesByDir = new Map<string, string[]>();
    routeFiles.forEach(route => {
      const parts = route.filePath.split('/');
      const dir = parts.slice(0, -1).join('/') || 'root';
      if (!routesByDir.has(dir)) {
        routesByDir.set(dir, []);
      }
      routesByDir.get(dir)!.push(route.name);
    });

    Array.from(routesByDir.entries())
      .slice(0, 10)
      .forEach(([dir, routes]) => {
        content += `- **${dir}**: ${routes.join(', ')}\n`;
      });

    content += '\n';
    return content;
  }

  /**
   * Generate Frontend Summary for Backend Developers
   */
  private generateFrontendSummaryForBackend(components: TypeInfo[], statePatterns: string[], analysis: AnalysisResult): string {
    let content = `### For Backend Developers\n\n`;

    content += `The frontend uses **${components.length} components** organized in a modular structure. `;

    if (statePatterns.length > 0) {
      content += `State is managed via ${statePatterns.join(', ')}. `;
    }

    const routeComponents = analysis.types.filter(t =>
      t.filePath.toLowerCase().includes('route') ||
      t.filePath.toLowerCase().includes('page')
    );

    if (routeComponents.length > 0) {
      content += `Key entry points include ${routeComponents.length} route/page components. `;
    }

    content += `The UI layer consumes backend APIs primarily through `;

    const hasAxios = analysis.dependencies.some(d => d.target.toLowerCase().includes('axios'));
    const hasFetch = analysis.dependencies.some(d => d.target.toLowerCase().includes('fetch'));

    if (hasAxios) content += 'Axios HTTP client';
    else if (hasFetch) content += 'Fetch API';
    else content += 'HTTP client libraries';

    content += '.\n\n';

    return content;
  }

  /**
   * Generate Service Layer Diagram
   */
  private generateServiceLayerDiagram(services: ServiceInfo[]): string {
    if (services.length === 0) return '';

    let content = `### Service Layer Diagram\n\n`;

    // Build service-to-service dependency graph
    const serviceDeps = new Map<string, Set<string>>();
    const serviceNames = new Set(services.map(s => s.name));

    services.forEach(svc => {
      svc.dependencies.forEach(dep => {
        if (serviceNames.has(dep)) {
          if (!serviceDeps.has(svc.name)) {
            serviceDeps.set(svc.name, new Set());
          }
          serviceDeps.get(svc.name)!.add(dep);
        }
      });
    });

    if (serviceDeps.size > 0) {
      content += '```mermaid\nflowchart LR\n';

      const rendered = new Set<string>();
      Array.from(serviceDeps.entries()).slice(0, 20).forEach(([service, deps]) => {
        const srcId = this.sanitizeMermaidNodeId(service);
        deps.forEach(dep => {
          const tgtId = this.sanitizeMermaidNodeId(dep);
          const edge = `${srcId}_${tgtId}`;
          if (!rendered.has(edge)) {
            const svcLabel = this.sanitizeMermaidLabel(service);
            const depLabel = this.sanitizeMermaidLabel(dep);
            content += `    ${srcId}["${svcLabel}"] --> ${tgtId}["${depLabel}"]\n`;
            rendered.add(edge);
          }
        });
      });

      content += '```\n\n';
    } else {
      content += `*No service-to-service dependencies detected.*\n\n`;
    }

    return content;
  }

  /**
   * Generate Data Flow Diagram (Entity → Service → Endpoint)
   */
  private generateDataFlowDiagram(entities: EntityInfo[], services: ServiceInfo[], endpoints: EndpointInfo[]): string {
    if (entities.length === 0 && services.length === 0 && endpoints.length === 0) return '';

    let content = `### Data Flow\n\n`;
    content += '```mermaid\nflowchart LR\n';

    // Entity → Service mapping
    const entityServiceMap = new Map<string, Set<string>>();
    services.forEach(svc => {
      svc.dependencies.forEach(dep => {
        const matchingEntity = entities.find(e =>
          dep.includes(e.name) || e.name.includes(dep.replace(/Repository|Service/g, ''))
        );
        if (matchingEntity) {
          if (!entityServiceMap.has(matchingEntity.name)) {
            entityServiceMap.set(matchingEntity.name, new Set());
          }
          entityServiceMap.get(matchingEntity.name)!.add(svc.name);
        }
      });
    });

    // Service → Endpoint mapping
    const serviceEndpointMap = new Map<string, Set<string>>();
    endpoints.forEach(ep => {
      if (ep.serviceRef) {
        if (!serviceEndpointMap.has(ep.serviceRef)) {
          serviceEndpointMap.set(ep.serviceRef, new Set());
        }
        serviceEndpointMap.get(ep.serviceRef)!.add(ep.name);
      }
    });

    // Render Entity → Service flows (limit to 10)
    let flowCount = 0;
    for (const [entity, svcs] of entityServiceMap.entries()) {
      if (flowCount >= 10) break;
      const entityId = this.sanitizeMermaidNodeId(entity);
      const entityLabel = this.sanitizeMermaidLabel(entity);
      svcs.forEach(svc => {
        const svcId = this.sanitizeMermaidNodeId(svc);
        const svcLabel = this.sanitizeMermaidLabel(svc);
        content += `    ${entityId}["${entityLabel}"] --> ${svcId}["${svcLabel}"]\n`;

        // Service → Endpoint
        const eps = serviceEndpointMap.get(svc);
        if (eps && flowCount < 10) {
          eps.forEach(ep => {
            const epId = this.sanitizeMermaidNodeId(ep);
            const epLabel = this.sanitizeMermaidLabel(ep);
            content += `    ${svcId} --> ${epId}["${epLabel}"]\n`;
          });
        }
        flowCount++;
      });
    }

    if (flowCount === 0) {
      content += `    A["No data flow detected"]\n`;
    }

    content += '```\n\n';
    return content;
  }

  /**
   * Generate Backend Summary for Frontend Developers
   */
  private generateBackendSummaryForFrontend(services: ServiceInfo[], endpoints: EndpointInfo[], entities: EntityInfo[]): string {
    let content = `### For Frontend Developers\n\n`;

    content += `The backend exposes **${endpoints.length} endpoints** through **${services.length} services**. `;

    if (entities.length > 0) {
      content += `Data is stored in **${entities.length} entities** (database tables/collections). `;
    }

    // Protocol summary
    const protocols = new Set(endpoints.map(ep => ep.protocol));
    if (protocols.size > 0) {
      content += `API protocols include: ${Array.from(protocols).map(p => p.toUpperCase()).join(', ')}. `;
    }

    // Auth info
    const authEndpoints = endpoints.filter(ep => ep.auth);
    if (authEndpoints.length > 0) {
      content += `${authEndpoints.length} endpoints require authentication. `;
    }

    content += `Refer to the API documentation for endpoint details and request/response schemas.\n\n`;

    return content;
  }

  /**
   * Generate Cross-Reference Section
   */
  private generateCrossReferenceSection(analysis: AnalysisResult): string {
    let content = `## Frontend ↔ Backend Integration Points\n\n`;

    // Detect potential API consumption patterns
    const apiServiceNames = analysis.services
      .filter(s => s.name.toLowerCase().includes('api') || s.name.toLowerCase().includes('client') || s.name.toLowerCase().includes('http'))
      .map(s => s.name);

    if (apiServiceNames.length > 0) {
      content += `**API Client Services:**\n\n`;
      apiServiceNames.forEach(name => {
        content += `- \`${name}\`\n`;
      });
      content += '\n';
    }

    // API Contract Summary
    if (analysis.endpoints.length > 0) {
      content += `### API Contract Summary\n\n`;
      content += `| Method | Path | Handler |\n`;
      content += `|--------|------|--------|\n`;

      analysis.endpoints.slice(0, 20).forEach(ep => {
        const method = ep.httpMethod || ep.protocol.toUpperCase();
        const path = ep.path || ep.name;
        const handler = ep.handlerClass || '-';
        content += `| \`${method}\` | \`${escapeMd(path)}\` | \`${escapeMd(handler)}\` |\n`;
      });

      if (analysis.endpoints.length > 20) {
        content += `\n*Showing 20 of ${analysis.endpoints.length} endpoints. See API documentation for complete list.*\n`;
      }

      content += '\n';
    }

    return content;
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
