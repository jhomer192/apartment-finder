import { execFile } from 'node:child_process';
import { config } from './config.js';

const MAX_OUTPUT_BYTES = 1_000_000;

export class ClaudeUnavailableError extends Error {}

/**
 * Runs Claude Code in headless mode. The prompt goes over stdin so that nothing
 * user-supplied is ever interpreted as a shell argument.
 */
export function askClaude(prompt: string): Promise<string> {
  if (!process.env.CLAUDE_CODE_OAUTH_TOKEN && !process.env.ANTHROPIC_API_KEY) {
    return Promise.reject(
      new ClaudeUnavailableError(
        'Claude is not configured. Set CLAUDE_CODE_OAUTH_TOKEN (from `claude setup-token`).',
      ),
    );
  }

  return new Promise((resolve, reject) => {
    const child = execFile(
      config.claudeBin,
      ['-p', '--model', config.claudeModel],
      {
        timeout: config.claudeTimeoutMs,
        maxBuffer: MAX_OUTPUT_BYTES,
        env: process.env,
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
