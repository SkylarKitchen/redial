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
import { resolve, join, basename, normalize } from "path";

/** Valid pseudo-class states — rejects anything not on this list to prevent CSS injection. */
const VALID_STATES = new Set([
  "hover", "focus", "active", "visited",
  "focus-within", "focus-visible", "first-child", "last-child",
]);

/**
 * Ensure a resolved path is contained within the project root.
 * Prevents path traversal attacks (e.g. "../../etc/cron.d/malicious").
 */
function assertWithinRoot(resolvedPath: string, projectRoot: string): void {
  const normalizedRoot = normalize(projectRoot);
  const normalizedPath = normalize(resolvedPath);
  if (!normalizedPath.startsWith(normalizedRoot + "/") && normalizedPath !== normalizedRoot) {
    throw new Error("Path traversal detected: resolved path escapes project root");
  }
}

export type CommitChange = {
  prop: string;
  from: string;
  to: string;
  sourceFile?: string;
  sourceLine?: number;
  className?: string;
  componentName?: string;
  /** CSS pseudo-class state (e.g. "hover", "focus"). When set, targets
   *  the `.className:state { }` block instead of the base class block. */
  state?: string;
};

export type CommitResult = {
  written: string[];
  failed: Array<CommitChange & { reason: string }>;
};

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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
      // Ensure symlinks or unusual names don't escape the starting directory
      const normalizedFull = normalize(full);
      const normalizedDir = normalize(dir);
      if (!normalizedFull.startsWith(normalizedDir + "/")) continue;
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
  // Reject path traversal attempts early
  const segments = sourceFile.split(/[/\\]/);
  if (segments.includes("..")) {
    throw new Error("Path traversal detected: sourceFile contains '..' segment");
  }

  // Try direct resolution first
  const direct = resolve(projectRoot, sourceFile);
  assertWithinRoot(direct, projectRoot);
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
    if (lines[i].includes(prop) && (lines[i].includes(value) || /\$[\w-]+/.test(lines[i]))) {
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
        if (lines[j].includes(prop) && (lines[j].includes(value) || /\$[\w-]+/.test(lines[j]))) {
          return j;
        }
      }

      if (depth <= 0 && j > blockStart) break;
    }
  }

  return null;
}

/**
 * Find a CSS pseudo-class block (`.className:hover { ... }`) and search within it.
 */
function searchPseudoClassBlock(
  lines: string[],
  className: string,
  state: string,
  prop: string,
  value: string
): number | null {
  const pseudoPattern = new RegExp(
    `\\.${escapeRegex(className)}:${escapeRegex(state)}\\s*\\{`
  );

  for (let i = 0; i < lines.length; i++) {
    if (!pseudoPattern.test(lines[i])) continue;

    // Found the pseudo-class block — track braces to find extent
    let depth = 0;
    for (let j = i; j < lines.length; j++) {
      for (const ch of lines[j]) {
        if (ch === "{") depth++;
        if (ch === "}") depth--;
      }

      if (j > i && depth >= 0) {
        if (lines[j].includes(prop) && (lines[j].includes(value) || /\$[\w-]+/.test(lines[j]))) {
          return j;
        }
      }

      if (depth <= 0 && j > i) break;
    }
  }

  return null;
}

/**
 * Search for a CSS property inside a nested SCSS pseudo-class block.
 * Matches `&:hover {` inside `.className { }`.
 */
function searchNestedPseudoBlock(
  lines: string[],
  className: string,
  state: string,
  prop: string,
  value: string
): number | null {
  const classPattern = new RegExp(
    `\\.${escapeRegex(className)}\\s*\\{`
  );
  const nestedPattern = new RegExp(
    `&:${escapeRegex(state)}\\s*\\{`
  );

  for (let i = 0; i < lines.length; i++) {
    // Skip flat pseudo-class lines (e.g. .btn:hover)
    if (lines[i].includes(":")) {
      const pseudoCheck = new RegExp(`\\.${escapeRegex(className)}:\\w`);
      if (pseudoCheck.test(lines[i])) continue;
    }

    if (!classPattern.test(lines[i])) continue;

    // Found parent class — scan within the block for &:state
    let depth = 0;
    for (let j = i; j < lines.length; j++) {
      for (const ch of lines[j]) {
        if (ch === "{") depth++;
        if (ch === "}") depth--;
      }

      if (j > i && depth >= 1 && nestedPattern.test(lines[j])) {
        // Found &:state sub-block — search within it
        let subDepth = 0;
        for (let k = j; k < lines.length; k++) {
          for (const ch of lines[k]) {
            if (ch === "{") subDepth++;
            if (ch === "}") subDepth--;
          }

          if (k > j && subDepth >= 0) {
            if (lines[k].includes(prop) && (lines[k].includes(value) || /\$[\w-]+/.test(lines[k]))) {
              return k;
            }
          }

          if (subDepth <= 0 && k > j) break;
        }
      }

      if (depth <= 0 && j > i) break;
    }
  }

  return null;
}

