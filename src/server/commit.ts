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

import { readFile, writeFile, readdir, realpath } from "fs/promises";
import { resolve, join, basename, normalize, sep } from "path";
import { trySourceMapResolution } from "./sourceMapCache";
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

/** Collect all CSS/SCSS files in the project (excluding node_modules etc.) */
async function findCSSFiles(dir: string): Promise<string[]> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const direct: string[] = [];
  const subdirs: string[] = [];
  for (const entry of entries) {
    if (EXCLUDE_DIRS.has(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) subdirs.push(full);
    else if (/\.(css|scss)$/.test(entry.name)) direct.push(full);
  }
  // Recurse into subdirectories concurrently; concat preserves walk order.
  const nested = await Promise.all(subdirs.map((d) => findCSSFiles(d)));
  return direct.concat(...nested);
}

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
    return `unsafe CSS value (contains "{", "}", ";", "<", "/*", "*/", or newline): "${change.to}"`;
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

const EXCLUDE_DIRS = new Set([
  "node_modules", ".next", "dist", ".git", "build", "out", ".turbo",
]);

/**
 * Recursively search for a file by basename, excluding common build dirs.
 * `root` is the project root used to reject any match whose real (symlink-
 * resolved) location escapes it (issue #22); it stays constant across recursion.
 */
