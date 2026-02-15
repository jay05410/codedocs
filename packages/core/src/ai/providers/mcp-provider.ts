// packages/core/src/ai/providers/mcp-provider.ts
// MCP-based AI provider that routes chat requests through an MCP server's tool

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import type { AiProvider, AiProviderConfig, ChatMessage, ChatOptions } from '../types.js';
import { extractJson } from '../types.js';
import { logger } from '../../logger.js';

/** Tool name patterns to auto-detect a chat-capable tool */
const CHAT_TOOL_PATTERNS = [
  /chat/i,
  /complet/i,
  /generate/i,
  /ask/i,
  /prompt/i,
  /message/i,
];

/**
 * Create an MCP-based AI provider.
 * Connects to an MCP server via stdio, finds a chat tool, and routes requests through it.
 */
export function createMcpProvider(config: AiProviderConfig): AiProvider {
  if (!config.mcp) {
    throw new Error(
      'MCP config is required when auth is "mcp". ' +
      'Set ai.mcp.command in codedocs.config.ts (e.g. { command: "npx", args: ["-y", "@some/mcp-server"] })',
    );
  }

  const mcpConfig = config.mcp; // narrowed to non-nullable
  const providerLogger = logger.child('MCP');

  // Lazy-initialized client and tool name
  let client: Client | null = null;
  let resolvedTool: string | null = null;

  async function ensureConnected(): Promise<{ client: Client; tool: string }> {
    if (client && resolvedTool) {
      return { client, tool: resolvedTool };
    }

    providerLogger.debug(`Connecting to MCP server: ${mcpConfig.command} ${(mcpConfig.args || []).join(' ')}`);

    const transport = new StdioClientTransport({
      command: mcpConfig.command,
      args: mcpConfig.args,
      stderr: 'pipe',
    });

    client = new Client({ name: 'codedocs', version: '0.1.0' });
    await client.connect(transport);

    // Resolve tool name
    if (mcpConfig.tool) {
      resolvedTool = mcpConfig.tool;
    } else {
      // Auto-detect a chat-capable tool
      const { tools } = await client.listTools();
      providerLogger.debug(`Available tools: ${tools.map(t => t.name).join(', ')}`);

      for (const pattern of CHAT_TOOL_PATTERNS) {
        const match = tools.find(t => pattern.test(t.name));
        if (match) {
          resolvedTool = match.name;
          break;
        }
      }

      if (!resolvedTool && tools.length > 0) {
        // Fallback to first tool
        resolvedTool = tools[0].name;
        providerLogger.warn(`No chat tool detected, using first available: ${resolvedTool}`);
      }

      if (!resolvedTool) {
        throw new Error(
          `MCP server has no tools. Ensure the server at "${mcpConfig.command}" exposes at least one tool.`,
        );
      }
    }

    providerLogger.debug(`Using MCP tool: ${resolvedTool}`);
    return { client, tool: resolvedTool };
  }

  return {
    name: `mcp/${config.provider}/${config.model || 'default'}`,

    async chat(
      messages: ChatMessage[],
      options: ChatOptions = {},
    ): Promise<string> {
      const { client: c, tool } = await ensureConnected();

      // Build tool arguments — common patterns for AI chat tools
      const toolArgs: Record<string, unknown> = {
        messages,
        model: config.model,
      };
      if (options.temperature != null) toolArgs.temperature = options.temperature;
      if (options.maxTokens != null) toolArgs.max_tokens = options.maxTokens;

      providerLogger.debug(`Calling tool "${tool}" with ${messages.length} messages`);

      const result = await c.callTool({ name: tool, arguments: toolArgs });

      // Extract text from MCP tool result
      const textParts: string[] = [];
      if (Array.isArray(result.content)) {
        for (const block of result.content) {
          if (block.type === 'text' && typeof block.text === 'string') {
            textParts.push(block.text);
          }
        }
      }

      const text = textParts.join('\n').trim();
      if (!text) {
        throw new Error(`MCP tool "${tool}" returned empty response`);
      }

      if (options.jsonMode) {
        try {
          return extractJson(text);
        } catch {
          providerLogger.warn('jsonMode: failed to extract JSON from MCP response');
          return text;
        }
      }

      return text;
    },
  };
}
