/**
 * cssResolve.ts — Source-file resolution for the commit pipeline
 *
 * Maps a client-supplied source hint (bare filename, relative path, cssHref)
 * to a real file on disk, confined to the project root. Extracted from
 * commit.ts (structural split only).
 */

import { readFile, readdir, stat } from "fs/promises";
import { resolve, join, basename } from "path";
import { trySourceMapResolution } from "./sourceMapCache";
import { EXCLUDED_DIRS, isRealPathWithinRoot, resolveSafe } from "./pathSafety";

/**
 * Search the project for a CSS file that defines a custom property.
 * Used as a fallback when the client can't determine the definition site
 * (e.g., variable is in a bundled global stylesheet).
 */
export async function findVariableDefinitionFile(
  projectRoot: string,
  varName: string,
): Promise<string | null> {
  const cssFiles = await findCSSFiles(projectRoot);
  const pattern = new RegExp(`${varName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*:`);
  for (const file of cssFiles) {
    try {
      const source = await readFile(file, "utf-8");
      if (pattern.test(source)) return file;
    } catch { /* skip unreadable files */ }
  }
  return null;
}

/** Collect all CSS/SCSS files in the project (excluding node_modules etc.) */
async function findCSSFiles(dir: string): Promise<string[]> {
  const results: string[] = [];
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (EXCLUDED_DIRS.has(entry.name)) continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        results.push(...await findCSSFiles(full));
      } else if (/\.(css|scss)$/.test(entry.name)) {
        results.push(full);
      }
    }
  } catch { /* skip */ }
  return results;
}

/**
 * Recursively search for a file by basename, excluding common build dirs.
 * Symlinks are never followed (issue #22) — a symlinked dir or file could
 * point outside the project root, so the walk only sees real entries. The
 * symlink-resolved chokepoint guard in handleCommit remains the load-bearing
 * containment layer before any read/write.
 */
async function findFileRecursive(
  dir: string,
  target: string
): Promise<string[]> {
  const results: string[] = [];
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (EXCLUDED_DIRS.has(entry.name)) continue;
      if (entry.isSymbolicLink()) continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        results.push(...await findFileRecursive(full, target));
      } else if (entry.name === target) {
        results.push(full);
      }
    }
  } catch {
    // Permission error or similar — skip
  }
  return results;
}

/**
 * Resolve a source file path. Handles:
 * - Source map resolution (if cssHref is provided) → accurate file + line
 * - Full/relative paths that exist → return directly
 * - Bare filenames → recursive search from projectRoot
 * - Component name hint → try ComponentName.module.scss / .module.css
 */
export async function resolveSourceFile(
  projectRoot: string,
  sourceFile: string,
  componentName?: string,
  cssHref?: string
): Promise<string | null> {
  // Try source map resolution first (best accuracy)
  if (cssHref) {
    const mapped = trySourceMapResolution(cssHref, 1, 0, projectRoot);
    if (mapped) {
      const mappedPath = resolve(projectRoot, mapped.file);
      try {
        await stat(mappedPath);
        return mappedPath;
      } catch {
        // Mapped file doesn't exist on disk — fall through to existing logic
      }
    }
  }

  // Reject path traversal attempts early ("..": throw; string containment:
  // throw) and resolve the direct candidate confined to the root.
  const direct = resolveSafe(projectRoot, sourceFile);
  try {
    await stat(direct);
    // Reject a direct path that is a symlink escaping the root (issue #22);
    // fall through to the recursive search rather than returning it.
    if (await isRealPathWithinRoot(direct, projectRoot)) return direct;
  } catch {
    // Not found at direct path — search recursively
  }

  // Search by exact filename
  const target = basename(sourceFile);
  const matches = await findFileRecursive(projectRoot, target);

  if (matches.length === 1) return matches[0];

  if (matches.length > 1 && componentName) {
    // Prefer the match closest to the component name
    const preferred = matches.find((m) =>
      m.includes(componentName) || m.toLowerCase().includes(componentName.toLowerCase())
    );
    if (preferred) return preferred;
  }

  if (matches.length > 0) return matches[0];

  // Try variant extensions if we have a component hint
  if (componentName) {
    for (const ext of [".module.scss", ".module.css"]) {
      const variants = await findFileRecursive(projectRoot, `${componentName}${ext}`);
      if (variants.length > 0) return variants[0];
    }
  }

  // Try bare .css and .scss extensions (for global stylesheets)
  const baseName = target.replace(/\.\w+$/, "");
  if (baseName !== target) {
    for (const ext of [".css", ".scss"]) {
      const globalTarget = `${baseName}${ext}`;
      if (globalTarget === target) continue; // already tried
      const globalMatches = await findFileRecursive(projectRoot, globalTarget);
      if (globalMatches.length > 0) return globalMatches[0];
    }
  }

  return null;
}
