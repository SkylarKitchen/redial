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
import { trySourceMapResolution } from "./sourceMapCache";
import { EXCLUDED_DIRS, isRealPathWithinRoot, resolveSafe } from "./pathSafety";
import {
  isValidCSSProp,
  isValidCSSClassName,
  isSafeCSSValue,
  isInvalidDeclaration,
} from "../lib/css";

/**
 * Search the project for a CSS file that defines a custom property.
 * Used as a fallback when the client can't determine the definition site
 * (e.g., variable is in a bundled global stylesheet).
 */
async function findVariableDefinitionFile(
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

/** Valid pseudo-class states — rejects anything not on this list to prevent CSS injection. */
const VALID_STATES = new Set([
  "hover", "focus", "active", "visited",
  "focus-within", "focus-visible", "first-child", "last-child",
]);

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
  /** Compiled CSS href for source map resolution (e.g. "/_next/static/css/abc.css") */
  cssHref?: string;
};

export type CommitResult = {
  written: string[];
  failed: Array<CommitChange & { reason: string }>;
};

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Return a SAME-LENGTH copy of `source` with the INTERIORS of CSS comments,
 * string literals ('...' / "...") and url(...) contents replaced by spaces.
 * Newlines and the overall char/line count are preserved, so line indices and
 * column offsets computed on the mask map 1:1 back onto the original text.
 *
 * Used for ALL line-selection and brace-counting so that:
 *   - a comment that mentions `color: blue` is never mistaken for a declaration,
 *   - a `{` / `}` / `;` / prop name living inside a string or url() can't fool
 *     the brace-depth counter or the declaration matcher.
 * The actual text replacement is always applied to the ORIGINAL line.
 */
