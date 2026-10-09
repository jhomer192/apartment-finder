/**
 * Live eval: asks the real search agent every case in cases.ts and grades the
 * answers. It calls Claude, so it is opt-in and never part of `npm test`.
 *
 * Usage: npm run eval:prepare && npm run eval -- --label <name>
 *
 * The summary (pass/fail, pick keys, timings; no listing or answer text) goes
 * to evals/results/<label>.json; full answers stay in evals/.cache.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { CACHE_DIR, DB_PATHS, type Suite } from './paths.js';

const label = process.argv[process.argv.indexOf('--label') + 1];
if (!process.argv.includes('--label') || !label) throw new Error('pass --label <name>');
const suite = process.env.EVAL_SUITE as Suite | undefined;

if (suite) {
  const { CASES } = await import('./cases.js');
  const { grade } = await import('./checks.js');
  const { claudeSearch } = await import('../server/search-agent.js');

  const results = await Promise.all(
    CASES.filter((c) => c.suite === suite).map(async (c) => {
      const started = Date.now();
      const answer = await claudeSearch(c.question, c.history ?? []).catch((error: unknown) =>
        error instanceof Error ? error : new Error(String(error)),
      );
      const ms = Date.now() - started;
      const checks = grade(answer, c.checks);
      console.log(`${checks.every((check) => check.pass) ? 'PASS' : 'FAIL'} ${c.id} (${(ms / 1000).toFixed(0)}s)`);
      return { id: c.id, suite, question: c.question, ms, checks, answer };
    }),
  );
  writeFileSync(`${CACHE_DIR}/${label}-${suite}.json`, JSON.stringify(results, null, 2));
} else {
  for (const name of Object.keys(DB_PATHS) as Suite[]) {
    if (!existsSync(DB_PATHS[name])) throw new Error(`${DB_PATHS[name]} is missing: run npm run eval:prepare`);
  }
  // Each suite reads its own inventory, chosen by DATABASE_PATH before the
  // server modules load, so each runs in its own process.
  for (const name of Object.keys(DB_PATHS) as Suite[]) {
    execFileSync(process.execPath, [...process.execArgv, ...process.argv.slice(1)], {
      stdio: 'inherit',
      env: { ...process.env, EVAL_SUITE: name, DATABASE_PATH: DB_PATHS[name] },
    });
  }

  type Result = {
    id: string;
    suite: Suite;
    ms: number;
    checks: { name: string; pass: boolean; detail: string | null }[];
    answer: { ranked?: { listing: { key: string }; verdict: string }[]; relaxed?: string[] } | { message?: string };
  };
  const results = (Object.keys(DB_PATHS) as Suite[]).flatMap(
    (name) => JSON.parse(readFileSync(`${CACHE_DIR}/${label}-${name}.json`, 'utf8')) as Result[],
  );

  const tally = (suiteName: Suite) => {
    const rows = results.filter((r) => r.suite === suiteName);
    const checks = rows.flatMap((r) => r.checks);
    const times = rows.map((r) => r.ms).sort((a, b) => a - b);
    return {
      cases: rows.length,
      casesPassed: rows.filter((r) => r.checks.every((check) => check.pass)).length,
      checks: checks.length,
      checksPassed: checks.filter((check) => check.pass).length,
      medianSeconds: Math.round(times[Math.floor(times.length / 2)] / 1000),
    };
  };

  const summary = {
    label,
    commit: execFileSync('git', ['rev-parse', '--short', 'HEAD']).toString().trim(),
    model: process.env.CLAUDE_MODEL ?? 'sonnet',
    ranAt: new Date().toISOString(),
    golden: tally('golden'),
    hostile: tally('hostile'),
    cases: results.map((r) => ({
      id: r.id,
      suite: r.suite,
      pass: r.checks.every((check) => check.pass),
      seconds: Math.round(r.ms / 1000),
      failed: r.checks.filter((check) => !check.pass).map((check) => `${check.name}: ${check.detail}`),
      picks: 'ranked' in r.answer ? r.answer.ranked?.map((pick) => `${pick.listing.key} (${pick.verdict})`) : [],
      relaxed: 'relaxed' in r.answer ? r.answer.relaxed : undefined,
    })),
  };
  mkdirSync('evals/results', { recursive: true });
  writeFileSync(`evals/results/${label}.json`, JSON.stringify(summary, null, 2) + '\n');
  console.log(
    `\n${label}: golden ${summary.golden.casesPassed}/${summary.golden.cases} cases ` +
      `(${summary.golden.checksPassed}/${summary.golden.checks} checks), hostile ` +
      `${summary.hostile.casesPassed}/${summary.hostile.cases}, median ${summary.golden.medianSeconds}s`,
  );
}
