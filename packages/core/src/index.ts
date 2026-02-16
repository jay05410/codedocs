// @codedocs/core - AI-powered code documentation engine
export { defineConfig } from './config/schema.js';
export { loadConfig } from './config/loader.js';
export type { CodeDocsConfig } from './config/schema.js';
export { Logger, LogLevel, logger } from './logger.js';
export type {
  ParserPlugin,
  SourceFile,
  ParseResult,
  EndpointInfo,
  EntityInfo,
  ServiceInfo,
  TypeInfo,
  DependencyInfo,
  ParameterInfo,
  ColumnInfo,
  RelationInfo,
  AnalysisResult,
} from './parser/types.js';
export { ParserEngine } from './parser/engine.js';
export { FileReader } from './parser/file-reader.js';
export { AnalysisCache } from './parser/cache.js';
export type { CacheData, ParserCacheEntry } from './parser/cache.js';
export type { AiProvider, AiProviderConfig } from './ai/types.js';
export { AI_DEFAULTS } from './ai/types.js';
export { createAiProvider } from './ai/providers/index.js';
export { ExampleGenerator, formatExampleAsMarkdown } from './ai/example-generator.js';
export type { GeneratedExample, RequestExample, ResponseExample, ExampleGeneratorOptions } from './ai/example-generator.js';
export type {
  GeneratorConfig,
  SectionConfig,
  PageMeta,
  GeneratedPage,
  GeneratorResult,
  SidebarItem,
} from './generator/types.js';
export { MarkdownGenerator, generateFrontmatter, generateMetaTags } from './generator/markdown.js';
export { SidebarGenerator } from './generator/sidebar.js';
export type { ChangeEntry, ReleaseNote, AIProvider } from './changelog/index.js';
export { compareAnalysisResults, generateReleaseNote, formatReleaseNote } from './changelog/index.js';
export { generateVersionComparison, formatVersionComparisonMarkdown } from './changelog/version-compare.js';
export type { VersionComparison, ComparisonSummary, BreakingChange, EndpointDiff, EntityDiff, TypeDiff, ServiceDiff } from './changelog/version-compare.js';
export type { Locale, I18nStrings } from './i18n/index.js';
export { getStrings, getSupportedLocales, getLocaleName, LOCALE_NAMES } from './i18n/index.js';
export type { PromptTemplate } from './ai/prompts/index.js';
export { getPrompt, getPromptKeys, fillTemplate } from './ai/prompts/index.js';
export { SemanticSearch } from './search/index.js';
export type { SearchResult, SearchOptions, SearchIndex, SearchDocument, EmbeddingProvider } from './search/index.js';
export { DiagramGenerator } from './diagram/index.js';
export type { DiagramType, DiagramOptions, DiagramResult } from './diagram/index.js';
export type { DomainGroup, GroupingResult, GroupingOptions } from './ai/grouping.js';
export { groupByDomain, groupByHeuristic, groupComponentsByHeuristic } from './ai/grouping.js';
export type { Memo, MemoStore, MemoDisplayItem } from './memo/types.js';
export { createEmptyMemoStore, parseMemoStore, mergeMemoStores } from './memo/index.js';
export { escapeHtml, escapeMd, toKebab, extractFrontmatter } from './utils/index.js';

// SFC (Single File Component) utilities
export {
  extractScriptBlock,
  extractTemplateBlock,
  extractStyleBlock,
  extractFunctionBody,
  inferTypeFromDefault,
} from './parser/sfc-utils.js';

// Tree-sitter WASM engine
export {
  isTreeSitterAvailable,
  parseCode,
} from './parser/tree-sitter-engine.js';
export type { TsLanguage } from './parser/tree-sitter-engine.js';
