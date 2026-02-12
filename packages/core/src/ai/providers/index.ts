// packages/core/src/ai/providers/index.ts
// Factory function for creating AI providers

import type { AiProvider, AiProviderConfig } from '../types';
import { createOpenAiProvider } from './openai';
import { createClaudeProvider } from './claude';
import { createGeminiProvider } from './gemini';
import { createOllamaProvider } from './ollama';
import { createCustomProvider } from './custom';

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
    case 'ollama':
      return createOllamaProvider(config);
    case 'custom':
      return createCustomProvider(config);
    default:
      throw new Error(`Unknown provider: ${config.provider}`);
  }
}

// Re-export individual provider creators
export { createOpenAiProvider } from './openai';
export { createClaudeProvider } from './claude';
export { createGeminiProvider } from './gemini';
export { createOllamaProvider } from './ollama';
export { createCustomProvider } from './custom';
