// packages/core/src/ai/providers/index.ts
// Factory function for creating AI providers

import type { AiProvider, AiProviderConfig } from '../types.js';
import { createOpenAiProvider } from './openai.js';
import { createClaudeProvider } from './claude.js';
import { createGeminiProvider } from './gemini.js';
import { createGlmProvider } from './glm.js';
import { createOllamaProvider } from './ollama.js';
import { createCustomProvider } from './custom.js';

/**
 * Create an AI provider based on configuration
 */
export function createAiProvider(config: AiProviderConfig): AiProvider {
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
export { createGlmProvider } from './glm.js';
export { createOllamaProvider } from './ollama.js';
export { createCustomProvider } from './custom.js';
