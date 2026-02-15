// packages/core/src/ai/providers/index.ts
// Factory function for creating AI providers

import type { AiProvider, AiProviderConfig } from '../types.js';
import { createOpenAiProvider } from './openai.js';
import { createClaudeProvider } from './claude.js';
import { createGeminiProvider } from './gemini.js';
import { createGlmProvider, createOllamaProvider, createCustomProvider } from './openai-compat.js';
import { createMcpProvider } from './mcp-provider.js';

/**
 * Create an AI provider based on configuration.
 * When auth is 'mcp', routes through an MCP server regardless of provider.
 */
export function createAiProvider(config: AiProviderConfig): AiProvider {
  if (config.auth === 'mcp') {
    return createMcpProvider(config);
  }

  switch (config.provider) {
    case 'openai':
      return createOpenAiProvider(config);
    case 'claude':
      return createClaudeProvider(config);
    case 'gemini':
      return createGeminiProvider(config);
    case 'glm':
      return createGlmProvider(config);
    case 'ollama':
      return createOllamaProvider(config);
    case 'custom':
      return createCustomProvider(config);
    default:
      throw new Error(`Unknown provider: ${config.provider}`);
  }
}

// Re-export individual provider creators
export { createOpenAiProvider } from './openai.js';
export { createClaudeProvider } from './claude.js';
export { createGeminiProvider } from './gemini.js';
export { createGlmProvider, createOllamaProvider, createCustomProvider } from './openai-compat.js';
export { createMcpProvider } from './mcp-provider.js';
