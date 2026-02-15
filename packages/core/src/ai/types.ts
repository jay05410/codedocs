// packages/core/src/ai/types.ts
// Core types for AI provider abstraction

export interface AiProviderConfig {
  provider: 'openai' | 'claude' | 'gemini' | 'glm' | 'ollama' | 'custom';
  model: string;
  apiKey?: string;
  baseUrl?: string;
  /** Authentication method: api-key (default), env, mcp (MCP server), custom endpoint */
  auth?: 'api-key' | 'env' | 'mcp' | 'custom';
  /** MCP server configuration (required when auth is 'mcp') */
  mcp?: {
    /** Command to spawn MCP server (stdio transport) */
    command: string;
    /** Command arguments */
    args?: string[];
    /** Tool name to call for chat (auto-detected if omitted) */
    tool?: string;
  };
  temperature?: number;
  maxTokens?: number;
  /** Request timeout in milliseconds (default: 60000 for HTTP, 120000 for CLI) */
  timeout?: number;
  /** Maximum retry attempts on transient failures (default: 1) */
  maxRetries?: number;
}

export interface AiProvider {
  name: string;
  chat(messages: ChatMessage[], options?: ChatOptions): Promise<string>;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatOptions {
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
}

/**
 * Default limits for AI-powered features.
 * Used by generate command and can be overridden via config.
 */
export const AI_DEFAULTS = {
  maxDomainGroups: 8,
  maxExampleEndpoints: 15,
  maxComponentDescriptions: 20,
  minGroupSize: 2,
} as const;

/**
 * Extract JSON from LLM response text
 * Handles markdown code fences and surrounding text
 */
export function extractJson(text: string): string {
  // Extract from ```json ... ``` blocks
  const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  const jsonStr = fenceMatch ? fenceMatch[1] : text;

  // Remove leading/trailing non-JSON text
  const trimmed = jsonStr.trim();
  const start = trimmed.indexOf("{") !== -1 ? trimmed.indexOf("{") : trimmed.indexOf("[");
  if (start === -1) {
    throw new Error("JSON not found in response");
  }

  const candidate = trimmed.substring(start);

  try {
    // Validate it's parseable JSON
    JSON.parse(candidate);
    return candidate;
  } catch (e) {
    // Try to recover by trimming to last valid brace
    const lastBrace = Math.max(candidate.lastIndexOf("}"), candidate.lastIndexOf("]"));
    if (lastBrace > 0) {
      const recovered = candidate.substring(0, lastBrace + 1);
      JSON.parse(recovered); // Validate
      return recovered;
    }
    throw new Error(
      `Failed to parse JSON from LLM response: ${(e as Error).message}\n` +
      `Response preview: ${text.substring(0, 300)}`
    );
  }
}
