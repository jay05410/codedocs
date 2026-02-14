// packages/core/src/ai/providers/openai-compat.ts
// Unified OpenAI-compatible provider for Ollama, Custom, and GLM endpoints

import type { AiProvider, AiProviderConfig } from '../types.js';
import { createProviderFromAdapter, type ProviderAdapter } from './base-client.js';

interface OpenAiCompatDefaults {
  name: string;
  defaultBaseUrl: string;
  defaultMaxTokens: number;
  requireApiKey: boolean;
  /** Endpoint path appended to baseUrl (default: '/v1/chat/completions') */
  endpointPath?: string;
}

function createOpenAiCompatAdapter(defaults: OpenAiCompatDefaults): ProviderAdapter {
  const endpointPath = defaults.endpointPath ?? '/v1/chat/completions';

  return {
    name: defaults.name,

    validateConfig(config) {
      if (defaults.requireApiKey && !config.apiKey) {
        throw new Error(`${defaults.name} provider requires apiKey`);
      }
    },

    buildUrl(config) {
      const baseUrl = config.baseUrl?.replace(/\/+$/, '') || defaults.defaultBaseUrl;
      return `${baseUrl}${endpointPath}`;
    },

    buildHeaders(config) {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (config.apiKey) {
        headers['Authorization'] = `Bearer ${config.apiKey}`;
      }

      return headers;
    },

    buildBody(config, messages, options) {
      return {
        model: config.model,
        max_tokens: options.maxTokens ?? config.maxTokens ?? defaults.defaultMaxTokens,
        temperature: options.temperature ?? config.temperature ?? 0.1,
        messages: messages.map(msg => ({
          role: msg.role,
          content: msg.content,
        })),
      };
    },

    extractResponse(data: any) {
      return data.choices?.[0]?.message?.content;
    },
  };
}

export function createOllamaProvider(config: AiProviderConfig): AiProvider {
  return createProviderFromAdapter(config, createOpenAiCompatAdapter({
    name: 'Ollama',
    defaultBaseUrl: 'http://localhost:11434',
    defaultMaxTokens: 16384,
    requireApiKey: false,
  }));
}

export function createCustomProvider(config: AiProviderConfig): AiProvider {
  return createProviderFromAdapter(config, createOpenAiCompatAdapter({
    name: 'Custom',
    defaultBaseUrl: 'http://localhost:8080',
    defaultMaxTokens: 16384,
    requireApiKey: false,
  }));
}

export function createGlmProvider(config: AiProviderConfig): AiProvider {
  return createProviderFromAdapter(config, createOpenAiCompatAdapter({
    name: 'GLM',
    defaultBaseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    defaultMaxTokens: 4096,
    requireApiKey: true,
    endpointPath: '/chat/completions',
  }));
}
