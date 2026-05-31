/**
 * Pure, side-effect-free helpers for the parallel PRD runner
 * (`scripts/run-tasks.ts`). Extracted so the branch-naming, failure
 * classification, prompt construction, and completion logic can be unit
 * tested without spinning up Docker.
 */

/** Convert task text into a filesystem/branch-safe slug (max 50 chars). */
export function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);
}

/**
 * Build a unique branch name for a task.
 *
 * The per-task `index` guarantees uniqueness: two tasks whose text truncates
 * to the same 50-char slug and that launch in the same millisecond would
 * otherwise collide on `sandcastle/<slug>-<timestamp>` and the second would
 * die on `fatal: a branch named '…' already exists`.
 */
export function branchName(
  slug: string,
  index: number,
  now: number = Date.now(),
): string {
  return `sandcastle/${slug}-${now}-${index}`;
}

export type FailureKind = "auth" | "task";

/**
 * Decide whether a run failure is a suspected auth/rate-limit problem (which
 * should abort the whole fleet) or an ordinary per-task failure.
 *
 * Git/worktree errors — most importantly a branch-name collision — are always
 * task failures, never auth, even when they fail fast. Only otherwise-
 * unexplained fast failures are treated as auth/rate-limit.
 */
export function classifyFailure(
  message: string,
  elapsedMs: number,
): FailureKind {
  if (/\bfatal:|already exists|not a git repository|worktree/i.test(message)) {
    return "task";
  }
  return elapsedMs < 15_000 ? "auth" : "task";
}

/**
 * Compose the prompt sent to the sandboxed agent.
 *
 * `sandbox.run()` only syncs out *commits* — uncommitted working-tree edits
 * are discarded when the sandbox tears down. So the agent must commit its own
 * work; this appends an explicit instruction to do so.
 */
export function buildTaskPrompt(taskText: string): string {
  return [
    taskText,
    "",
    "When you are finished, stage and commit ALL your changes with a single " +
      "commit: `git add -A && git commit -m \"<short summary>\"`. If you made " +
      "no changes, do not create a commit.",
  ].join("\n");
}

/**
 * Map an agent run's commit count to a PRD checkbox mark.
 *
 * A run that produced zero commits persisted no work, so it must not be
 * marked done (`[x]`) — it is a failure (`[!]`).
 */
export function resultMark(commitCount: number): "x" | "!" {
  return commitCount > 0 ? "x" : "!";
}
