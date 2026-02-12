// packages/core/src/ai/providers/openai.ts
// OpenAI provider using native fetch

import type { AiProvider, AiProviderConfig, ChatMessage, ChatOptions } from '../types';

export function createOpenAiProvider(config: AiProviderConfig): AiProvider {
  if (!config.apiKey) {
    throw new Error('OpenAI provider requires apiKey');
  }

  return {
    name: `openai/${config.model}`,

    async chat(messages: ChatMessage[], options: ChatOptions = {}): Promise<string> {
      const temperature = options.temperature ?? config.temperature ?? 0.1;
      const maxTokens = options.maxTokens ?? config.maxTokens ?? 65536;

      const body: any = {
        model: config.model,
        max_completion_tokens: maxTokens,
        temperature,
        messages: messages.map(msg => ({
          role: msg.role,
          content: msg.content,
        })),
      };

      // Enable JSON mode for o-series models or when explicitly requested
      if (options.jsonMode || config.model.startsWith('o')) {
        body.response_format = { type: 'json_object' };
      }

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `OpenAI API error (${response.status}): ${errorText.substring(0, 500)}`
        );
      }

      const data = await response.json() as any;
      const text = data.choices?.[0]?.message?.content;

      if (!text) {
        throw new Error(
          `OpenAI response empty: ${JSON.stringify(data).substring(0, 500)}`
        );
      }

      return text;
    },
  };
}
