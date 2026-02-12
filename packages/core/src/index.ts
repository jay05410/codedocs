// @codedocs/core - AI-powered code documentation engine
export { defineConfig } from './config/schema.js';
export { loadConfig } from './config/loader.js';
export type { CodeDocsConfig } from './config/schema.js';
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
export type { AiProvider, AiProviderConfig } from './ai/types.js';
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
export type { Locale, I18nStrings } from './i18n/index.js';
export { getStrings, getSupportedLocales } from './i18n/index.js';
export type { PromptTemplate } from './ai/prompts/index.js';
export { getPrompt, getPromptKeys, fillTemplate } from './ai/prompts/index.js';
