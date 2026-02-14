// packages/core/src/ai/providers/gemini.ts
// Google Gemini provider using shared base client

import type { AiProvider, AiProviderConfig } from '../types.js';
import { createProviderFromAdapter, type ProviderAdapter } from './base-client.js';

const geminiAdapter: ProviderAdapter = {
  name: 'Gemini',

  validateConfig(config) {
    if (!config.apiKey) {
      throw new Error('Gemini provider requires apiKey');
    }
  },

  buildUrl(config) {
    return `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent`;
  },

  buildHeaders(config) {
    return {
      'Content-Type': 'application/json',
      'x-goog-api-key': config.apiKey!,
    };
  },

  buildBody(config, messages, options) {
    // Extract system message (Gemini uses systemInstruction field)
    const systemMessage = messages.find(msg => msg.role === 'system');
    const conversationMessages = messages.filter(msg => msg.role !== 'system');

    // Convert to Gemini format
    const contents = conversationMessages.map(msg => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }],
    }));

    const body: Record<string, unknown> = {
      contents,
      generationConfig: {
        temperature: options.temperature ?? config.temperature ?? 0.1,
        maxOutputTokens: options.maxTokens ?? config.maxTokens ?? 65536,
      },
    };

    if (systemMessage) {
      body.systemInstruction = {
        parts: [{ text: systemMessage.content }],
      };
    }

    return body;
  },

  extractResponse(data: any) {
    return data.candidates?.[0]?.content?.parts?.[0]?.text;
  },
};

export function createGeminiProvider(config: AiProviderConfig): AiProvider {
  return createProviderFromAdapter(config, geminiAdapter);
}