function maskCSS(source: string): string {
  const out = source.split("");
  const n = source.length;
  let i = 0;
  while (i < n) {
    const ch = source[i];
    const next = i + 1 < n ? source[i + 1] : "";

    // Block comment — mask the interior, keep the delimiters.
    if (ch === "/" && next === "*") {
      i += 2;
      while (i < n && !(source[i] === "*" && source[i + 1] === "/")) {
        if (source[i] !== "\n") out[i] = " ";
        i++;
      }
      if (i < n) i += 2; // skip the closing "*/"
      continue;
    }

    // String literal — mask the interior, keep the quotes.
    if (ch === "'" || ch === '"') {
      const quote = ch;
      i++;
      while (i < n && source[i] !== quote) {
        if (source[i] === "\\" && i + 1 < n) {
          // escaped char — mask both, preserving newline positions
          if (source[i] !== "\n") out[i] = " ";
          if (source[i + 1] !== "\n") out[i + 1] = " ";
          i += 2;
          continue;
        }
        if (source[i] !== "\n") out[i] = " ";
        i++;
      }
      if (i < n) i++; // keep the closing quote
      continue;
    }

    // url(...) — mask the (possibly brace-bearing) body. A quoted url body is
    // handled by the string branch above, so bail to it when one is found.
    if (
      (ch === "u" || ch === "U") &&
      /^url\s*\(/i.test(source.slice(i, i + 6))
    ) {
      let j = i + 3;
      while (j < n && /\s/.test(source[j])) j++;
      if (source[j] === "(") {
        i = j + 1; // keep "url("
        while (i < n && source[i] !== ")") {
          if (source[i] === "'" || source[i] === '"') break;
          if (source[i] !== "\n") out[i] = " ";
          i++;
        }
        continue;
      }
    }

    i++;
  }
  return out.join("");
}

/** Build the masked, line-split view used for all matching/brace-counting. */
function maskedLinesOf(lines: string[]): string[] {
  return maskCSS(lines.join("\n")).split("\n");
}

/**
 * Reject malformed client input before any search or write (issue #16), so a
 * crafted prop/value/className can't break out of a CSS block. Returns a
 * failure reason, or null when the change is safe to process.
 */
function changeValidationError(change: CommitChange): string | null {
  if (!isValidCSSProp(change.prop))
    return `invalid CSS property name: "${change.prop}"`;
  if (!isSafeCSSValue(change.to))
    return `unsafe CSS value (contains "{", "}", ";", "<", or newline): "${change.to}"`;
  // Semantic validity: reject `none` for props whose grammar has no `none`
  // (toggle-deselect sentinel). Shares the predicate with the live preview so
  // client and server can't drift apart.
  if (isInvalidDeclaration(change.prop, change.to))
    return `semantically invalid value "${change.to}" for property "${change.prop}"`;
  if (change.className != null && !isValidCSSClassName(change.className))
    return `invalid CSS class name: "${change.className}"`;
  return null;
}

/**
 * Build a regex that matches `prop` only at a real declaration boundary
 * (start of line, or after a `;` or `{`), with optional whitespace before the
 * colon. Prevents `color` from matching inside `background-color:` and stops a
 * declaration matcher from firing on a bare substring.
 */
function declAnchoredPropRegex(prop: string): RegExp {
  // Boundary = start-of-line (allowing indentation) OR after a `;`/`{`. This
  // anchors the match to a real declaration start so `color` can't match inside
  // `background-color:` and `--accent` can't match `--accent-dark:`.
  return new RegExp(`(?:^\\s*|[;{]\\s*)${escapeRegex(prop)}\\s*:`);
}

/**
 * Build the surgical/broad replacement regex with a LEFT boundary so `color`
 * cannot match inside `background-color`. Capture group 1 is the boundary char
 * (preserved), group 2 is the `prop:` prefix (preserved); the value that
 * follows is what gets rewritten by the caller.
 */
function replacePropRegex(prop: string, valuePattern: string): RegExp {
  return new RegExp(
    `(^|[;{\\s])(${escapeRegex(prop)}\\s*:\\s*)${valuePattern}`
  );
}

/**
 * Whether a (masked) line contains `prop` as a real declaration AND either the
 * literal `value` or an SCSS `$variable`. Used by the value-aware searches.
 */
function lineHasDecl(maskedLine: string, prop: string, value: string): boolean {
  return (
    declAnchoredPropRegex(prop).test(maskedLine) &&
    (maskedLine.includes(value) || /\$[\w-]+/.test(maskedLine))
  );
}

// --- File resolution ---

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

// --- Property search (tiered) ---

type FindResult = {
  lineIdx: number;
  strategy: "window" | "class-block" | "full-file" | "fuzzy";
  /**
   * Optional character span [start, end) on `lineIdx` to which a surgical
   * replacement must be confined. Set for minified/same-line CSS where several
   * class blocks share one physical line and an identical declaration in an
   * earlier sibling block would otherwise be rewritten (issue #47).
   */
  range?: [number, number];
};

// --- Block-extent walking (the single brace-depth implementation) ---

/**
 * A selector occurrence and its block's extent metadata, as yielded by
 * `eachBlock`. Line-granular: the depth walk that delimits the block runs via
 * `scanBlockLines` from `openLine`.
 */
type BlockExtent = {
  /** Line index where the selector regex matched. */
  selLine: number;
  /**
   * First line at/after `selLine` containing a `{` — where the brace-depth
   * walk starts. Differs from `selLine` for multi-line selector lists.
   */
  openLine: number;
  /**
   * Char span [start, end) of the block BODY on `selLine` — the region between
   * the block's opening `{` and its matching `}` — present only when both sit
   * on that one physical line (minified/same-line CSS). Used to confine a
   * surgical replacement to the targeted block so an identical declaration in
   * an earlier sibling block on the same line isn't rewritten (issue #47).
   */
  bodyRange?: [number, number];
};

/**
 * A scanner hit: the matched declaration's line plus the optional issue-#47
 * confinement span (set when the hit line is a minified same-line block).
 */
type BlockHit = {
  lineIdx: number;
  range?: [number, number];
};

/**
 * Yield a BlockExtent for every line on which `selectorRe` matches (first
 * match per line). Candidates whose opening `{` never appears are skipped.
 * `maskedLines` must be the masked view so braces in strings/comments/url()
 * can't fool the extent computation.
 */
function* eachBlock(
  maskedLines: string[],
  selectorRe: RegExp
): Generator<BlockExtent> {
  for (let i = 0; i < maskedLines.length; i++) {
    const m = selectorRe.exec(maskedLines[i]);
    if (!m) continue;

    // Find the opening brace (might be on the same line or several lines
    // below, e.g. a multi-line selector list). Scan until the first '{',
    // no fixed cap.
    let openLine = -1;
    for (let j = i; j < maskedLines.length; j++) {
      if (maskedLines[j].includes("{")) {
        openLine = j;
        break;
      }
    }
    if (openLine === -1) continue;

    yield {
      selLine: i,
      openLine,
      bodyRange: bodyRangeOnLine(maskedLines[i], m.index),
    };
  }
}

/**
 * Char-accurate body span for a block that opens AND closes on one physical
 * line: from the first `{` at/after `fromCol`, walk char-level brace depth to
 * the matching `}`. Returns [openCol + 1, closeCol) — the body between the
 * braces — or undefined when no `{` follows `fromCol` or the block doesn't
 * close on this line.
 */
function bodyRangeOnLine(
  maskedLine: string,
  fromCol: number
): [number, number] | undefined {
  const braceIdx = maskedLine.indexOf("{", fromCol);
  if (braceIdx === -1) return undefined;
  let depth = 0;
  for (let k = braceIdx; k < maskedLine.length; k++) {
    if (maskedLine[k] === "{") depth++;
    else if (maskedLine[k] === "}") {
      depth--;
      if (depth === 0) return [braceIdx + 1, k];
    }
  }
  return undefined; // block doesn't close on this line
}

/**
 * THE line-granular brace-depth walk — every block scanner is a consumer.
 * Starting at `openLine`, count net brace depth line-by-line on the masked
 * view and call `visit(lineIdx, depthAfter)` for each line, where
 * `depthAfter` is the depth after all braces on that line are counted. The
 * walk stops when `visit` returns a non-null line index (returned to the
 * caller) or after visiting the first line PAST `openLine` on which depth has
 * returned to <= 0 (the block's closing line). Returns null when the walk
 * ends without a hit (including an unbalanced block running to EOF).
 *
 * Note the visit-then-stop order: the closing line itself IS visited, and for
 * a block that opens and closes on `openLine` (net depth 0) the following
 * line is visited too — quirks of the original hand-rolled scanners,
 * preserved exactly.
 */
function scanBlockLines(
  maskedLines: string[],
  openLine: number,
  visit: (lineIdx: number, depthAfter: number) => number | null
): number | null {
  let depth = 0;
  for (let j = openLine; j < maskedLines.length; j++) {
    for (const ch of maskedLines[j]) {
      if (ch === "{") depth++;
      if (ch === "}") depth--;
    }
    const hit = visit(j, depth);
    if (hit != null) return hit;
    if (depth <= 0 && j > openLine) break;
  }
  return null;
}

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

  // First pass: prefer an EXACT (prop + value) declaration anywhere in the
  // window so a false positive earlier in the window can't win over the real
  // declaration at the supplied sourceLine.
  for (let i = start; i <= end; i++) {
    if (declAnchoredPropRegex(prop).test(lines[i]) && lines[i].includes(value)) {
      return i;
    }
  }
  // Second pass: SCSS-variable lines (value can't be matched literally).
  for (let i = start; i <= end; i++) {
    if (declAnchoredPropRegex(prop).test(lines[i]) && /\$[\w-]+/.test(lines[i])) {
      return i;
    }
  }
  return null;
}

