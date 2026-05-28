#!/usr/bin/env tsx
/**
 * Sandcastle branch merge helper.
 *
 *   npm run sandcastle:merge                 # interactive: shows status, merges all clean
 *   npm run sandcastle:merge -- --dry-run    # show what would happen, don't merge
 *   npm run sandcastle:merge -- --branch X   # merge a single branch
 *
 * Lists all branches matching `sandcastle/*`, shows diff stats, and
 * attempts to merge each one into the current HEAD. Reports conflicts
 * without leaving the working tree in a merge state.
 *
 * Companion to scripts/run-tasks.ts. Replaces merge-workers.sh for the
 * sandcastle branch naming convention.
 */
import { execSync } from "node:child_process";
import { argv, exit } from "node:process";

const args = argv.slice(2);
const flag = (name: string): string | undefined => {
  const idx = args.indexOf(name);
  return idx >= 0 ? args[idx + 1] : undefined;
};
const hasFlag = (name: string): boolean => args.includes(name);

const dryRun = hasFlag("--dry-run");
const singleBranch = flag("--branch");

const sh = (cmd: string): string => execSync(cmd, { encoding: "utf8" }).trim();
const shSilent = (cmd: string): { ok: boolean; out: string } => {
  try {
    return { ok: true, out: execSync(cmd, { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }).trim() };
  } catch (err) {
    const e = err as { stdout?: Buffer; stderr?: Buffer };
    return { ok: false, out: `${e.stdout?.toString() ?? ""}${e.stderr?.toString() ?? ""}`.trim() };
  }
};

const head = sh("git rev-parse --abbrev-ref HEAD");
if (head.startsWith("sandcastle/")) {
  console.error(
    `Refusing to merge while HEAD is itself a sandcastle branch (${head}). ` +
      `Checkout the target branch (main, etc.) first.`,
  );
  exit(1);
}

const allBranches = sh("git for-each-ref --format='%(refname:short)' refs/heads/sandcastle/")
  .split("\n")
  .filter(Boolean);
const branches = singleBranch ? [singleBranch] : allBranches;

if (branches.length === 0) {
  console.log("No sandcastle/* branches found.");
  exit(0);
}

console.log(`HEAD:     ${head}`);
console.log(`Branches: ${branches.length}`);
console.log(`Mode:     ${dryRun ? "dry-run" : "merge"}`);
console.log("");

type Outcome = "merged" | "no-changes" | "already-merged" | "conflict" | "skipped";
const results: Record<Outcome, string[]> = {
  merged: [],
  "no-changes": [],
  "already-merged": [],
  conflict: [],
  skipped: [],
};

for (const branch of branches) {
  const exists = shSilent(`git rev-parse --verify --quiet refs/heads/${branch}`);
  if (!exists.ok) {
    console.log(`[skip] ${branch} — branch does not exist`);
    results.skipped.push(branch);
    continue;
  }

  const ahead = Number(sh(`git rev-list --count ${head}..${branch}`));
  if (ahead === 0) {
    console.log(`[skip] ${branch} — no new commits vs ${head}`);
    results["no-changes"].push(branch);
    continue;
  }

  const merged = shSilent(`git merge-base --is-ancestor ${branch} ${head}`);
  if (merged.ok) {
    console.log(`[skip] ${branch} — already merged into ${head}`);
    results["already-merged"].push(branch);
    continue;
  }

  const stat = sh(`git diff --shortstat ${head}...${branch}`);
  console.log(`[${dryRun ? "would-merge" : "merge"}] ${branch} (${ahead} commit${ahead === 1 ? "" : "s"}, ${stat})`);

  if (dryRun) continue;

  const result = shSilent(`git merge --no-edit --no-ff -m "merge: ${branch}" ${branch}`);
  if (result.ok) {
    console.log(`        merged`);
    results.merged.push(branch);
  } else {
    console.log(`        CONFLICT — aborting merge of this branch`);
    shSilent(`git merge --abort`);
    results.conflict.push(branch);
  }
}

console.log("");
console.log("=== Summary ===");
console.log(`  Merged:         ${results.merged.length}`);
console.log(`  No changes:     ${results["no-changes"].length}`);
console.log(`  Already merged: ${results["already-merged"].length}`);
console.log(`  Conflicted:     ${results.conflict.length}`);
console.log(`  Skipped:        ${results.skipped.length}`);

if (results.conflict.length > 0) {
  console.log("");
  console.log("Conflicted branches need manual resolution:");
  for (const b of results.conflict) console.log(`  git merge ${b}`);
}

if (!dryRun && results.merged.length > 0) {
  console.log("");
  console.log("To delete the merged branches:");
  console.log(`  git branch --list 'sandcastle/*' --merged | xargs -n1 git branch -d`);
}

exit(results.conflict.length > 0 ? 1 : 0);
