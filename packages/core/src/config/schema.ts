import { z } from 'zod';

/**
 * Zod schema for ParserPlugin
 */
const parserPluginSchema = z.object({
  name: z.string(),
  filePattern: z.union([z.string(), z.array(z.string())]),
  parse: z.any(), // Functions cannot be validated by Zod
});

/**
 * Zod schema for AI configuration
 */
const aiConfigSchema = z.object({
  provider: z.enum(['openai', 'claude', 'gemini', 'glm', 'ollama', 'custom', 'codex-cli', 'gemini-cli']),
  model: z.string(),
  apiKey: z.string().optional(),
  baseUrl: z.string().optional(),
  timeout: z.number().optional(),
  maxRetries: z.number().optional(),
  features: z.object({
    domainGrouping: z.boolean().optional(),
    flowDiagrams: z.boolean().optional(),
    codeExplanation: z.boolean().optional(),
    releaseNoteAnalysis: z.boolean().optional(),
  }).optional(),
});

/**
 * Zod schema for documentation section
 */
const docsSectionSchema = z.object({
  id: z.string(),
  label: z.string(),
  type: z.enum(['auto', 'endpoints', 'entities', 'architecture', 'changelog', 'custom']),
  dir: z.string().optional(),
});

/**
 * Zod schema for page overrides
 */
const pageOverrideSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

/**
 * Zod schema for docs configuration
 */
const docsConfigSchema = z.object({
  title: z.string(),
  logo: z.string().optional(),
  locale: z.enum(['ko', 'en', 'ja', 'zh']),
  sections: z.array(docsSectionSchema),
  pageOverrides: z.record(z.string(), pageOverrideSchema).optional(),
});

/**
 * Zod schema for theme colors
 */
const themeColorsSchema = z.object({
  primary: z.string().optional(),
  secondary: z.string().optional(),
});

/**
 * Zod schema for theme configuration
 */
const themeConfigSchema = z.object({
  preset: z.enum(['default', 'swagger', 'redoc', 'mintlify', 'minimal']),
  colors: themeColorsSchema.optional(),
  components: z.record(z.string(), z.any()).optional(),
  css: z.string().optional(),
});

/**
 * Zod schema for git configuration
 */
const gitConfigSchema = z.object({
  trackBranch: z.string().optional(),
  autoVersionBump: z.boolean().optional(),
}).optional();

/**
 * Zod schema for build configuration
 */
const buildConfigSchema = z.object({
  base: z.string().optional(),
  outDir: z.string().optional(),
  prerender: z.boolean().optional(),
}).optional();

/**
 * Main configuration schema
 * parsers accepts both string names (e.g., 'react', 'nestjs') and full ParserPlugin objects
 */
export const configSchema = z.object({
  source: z.string(),
  parsers: z.array(z.union([z.string(), parserPluginSchema])),
  ai: aiConfigSchema,
  docs: docsConfigSchema,
  theme: themeConfigSchema,
  git: gitConfigSchema,
  build: buildConfigSchema,
});

/**
 * Type inference from schema
 */
export type CodeDocsConfig = z.infer<typeof configSchema>;
export type ParserPlugin = z.infer<typeof parserPluginSchema>;
export type AIConfig = z.infer<typeof aiConfigSchema>;
export type DocsConfig = z.infer<typeof docsConfigSchema>;
export type ThemeConfig = z.infer<typeof themeConfigSchema>;
export type GitConfig = z.infer<typeof gitConfigSchema>;
export type BuildConfig = z.infer<typeof buildConfigSchema>;

/**
 * Helper function for defining config with type inference.
 * Accepts string-based parser names (e.g., 'react') or full ParserPlugin objects.
 */
export function defineConfig(config: CodeDocsConfig): CodeDocsConfig {
  return config;
}