/**
 * Find a CSS class block (`.className { ... }`) and search within it.
 * Returns the hit line plus, when the block opens AND closes on that same
 * physical line (minified CSS), the char span of the block's body to which a
 * surgical replacement must be confined (issue #47).
 */
function searchClassBlock(
  lines: string[],
  className: string,
  prop: string,
  value: string
): BlockHit | null {
  const classPattern = new RegExp(
    `\\.${escapeRegex(className)}\\s*[{,]`
  );

  for (const block of eachBlock(lines, classPattern)) {
    // Search within the block for our property. The opening-brace line itself
    // is inspected too (depthAfter >= 0 includes it), so an all-on-one-line
    // minified block whose declaration shares the line with the `{` is found
    // rather than skipped (issue #47); a multi-line selector line carries no
    // `prop: value`, so this is a no-op there.
    const idx = scanBlockLines(lines, block.openLine, (j, depth) =>
      depth >= 0 && lineHasDecl(lines[j], prop, value) ? j : null
    );
    if (idx != null) {
      return {
        lineIdx: idx,
        range: idx === block.selLine ? block.bodyRange : undefined,
      };
    }
  }

  return null;
}

/**
 * For minified/same-line CSS, return the character span [start, end) of the
 * BODY of `.className { ... }` on a single physical line — the region between
 * the block's opening `{` and its matching `}`. Used to confine a surgical
 * replacement to the targeted block so an identical declaration in an earlier
 * sibling block on the same line isn't rewritten (issue #47). The selector may
 * include a pseudo-state suffix (e.g. "btn:hover"). Returns undefined when the
 * selector/brace aren't present or the block doesn't close on this one line.
 */
