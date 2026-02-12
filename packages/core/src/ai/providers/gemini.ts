// packages/core/src/ai/providers/gemini.ts
// Google Gemini provider using native fetch

import type { AiProvider, AiProviderConfig, ChatMessage, ChatOptions } from '../types';

export function createGeminiProvider(config: AiProviderConfig): AiProvider {
  if (!config.apiKey) {
    throw new Error('Gemini provider requires apiKey');
  }

  return {
    name: `gemini/${config.model}`,

    async chat(messages: ChatMessage[], options: ChatOptions = {}): Promise<string> {
      const temperature = options.temperature ?? config.temperature ?? 0.1;
      const maxTokens = options.maxTokens ?? config.maxTokens ?? 65536;

      // Convert ChatMessage format to Gemini format
      // System messages are simulated as user/model exchange
      const contents: any[] = [];

      for (const msg of messages) {
        if (msg.role === 'system') {
          // Simulate system message with user/model exchange
          contents.push({
            role: 'user',
            parts: [{ text: msg.content }],
          });
          contents.push({
            role: 'model',
            parts: [{ text: 'Understood.' }],
          });
        } else if (msg.role === 'user') {
          contents.push({
            role: 'user',
            parts: [{ text: msg.content }],
          });
        } else if (msg.role === 'assistant') {
          contents.push({
            role: 'model',
            parts: [{ text: msg.content }],
          });
        }
      }

      const body = {
        contents,
        generationConfig: {
          temperature,
          maxOutputTokens: maxTokens,
        },
      };

      const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent?key=${config.apiKey}`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Gemini API error (${response.status}): ${errorText.substring(0, 500)}`
        );
      }

      const data = await response.json() as any;
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!text) {
        throw new Error(
          `Gemini response empty: ${JSON.stringify(data).substring(0, 500)}`
        );
      }

      return text;
    },
  };
}
