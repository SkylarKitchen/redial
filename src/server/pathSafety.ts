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
 *  - collectFilesWithinRoot() / findFirstMatchingFile()
 *                           the shared recursive project walkers (issue #138) —
 *                           previously duplicated across commit.ts and
 *                           commitTailwind.ts
 */

import { readdir, realpath } from "fs/promises";
import * as nodePath from "path";
import { join, normalize, resolve, sep } from "path";

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

// ─── Shared recursive project walkers (issue #138) ───────────────────────────
// Previously three near-duplicate walkers lived in commit.ts (findCSSFiles,
// findFileRecursive) and commitTailwind.ts (findFileByClassName's inner walk).
// The two collect-style walkers unify here; the first-match walker keeps its
// own (deliberately different) semantics below.

/**
 * Recursively collect files under `dir` whose basename satisfies `matchesFile`,
 * skipping EXCLUDED_DIRS. `root` stays constant across recursion: every
 * candidate — directory before descending, file before it's ever read — must
 * have its REAL (symlink-resolved) location inside it (issues #22/#56), and a
 * joined path that escapes its own parent directory is rejected outright.
 * Platform separator, not "/" — join() emits backslashes on Windows and a
 * hardcoded slash would reject every entry there (issue #69's bug class).
 *
 * Ordering is pinned by tests downstream (`matches[0]` tie-breaking):
 *  - default: per-entry readdir order, recursion results inline (the old
 *    findFileRecursive DFS order);
 *  - `filesFirst`: all direct file hits of a directory, then each
 *    subdirectory's results in readdir order (the old findCSSFiles order).
 * Recursion runs concurrently; awaiting in entry order keeps both orders
 * byte-identical to their old sequential walks.
 */
export async function collectFilesWithinRoot(
  dir: string,
  root: string,
  matchesFile: (name: string) => boolean,
  opts: { filesFirst?: boolean } = {},
): Promise<string[]> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    // Permission error or similar — skip
    return [];
  }
  const normalizedDir = normalize(dir);

  if (opts.filesFirst) {
    const direct: string[] = [];
    const subdirs: string[] = [];
    for (const entry of entries) {
      if (EXCLUDED_DIRS.has(entry.name)) continue;
      const full = join(dir, entry.name);
      // Ensure symlinks or unusual names don't escape the starting directory.
      if (!normalize(full).startsWith(normalizedDir + sep)) continue;
      if (entry.isDirectory()) {
        if (await isRealPathWithinRoot(full, root)) subdirs.push(full);
      } else if (matchesFile(entry.name)) {
        if (await isRealPathWithinRoot(full, root)) direct.push(full);
      }
    }
    // Recurse into subdirectories concurrently; concat preserves walk order.
    const nested = await Promise.all(
      subdirs.map((d) => collectFilesWithinRoot(d, root, matchesFile, opts)),
    );
    return direct.concat(...nested);
  }

  // Each entry needs a realpath check (and directories a recursive walk) —
  // run them concurrently. Awaiting in entry order keeps the result list
  // byte-identical to the old sequential DFS, so `matches[0]` tie-breaking
  // downstream is unaffected.
  const perEntry = await Promise.all(entries.map(async (entry): Promise<string[]> => {
    if (EXCLUDED_DIRS.has(entry.name)) return [];
    const full = join(dir, entry.name);
    // Ensure symlinks or unusual names don't escape the starting directory.
    if (!normalize(full).startsWith(normalizedDir + sep)) return [];
    if (entry.isDirectory()) {
      // Only descend into real in-root directories — never follow a symlinked
      // directory whose target lies outside the project root.
      if (await isRealPathWithinRoot(full, root)) {
        return collectFilesWithinRoot(full, root, matchesFile, opts);
      }
    } else if (matchesFile(entry.name)) {
      // A name match is only accepted if its real location is in-root, so a
      // symlinked-out file masquerading as a stylesheet is rejected.
      if (await isRealPathWithinRoot(full, root)) {
        return [full];
      }
    }
    return [];
  }));
  return perEntry.flat();
}

/**
 * Depth-first first-match walker (commitTailwind's className fallback walk).
 * Deliberately different semantics from collectFilesWithinRoot, preserved
 * exactly: symlink defense is Dirent-level (`isSymbolicLink()` on directories,
 * no realpath), `priorityDirs` are visited before other directories, and each
 * directory checks its own files (via the async `accept` predicate, which
 * typically reads the file) before descending. Returns the first ABSOLUTE
 * path accepted, or null.
 */
export async function findFirstMatchingFile(
  dir: string,
  opts: {
    /** Cheap name-level filter (e.g. extension check) run before `accept`. */
    fileFilter: (name: string) => boolean;
    /** Directory names visited first at each level (a hint, not a restriction). */
    priorityDirs?: ReadonlySet<string>;
    /** Content-level acceptance test; receives the absolute file path. */
    accept: (filePath: string) => Promise<boolean>;
  },
): Promise<string | null> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch { return null; }

  // Visit prioritized source directories first, then files, then the rest.
  const dirs = entries.filter((e) => e.isDirectory() && !e.isSymbolicLink() && !EXCLUDED_DIRS.has(e.name));
  const pd = opts.priorityDirs;
  if (pd) {
    dirs.sort((a, b) => Number(pd.has(b.name)) - Number(pd.has(a.name)));
  }
  const files = entries.filter((e) => e.isFile());

  for (const entry of files) {
    if (!opts.fileFilter(entry.name)) continue;
    const filePath = join(dir, entry.name);
    if (await opts.accept(filePath)) return filePath;
  }

  for (const entry of dirs) {
    const found = await findFirstMatchingFile(join(dir, entry.name), opts);
    if (found) return found;
  }
  return null;
}
