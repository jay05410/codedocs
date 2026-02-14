// packages/core/src/ai/providers/custom.ts
// Custom provider for any OpenAI-compatible endpoint

import type { AiProvider, AiProviderConfig } from '../types.js';
import { createProviderFromAdapter, type ProviderAdapter } from './base-client.js';

const customAdapter: ProviderAdapter = {
  name: 'Custom',

  validateConfig() {
    // Custom provider doesn't require apiKey
  },

  buildUrl(config) {
    const baseUrl = config.baseUrl?.replace(/\/+$/, '') || 'http://localhost:8080';
    return `${baseUrl}/v1/chat/completions`;
  },

  buildHeaders(config) {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

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

export function createCustomProvider(config: AiProviderConfig): AiProvider {
  return createProviderFromAdapter(config, customAdapter);
}
