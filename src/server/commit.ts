/**
 * commit.ts — Direct file write for CSS changes
 *
 * Receives a list of { prop, from, to, sourceFile?, sourceLine? } changes,
 * finds the property in the source file using tiered search,
 * and does a surgical string replacement.
 *
 * Works for the 90% case: literal CSS values in .module.scss files.
 * Falls back gracefully for SCSS variables, calc(), etc.
 */

import { readFile, writeFile, readdir, stat } from "fs/promises";
import { resolve, join, basename } from "path";

export type CommitChange = {
  prop: string;
  from: string;
  to: string;
  sourceFile?: string;
  sourceLine?: number;
  className?: string;
  componentName?: string;
};

export type CommitResult = {
  written: string[];
  failed: Array<CommitChange & { reason: string }>;
};

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Check if a line contains a non-literal CSS value expression:
 * var(), calc(), env(), hex colors (#xxx or #xxxxxx), or SCSS $variables.
 */
function hasNonLiteralValue(line: string): boolean {
  return /\$[\w-]+/.test(line)
    || /var\s*\(/.test(line)
    || /calc\s*\(/.test(line)
    || /env\s*\(/.test(line)
    || /:\s*#[0-9a-fA-F]{3,8}\b/.test(line);
}

// --- File resolution ---

const EXCLUDE_DIRS = new Set([
  "node_modules", ".next", "dist", ".git", "build", "out", ".turbo",
]);

/**
 * Recursively search for a file by basename, excluding common build dirs.
 * Returns the first match, preferring paths that contain the componentName.
 */
async function findFileRecursive(
  dir: string,
  target: string,
  componentHint?: string
): Promise<string[]> {
  const results: string[] = [];
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (EXCLUDE_DIRS.has(entry.name)) continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        results.push(...await findFileRecursive(full, target, componentHint));
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
 * - Full/relative paths that exist → return directly
 * - Bare filenames → recursive search from projectRoot
 * - Component name hint → try ComponentName.module.scss / .module.css
 */
export async function resolveSourceFile(
  projectRoot: string,
  sourceFile: string,
  componentName?: string
): Promise<string | null> {
  // Try direct resolution first
  const direct = resolve(projectRoot, sourceFile);
  try {
    await stat(direct);
    return direct;
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

  return null;
}

// --- Property search (tiered) ---

type FindResult = {
  lineIdx: number;
  strategy: "window" | "class-block" | "full-file" | "fuzzy";
};

/**
 * Search for a CSS property near the expected line (±windowSize).
 */
function searchWindow(
  lines: string[],
  targetLine: number,
  prop: string,
  value: string,
  windowSize = 5
): number | null {
  const start = Math.max(0, targetLine - windowSize);
  const end = Math.min(lines.length - 1, targetLine + windowSize);

  for (let i = start; i <= end; i++) {
    if (lines[i].includes(prop) && (lines[i].includes(value) || hasNonLiteralValue(lines[i]))) {
      return i;
    }
  }
  return null;
}

/**
 * Find a CSS class block (`.className { ... }`) and search within it.
 */
function searchClassBlock(
  lines: string[],
  className: string,
  prop: string,
  value: string
): number | null {
  // Find the opening line of the class block
  const classPattern = new RegExp(
    `\\.${escapeRegex(className)}\\s*[{,]`
  );

  for (let i = 0; i < lines.length; i++) {
    if (!classPattern.test(lines[i])) continue;

    // Found the class — track braces to find the block extent
    let depth = 0;
    let blockStart = i;

    // Find the opening brace (might be on same line or next)
    for (let j = i; j < lines.length && j < i + 3; j++) {
      if (lines[j].includes("{")) {
        blockStart = j;
        break;
      }
    }

    // Count from blockStart
    for (let j = blockStart; j < lines.length; j++) {
      for (const ch of lines[j]) {
        if (ch === "{") depth++;
        if (ch === "}") depth--;
      }

      // Search within the block for our property
      if (j > blockStart && depth >= 0) {
        if (lines[j].includes(prop) && (lines[j].includes(value) || hasNonLiteralValue(lines[j]))) {
          return j;
        }
      }

      if (depth <= 0 && j > blockStart) break;
    }
  }

  return null;
}

/**
 * Search the entire file for `prop` + `value`.
 */
function searchFullFile(
  lines: string[],
  prop: string,
  value: string
): number | null {
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(prop) && (lines[i].includes(value) || hasNonLiteralValue(lines[i]))) {
      return i;
    }
  }
  return null;
}

/**
 * Fuzzy search: find any line with just the property name.
 * Last resort — handles variables, calc(), etc.
 */
function searchFuzzy(
  lines: string[],
  prop: string
): number | null {
  const pattern = new RegExp(`${escapeRegex(prop)}\\s*:`);
  for (let i = 0; i < lines.length; i++) {
    if (pattern.test(lines[i])) return i;
  }
  return null;
}

/**
 * Search for a custom property definition within a :root or [data-theme] block.
 */
function searchRootBlock(
  lines: string[],
  prop: string,
  value: string
): number | null {
  // Look for :root { or [data-theme] { blocks
  const rootPattern = /^\s*(:root|\[data-theme[^\]]*\])\s*\{/;

  for (let i = 0; i < lines.length; i++) {
    if (!rootPattern.test(lines[i])) continue;

    // Found the block — search within it
    let depth = 0;
    for (let j = i; j < lines.length; j++) {
      for (const ch of lines[j]) {
        if (ch === "{") depth++;
        if (ch === "}") depth--;
      }

      if (j > i && depth >= 0) {
        if (lines[j].includes(prop)) {
          return j;
        }
      }

      if (depth <= 0 && j > i) break;
    }
  }

  return null;
}

/**
 * Tiered search for a CSS property in a file.
 * Tries increasingly broad strategies until a match is found.
 */
export function findPropertyInFile(
  lines: string[],
  prop: string,
  value: string,
  sourceLine?: number,
  className?: string
): FindResult | null {
  // Tier 1: Window search (if we have a reliable line number)
  if (sourceLine != null && sourceLine > 0) {
    const idx = searchWindow(lines, sourceLine, prop, value);
    if (idx != null) return { lineIdx: idx, strategy: "window" };
  }

  // Tier 1.5: For custom properties (--*), search :root and theme blocks first
  if (prop.startsWith("--")) {
    const idx = searchRootBlock(lines, prop, value);
    if (idx != null) return { lineIdx: idx, strategy: "class-block" };
  }

  // Tier 2: Class-scoped search (if we know the CSS class)
  if (className) {
    const idx = searchClassBlock(lines, className, prop, value);
    if (idx != null) return { lineIdx: idx, strategy: "class-block" };
  }

  // Tier 3: Full-file search (prop + value anywhere)
  {
    const idx = searchFullFile(lines, prop, value);
    if (idx != null) return { lineIdx: idx, strategy: "full-file" };
  }

  // Tier 4: Fuzzy search (prop name only — handles variables)
  {
    const idx = searchFuzzy(lines, prop);
    if (idx != null) return { lineIdx: idx, strategy: "fuzzy" };
  }

  return null;
}

export async function handleCommit(
  changes: CommitChange[],
  cwd?: string
): Promise<CommitResult> {
  const projectRoot = cwd ?? process.cwd();
  const result: CommitResult = { written: [], failed: [] };

  // Group changes by file to batch writes
  const changesByFile = new Map<string, CommitChange[]>();
  for (const change of changes) {
    if (!change.sourceFile) {
      result.failed.push({ ...change, reason: "no source file specified" });
      continue;
    }
    const existing = changesByFile.get(change.sourceFile) ?? [];
    existing.push(change);
    changesByFile.set(change.sourceFile, existing);
  }

  for (const [sourceFile, fileChanges] of changesByFile) {
    try {
      // Resolve the actual file path (handles bare filenames)
      const filePath = await resolveSourceFile(
        projectRoot,
        sourceFile,
        fileChanges[0]?.componentName
      );

      if (!filePath) {
        for (const change of fileChanges) {
          result.failed.push({
            ...change,
            reason: `file not found: "${sourceFile}"`,
          });
        }
        continue;
      }

      const source = await readFile(filePath, "utf-8");
      let lines = source.split("\n");
      let modified = false;

      for (const change of fileChanges) {
        // Tiered search for the property
        const found = findPropertyInFile(
          lines,
          change.prop,
          change.from,
          change.sourceLine,
          change.className
        );

        if (!found) {
          result.failed.push({
            ...change,
            reason: `property "${change.prop}: ${change.from}" not found in ${sourceFile}`,
          });
          continue;
        }

        // Surgical replacement: only change the value, preserve everything else
        const pattern = new RegExp(
          `(${escapeRegex(change.prop)}\\s*:\\s*)${escapeRegex(change.from)}`
        );

        if (pattern.test(lines[found.lineIdx])) {
          lines[found.lineIdx] = lines[found.lineIdx].replace(
            pattern,
            `$1${change.to}`
          );
          modified = true;
        } else if (found.strategy === "fuzzy") {
          // Fuzzy match found the property but not the exact value — report it
          result.failed.push({
            ...change,
            reason: `value "${change.from}" not found literally (may be a variable)`,
          });
        } else {
          result.failed.push({
            ...change,
            reason: `value "${change.from}" not found literally on line ${found.lineIdx + 1}`,
          });
        }
      }

      if (modified) {
        await writeFile(filePath, lines.join("\n"), "utf-8");
        result.written.push(sourceFile);
      }
    } catch (err: any) {
      for (const change of fileChanges) {
        result.failed.push({
          ...change,
          reason: `file error: ${err.message}`,
        });
      }
    }
  }

  return result;
}
