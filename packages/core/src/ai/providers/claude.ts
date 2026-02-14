// packages/core/src/ai/providers/claude.ts
// Anthropic Claude provider using shared base client

import type { AiProvider, AiProviderConfig } from '../types.js';
import { createProviderFromAdapter, type ProviderAdapter } from './base-client.js';

const claudeAdapter: ProviderAdapter = {
  name: 'Claude',

  validateConfig(config) {
    if (!config.apiKey) {
      throw new Error('Claude provider requires apiKey');
    }
  },

  buildUrl() {
    return 'https://api.anthropic.com/v1/messages';
  },

  buildHeaders(config) {
    return {
      'Content-Type': 'application/json',
      'x-api-key': config.apiKey!,
      'anthropic-version': '2024-10-22',
    };
  },

  buildBody(config, messages, options) {
    // Extract system message (Anthropic uses separate system field)
    const systemMessage = messages.find(msg => msg.role === 'system');
    const conversationMessages = messages.filter(msg => msg.role !== 'system');

    const body: Record<string, unknown> = {
      model: config.model,
      max_tokens: options.maxTokens ?? config.maxTokens ?? 65536,
      temperature: options.temperature ?? config.temperature ?? 0.1,
      messages: conversationMessages.map(msg => ({
        role: msg.role === 'assistant' ? 'assistant' : 'user',
        content: msg.content,
      })),
    };

    if (systemMessage) {
      body.system = systemMessage.content;
    }

    return body;
  },

  extractResponse(data: any) {
    return data.content?.[0]?.text;
  },
};

export function createClaudeProvider(config: AiProviderConfig): AiProvider {
  return createProviderFromAdapter(config, claudeAdapter);
}
