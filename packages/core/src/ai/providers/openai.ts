// packages/core/src/ai/providers/openai.ts
// OpenAI provider using shared base client

import type { AiProvider, AiProviderConfig } from '../types.js';
import { createProviderFromAdapter, type ProviderAdapter } from './base-client.js';

const openaiAdapter: ProviderAdapter = {
  name: 'OpenAI',

  validateConfig(config) {
    if (!config.apiKey) {
      throw new Error('OpenAI provider requires apiKey');
    }
  },

  buildUrl() {
    return 'https://api.openai.com/v1/chat/completions';
  },

  buildHeaders(config) {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
    };
  },

  buildBody(config, messages, options) {
    const body: Record<string, unknown> = {
      model: config.model,
      max_completion_tokens: options.maxTokens ?? config.maxTokens ?? 65536,
      temperature: options.temperature ?? config.temperature ?? 0.1,
      messages: messages.map(msg => ({
        role: msg.role,
        content: msg.content,
      })),
    };

    // Enable JSON mode for o-series models or when explicitly requested
    if (options.jsonMode || config.model.startsWith('o')) {
      body.response_format = { type: 'json_object' };
    }

    return body;
  },

  extractResponse(data: any) {
    return data.choices?.[0]?.message?.content;
  },
};

export function createOpenAiProvider(config: AiProviderConfig): AiProvider {
  return createProviderFromAdapter(config, openaiAdapter);
}
