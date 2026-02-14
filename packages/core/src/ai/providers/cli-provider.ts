// packages/core/src/ai/providers/cli-provider.ts
// CLI-based AI provider that shells out to installed CLI tools
// Supports: codex (OpenAI), gemini (Google) — uses their OAuth auth, no API key needed

import { spawn } from 'node:child_process';
import type { AiProvider, AiProviderConfig, ChatMessage, ChatOptions } from '../types.js';
import { logger } from '../../logger.js';

const CLI_TIMEOUT = 120000; // 2 minutes (CLI tools are slower than direct API)
const MAX_BUFFER_SIZE = 10 * 1024 * 1024; // 10 MB cap to prevent OOM

interface CliProviderSpec {
  /** CLI command name */
  command: string;
  /** Display name */
  displayName: string;
  /** Build CLI arguments (prompt is piped via stdin, not passed as arg) */
  buildArgs(config: AiProviderConfig): string[];
  /** Check if CLI is installed */
  checkCommand: string[];
  /** Install instruction for error messages */
  installHint: string;
}

const CLI_SPECS: Record<string, CliProviderSpec> = {
  'codex-cli': {
    command: 'codex',
    displayName: 'Codex CLI',
    buildArgs(config) {
      const args = ['--quiet', '--full-auto'];
      if (config.model) {
        args.push('--model', config.model);
      }
      // Prompt piped via stdin — no positional arg injection risk
      args.push('-');
      return args;
    },
    checkCommand: ['codex', '--version'],
    installHint: 'npm install -g @openai/codex',
  },
  'gemini-cli': {
    command: 'gemini',
    displayName: 'Gemini CLI',
    buildArgs(config) {
      const args: string[] = [];
      if (config.model) {
        args.push('--model', config.model);
      }
      // Prompt piped via stdin
      args.push('-');
      return args;
    },
    checkCommand: ['gemini', '--version'],
    installHint: 'npm install -g @google/gemini-cli',
  },
};

/**
 * Execute a CLI command and return stdout as string.
 * Prompt is piped via stdin to avoid argument injection.
 */
function execCli(
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
        reject(new Error(`CLI stdout exceeded ${MAX_BUFFER_SIZE} bytes`));
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
        reject(
          new Error(
            `CLI exited with code ${code}: ${stderr.substring(0, 500)}`,
          ),
        );
      }
    });

    proc.on('error', (err) => {
      if (bufferExceeded) return;
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        reject(new Error(`Command "${command}" not found`));
      } else {
        reject(err);
      }
    });

    // Pipe prompt via stdin to avoid flag injection
    if (stdinData) {
      proc.stdin.write(stdinData);
      proc.stdin.end();
    } else {
      proc.stdin.end();
    }
  });
}

/**
 * Check if a CLI tool is installed and authenticated
 */
async function checkCliAvailable(spec: CliProviderSpec): Promise<boolean> {
  try {
    await execCli(spec.checkCommand[0], spec.checkCommand.slice(1), 10000);
    return true;
  } catch {
    return false;
  }
}

/**
 * Create a CLI-based AI provider.
 * Uses installed CLI tools (codex, gemini) that handle their own authentication.
 */
export function createCliProvider(config: AiProviderConfig): AiProvider {
  const providerType = config.provider as string;
  const spec = CLI_SPECS[providerType];

  if (!spec) {
    throw new Error(
      `Unknown CLI provider: ${providerType}. Available: ${Object.keys(CLI_SPECS).join(', ')}`,
    );
  }

  const providerLogger = logger.child(spec.displayName);

  // Cache availability — check once at creation, not per call
  let availableChecked = false;
  let isAvailable = false;

  return {
    name: `${providerType}/${config.model || 'default'}`,

    async chat(
      messages: ChatMessage[],
      options: ChatOptions = {},
    ): Promise<string> {
      // Check availability once (cached)
      if (!availableChecked) {
        isAvailable = await checkCliAvailable(spec);
        availableChecked = true;
      }
      if (!isAvailable) {
        throw new Error(
          `${spec.displayName} is not installed or not authenticated.\n` +
            `Install: ${spec.installHint}\n` +
            `Then authenticate: ${spec.command} auth login`,
        );
      }

      // Warn when ChatOptions cannot be honored by CLI tools
      if (options.jsonMode) {
        providerLogger.warn(
          'jsonMode requested but CLI provider cannot enforce JSON output',
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

      const args = spec.buildArgs(config);

      providerLogger.debug(
        `Executing: ${spec.command} ${args.slice(0, 2).join(' ')}...`,
      );

      try {
        const result = await execCli(spec.command, args, CLI_TIMEOUT, prompt);

        if (!result) {
          throw new Error(`${spec.displayName} returned empty response`);
        }

        return result;
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        providerLogger.error(`CLI execution failed: ${msg}`);
        throw new Error(`${spec.displayName} failed: ${msg}`);
      }
    },
  };
}
