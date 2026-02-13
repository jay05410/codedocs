// packages/core/src/ai/providers/openai.ts
// OpenAI provider using native fetch

import type { AiProvider, AiProviderConfig, ChatMessage, ChatOptions } from '../types.js';
import { logger } from '../../logger.js';

const REQUEST_TIMEOUT = 60000; // 60 seconds
const MAX_RETRIES = 1;
const RETRY_DELAY = 1000; // 1 second

export function createOpenAiProvider(config: AiProviderConfig): AiProvider {
  if (!config.apiKey) {
    throw new Error('OpenAI provider requires apiKey');
  }

  const providerLogger = logger.child('OpenAI');

  async function makeRequest(messages: ChatMessage[], options: ChatOptions, attempt: number = 0): Promise<string> {
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

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        const error = new Error(
          `OpenAI API error (${response.status}): ${errorText.substring(0, 500)}`
        );

        // Retry on rate limit or server errors
        if ((response.status === 429 || response.status >= 500) && attempt < MAX_RETRIES) {
          const delay = RETRY_DELAY * Math.pow(2, attempt);
          providerLogger.warn(`Request failed with status ${response.status}, retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          return makeRequest(messages, options, attempt + 1);
        }

        throw error;
      }

      const data = await response.json() as any;
      const text = data.choices?.[0]?.message?.content;

      if (!text) {
        throw new Error(
          `OpenAI response empty: ${JSON.stringify(data).substring(0, 500)}`
        );
      }

      return text;
    } catch (error) {
      clearTimeout(timeoutId);

      // Handle timeout and network errors
      if (error instanceof Error && error.name === 'AbortError') {
        const timeoutError = new Error(`OpenAI request timeout after ${REQUEST_TIMEOUT}ms`);

        if (attempt < MAX_RETRIES) {
          const delay = RETRY_DELAY * Math.pow(2, attempt);
          providerLogger.warn(`Request timeout, retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          return makeRequest(messages, options, attempt + 1);
        }

        throw timeoutError;
      }

      // Network errors
      if (error instanceof TypeError && attempt < MAX_RETRIES) {
        const delay = RETRY_DELAY * Math.pow(2, attempt);
        providerLogger.warn(`Network error: ${error.message}, retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return makeRequest(messages, options, attempt + 1);
      }

      throw error;
    }
  }

  return {
    name: `openai/${config.model}`,

    async chat(messages: ChatMessage[], options: ChatOptions = {}): Promise<string> {
      return makeRequest(messages, options);
    },
  };
}
