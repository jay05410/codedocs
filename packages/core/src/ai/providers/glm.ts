// packages/core/src/ai/providers/glm.ts
// Zhipu AI GLM provider (ChatGLM) using shared base client
// API docs: https://open.bigmodel.cn/dev/api

import type { AiProvider, AiProviderConfig } from '../types.js';
import { createProviderFromAdapter, type ProviderAdapter } from './base-client.js';

const glmAdapter: ProviderAdapter = {
  name: 'GLM',

  validateConfig(config) {
    if (!config.apiKey) {
      throw new Error('GLM provider requires apiKey (Zhipu AI API key)');
    }
  },

  buildUrl(config) {
    const baseUrl = config.baseUrl?.replace(/\/+$/, '') || 'https://open.bigmodel.cn/api/paas/v4';
    return `${baseUrl}/chat/completions`;
  },

  buildHeaders(config) {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
    };
  },

  buildBody(config, messages, options) {
    return {
      model: config.model,
      max_tokens: options.maxTokens ?? config.maxTokens ?? 4096,
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

export function createGlmProvider(config: AiProviderConfig): AiProvider {
  return createProviderFromAdapter(config, glmAdapter);
}
