// packages/core/src/ai/providers/claude.ts
// Anthropic Claude provider using native fetch

import type { AiProvider, AiProviderConfig, ChatMessage, ChatOptions } from '../types.js';
import { logger } from '../../logger.js';

const REQUEST_TIMEOUT = 60000; // 60 seconds
const MAX_RETRIES = 1;
const RETRY_DELAY = 1000; // 1 second

export function createClaudeProvider(config: AiProviderConfig): AiProvider {
  if (!config.apiKey) {
    throw new Error('Claude provider requires apiKey');
  }

  const providerLogger = logger.child('Claude');

  async function makeRequest(messages: ChatMessage[], options: ChatOptions, attempt: number = 0): Promise<string> {
    const temperature = options.temperature ?? config.temperature ?? 0.1;
    const maxTokens = options.maxTokens ?? config.maxTokens ?? 65536;

    // Extract system message (Anthropic uses separate system field)
    // NOTE: Gemini uses systemInstruction field for similar purpose
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

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': config.apiKey,
          'anthropic-version': '2024-10-22',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        const error = new Error(
          `Claude API error (${response.status}): ${errorText.substring(0, 500)}`
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
      const text = data.content?.[0]?.text;

      if (!text) {
        throw new Error(
          `Claude response empty: ${JSON.stringify(data).substring(0, 500)}`
        );
      }

      return text;
    } catch (error) {
      clearTimeout(timeoutId);

      // Handle timeout and network errors
      if (error instanceof Error && error.name === 'AbortError') {
        const timeoutError = new Error(`Claude request timeout after ${REQUEST_TIMEOUT}ms`);

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
    name: `claude/${config.model}`,

    async chat(messages: ChatMessage[], options: ChatOptions = {}): Promise<string> {
      return makeRequest(messages, options);
    },
  };
}
