// packages/core/src/ai/providers/ollama.ts
// Ollama provider using shared base client
// Supports both native Ollama API and OpenAI-compatible endpoint

import type { AiProvider, AiProviderConfig } from '../types.js';
import { createProviderFromAdapter, type ProviderAdapter } from './base-client.js';

const ollamaAdapter: ProviderAdapter = {
  name: 'Ollama',

  validateConfig() {
    // Ollama doesn't require apiKey
  },

  buildUrl(config) {
    const baseUrl = config.baseUrl?.replace(/\/+$/, '') || 'http://localhost:11434';
    return `${baseUrl}/v1/chat/completions`;
  },

  buildHeaders(config) {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Add auth header if apiKey is provided
    if (config.apiKey) {
      headers['Authorization'] = `Bearer ${config.apiKey}`;
    }

    return headers;
  },

  buildBody(config, messages, options) {
    return {
      model: config.model,
      max_tokens: options.maxTokens ?? config.maxTokens ?? 16384,
      temperature: options.temperature ?? config.temperature ?? 0.1,
      messages: messages.map(msg => ({
        role: msg.role,
        content: msg.content,
      })),
    };
  },

  extractResponse(data: any) {
    return data.choices?.[0]?.message?.content;
  },
};

export function createOllamaProvider(config: AiProviderConfig): AiProvider {
  return createProviderFromAdapter(config, ollamaAdapter);
}
