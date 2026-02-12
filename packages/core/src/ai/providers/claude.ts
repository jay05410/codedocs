// packages/core/src/ai/providers/claude.ts
// Anthropic Claude provider using native fetch

import type { AiProvider, AiProviderConfig, ChatMessage, ChatOptions } from '../types';

export function createClaudeProvider(config: AiProviderConfig): AiProvider {
  if (!config.apiKey) {
    throw new Error('Claude provider requires apiKey');
  }

  return {
    name: `claude/${config.model}`,

    async chat(messages: ChatMessage[], options: ChatOptions = {}): Promise<string> {
      const temperature = options.temperature ?? config.temperature ?? 0.1;
      const maxTokens = options.maxTokens ?? config.maxTokens ?? 65536;

      // Extract system message (Anthropic uses separate system field)
      const systemMessage = messages.find(msg => msg.role === 'system');
      const conversationMessages = messages.filter(msg => msg.role !== 'system');

      const body: any = {
        model: config.model,
        max_tokens: maxTokens,
        temperature,
        messages: conversationMessages.map(msg => ({
          role: msg.role === 'assistant' ? 'assistant' : 'user',
          content: msg.content,
        })),
      };

      if (systemMessage) {
        body.system = systemMessage.content;
      }

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': config.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Claude API error (${response.status}): ${errorText.substring(0, 500)}`
        );
      }

      const data = await response.json() as any;
      const text = data.content?.[0]?.text;

      if (!text) {
        throw new Error(
          `Claude response empty: ${JSON.stringify(data).substring(0, 500)}`
        );
      }

      return text;
    },
  };
}