function classBlockBodyRangeOnLine(
  maskedLine: string,
  className: string
): [number, number] | undefined {
  const classRe = new RegExp(`\\.${escapeRegex(className)}\\s*\\{`);
  const m = classRe.exec(maskedLine);
  if (!m) return undefined;
  const braceIdx = maskedLine.indexOf("{", m.index);
  if (braceIdx === -1) return undefined;
  let depth = 0;
  for (let k = braceIdx; k < maskedLine.length; k++) {
    if (maskedLine[k] === "{") depth++;
    else if (maskedLine[k] === "}") {
      depth--;
      if (depth === 0) return [braceIdx + 1, k]; // body between the braces
    }
  }
  return undefined; // block doesn't close on this line
}

/**
 * Rewrite `prop: from` → `prop: to` within `line`, confined to the character
 * span `range` [start, end). The single declaration-rewrite implementation
 * shared by the pseudo-state and standard branches of handleCommit. Tries a
 * surgical replacement (exact `from` value) first; when `broad` is allowed,
 * falls back to replacing whatever value the property currently has (handles
 * hex vs rgb, var(), etc.). Returns the updated line, or null when no
 * declaration matched inside the range (issue #47: the range keeps an
 * identical declaration in a sibling block on the same minified line intact).
 */
function replaceDeclInLine(
  line: string,
  prop: string,
  from: string,
  to: string,
  range: [number, number] = [0, line.length],
  broad = true
): string | null {
  const [start, end] = range;
  const segment = line.slice(start, end);
  // Escape $ in replacement to prevent regex backreference interpretation
  const safeValue = to.replace(/\$/g, "$$$$");

  const surgical = replacePropRegex(prop, escapeRegex(from));
  if (surgical.test(segment)) {
    return (
      line.slice(0, start) +
      segment.replace(surgical, `$1$2${safeValue}`) +
      line.slice(end)
    );
  }

  if (broad) {
    const broadPattern = replacePropRegex(prop, "([^;!}]+)");
    if (broadPattern.test(segment)) {
      return (
        line.slice(0, start) +
        segment.replace(broadPattern, `$1$2${safeValue}`) +
        line.slice(end)
      );
    }
  }

  return null;
}

/**
 * Find a CSS pseudo-class block (`.className:hover { ... }`) and search within
 * it. Returns the hit line plus, for a minified same-line block, the char span
 * of the block's body to confine the replacement to (issue #47, pseudo branch).
 */
function searchPseudoClassBlock(
  lines: string[],
  className: string,
  state: string,
  prop: string,
  value: string
): BlockHit | null {
  const pseudoPattern = new RegExp(
    `\\.${escapeRegex(className)}:${escapeRegex(state)}\\s*\\{`
  );

  for (const block of eachBlock(lines, pseudoPattern)) {
    // The opening-brace line itself is inspected too (depthAfter >= 0 includes
    // it), so an all-on-one-line minified pseudo block whose declaration shares
    // the line with the `{` is found rather than skipped — and the scan can't
    // fall through to a later sibling block's identical declaration (issue #47,
    // pseudo branch).
    const idx = scanBlockLines(lines, block.openLine, (j, depth) =>
      depth >= 0 && lineHasDecl(lines[j], prop, value) ? j : null
    );
    if (idx != null) {
      return {
        lineIdx: idx,
        range: idx === block.selLine ? block.bodyRange : undefined,
      };
    }
  }

  return null;
}

/**
 * Search for a CSS property inside a nested SCSS pseudo-class block.
 * Matches `&:hover {` inside `.className { }`. Never produces a confinement
 * range — nested SCSS hit lines are plain declaration lines.
 */
