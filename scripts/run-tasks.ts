#!/usr/bin/env tsx
/**
 * Parallel PRD runner for sandcastle. Reads a markdown checklist
 * (`- [ ]` items) and dispatches each one to a sandboxed Claude Code agent.
 *
 *   tsx scripts/run-tasks.ts <tasks.md> [--workers N] [--model NAME]
 *   npm run tasks -- tasks.md --workers 5
 *
 * Matches the `- [ ]` / `- [x]` / `- [!]` PRD semantics of the existing
 * `run-tasks-parallel.sh`, with three differences:
 *
 *   1. Each task runs in a Docker sandbox via sandcastle. The host
 *      working tree is never touched until merge.
 *   2. Concurrency is a Node-side semaphore, not flock(1) over a counter.
 *   3. Branches are named `sandcastle/<slug>-<unix-ts>`. Cleanup with
 *      `./merge-workers.sh` works against the same branch pattern, or
 *      delete the branches directly once you've reviewed them.
 *
 * The fast-fail-on-auth heuristic from the bash runner is preserved:
 * if any task fails in under 15 seconds, the entire fleet aborts and
 * that line stays `[ ]` (almost certainly auth/rate-limit, not real work).
 */
import { createSandbox, claudeCode } from "@ai-hero/sandcastle";
import { docker } from "@ai-hero/sandcastle/sandboxes/docker";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { argv, exit } from "node:process";

// Load `.sandcastle/.env` (gitignored) so SANDCASTLE_MODEL and
// ANTHROPIC_API_KEY can be pinned locally without committing them.
const ENV_FILE = ".sandcastle/.env";
if (existsSync(ENV_FILE)) {
  for (const line of readFileSync(ENV_FILE, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

// --- Args ----------------------------------------------------------------

const args = argv.slice(2);
const positional = args.filter((a) => !a.startsWith("--"));
const flag = (name: string): string | undefined => {
  const idx = args.indexOf(name);
  return idx >= 0 ? args[idx + 1] : undefined;
};

const prdFile = positional[0];
if (!prdFile) {
  console.error(
    "Usage: tsx scripts/run-tasks.ts <tasks.md> [--workers N] [--model NAME]",
  );
  exit(1);
}

const workers = Number(flag("--workers") ?? 5);
const model =
  flag("--model") ?? process.env.SANDCASTLE_MODEL ?? "claude-opus-4-5";
const imageName = process.env.SANDCASTLE_IMAGE ?? "redial-sandcastle:local";

// Auth: set CLAUDE_CODE_OAUTH_TOKEN in `.sandcastle/.env` (generate it with
// `claude setup-token`). Sandcastle's env resolver injects every key declared
// in `.sandcastle/.env` into each sandbox, so the agent authenticates with
// your Claude subscription. To use an API key instead, set ANTHROPIC_API_KEY
// in `.sandcastle/.env`. (Bind-mounting `~/.claude` does NOT work on macOS —
// the token lives in the Keychain, not the dir.)
const sandboxMounts = [
  { hostPath: "~/.npm", sandboxPath: "/home/agent/.npm" },
];

// --- PRD I/O -------------------------------------------------------------

type Task = { lineIdx: number; text: string };

function readPRD(): { lines: string[]; pending: Task[] } {
  const lines = readFileSync(prdFile, "utf8").split("\n");
  const pending: Task[] = [];
  lines.forEach((line, idx) => {
    const m = line.match(/^\s*-\s\[ \]\s+(.*)$/);
    if (m) pending.push({ lineIdx: idx, text: m[1] });
  });
  return { lines, pending };
}

/** Serialize writes to the PRD so concurrent task completions don't clobber. */
const prdMutex = (() => {
  let chain: Promise<unknown> = Promise.resolve();
  return <T>(fn: () => T): Promise<T> => {
    const next = chain.then(fn);
    chain = next.catch(() => {});
    return next;
  };
})();

function markStatus(lineIdx: number, mark: "x" | "!"): Promise<void> {
  return prdMutex(() => {
    const { lines } = readPRD();
    lines[lineIdx] = lines[lineIdx].replace(/-\s\[ \]/, `- [${mark}]`);
    writeFileSync(prdFile, lines.join("\n"));
  });
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);
}

// --- Semaphore -----------------------------------------------------------

class Semaphore {
  private waiters: Array<() => void> = [];
  constructor(private permits: number) {}
  async acquire(): Promise<() => void> {
    if (this.permits > 0) {
      this.permits--;
      return () => this.release();
    }
    return new Promise<() => void>((resolve) => {
      this.waiters.push(() => {
        this.permits--;
        resolve(() => this.release());
      });
    });
  }
  private release(): void {
    this.permits++;
    this.waiters.shift()?.();
  }
}

// --- Main ----------------------------------------------------------------

const { pending } = readPRD();
if (pending.length === 0) {
  console.log(`No pending tasks in ${prdFile}.`);
  exit(0);
}

console.log(`PRD:     ${prdFile}`);
console.log(`Model:   ${model}`);
console.log(`Image:   ${imageName}`);
console.log(`Workers: ${workers}`);
console.log(`Tasks:   ${pending.length}`);
console.log("");

const sem = new Semaphore(workers);
const startedAt = Date.now();
let doneCount = 0;
let failedCount = 0;
let abortedCount = 0;

// Abort the entire fleet if we detect auth/rate-limit failures.
const fleetAbort = new AbortController();

async function runOne(task: Task): Promise<void> {
  const release = await sem.acquire();
  try {
    if (fleetAbort.signal.aborted) {
      abortedCount++;
      return;
    }

    const slug = slugify(task.text);
    const branch = `sandcastle/${slug}-${Math.floor(Date.now() / 1000)}`;
    const taskStartedAt = Date.now();
    console.log(`[start] ${branch}`);
    console.log(`        ${task.text.slice(0, 100)}`);

    try {
      // `await using` triggers Symbol.asyncDispose on scope exit, which
      // tears down the container and worktree. Requires Node ≥ 20.4.
      await using sandbox = await createSandbox({
        branch,
        sandbox: docker({ imageName, mounts: sandboxMounts }),
      });
      await sandbox.run({
        agent: claudeCode(model),
        prompt: task.text,
      });
      await markStatus(task.lineIdx, "x");
      doneCount++;
      console.log(`[done]  ${branch}`);
    } catch (err) {
      const elapsed = Date.now() - taskStartedAt;
      const msg = err instanceof Error ? err.message : String(err);
      if (elapsed < 15_000) {
        console.error(
          `[abort] ${branch} failed in ${elapsed}ms — auth/rate limit suspected. Aborting fleet.`,
        );
        console.error(`        ${msg}`);
        fleetAbort.abort();
        return;
      }
      failedCount++;
      await markStatus(task.lineIdx, "!");
      console.error(`[fail]  ${branch}: ${msg}`);
    }
  } finally {
    release();
  }
}

await Promise.all(pending.map(runOne));

const elapsedMin = ((Date.now() - startedAt) / 60_000).toFixed(1);
console.log("");
console.log(
  `Done in ${elapsedMin}m — ${doneCount} succeeded, ${failedCount} failed, ${abortedCount} aborted.`,
);
console.log(
  `Branches: \`git branch --list 'sandcastle/*'\` — review, then merge.`,
);
