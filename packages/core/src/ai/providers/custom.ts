// packages/core/src/ai/providers/custom.ts
// Custom provider for any OpenAI-compatible endpoint

import type { AiProvider, AiProviderConfig, ChatMessage, ChatOptions } from '../types';

export function createCustomProvider(config: AiProviderConfig): AiProvider {
  const baseUrl = config.baseUrl?.replace(/\/+$/, '') || 'http://localhost:8080';

  return {
    name: `custom/${config.model}`,

    async chat(messages: ChatMessage[], options: ChatOptions = {}): Promise<string> {
      const temperature = options.temperature ?? config.temperature ?? 0.1;
      const maxTokens = options.maxTokens ?? config.maxTokens ?? 16384;

      const url = `${baseUrl}/v1/chat/completions`;

      const body = {
        model: config.model,
        max_tokens: maxTokens,
        temperature,
        messages: messages.map(msg => ({
          role: msg.role,
          content: msg.content,
        })),
      };

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      // Add auth header if apiKey is provided
      if (config.apiKey) {
        headers['Authorization'] = `Bearer ${config.apiKey}`;
      }

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Custom LLM API error (${response.status}): ${errorText.substring(0, 500)}`
        );
      }

      const data = await response.json() as any;
      const text = data.choices?.[0]?.message?.content;

      if (!text) {
        throw new Error(
          `Custom LLM response empty: ${JSON.stringify(data).substring(0, 500)}`
        );
      }

      return text;
    },
  };
}
