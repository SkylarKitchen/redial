/**
 * Four-phase sandcastle orchestrator — plan → implement → review → merge.
 *
 * Each cycle:
 *   Phase 1 (Plan):    A planner agent reads open `ready-for-agent` issues,
 *                      builds a dependency graph, and emits a <plan> JSON
 *                      block listing unblocked issues with branch names.
 *   Phase 2 (Execute): Per issue, one sandbox runs an implementer (up to 8
 *                      iterations) and — if it committed — a reviewer on the
 *                      same branch. All issue pipelines run concurrently.
 *   Phase 3 (Merge):   One agent merges every branch that produced commits
 *                      into the current branch, gates green, comments on the
 *                      issues. Issues stay open for human QA.
 *
 * The outer loop repeats so newly unblocked issues get picked up after each
 * merge round.
 *
 * Usage:
 *   git switch -c sandcastle/integration-$(date +%F)   # never run from main
 *   npm run sandcastle
 *
 * Credentials, models, and the Docker image live in `./runtime` —
 * see `.sandcastle/.env.example` for the knobs.
 */
import * as sandcastle from "@ai-hero/sandcastle";
import { execSync } from "node:child_process";
import { loadDotEnv, makeSandbox, plannerModel, workerModel } from "./runtime";

loadDotEnv();

// Plan → execute → merge cycles before stopping. Raise for a big backlog,
// lower to 1 for a smoke test.
const MAX_CYCLES = Number(process.env.SANDCASTLE_MAX_CYCLES ?? 4);

// Repo rule (issue #63): `main` only moves through PRs. The merge phase
// lands merge commits on the branch this script starts from, so running
// from main would sidestep that.
const startBranch = execSync("git rev-parse --abbrev-ref HEAD", {
  encoding: "utf8",
}).trim();
if (startBranch === "main" || startBranch === "master") {
  console.error(
    `Refusing to run from '${startBranch}' — the merge phase commits to the current branch, and ${startBranch} only moves through PRs.\n` +
      `Start an integration branch first:\n\n` +
      `  git switch -c sandcastle/integration-$(date +%F)\n`,
  );
  process.exit(1);
}

// Deps inside each sandbox; the ~/.npm cache mount (see ./runtime) keeps
// repeat installs fast.
const hooks = {
  sandbox: {
    onSandboxReady: [{ command: "npm ci", timeoutMs: 10 * 60_000 }],
  },
};

for (let cycle = 1; cycle <= MAX_CYCLES; cycle++) {
  console.log(`\n=== Cycle ${cycle}/${MAX_CYCLES} (base: ${startBranch}) ===\n`);

  // --- Phase 1: Plan -------------------------------------------------------
  // maxIterations 1 — the planner only reads and reasons; it writes no code.
  const plan = await sandcastle.run({
    hooks,
    sandbox: makeSandbox(),
    name: "planner",
    maxIterations: 1,
    agent: sandcastle.claudeCode(plannerModel()),
    promptFile: ".sandcastle/plan-prompt.md",
  });

  const planMatch = plan.stdout.match(/<plan>([\s\S]*?)<\/plan>/);
  if (!planMatch) {
    throw new Error(
      "Planning agent did not produce a <plan> tag.\n\n" + plan.stdout,
    );
  }

  const { issues } = JSON.parse(planMatch[1]!) as {
    issues: { id: string; title: string; branch: string }[];
  };

  if (issues.length === 0) {
    console.log("No unblocked `ready-for-agent` issues. Exiting.");
    break;
  }

  console.log(`Plan: ${issues.length} issue(s) to work in parallel:`);
  for (const issue of issues) {
    console.log(`  #${issue.id}: ${issue.title} → ${issue.branch}`);
  }

  // --- Phase 2: Execute + Review -------------------------------------------
  // One sandbox per issue so implementer and reviewer share a worktree and
  // branch. allSettled: one failed pipeline doesn't cancel the others.
  const settled = await Promise.allSettled(
    issues.map(async (issue) => {
      await using sandbox = await sandcastle.createSandbox({
        branch: issue.branch,
        sandbox: makeSandbox(),
        hooks,
      });

      // 8 iterations: most issues converge in 1–2. One that hasn't by 8 is
      // stuck — fail fast and leave quota for the next cycle.
      const implement = await sandbox.run({
        name: `implement#${issue.id}`,
        maxIterations: 8,
        agent: sandcastle.claudeCode(workerModel()),
        promptFile: ".sandcastle/implement-prompt.md",
        completionSignal: "<promise>COMPLETE</promise>",
        promptArgs: {
          TASK_ID: issue.id,
          ISSUE_TITLE: issue.title,
          BRANCH: issue.branch,
        },
      });

      // Review is pointless without commits to review.
      if (implement.commits.length === 0) return implement;

      const review = await sandbox.run({
        name: `review#${issue.id}`,
        maxIterations: 1,
        agent: sandcastle.claudeCode(workerModel()),
        promptFile: ".sandcastle/review-prompt.md",
        promptArgs: {
          BRANCH: issue.branch,
          SOURCE_BRANCH: startBranch,
        },
      });

      // Each run() only reports its own commits; the merge gate below needs
      // the union.
      return {
        ...review,
        commits: [...implement.commits, ...review.commits],
      };
    }),
  );

  for (const [i, outcome] of settled.entries()) {
    if (outcome.status === "rejected") {
      console.error(
        `  ✗ #${issues[i]!.id} (${issues[i]!.branch}) failed: ${outcome.reason}`,
      );
    }
  }

  // Only branches that actually hold commits go to the merge phase.
  const completedIssues = settled
    .map((outcome, i) => ({ outcome, issue: issues[i]! }))
    .filter(
      (entry) =>
        entry.outcome.status === "fulfilled" &&
        entry.outcome.value.commits.length > 0,
    )
    .map((entry) => entry.issue);

  console.log(
    `\nExecution done. ${completedIssues.length} branch(es) with commits:`,
  );
  for (const issue of completedIssues) {
    console.log(`  ${issue.branch}`);
  }

  if (completedIssues.length === 0) {
    console.log("No commits produced this cycle. Nothing to merge.");
    continue;
  }

  // --- Phase 3: Merge ------------------------------------------------------
  // merge-to-head so the merge agent's work lands back on the integration
  // branch this script started from.
  await sandcastle.run({
    hooks,
    sandbox: makeSandbox(),
    name: "merger",
    maxIterations: 1,
    agent: sandcastle.claudeCode(workerModel()),
    promptFile: ".sandcastle/merge-prompt.md",
    branchStrategy: { type: "merge-to-head" },
    promptArgs: {
      BRANCHES: completedIssues.map((i) => `- ${i.branch}`).join("\n"),
      ISSUES: completedIssues.map((i) => `- #${i.id}: ${i.title}`).join("\n"),
    },
  });

  console.log("\nBranches merged into " + startBranch + ".");
}

console.log(
  `\nDone. Review the result on '${startBranch}', then PR it to main.`,
);
