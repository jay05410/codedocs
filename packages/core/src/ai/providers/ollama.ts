// packages/core/src/ai/providers/ollama.ts
// Ollama provider using native fetch
// Supports both native Ollama API and OpenAI-compatible endpoint

import type { AiProvider, AiProviderConfig, ChatMessage, ChatOptions } from '../types.js';
import { logger } from '../../logger.js';

const REQUEST_TIMEOUT = 60000; // 60 seconds
const MAX_RETRIES = 1;
const RETRY_DELAY = 1000; // 1 second

export function createOllamaProvider(config: AiProviderConfig): AiProvider {
  const baseUrl = config.baseUrl?.replace(/\/+$/, '') || 'http://localhost:11434';

  const providerLogger = logger.child('Ollama');

  async function makeRequest(messages: ChatMessage[], options: ChatOptions, attempt: number = 0): Promise<string> {
    const temperature = options.temperature ?? config.temperature ?? 0.1;
    const maxTokens = options.maxTokens ?? config.maxTokens ?? 16384;

    // Use OpenAI-compatible endpoint for simplicity
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

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        const error = new Error(
          `Ollama API error (${response.status}): ${errorText.substring(0, 500)}`
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
          `Ollama response empty: ${JSON.stringify(data).substring(0, 500)}`
        );
      }

      return text;
    } catch (error) {
      clearTimeout(timeoutId);

      // Handle timeout and network errors
      if (error instanceof Error && error.name === 'AbortError') {
        const timeoutError = new Error(`Ollama request timeout after ${REQUEST_TIMEOUT}ms`);

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
    name: `ollama/${config.model}`,

    async chat(messages: ChatMessage[], options: ChatOptions = {}): Promise<string> {
      return makeRequest(messages, options);
    },
  };
}
