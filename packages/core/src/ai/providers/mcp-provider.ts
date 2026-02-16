// packages/core/src/ai/providers/mcp-provider.ts
// MCP provider that delegates to installed CLI tools (codex, gemini, etc.)
// Spawns the tool as a subprocess and communicates via stdin/stdout.

import { spawn } from 'node:child_process';
import type { AiProvider, AiProviderConfig, ChatMessage, ChatOptions } from '../types.js';
import { extractJson } from '../types.js';
import { logger } from '../../logger.js';

const DEFAULT_TIMEOUT = 120000; // 2 minutes
const MAX_BUFFER_SIZE = 10 * 1024 * 1024; // 10 MB

/**
 * Spawn a CLI tool, pipe prompt via stdin, and return stdout.
 */
function execTool(
  command: string,
  args: string[],
  timeout: number,
  stdinData?: string,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout,
      env: { ...process.env, NO_COLOR: '1' },
    });

    let stdout = '';
    let stderr = '';
    let bufferExceeded = false;

    proc.stdout.on('data', (data: Buffer) => {
      if (bufferExceeded) return;
      stdout += data.toString();
      if (stdout.length > MAX_BUFFER_SIZE) {
        bufferExceeded = true;
        proc.kill();
        reject(new Error(`stdout exceeded ${MAX_BUFFER_SIZE} bytes`));
      }
    });

    proc.stderr.on('data', (data: Buffer) => {
      if (bufferExceeded) return;
      if (stderr.length < MAX_BUFFER_SIZE) {
        stderr += data.toString();
      }
    });

    proc.on('close', (code) => {
      if (bufferExceeded) return;
      if (code === 0) {
        resolve(stdout.trim());
      } else {
        reject(new Error(`${command} exited with code ${code}: ${stderr.substring(0, 500)}`));
      }
    });

    proc.on('error', (err) => {
      if (bufferExceeded) return;
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        reject(new Error(`Command "${command}" not found. Install it first.`));
      } else {
        reject(err);
      }
    });

    if (stdinData) {
      proc.stdin.write(stdinData);
      proc.stdin.end();
    } else {
      proc.stdin.end();
    }
  });
}

/**
 * Check if a CLI tool is available.
 */
async function checkAvailable(command: string): Promise<boolean> {
  try {
    await execTool(command, ['--version'], 10000);
    return true;
  } catch {
    return false;
  }
}

/**
 * Create an MCP provider that delegates to a CLI tool.
 * Uses the command and args specified in config.mcp.
 */
export function createMcpProvider(config: AiProviderConfig): AiProvider {
  if (!config.mcp) {
    throw new Error(
      'MCP config is required when auth is "mcp". ' +
      'Set ai.mcp in codedocs.config.ts (e.g. { command: "codex", args: ["--quiet", "--full-auto", "-"] })',
    );
  }

  const mcpConfig = config.mcp;
  const providerLogger = logger.child('MCP');
  const timeout = config.timeout ?? DEFAULT_TIMEOUT;

  let availableChecked = false;
  let isAvailable = false;

  return {
    name: `mcp/${config.provider}/${config.model || 'default'}`,

    async chat(
      messages: ChatMessage[],
      options: ChatOptions = {},
    ): Promise<string> {
      if (!availableChecked) {
        isAvailable = await checkAvailable(mcpConfig.command);
        availableChecked = true;
      }
      if (!isAvailable) {
        throw new Error(
          `"${mcpConfig.command}" is not installed.\n` +
          `Install it first, then try again.`,
        );
      }

      // Combine messages into a single prompt
      const prompt = messages
        .map((msg) => {
          if (msg.role === 'system') return `[System]: ${msg.content}`;
          if (msg.role === 'user') return msg.content;
          return `[Assistant]: ${msg.content}`;
        })
        .join('\n\n');

      // Auto-append stdin flag for known CLI tools if not already present
      let effectiveArgs = mcpConfig.args || [];
      const cmd = mcpConfig.command;
      if ((cmd === 'codex' || cmd.endsWith('/codex')) && !effectiveArgs.includes('-')) {
        effectiveArgs = [...effectiveArgs, '-'];
      } else if ((cmd === 'gemini' || cmd.endsWith('/gemini')) && !effectiveArgs.includes('-')) {
        effectiveArgs = [...effectiveArgs, '-'];
      }

      providerLogger.debug(`Executing: ${mcpConfig.command} ${effectiveArgs.slice(0, 3).join(' ')}...`);

      try {
        const result = await execTool(mcpConfig.command, effectiveArgs, timeout, prompt);

        if (!result) {
          throw new Error(`${mcpConfig.command} returned empty response`);
        }

        if (options.jsonMode) {
          try {
            return extractJson(result);
          } catch {
            providerLogger.warn('jsonMode: failed to extract JSON from response');
            return result;
          }
        }

        return result;
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        providerLogger.error(`Execution failed: ${msg}`);
        throw new Error(`MCP provider (${mcpConfig.command}) failed: ${msg}`);
      }
    },
  };
}