async function findFileRecursive(
  dir: string,
  target: string,
  root: string
): Promise<string[]> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    // Permission error or similar — skip
    return [];
  }
  const normalizedDir = normalize(dir);
  // Each entry needs a realpath check (and directories a recursive walk) —
  // run them concurrently. Awaiting in entry order keeps the result list
  // byte-identical to the old sequential DFS, so `matches[0]` tie-breaking
  // downstream is unaffected.
  const perEntry = await Promise.all(entries.map(async (entry): Promise<string[]> => {
    if (EXCLUDE_DIRS.has(entry.name)) return [];
    const full = join(dir, entry.name);
    // Ensure symlinks or unusual names don't escape the starting directory
    if (!normalize(full).startsWith(normalizedDir + "/")) return [];
    if (entry.isDirectory()) {
      // Only descend into real in-root directories — never follow a symlinked
      // directory whose target lies outside the project root.
      if (await isRealPathWithinRoot(full, root)) {
        return findFileRecursive(full, target, root);
      }
    } else if (entry.name === target) {
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
      // realpath doubles as the existence check (false for missing files), so
      // no separate stat() — and it rejects a symlinked-out mapped path too.
      if (await isRealPathWithinRoot(mappedPath, projectRoot)) return mappedPath;
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
  if (await isRealPathWithinRoot(direct, projectRoot)) return direct;

  // Search by exact filename
  const target = basename(sourceFile);
  const matches = await findFileRecursive(projectRoot, target, projectRoot);

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
      const variants = await findFileRecursive(projectRoot, `${componentName}${ext}`, projectRoot);
      if (variants.length > 0) return variants[0];
    }
  }

  // Try bare .css and .scss extensions (for global stylesheets)
  const baseName = target.replace(/\.\w+$/, "");
  if (baseName !== target) {
    for (const ext of [".css", ".scss"]) {
      const globalTarget = `${baseName}${ext}`;
      if (globalTarget === target) continue; // already tried
      const globalMatches = await findFileRecursive(projectRoot, globalTarget, projectRoot);
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

    // Find the opening brace (might be on the same line or several lines below,
    // e.g. a multi-line selector list). Scan until the first '{', no fixed cap.
    let foundBrace = false;
    for (let j = i; j < lines.length; j++) {
      if (lines[j].includes("{")) {
        blockStart = j;
        foundBrace = true;
        break;
      }
    }
    if (!foundBrace) continue;

    // Count from blockStart
    for (let j = blockStart; j < lines.length; j++) {
      for (const ch of lines[j]) {
        if (ch === "{") depth++;
        if (ch === "}") depth--;
      }

      // Search within the block for our property. The brace line itself
      // (j === blockStart) is inspected too, so an all-on-one-line minified
      // block whose declaration shares the line with the `{` is found rather
      // than skipped (issue #47); a multi-line selector line carries no
      // `prop: value`, so this is a no-op there.
      if (depth >= 0) {
        if (lineHasDecl(lines[j], prop, value)) {
          return j;
        }
      }

      if (depth <= 0 && j > blockStart) break;
    }
  }

  return null;
}

/**
 * For minified/same-line CSS, return the character span [start, end) of the
 * BODY of `.className { ... }` on a single physical line — the region between
 * the block's opening `{` and its matching `}`. Used to confine a surgical
 * replacement to the targeted block so an identical declaration in an earlier
 * sibling block on the same line isn't rewritten (issue #47). Returns null when
 * the class/brace aren't present or the block doesn't close on this one line.
 */
function classBlockBodyRangeOnLine(
  maskedLine: string,
  className: string
): [number, number] | null {
  const classRe = new RegExp(`\\.${escapeRegex(className)}\\s*\\{`);
  const m = classRe.exec(maskedLine);
  if (!m) return null;
  const braceIdx = maskedLine.indexOf("{", m.index);
  if (braceIdx === -1) return null;
  let depth = 0;
  for (let k = braceIdx; k < maskedLine.length; k++) {
    if (maskedLine[k] === "{") depth++;
    else if (maskedLine[k] === "}") {
      depth--;
      if (depth === 0) return [braceIdx + 1, k]; // body between the braces
    }
  }
  return null; // block doesn't close on this line
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
        if (lineHasDecl(lines[j], prop, value)) {
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
            if (lineHasDecl(lines[k], prop, value)) {
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
    const idx = searchClassBlock(masked, className, prop, value);
    if (idx != null) {
      // If the target class's block opens AND closes on this same physical
      // line (minified CSS), confine the later surgical replacement to that
      // block's body so a sibling block's identical declaration earlier on the
      // line isn't the one rewritten (issue #47).
      const range = classBlockBodyRangeOnLine(masked[idx], className) ?? undefined;
      return { lineIdx: idx, strategy: "class-block", range };
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

  // Process each source file concurrently — groups don't share state and
  // writes are batched per file, so they can't conflict. Each task collects
  // into local arrays which are merged into `result` after all settle, keeping
  // the output order deterministic (input order, not completion order).
  const perFile = await Promise.all(Array.from(changesByFile).map(async ([sourceFile, fileChanges]) => {
    const written: string[] = [];
    const failed: CommitResult["failed"] = [];
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
            failed.push({
              ...change,
              reason: `file not found: "${sourceFile}"`,
            });
          }
          return { written, failed };
        }
      }

      // Final chokepoint guard (issue #22): never read/write a resolved path
      // whose real (symlink-resolved) location escapes the project root. Covers
      // every resolution branch, including the var-definition-file fallback.
      if (!(await isRealPathWithinRoot(filePath, projectRoot))) {
        for (const change of fileChanges) {
          failed.push({
            ...change,
            reason: `resolved path escapes project root: "${sourceFile}"`,
          });
        }
        return { written, failed };
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
          failed.push({ ...change, reason: invalid });
          continue;
        }

        // --- Pseudo-class state handling ---
        // When a state like "hover" is provided, target the `.className:hover { }` block
        if (change.state && change.className) {
          // Validate state against allowlist to prevent CSS injection
          if (!VALID_STATES.has(change.state)) {
            failed.push({
              ...change,
              reason: `invalid state "${change.state}" — not in allowlist`,
            });
            continue;
          }
          // Locate on the masked view so brace literals / comments can't fool
          // the scan; the replacement is applied to the original `lines`.
          const pseudoIdx = searchPseudoClassBlock(
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

          if (pseudoIdx != null) {
            // Found the property in the pseudo-class block — do surgical replacement
            const pattern = replacePropRegex(change.prop, escapeRegex(change.from));
            if (pattern.test(lines[pseudoIdx])) {
              const safeValue = change.to.replace(/\$/g, "$$$$");
              lines[pseudoIdx] = lines[pseudoIdx].replace(pattern, `$1$2${safeValue}`);
              modified = true;
              remask();
            } else {
              // Try broad replacement (handles hex vs rgb, etc.)
              const broadPattern = replacePropRegex(change.prop, "([^;!}]+)");
              if (broadPattern.test(lines[pseudoIdx])) {
                const safeValue = change.to.replace(/\$/g, "$$$$");
                lines[pseudoIdx] = lines[pseudoIdx].replace(broadPattern, `$1$2${safeValue}`);
                modified = true;
                remask();
              } else {
                failed.push({
                  ...change,
                  reason: `value "${change.from}" not found in .${change.className}:${change.state} block`,
                });
              }
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
          failed.push({
            ...change,
            reason: `base class ".${change.className}" not found — cannot create :${change.state} block`,
          });
          continue;
        }

        // Fail-safe (issue #57): a state-tagged change WITHOUT class info
        // cannot be routed to a `.class:state { }` block. Falling through to
        // the standard search would write the state-only value into the BASE
        // rule — silently corrupting the resting style while reporting
        // success. Reject it instead. Custom properties are exempt: the client
        // intentionally redirects var()-backed edits to the variable's
        // definition site (e.g. `:root`) with no class info, regardless of the
        // state the edit was made under.
        if (change.state && !change.className && !change.prop.startsWith("--")) {
          result.failed.push({
            ...change,
            reason: `state ":${change.state}" edit has no class info — refusing to write it into the base rule`,
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
          failed.push({
            ...change,
            reason: `property "${change.prop}: ${change.from}" not found in ${sourceFile}`,
          });
          continue;
        }

        // Surgical replacement: only change the value, preserve everything else.
        // The pattern carries a LEFT boundary so `color` can't match inside
        // `background-color` even if both share a line.
        const pattern = replacePropRegex(change.prop, escapeRegex(change.from));

        // When a char range is set (minified same-line block, issue #47),
        // confine the match+replace to that block's body so an identical sibling
        // declaration earlier on the line is left untouched. The range is
        // computed on the masked view, which is same-length as `lines`.
        const range = found.range;
        const segment = range
          ? lines[found.lineIdx].slice(range[0], range[1])
          : lines[found.lineIdx];

        if (pattern.test(segment)) {
          // Escape $ in replacement to prevent regex backreference interpretation
          const safeValue = change.to.replace(/\$/g, "$$$$");
          const replaced = segment.replace(pattern, `$1$2${safeValue}`);
          lines[found.lineIdx] = range
            ? lines[found.lineIdx].slice(0, range[0]) +
              replaced +
              lines[found.lineIdx].slice(range[1])
            : replaced;
          modified = true;
          remask();
        } else if (found.strategy === "fuzzy") {
          // Fuzzy match found the property by name but the exact from-value
          // isn't on this line. Source likely uses a different representation
          // (hex vs rgb, var() vs computed, etc.). Replace the full CSS value.

          // Guard: don't overwrite SCSS variables — they require manual editing
          const scssVarMatch = lines[found.lineIdx].match(/\$[\w-]+/);
          if (scssVarMatch) {
            failed.push({
              ...change,
              reason: `uses SCSS variable ${scssVarMatch[0]} — manual edit required`,
            });
          } else {
            const broadPattern = replacePropRegex(change.prop, "([^;!}]+)");
            if (broadPattern.test(lines[found.lineIdx])) {
              const safeValue = change.to.replace(/\$/g, "$$$$");
              lines[found.lineIdx] = lines[found.lineIdx].replace(
                broadPattern,
                `$1$2${safeValue}`
              );
              modified = true;
              remask();
            } else {
              failed.push({
                ...change,
                reason: `value "${change.from}" not found literally (may be a variable)`,
              });
            }
          }
        } else {
          const lineVarMatch = lines[found.lineIdx].match(/\$[\w-]+/);
          failed.push({
            ...change,
            reason: lineVarMatch
              ? `uses SCSS variable ${lineVarMatch[0]} — manual edit required`
              : `value "${change.from}" not found literally on line ${found.lineIdx + 1}`,
          });
        }
      }

      if (modified) {
        await writeFile(filePath, lines.join("\n"), "utf-8");
        written.push(sourceFile);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      for (const change of fileChanges) {
        failed.push({
          ...change,
          reason: `file error: ${message}`,
        });
      }
    }
    return { written, failed };
  }));

  for (const { written, failed } of perFile) {
    for (const f of written) {
      if (!result.written.includes(f)) result.written.push(f);
    }
    result.failed.push(...failed);
  }

  return result;
}
