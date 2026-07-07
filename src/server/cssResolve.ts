/**
 * cssResolve.ts — source-file resolution for the CSS save path.
 *
 * Structural split out of commit.ts (issue #138). Owns the "which file on
 * disk does this change belong to?" question:
 *
 *  - resolveSourceFileDetailed()  the full resolution ladder, returning the
 *                                 path PLUS how confidently it was chosen
 *                                 (bugs #66/#68 stemmed from discarding that)
 *  - resolveSourceFile()          thin string|null wrapper over the above
 *  - findVariableDefinitionFile() project-wide search for a custom property's
 *                                 definition site
 *
 * All directory walking delegates to pathSafety's shared walker, which owns
 * the symlink / traversal containment (issues #22, #56, #69).
 */

import { readFile } from "fs/promises";
import { resolve, basename } from "path";
import { tryFirstMappedSourceFile } from "./sourceMapCache";
import {
  assertWithinRoot,
  isRealPathWithinRoot,
  collectFilesWithinRoot,
} from "./pathSafety";
import { escapeRegex } from "./cssMask";

/**
 * Search the project for a CSS file that defines a custom property.
 * Used as a fallback when the client can't determine the definition site
 * (e.g., variable is in a bundled global stylesheet).
 */
export async function findVariableDefinitionFile(
  projectRoot: string,
  varName: string,
): Promise<string | null> {
  const cssFiles = await findCSSFiles(projectRoot, projectRoot);
  const pattern = new RegExp(`${escapeRegex(varName)}\\s*:`);
  // Read all candidates in parallel; first match in walk order wins.
  const hits = await Promise.all(
    cssFiles.map((file) =>
      readFile(file, "utf-8").then(
        (src) => (pattern.test(src) ? file : null),
        () => null, // skip unreadable files
      ),
    ),
  );
  return hits.find((f): f is string => f !== null) ?? null;
}

/**
 * Collect all CSS/SCSS files in the project (excluding node_modules etc.).
 * Delegates to the shared containment-checked walker; `filesFirst` preserves
 * this search's historical walk order (a directory's own stylesheets before
 * its subdirectories'), which findVariableDefinitionFile's "first match in
 * walk order wins" depends on.
 */
async function findCSSFiles(dir: string, root: string): Promise<string[]> {
  return collectFilesWithinRoot(dir, root, (name) => /\.(css|scss)$/.test(name), {
    filesFirst: true,
  });
}

/**
 * Recursively search for a file by basename, excluding common build dirs.
 * `root` is the project root used to reject any match whose real (symlink-
 * resolved) location escapes it (issue #22). Per-entry DFS order is preserved
 * by the shared walker — `matches[0]` tie-breaking downstream depends on it.
 */
async function findFileRecursive(
  dir: string,
  target: string,
  root: string,
): Promise<string[]> {
  return collectFilesWithinRoot(dir, root, (name) => name === target);
}

/**
 * How a source file was resolved, from most to least trustworthy. Bugs #66
 * and #68 both came from callers discarding this and treating a low-trust
 * guess like a certainty, so the ladder's tier now travels with the path.
 */
export type ResolveStrategy =
  | "sourcemap"           // compiled-CSS source map named the file
  | "direct"              // the given path exists as-is under the root
  | "unique-basename"     // recursive basename search found exactly one file
  | "component-preferred" // several matches; componentName picked one
  | "ambiguous-first"     // several matches; fell back to the first in walk order
  | "component-variant"   // ComponentName.module.scss/.module.css probe
  | "extension-fallback"  // bare .css/.scss global-stylesheet probe
  | "variable-definition"; // project-wide custom-property definition search
                           // (findVariableDefinitionFile — set by the caller)

export type ResolvedSourceFile = {
  /** Absolute path of the chosen file. */
  path: string;
  /** Which rung of the resolution ladder produced it. */
  strategy: ResolveStrategy;
  /** high = unambiguous; medium = heuristic pick; low = arbitrary tie-break. */
  confidence: "high" | "medium" | "low";
  /** How many candidates the winning rung chose among (1 when unambiguous). */
  matchCount: number;
};

const CONFIDENCE_BY_STRATEGY: Record<ResolveStrategy, ResolvedSourceFile["confidence"]> = {
  "sourcemap": "high",
  "direct": "high",
  "unique-basename": "high",
  "component-preferred": "medium",
  "ambiguous-first": "low",
  "component-variant": "medium",
  "extension-fallback": "low",
  "variable-definition": "low",
};

