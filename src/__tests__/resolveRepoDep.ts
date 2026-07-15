/**
 * Locate a dep's package directory the way Node resolution does: from the
 * repo root, walking up through ancestor node_modules. A direct
 * `repoRoot/node_modules/<dep>` probe breaks in session worktrees
 * (.worktrees/<name>/), where deps live up-tree in the main checkout by
 * design (scripts/new-session.sh) and the worktree's own node_modules —
 * when it exists at all — holds only tool caches (vitest's .vite,
 * packaging.test.ts's .cache), so the walk must probe for the dep itself,
 * not the first node_modules dir.
 *
 * Shared by packSmoke.test.ts (runtime dep symlinks, #93/#152) and
 * packaging.test.ts (tsc binary, #151).
 */
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const requireFromRepoRoot = createRequire(join(repoRoot, "package.json"));

/** Resolve a dep's package directory from the repo root, or null if absent. */
export function resolveRepoDep(dep: string): string | null {
  try {
    return dirname(requireFromRepoRoot.resolve(`${dep}/package.json`));
  } catch {
    // An exports map without "./package.json" makes require.resolve throw
    // even when the dep is installed; redo Node's directory walk by hand.
    for (let dir = repoRoot; ; dir = dirname(dir)) {
      const candidate = join(dir, "node_modules", dep);
      if (existsSync(join(candidate, "package.json"))) return candidate;
      if (dirname(dir) === dir) return null;
    }
  }
}
