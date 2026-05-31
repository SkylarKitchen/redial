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
import { readFileSync, writeFileSync } from "node:fs";
import { argv, exit } from "node:process";
import {
  loadDotEnv,
  model as defaultModel,
  imageName,
  makeSandbox,
} from "../.sandcastle/runtime";
import {
  slugify,
  branchName,
  classifyFailure,
  buildTaskPrompt,
  resultMark,
} from "./run-tasks-lib";

loadDotEnv();

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
if (!Number.isInteger(workers) || workers < 1) {
  console.error(
    `--workers must be a positive integer (got "${flag("--workers")}").`,
  );
  exit(1);
}

// CLI --model wins; otherwise SANDCASTLE_MODEL / the committed default (see
// ../.sandcastle/runtime). Sandbox image/mounts/auth all live there too.
const model = flag("--model") ?? defaultModel();

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
console.log(`Image:   ${imageName()}`);
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

async function runOne(task: Task, index: number): Promise<void> {
  const release = await sem.acquire();
  try {
    if (fleetAbort.signal.aborted) {
      abortedCount++;
      return;
    }

    // `index` keeps the branch unique even when two tasks share a (truncated)
    // slug and start in the same millisecond.
    const branch = branchName(slugify(task.text), index);
    const taskStartedAt = Date.now();
    console.log(`[start] ${branch}`);
    console.log(`        ${task.text.slice(0, 100)}`);

    try {
      // `await using` triggers Symbol.asyncDispose on scope exit, which
      // tears down the container and worktree. Requires Node ≥ 20.4.
      await using sandbox = await createSandbox({
        branch,
        sandbox: makeSandbox(),
      });
      const result = await sandbox.run({
        agent: claudeCode(model),
        // sandbox.run() only persists commits, so the prompt tells the agent
        // to commit its work.
        prompt: buildTaskPrompt(task.text),
      });

      // A run that produced no commits persisted nothing — mark it failed.
      const mark = resultMark(result.commits.length);
      await markStatus(task.lineIdx, mark);
      if (mark === "x") {
        doneCount++;
        console.log(`[done]  ${branch} (${result.commits.length} commit(s))`);
      } else {
        failedCount++;
        console.error(`[fail]  ${branch}: agent produced no commits`);
      }
    } catch (err) {
      const elapsed = Date.now() - taskStartedAt;
      const msg = err instanceof Error ? err.message : String(err);
      // Only genuine auth/rate-limit failures abort the fleet. A branch-name
      // collision or other git error is a per-task failure.
      if (classifyFailure(msg, elapsed) === "auth") {
        console.error(
          `[abort] ${branch} failed in ${elapsed}ms — auth/rate limit suspected. Aborting fleet.`,
        );
        console.error(`        ${msg}`);
        fleetAbort.abort();
        abortedCount++;
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

await Promise.all(pending.map((task, index) => runOne(task, index)));

const elapsedMin = ((Date.now() - startedAt) / 60_000).toFixed(1);
console.log("");
console.log(
  `Done in ${elapsedMin}m — ${doneCount} succeeded, ${failedCount} failed, ${abortedCount} aborted.`,
);
console.log(
  `Branches: \`git branch --list 'sandcastle/*'\` — review, then merge.`,
);