function resolved(
  path: string,
  strategy: ResolveStrategy,
  matchCount = 1,
): ResolvedSourceFile {
  return { path, strategy, confidence: CONFIDENCE_BY_STRATEGY[strategy], matchCount };
}

/**
 * Resolve a source file path, reporting HOW it was resolved. Handles:
 * - Source map resolution (if cssHref is provided) → accurate file + line
 * - Full/relative paths that exist → return directly
 * - Bare filenames → recursive search from projectRoot
 * - Component name hint → try ComponentName.module.scss / .module.css
 *
 * The ladder and its tie-breaking are byte-identical to the historical
 * resolveSourceFile; only the return shape is richer.
 */
export async function resolveSourceFileDetailed(
  projectRoot: string,
  sourceFile: string,
  componentName?: string,
  cssHref?: string,
): Promise<ResolvedSourceFile | null> {
  // Try source map resolution first (best accuracy). This is a which-file
  // question, so read the map's sources list rather than probing a position —
  // Turbopack's sectioned maps leave line (1,0) unmapped (issue #59).
  if (cssHref) {
    const mapped = tryFirstMappedSourceFile(cssHref, projectRoot);
    if (mapped) {
      const mappedPath = resolve(projectRoot, mapped);
      // realpath doubles as the existence check (false for missing files), so
      // no separate stat() — and it rejects a symlinked-out mapped path too.
      if (await isRealPathWithinRoot(mappedPath, projectRoot)) {
        return resolved(mappedPath, "sourcemap");
      }
      // Mapped file doesn't exist on disk — fall through to existing logic
    }
  }

  // Reject path traversal attempts early
  const segments = sourceFile.split(/[/\\]/);
  if (segments.includes("..")) {
    throw new Error("Path traversal detected: sourceFile contains '..' segment");
  }

  // Try direct resolution first. isRealPathWithinRoot returns false both for
  // a missing file and for a symlink escaping the root (issue #22) — either
  // way we fall through to the recursive search.
  const direct = resolve(projectRoot, sourceFile);
  assertWithinRoot(direct, projectRoot);
  if (await isRealPathWithinRoot(direct, projectRoot)) {
    return resolved(direct, "direct");
  }

  // Search by exact filename
  const target = basename(sourceFile);
  const matches = await findFileRecursive(projectRoot, target, projectRoot);

  if (matches.length === 1) return resolved(matches[0], "unique-basename");

  if (matches.length > 1 && componentName) {
    // Prefer the match closest to the component name
    const preferred = matches.find((m) =>
      m.includes(componentName) || m.toLowerCase().includes(componentName.toLowerCase())
    );
    if (preferred) return resolved(preferred, "component-preferred", matches.length);
  }

  if (matches.length > 0) return resolved(matches[0], "ambiguous-first", matches.length);

  // Try variant extensions if we have a component hint
  if (componentName) {
    for (const ext of [".module.scss", ".module.css"]) {
      const variants = await findFileRecursive(projectRoot, `${componentName}${ext}`, projectRoot);
      if (variants.length > 0) {
        return resolved(variants[0], "component-variant", variants.length);
      }
    }
  }

  // Try bare .css and .scss extensions (for global stylesheets)
  const baseName = target.replace(/\.\w+$/, "");
  if (baseName !== target) {
    for (const ext of [".css", ".scss"]) {
      const globalTarget = `${baseName}${ext}`;
      if (globalTarget === target) continue; // already tried
      const globalMatches = await findFileRecursive(projectRoot, globalTarget, projectRoot);
      if (globalMatches.length > 0) {
        return resolved(globalMatches[0], "extension-fallback", globalMatches.length);
      }
    }
  }

  return null;
}

/**
 * Path-only view of resolveSourceFileDetailed — the historical contract.
 * Prefer the detailed variant in new code so resolution confidence isn't
 * silently discarded (bugs #66/#68).
 */
export async function resolveSourceFile(
  projectRoot: string,
  sourceFile: string,
  componentName?: string,
  cssHref?: string,
): Promise<string | null> {
  const res = await resolveSourceFileDetailed(projectRoot, sourceFile, componentName, cssHref);
  return res?.path ?? null;
}
