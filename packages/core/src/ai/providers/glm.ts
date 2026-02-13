// packages/core/src/ai/providers/glm.ts
// Zhipu AI GLM provider (ChatGLM) using native fetch
// API docs: https://open.bigmodel.cn/dev/api

import type { AiProvider, AiProviderConfig, ChatMessage, ChatOptions } from '../types.js';
import { logger } from '../../logger.js';

const REQUEST_TIMEOUT = 60000;
const MAX_RETRIES = 1;
const RETRY_DELAY = 1000;

export function createGlmProvider(config: AiProviderConfig): AiProvider {
  if (!config.apiKey) {
    throw new Error('GLM provider requires apiKey (Zhipu AI API key)');
  }

  const baseUrl = config.baseUrl?.replace(/\/+$/, '') || 'https://open.bigmodel.cn/api/paas/v4';
  const providerLogger = logger.child('GLM');

  async function makeRequest(messages: ChatMessage[], options: ChatOptions, attempt: number = 0): Promise<string> {
    const temperature = options.temperature ?? config.temperature ?? 0.1;
    const maxTokens = options.maxTokens ?? config.maxTokens ?? 4096;

    const body: Record<string, unknown> = {
      model: config.model,
      max_tokens: maxTokens,
      temperature,
      messages: messages.map(msg => ({
        role: msg.role,
        content: msg.content,
      })),
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    try {
      const response = await fetch(`${baseUrl}/chat/completions`, {
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
          `GLM API error (${response.status}): ${errorText.substring(0, 500)}`
        );

        if ((response.status === 429 || response.status >= 500) && attempt < MAX_RETRIES) {
          const delay = RETRY_DELAY * Math.pow(2, attempt);
          providerLogger.warn(`Request failed with status ${response.status}, retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          return makeRequest(messages, options, attempt + 1);
        }

        throw error;
      }

      // GLM API returns OpenAI-compatible response format
      const data = await response.json() as Record<string, unknown>;
      const choices = data.choices as Array<{ message: { content: string } }> | undefined;
      const text = choices?.[0]?.message?.content;

      if (!text) {
        throw new Error(
          `GLM response empty: ${JSON.stringify(data).substring(0, 500)}`
        );
      }

      return text;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error && error.name === 'AbortError') {
        const timeoutError = new Error(`GLM request timeout after ${REQUEST_TIMEOUT}ms`);

        if (attempt < MAX_RETRIES) {
          const delay = RETRY_DELAY * Math.pow(2, attempt);
          providerLogger.warn(`Request timeout, retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          return makeRequest(messages, options, attempt + 1);
        }

        throw timeoutError;
      }

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
    name: `glm/${config.model}`,

    async chat(messages: ChatMessage[], options: ChatOptions = {}): Promise<string> {
      return makeRequest(messages, options);
    },
  };
}
