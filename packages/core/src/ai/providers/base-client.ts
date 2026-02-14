// packages/core/src/ai/providers/base-client.ts
// Shared HTTP client with timeout, retry, and error handling

import type { AiProviderConfig, ChatMessage, ChatOptions } from '../types.js';
import { logger as rootLogger } from '../../logger.js';

const DEFAULT_TIMEOUT = 60000; // 60 seconds
const DEFAULT_MAX_RETRIES = 1;
const DEFAULT_RETRY_DELAY = 1000; // 1 second

/**
 * Provider-specific adapter that defines how to build requests
 * and extract responses for each AI provider.
 */
export interface ProviderAdapter {
  /** Provider display name */
  name: string;
  /** Validate config (throw if invalid) */
  validateConfig(config: AiProviderConfig): void;
  /** Build the full request URL */
  buildUrl(config: AiProviderConfig): string;
  /** Build request headers */
  buildHeaders(config: AiProviderConfig): Record<string, string>;
  /** Build request body */
  buildBody(
    config: AiProviderConfig,
    messages: ChatMessage[],
    options: ChatOptions,
  ): Record<string, unknown>;
  /** Extract text from provider-specific response */
  extractResponse(data: unknown): string;
}

/**
 * Create an AI provider from a ProviderAdapter.
 * Handles all shared concerns: timeout, retry, error handling.
 */
export function createProviderFromAdapter(
  config: AiProviderConfig,
  adapter: ProviderAdapter,
) {
  adapter.validateConfig(config);

  const providerLogger = rootLogger.child(adapter.name);
  const timeout = config.timeout ?? DEFAULT_TIMEOUT;
  const maxRetries = config.maxRetries ?? DEFAULT_MAX_RETRIES;

  async function makeRequest(
    messages: ChatMessage[],
    options: ChatOptions,
    attempt: number = 0,
  ): Promise<string> {
    const url = adapter.buildUrl(config);
    const headers = adapter.buildHeaders(config);
    const body = adapter.buildBody(config, messages, options);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

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
          `${adapter.name} API error (${response.status}): ${errorText.substring(0, 500)}`,
        );

        // Retry on rate limit or server errors
        if (
          (response.status === 429 || response.status >= 500) &&
          attempt < maxRetries
        ) {
          const delay = DEFAULT_RETRY_DELAY * Math.pow(2, attempt);
          providerLogger.warn(
            `Request failed with status ${response.status}, retrying in ${delay}ms...`,
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
          return makeRequest(messages, options, attempt + 1);
        }

        throw error;
      }

      const data = await response.json();
      const text = adapter.extractResponse(data);

      if (!text) {
        throw new Error(
          `${adapter.name} response empty: ${JSON.stringify(data).substring(0, 500)}`,
        );
      }

      return text;
    } catch (error) {
      clearTimeout(timeoutId);

      // Handle timeout
      if (error instanceof Error && error.name === 'AbortError') {
        const timeoutError = new Error(
          `${adapter.name} request timeout after ${timeout}ms`,
        );

        if (attempt < maxRetries) {
          const delay = DEFAULT_RETRY_DELAY * Math.pow(2, attempt);
          providerLogger.warn(`Request timeout, retrying in ${delay}ms...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
          return makeRequest(messages, options, attempt + 1);
        }

        throw timeoutError;
      }

      // Network errors
      if (error instanceof TypeError && attempt < maxRetries) {
        const delay = DEFAULT_RETRY_DELAY * Math.pow(2, attempt);
        providerLogger.warn(
          `Network error: ${error.message}, retrying in ${delay}ms...`,
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
        return makeRequest(messages, options, attempt + 1);
      }

      throw error;
    }
  }

  return {
    name: `${adapter.name.toLowerCase()}/${config.model}`,

    async chat(
      messages: ChatMessage[],
      options: ChatOptions = {},
    ): Promise<string> {
      return makeRequest(messages, options);
    },
  };
}