function searchNestedPseudoBlock(
  lines: string[],
  className: string,
  state: string,
  prop: string,
  value: string
): BlockHit | null {
  const classPattern = new RegExp(
    `\\.${escapeRegex(className)}\\s*\\{`
  );
  const nestedPattern = new RegExp(
    `&:${escapeRegex(state)}\\s*\\{`
  );
  const pseudoCheck = new RegExp(`\\.${escapeRegex(className)}:\\w`);

  for (const block of eachBlock(lines, classPattern)) {
    // Skip flat pseudo-class lines (e.g. .btn:hover)
    if (pseudoCheck.test(lines[block.selLine])) continue;

    // Found parent class — scan within the block for &:state
    const idx = scanBlockLines(lines, block.openLine, (j, depth) => {
      if (j > block.openLine && depth >= 1 && nestedPattern.test(lines[j])) {
        // Found &:state sub-block — search within it with its own depth walk.
        // The `&:state {` line itself is NOT inspected (k > j), as before.
        return scanBlockLines(lines, j, (k, subDepth) =>
          k > j && subDepth >= 0 && lineHasDecl(lines[k], prop, value)
            ? k
            : null
        );
      }
      return null;
    });
    if (idx != null) return { lineIdx: idx };
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
  const pseudoCheck = new RegExp(`\\.${escapeRegex(className)}:\\w`);

  for (const block of eachBlock(lines, classPattern)) {
    // Skip pseudo-class blocks — we want the base class
    if (pseudoCheck.test(lines[block.selLine])) continue;

    // Found the base class — the closing `}` is the first line on which the
    // depth returns to <= 0 (the open line itself for a one-line block). An
    // unbalanced block (depth never closes) falls through to the next
    // candidate, as before.
    const end = scanBlockLines(lines, block.openLine, (j, depth) =>
      depth <= 0 ? j : null
    );
    if (end != null) return end;
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
    if (lineHasDecl(lines[i], prop, value)) {
      return i;
    }
  }
  return null;
}

/**
 * Fuzzy search: find any line with just the property name (as a real
 * declaration). Last resort — handles variables, calc(), etc.
 */
function searchFuzzy(
  lines: string[],
  prop: string
): number | null {
  const pattern = declAnchoredPropRegex(prop);
  for (let i = 0; i < lines.length; i++) {
    if (pattern.test(lines[i])) return i;
  }
  return null;
}

/**
 * Search for a custom property definition within a :root or [data-theme] block.
 * Also handles :root blocks nested inside @layer blocks.
 */
function searchRootBlock(
  lines: string[],
  prop: string,
  value: string
): number | null {
  // Look for :root { or [data-theme] { blocks (possibly nested inside @layer)
  const rootPattern = /^\s*(:root|\[data-theme[^\]]*\])\s*\{/;
  const layerPattern = /^\s*@layer\b[^{]*\{/;

  // Collect every candidate declaration line across all root-like blocks so we
  // can value-disambiguate (root cause C): two root-like blocks may both define
  // `prop`, and editing the dark value must not rewrite the light block.
  const candidates: number[] = [];
  const collect = (start: number) => {
    const idx = searchWithinRootBlock(lines, start, prop);
    if (idx != null) candidates.push(idx);
  };

  for (let i = 0; i < lines.length; i++) {
    // Direct :root / [data-theme] block
    if (rootPattern.test(lines[i])) {
      collect(i);
      continue;
    }

    // @layer block — scan inside for :root blocks
    if (layerPattern.test(lines[i])) {
      let layerDepth = 0;
      for (let j = i; j < lines.length; j++) {
        for (const ch of lines[j]) {
          if (ch === "{") layerDepth++;
          if (ch === "}") layerDepth--;
        }

        if (j > i && layerDepth >= 1 && rootPattern.test(lines[j])) {
          collect(j);
        }

        if (layerDepth <= 0 && j > i) break;
      }
    }
  }

  if (candidates.length === 0) return null;
  // Prefer the block whose declared value matches the requested `value`; fall
  // back to the first candidate when none match (e.g. hex vs computed rgb).
  const valueMatch = candidates.find((idx) => lines[idx].includes(value));
  return valueMatch ?? candidates[0];
}

/**
 * Search within a :root or [data-theme] block starting at line `start` for a
 * custom property. Matches at a real declaration boundary so `--accent` cannot
 * match `--accent-dark` (prefix collision) and a comment mentioning the prop is
 * skipped (the caller passes masked lines).
 */
function searchWithinRootBlock(
  lines: string[],
  start: number,
  prop: string
): number | null {
  const propPattern = declAnchoredPropRegex(prop);
  let depth = 0;
  for (let j = start; j < lines.length; j++) {
    for (const ch of lines[j]) {
      if (ch === "{") depth++;
      if (ch === "}") depth--;
    }

    if (j > start && depth >= 0) {
      if (propPattern.test(lines[j])) {
        return j;
      }
    }

    if (depth <= 0 && j > start) break;
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
 * Uses a declaration-anchored regex to avoid matching longhand variants.
 */
function searchClassBlockFuzzy(
  lines: string[],
  className: string,
  prop: string
): number | null {
  const classPattern = new RegExp(
    `\\.${escapeRegex(className)}\\s*[{,]`
  );
  const propPattern = declAnchoredPropRegex(prop);

  for (let i = 0; i < lines.length; i++) {
    if (!classPattern.test(lines[i])) continue;

    let depth = 0;
    let blockStart = i;
    let foundBrace = false;
    for (let j = i; j < lines.length; j++) {
      if (lines[j].includes("{")) { blockStart = j; foundBrace = true; break; }
    }
    if (!foundBrace) continue;

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
 *
 * `maskedLines` is used to LOCATE the shorthand line (so a comment mentioning the
 * shorthand can't be selected); the extraction/replacement runs on the ORIGINAL
 * line at the same index.
 */
function tryShorthandFallback(
  lines: string[],
  maskedLines: string[],
  prop: string,
  from: string,
  to: string,
  _sourceLine?: number,
  className?: string
): { lineIdx: number; replacementLine: string } | null {
  const mapping = LONGHAND_TO_SHORTHAND[prop];
  if (!mapping) return null;

  // Find the shorthand line on the MASKED copy (class-scoped first, then file-wide)
  let lineIdx: number | null = null;
  if (className) {
    lineIdx = searchClassBlockFuzzy(maskedLines, className, mapping.shorthand);
  }
  if (lineIdx == null) {
    lineIdx = searchFuzzy(maskedLines, mapping.shorthand);
  }
  if (lineIdx == null) return null;

  const line = lines[lineIdx];

  // Guard: bail if line contains SCSS variable
  if (/\$[\w-]/.test(line)) return null;

  // Extract the value portion (anchored so `gap` can't match `row-gap`, etc.)
  const valueMatch = line.match(
    new RegExp(`(?:^\\s*|[;{]\\s*)${escapeRegex(mapping.shorthand)}\\s*:\\s*([^;!}]+)`)
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
    new RegExp(`((?:^\\s*|[;{]\\s*)${escapeRegex(mapping.shorthand)}\\s*:\\s*)[^;!}]+`),
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
  // Match/count on a comment-, string- and url()-masked copy so neither a
  // declaration matcher nor a brace counter is fooled by those constructs. The
  // mask is same-length and line-for-line, so returned indices map onto `lines`.
  const masked = maskedLinesOf(lines);

  // Tier 1: Window search (if we have a reliable line number)
  if (sourceLine != null && sourceLine > 0) {
    const idx = searchWindow(masked, sourceLine, prop, value);
    if (idx != null) return { lineIdx: idx, strategy: "window" };
  }

  // Tier 1.5: For custom properties (--*), search :root and theme blocks first
  if (prop.startsWith("--")) {
    const idx = searchRootBlock(masked, prop, value);
    if (idx != null) return { lineIdx: idx, strategy: "class-block" };
  }

  // Tier 2: Class-scoped search (if we know the CSS class)
  if (className) {
    const hit = searchClassBlock(masked, className, prop, value);
    if (hit != null) {
      // hit.range (set for a minified same-line block) confines the later
      // surgical replacement to the target block's body so a sibling block's
      // identical declaration earlier on the line isn't rewritten (issue #47).
      return { lineIdx: hit.lineIdx, strategy: "class-block", range: hit.range };
    }
  }

  // Tier 3: Full-file search (prop + value anywhere)
  {
    const idx = searchFullFile(masked, prop, value);
    if (idx != null) return { lineIdx: idx, strategy: "full-file" };
  }

  // Tier 4: Fuzzy search (prop name only — handles variables)
  {
    const idx = searchFuzzy(masked, prop);
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
      // Resolve the actual file path (handles bare filenames + source maps)
      let filePath = await resolveSourceFile(
        projectRoot,
        sourceFile,
        fileChanges[0]?.componentName,
        fileChanges[0]?.cssHref
      );

      if (!filePath) {
        // Fallback: if the property is a CSS custom property, search project for its definition
        const firstProp = fileChanges[0]?.prop;
        if (firstProp?.startsWith("--")) {
          const varFile = await findVariableDefinitionFile(projectRoot, firstProp);
          if (varFile) {
            filePath = varFile;
          }
        }
        if (!filePath) {
          for (const change of fileChanges) {
            result.failed.push({
              ...change,
              reason: `file not found: "${sourceFile}"`,
            });
          }
          continue;
        }
      }

      // Final chokepoint guard (issue #22): never read/write a resolved path
      // whose real (symlink-resolved) location escapes the project root. Covers
      // every resolution branch, including the var-definition-file fallback.
      if (!(await isRealPathWithinRoot(filePath, projectRoot))) {
        for (const change of fileChanges) {
          result.failed.push({
            ...change,
            reason: `resolved path escapes project root: "${sourceFile}"`,
          });
        }
        continue;
      }

      const source = await readFile(filePath, "utf-8");
      let lines = source.split("\n");
      let modified = false;

      // Recompute lazily: after any structural splice (state block creation) the
      // masked view must be rebuilt before the next change is processed.
      let masked = maskedLinesOf(lines);
      const remask = () => { masked = maskedLinesOf(lines); };

      for (const change of fileChanges) {
        // Reject malformed client input up front (issue #16).
        const invalid = changeValidationError(change);
        if (invalid) {
          result.failed.push({ ...change, reason: invalid });
          continue;
        }

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
          // Locate on the masked view so brace literals / comments can't fool
          // the scan; the replacement is applied to the original `lines`.
          const pseudoHit = searchPseudoClassBlock(
            masked,
            change.className,
            change.state,
            change.prop,
            change.from
          ) ?? searchNestedPseudoBlock(
            masked,
            change.className,
            change.state,
            change.prop,
            change.from
          );

          if (pseudoHit != null) {
            // Found the property in the pseudo-class block. When the block
            // opens AND closes on one physical line (minified CSS), hit.range
            // confines the replacement to the block's body so a sibling
            // block's identical declaration on the line isn't rewritten
            // (issue #47).
            const updated = replaceDeclInLine(
              lines[pseudoHit.lineIdx],
              change.prop,
              change.from,
              change.to,
              pseudoHit.range
            );
            if (updated != null) {
              lines[pseudoHit.lineIdx] = updated;
              modified = true;
              remask();
            } else {
              result.failed.push({
                ...change,
                reason: `value "${change.from}" not found in .${change.className}:${change.state} block`,
              });
            }
            continue;
          }

          // No existing pseudo-class block — create one
          const baseEnd = findClassBlockEnd(masked, change.className);
          if (baseEnd != null) {
            const isNestedSCSS = masked.some(line => /&\s*[:.[]/.test(line));

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
            remask();
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
            lines, masked, change.prop, change.from, change.to, change.sourceLine, change.className
          );
          if (shorthand) {
            lines[shorthand.lineIdx] = shorthand.replacementLine;
            modified = true;
            remask();
            continue;
          }
          result.failed.push({
            ...change,
            reason: `property "${change.prop}: ${change.from}" not found in ${sourceFile}`,
          });
          continue;
        }

        // Surgical replacement: only change the value, preserve everything else
        // (the pattern carries a LEFT boundary so `color` can't match inside
        // `background-color` even if both share a line), confined to
        // `found.range` when set (minified same-line block, issue #47). The
        // broad fallback (full CSS value replace — hex vs rgb, var(), etc.) is
        // only allowed for fuzzy matches, and never over an SCSS variable —
        // those require manual editing.
        const scssVarMatch = lines[found.lineIdx].match(/\$[\w-]+/);
        const allowBroad = found.strategy === "fuzzy" && !scssVarMatch;
        const updated = replaceDeclInLine(
          lines[found.lineIdx],
          change.prop,
          change.from,
          change.to,
          found.range,
          allowBroad
        );

        if (updated != null) {
          lines[found.lineIdx] = updated;
          modified = true;
          remask();
        } else if (found.strategy === "fuzzy") {
          result.failed.push({
            ...change,
            reason: scssVarMatch
              ? `uses SCSS variable ${scssVarMatch[0]} — manual edit required`
              : `value "${change.from}" not found literally (may be a variable)`,
          });
        } else {
          result.failed.push({
            ...change,
            reason: scssVarMatch
              ? `uses SCSS variable ${scssVarMatch[0]} — manual edit required`
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
