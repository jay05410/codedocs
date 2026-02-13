// packages/core/src/ai/providers/gemini.ts
// Google Gemini provider using native fetch

import type { AiProvider, AiProviderConfig, ChatMessage, ChatOptions } from '../types.js';
import { logger } from '../../logger.js';

const REQUEST_TIMEOUT = 60000; // 60 seconds
const MAX_RETRIES = 1;
const RETRY_DELAY = 1000; // 1 second

export function createGeminiProvider(config: AiProviderConfig): AiProvider {
  if (!config.apiKey) {
    throw new Error('Gemini provider requires apiKey');
  }

  const providerLogger = logger.child('Gemini');

  async function makeRequest(messages: ChatMessage[], options: ChatOptions, attempt: number = 0): Promise<string> {
    const temperature = options.temperature ?? config.temperature ?? 0.1;
    const maxTokens = options.maxTokens ?? config.maxTokens ?? 65536;

    // Extract system message (Gemini uses systemInstruction field)
    const systemMessage = messages.find(msg => msg.role === 'system');
    const conversationMessages = messages.filter(msg => msg.role !== 'system');

    // Convert ChatMessage format to Gemini format
    const contents: any[] = [];

    for (const msg of conversationMessages) {
      if (msg.role === 'user') {
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

    const body: any = {
      contents,
      generationConfig: {
        temperature,
        maxOutputTokens: maxTokens,
      },
    };

    // Use systemInstruction field for system messages (proper API approach)
    if (systemMessage) {
      body.systemInstruction = {
        parts: [{ text: systemMessage.content }],
      };
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': config.apiKey,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        const error = new Error(
          `Gemini API error (${response.status}): ${errorText.substring(0, 500)}`
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
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!text) {
        throw new Error(
          `Gemini response empty: ${JSON.stringify(data).substring(0, 500)}`
        );
      }

      return text;
    } catch (error) {
      clearTimeout(timeoutId);

      // Handle timeout and network errors
      if (error instanceof Error && error.name === 'AbortError') {
        const timeoutError = new Error(`Gemini request timeout after ${REQUEST_TIMEOUT}ms`);

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
    name: `gemini/${config.model}`,

    async chat(messages: ChatMessage[], options: ChatOptions = {}): Promise<string> {
      return makeRequest(messages, options);
    },
  };
}