/**
 * Find the end of a CSS class block (closing `}`) for `.className { ... }`.
 * Used to know where to insert a new pseudo-class block after the base class.
 */
function findClassBlockEnd(
  lines: string[],
  className: string
): number | null {
  const classPattern = new RegExp(
    `\\.${escapeRegex(className)}\\s*\\{`
  );

  for (let i = 0; i < lines.length; i++) {
    // Skip pseudo-class blocks — we want the base class
    if (lines[i].includes(":")) {
      const pseudoCheck = new RegExp(
        `\\.${escapeRegex(className)}:\\w`
      );
      if (pseudoCheck.test(lines[i])) continue;
    }

    if (!classPattern.test(lines[i])) continue;

    // Found the base class — track braces to find the closing `}`
    let depth = 0;
    for (let j = i; j < lines.length; j++) {
      for (const ch of lines[j]) {
        if (ch === "{") depth++;
        if (ch === "}") depth--;
      }
      if (depth <= 0 && j >= i) return j;
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
    if (lines[i].includes(prop) && (lines[i].includes(value) || /\$[\w-]+/.test(lines[i]))) {
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

// --- Shorthand property fallback ---

/** Maps CSS longhands to their shorthand parent + clockwise index. */
const LONGHAND_TO_SHORTHAND: Record<string, { shorthand: string; index: number }> = {
  "padding-top":    { shorthand: "padding", index: 0 },
  "padding-right":  { shorthand: "padding", index: 1 },
  "padding-bottom": { shorthand: "padding", index: 2 },
  "padding-left":   { shorthand: "padding", index: 3 },
  "margin-top":     { shorthand: "margin", index: 0 },
  "margin-right":   { shorthand: "margin", index: 1 },
  "margin-bottom":  { shorthand: "margin", index: 2 },
  "margin-left":    { shorthand: "margin", index: 3 },
  "border-top-left-radius":     { shorthand: "border-radius", index: 0 },
  "border-top-right-radius":    { shorthand: "border-radius", index: 1 },
  "border-bottom-right-radius": { shorthand: "border-radius", index: 2 },
  "border-bottom-left-radius":  { shorthand: "border-radius", index: 3 },
  "row-gap":    { shorthand: "gap", index: 0 },
  "column-gap": { shorthand: "gap", index: 1 },
};

/**
 * Expand a CSS shorthand value into individual sub-values per the CSS spec.
 * count=4: padding/margin/border-radius (1→4, 2→4, 3→4, 4→4)
 * count=2: gap (1→2, 2→2)
 */
function expandShorthandValues(rawValue: string, count: 2 | 4): string[] | null {
  const parts = rawValue.trim().split(/\s+/);

  if (count === 2) {
    if (parts.length === 1) return [parts[0], parts[0]];
    if (parts.length === 2) return [parts[0], parts[1]];
    return null;
  }

  // count === 4
  if (parts.length === 1) return [parts[0], parts[0], parts[0], parts[0]];
  if (parts.length === 2) return [parts[0], parts[1], parts[0], parts[1]];
  if (parts.length === 3) return [parts[0], parts[1], parts[2], parts[1]];
  if (parts.length === 4) return [parts[0], parts[1], parts[2], parts[3]];
  return null;
}

/**
 * Collapse expanded sub-values back to the shortest valid CSS shorthand form.
 */
function collapseShorthand(expanded: string[], count: 2 | 4): string {
  if (count === 2) {
    if (expanded[0] === expanded[1]) return expanded[0];
    return `${expanded[0]} ${expanded[1]}`;
  }

  const [top, right, bottom, left] = expanded;
  if (top === right && right === bottom && bottom === left) return top;
  if (top === bottom && right === left) return `${top} ${right}`;
  if (right === left) return `${top} ${right} ${bottom}`;
  return `${top} ${right} ${bottom} ${left}`;
}

/**
 * Like searchClassBlock but matches property name only (no value check).
 * Uses exact-match regex to avoid matching longhand variants.
 */
function searchClassBlockFuzzy(
  lines: string[],
  className: string,
  prop: string
): number | null {
  const classPattern = new RegExp(
    `\\.${escapeRegex(className)}\\s*[{,]`
  );
  const propPattern = new RegExp(`${escapeRegex(prop)}\\s*:`);

  for (let i = 0; i < lines.length; i++) {
    if (!classPattern.test(lines[i])) continue;

    let depth = 0;
    let blockStart = i;
    for (let j = i; j < lines.length && j < i + 3; j++) {
      if (lines[j].includes("{")) { blockStart = j; break; }
    }

    for (let j = blockStart; j < lines.length; j++) {
      for (const ch of lines[j]) {
        if (ch === "{") depth++;
        if (ch === "}") depth--;
      }

      if (j > blockStart && depth >= 0) {
        if (propPattern.test(lines[j])) return j;
      }

      if (depth <= 0 && j > blockStart) break;
    }
  }

  return null;
}

/**
 * Try to find and rewrite a CSS shorthand property when the longhand isn't found directly.
 * e.g., `padding-top` → finds `padding: 16px 24px`, expands, replaces sub-value, collapses.
 */
function tryShorthandFallback(
  lines: string[],
  prop: string,
  from: string,
  to: string,
  _sourceLine?: number,
  className?: string
): { lineIdx: number; replacementLine: string } | null {
  const mapping = LONGHAND_TO_SHORTHAND[prop];
  if (!mapping) return null;

  // Find the shorthand line (class-scoped first, then file-wide)
  let lineIdx: number | null = null;
  if (className) {
    lineIdx = searchClassBlockFuzzy(lines, className, mapping.shorthand);
  }
  if (lineIdx == null) {
    lineIdx = searchFuzzy(lines, mapping.shorthand);
  }
  if (lineIdx == null) return null;

  const line = lines[lineIdx];

  // Guard: bail if line contains SCSS variable
  if (/\$[\w-]/.test(line)) return null;

  // Extract the value portion
  const valueMatch = line.match(
    new RegExp(`${escapeRegex(mapping.shorthand)}\\s*:\\s*([^;!}]+)`)
  );
  if (!valueMatch) return null;

  const rawValue = valueMatch[1].trim();
  const count = mapping.shorthand === "gap" ? 2 : 4;
  const expanded = expandShorthandValues(rawValue, count);
  if (!expanded) return null;

  // Validate: the sub-value at the index must match the `from` value
  if (expanded[mapping.index] !== from) return null;

  // Reconstruct
  expanded[mapping.index] = to;
  const collapsed = collapseShorthand(expanded, count);

  const replacementLine = line.replace(
    new RegExp(`(${escapeRegex(mapping.shorthand)}\\s*:\\s*)[^;!}]+`),
    `$1${collapsed}`
  );

  return { lineIdx, replacementLine };
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
        // --- Pseudo-class state handling ---
        // When a state like "hover" is provided, target the `.className:hover { }` block
        if (change.state && change.className) {
          // Validate state against allowlist to prevent CSS injection
          if (!VALID_STATES.has(change.state)) {
            result.failed.push({
              ...change,
              reason: `invalid state "${change.state}" — not in allowlist`,
            });
            continue;
          }
          const pseudoIdx = searchPseudoClassBlock(
            lines,
            change.className,
            change.state,
            change.prop,
            change.from
          ) ?? searchNestedPseudoBlock(
            lines,
            change.className,
            change.state,
            change.prop,
            change.from
          );

          if (pseudoIdx != null) {
            // Found the property in the pseudo-class block — do surgical replacement
            const pattern = new RegExp(
              `(${escapeRegex(change.prop)}\\s*:\\s*)${escapeRegex(change.from)}`
            );
            if (pattern.test(lines[pseudoIdx])) {
              const safeValue = change.to.replace(/\$/g, "$$$$");
              lines[pseudoIdx] = lines[pseudoIdx].replace(pattern, `$1${safeValue}`);
              modified = true;
            } else {
              // Try broad replacement (handles hex vs rgb, etc.)
              const broadPattern = new RegExp(
                `(${escapeRegex(change.prop)}\\s*:\\s*)([^;!}]+)`
              );
              if (broadPattern.test(lines[pseudoIdx])) {
                const safeValue = change.to.replace(/\$/g, "$$$$");
                lines[pseudoIdx] = lines[pseudoIdx].replace(broadPattern, `$1${safeValue}`);
                modified = true;
              } else {
                result.failed.push({
                  ...change,
                  reason: `value "${change.from}" not found in .${change.className}:${change.state} block`,
                });
              }
            }
            continue;
          }

          // No existing pseudo-class block — create one
          const baseEnd = findClassBlockEnd(lines, change.className);
          if (baseEnd != null) {
            const isNestedSCSS = lines.some(line => /&\s*[:.[]/.test(line));

            if (isNestedSCSS) {
              // Insert nested &:state block inside parent (before closing })
              const innerLine = lines[baseEnd > 0 ? baseEnd - 1 : baseEnd];
              const indent = innerLine.match(/^(\s*)/)?.[1] ?? "  ";
              const newLines = [
                "",
                `${indent}&:${change.state} {`,
                `${indent}  ${change.prop}: ${change.to};`,
                `${indent}}`,
              ];
              lines.splice(baseEnd, 0, ...newLines);
            } else {
              // Insert flat block after base class
              const baseLine = lines[baseEnd > 0 ? baseEnd - 1 : baseEnd];
              const indent = baseLine.match(/^(\s*)/)?.[1] ?? "  ";
              const newBlock = [
                "",
                `.${change.className}:${change.state} {`,
                `${indent}${change.prop}: ${change.to};`,
                "}",
              ];
              lines.splice(baseEnd + 1, 0, ...newBlock);
            }
            modified = true;
            continue;
          }

          // Can't find the base class block at all
          result.failed.push({
            ...change,
            reason: `base class ".${change.className}" not found — cannot create :${change.state} block`,
          });
          continue;
        }

        // --- Standard (non-state) property search ---
        // Tiered search for the property
        const found = findPropertyInFile(
          lines,
          change.prop,
          change.from,
          change.sourceLine,
          change.className
        );

        if (!found) {
          // Try shorthand fallback: e.g. padding-top → padding: 16px 24px
          const shorthand = tryShorthandFallback(
            lines, change.prop, change.from, change.to, change.sourceLine, change.className
          );
          if (shorthand) {
            lines[shorthand.lineIdx] = shorthand.replacementLine;
            modified = true;
            continue;
          }
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
          // Escape $ in replacement to prevent regex backreference interpretation
          const safeValue = change.to.replace(/\$/g, "$$$$");
          lines[found.lineIdx] = lines[found.lineIdx].replace(
            pattern,
            `$1${safeValue}`
          );
          modified = true;
        } else if (found.strategy === "fuzzy") {
          // Fuzzy match found the property by name but the exact from-value
          // isn't on this line. Source likely uses a different representation
          // (hex vs rgb, var() vs computed, etc.). Replace the full CSS value.

          // Guard: don't overwrite SCSS variables — they require manual editing
          const scssVarMatch = lines[found.lineIdx].match(/\$[\w-]+/);
          if (scssVarMatch) {
            result.failed.push({
              ...change,
              reason: `uses SCSS variable ${scssVarMatch[0]} — manual edit required`,
            });
          } else {
            const broadPattern = new RegExp(
              `(${escapeRegex(change.prop)}\\s*:\\s*)([^;!}]+)`
            );
            if (broadPattern.test(lines[found.lineIdx])) {
              const safeValue = change.to.replace(/\$/g, "$$$$");
              lines[found.lineIdx] = lines[found.lineIdx].replace(
                broadPattern,
                `$1${safeValue}`
              );
              modified = true;
            } else {
              result.failed.push({
                ...change,
                reason: `value "${change.from}" not found literally (may be a variable)`,
              });
            }
          }
        } else {
          const lineVarMatch = lines[found.lineIdx].match(/\$[\w-]+/);
          result.failed.push({
            ...change,
            reason: lineVarMatch
              ? `uses SCSS variable ${lineVarMatch[0]} — manual edit required`
              : `value "${change.from}" not found literally on line ${found.lineIdx + 1}`,
          });
        }
      }

      if (modified) {
        await writeFile(filePath, lines.join("\n"), "utf-8");
        if (!result.written.includes(sourceFile)) {
          result.written.push(sourceFile);
        }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      for (const change of fileChanges) {
        result.failed.push({
          ...change,
          reason: `file error: ${message}`,
        });
      }
    }
  }

  return result;
}
