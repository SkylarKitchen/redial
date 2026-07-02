/**
 * pathSafety.ts — shared path-traversal / symlink containment primitives.
 *
 * Single owner for the root-confinement checks used by the file-writing
 * modules (commit.ts for CSS, commitTailwind.ts for Tailwind classes), so the
 * security-sensitive logic exists in exactly one place:
 *
 *  - resolveSafe()          string-level checks: reject ".." segments, resolve
 *                           against the root, assert containment
 *  - isRealPathWithinRoot() symlink-resolved containment (issue #22) — the
 *                           load-bearing guard at every read/write chokepoint
 *  - EXCLUDED_DIRS          directories no recursive file search descends into
 */

import { realpath } from "fs/promises";
import * as nodePath from "path";
import { resolve, sep } from "path";

/**
 * Directories excluded from recursive project searches (build output,
 * dependencies, VCS metadata). Shared by every walker so the exclusion list
 * can't drift between modules.
 */
export const EXCLUDED_DIRS = new Set([
  "node_modules", ".next", "dist", ".git", "build", "out", ".turbo",
]);

/**
 * Ensure a resolved path is contained within the project root.
 * Prevents path traversal attacks (e.g. "../../etc/cron.d/malicious").
 *
 * Containment is separator-aware via path.relative — a hardcoded "/" broke
 * every Windows save, where normalize() yields backslashes (issue #69) —
 * and rejects prefix-sharing siblings (`/root-evil` vs `/root`) either way.
 *
 * `p` exists for tests only: process.platform can't be flipped in a test,
 * so the win32/posix semantics are exercised by injecting path.win32 /
 * path.posix. Production callers use the host default.
 *
 * String-level only — does NOT resolve symlinks; pair with
 * isRealPathWithinRoot() before any actual read/write.
 */
export function assertWithinRoot(
  resolvedPath: string,
  projectRoot: string,
  p: Pick<typeof nodePath, "normalize" | "relative" | "isAbsolute" | "sep"> = nodePath,
): void {
  const rel = p.relative(p.normalize(projectRoot), p.normalize(resolvedPath));
  // rel === "" means the path IS the root; anything reaching the root's
  // parent ("..", "../…") or landing on another root/drive (absolute rel)
  // escapes containment.
  if (rel === ".." || rel.startsWith(`..${p.sep}`) || p.isAbsolute(rel)) {
    throw new Error("Path traversal detected: resolved path escapes project root");
  }
}

/**
 * Resolve `sourceFile` against `projectRoot` with the string-level traversal
 * checks composed in one place:
 *
 *  1. reject any ".." path segment
 *  2. resolve against the root
 *  3. assert the resolved path stays inside the root
 *
 * Returns the resolved absolute path; throws on traversal. Callers that go on
 * to read/write the path must still apply isRealPathWithinRoot() — string
 * checks alone cannot defeat symlinks.
 */
export function resolveSafe(projectRoot: string, sourceFile: string): string {
  const segments = sourceFile.split(/[/\\]/);
  if (segments.includes("..")) {
    throw new Error("Path traversal detected: sourceFile contains '..' segment");
  }
  const resolved = resolve(projectRoot, sourceFile);
  assertWithinRoot(resolved, projectRoot);
  return resolved;
}

/**
 * Resolve `candidate` through symlinks and verify its REAL location stays within
 * the (also symlink-resolved) project root. Unlike the string-only
 * assertWithinRoot, this defeats a symlink whose target escapes the root — e.g.
 * a repo shipping `styles.module.css -> ~/.ssh/authorized_keys` (issue #22).
 * Returns false when the path can't be resolved (missing/broken link).
 */
export async function isRealPathWithinRoot(
  candidate: string,
  projectRoot: string,
): Promise<boolean> {
  try {
    const realRoot = await realpath(projectRoot);
    const realCandidate = await realpath(candidate);
    return realCandidate === realRoot || realCandidate.startsWith(realRoot + sep);
  } catch {
    return false;
  }
}
