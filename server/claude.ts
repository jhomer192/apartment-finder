import { execFile } from 'node:child_process';
import { tmpdir } from 'node:os';
import { config } from './config.js';

const MAX_OUTPUT_BYTES = 1_000_000;

/**
 * Each call is a whole CLI process against the subscription; a page of results
 * would otherwise fan out into dozens at once.
 */
const MAX_CONCURRENT = 3;
let running = 0;
const waiting: Array<() => void> = [];

async function acquire(): Promise<void> {
  if (running < MAX_CONCURRENT) {
    running += 1;
    return;
  }
  await new Promise<void>((resolve) => waiting.push(resolve));
  running += 1;
}

function release(): void {
  running -= 1;
  waiting.shift()?.();
}

export class ClaudeUnavailableError extends Error {}

/**
 * Only what the CLI itself needs. Listing text reaches the model, so the
 * subprocess must not carry SMTP_PASS, SESSION_SECRET or the rest of `.env`.
 */
function claudeEnv(): NodeJS.ProcessEnv {
  const { PATH, HOME, CLAUDE_CODE_OAUTH_TOKEN, ANTHROPIC_API_KEY } = process.env;
  return { PATH, HOME, CLAUDE_CODE_OAUTH_TOKEN, ANTHROPIC_API_KEY };
}

function run(prompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = execFile(
      config.claudeBin,
      // Listings are attacker-controlled text, so the model gets no tools at
      // all: it cannot read files, fetch URLs, or run commands on our behalf.
      ['-p', '--model', config.claudeModel, '--tools', '', '--strict-mcp-config'],
      {
        timeout: config.claudeTimeoutMs,
        maxBuffer: MAX_OUTPUT_BYTES,
        cwd: tmpdir(),
        env: claudeEnv(),
      },
      (error, stdout, stderr) => {
        if (error) {
          reject(new Error(`Claude CLI failed: ${stderr.trim() || error.message}`));
          return;
        }
        resolve(stdout.trim());
      },
    );

    child.stdin?.end(prompt);
  });
}

/**
 * Runs Claude Code in headless mode. The prompt goes over stdin so that nothing
 * user-supplied is ever interpreted as a shell argument.
 */
export async function askClaude(prompt: string): Promise<string> {
  if (!process.env.CLAUDE_CODE_OAUTH_TOKEN && !process.env.ANTHROPIC_API_KEY) {
    throw new ClaudeUnavailableError(
      'Claude is not configured. Set CLAUDE_CODE_OAUTH_TOKEN (from `claude setup-token`).',
    );
  }

  await acquire();
  try {
    return await run(prompt);
  } finally {
    release();
  }
}
