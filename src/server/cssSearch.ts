/**
 * cssSearch.ts — Block-extent walking, tiered property search, and surgical
 * declaration rewriting for the commit pipeline.
 *
 * All matching/brace-counting runs on the masked view (see cssMask.ts); the
 * actual text replacement is always applied to the ORIGINAL line. Extracted
 * from commit.ts (structural split only).
 */

import { maskedLinesOf } from "./cssMask";

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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

// --- Property search (tiered) ---

export type FindResult = {
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
export type BlockHit = {
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
 * Rewrite `prop: from` → `prop: to` within `line`, confined to the character
 * span `range` [start, end). The single declaration-rewrite implementation
 * shared by the pseudo-state and standard branches of handleCommit. Tries a
 * surgical replacement (exact `from` value) first; when `broad` is allowed,
 * falls back to replacing whatever value the property currently has (handles
 * hex vs rgb, var(), etc.). Returns the updated line, or null when no
 * declaration matched inside the range (issue #47: the range keeps an
 * identical declaration in a sibling block on the same minified line intact).
 */
export function replaceDeclInLine(
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
export function searchPseudoClassBlock(
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
export function searchNestedPseudoBlock(
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
export function findClassBlockEnd(
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

    // @layer block — scan inside its extent for :root blocks
    if (layerPattern.test(lines[i])) {
      scanBlockLines(lines, i, (j, layerDepth) => {
        if (j > i && layerDepth >= 1 && rootPattern.test(lines[j])) {
          collect(j);
        }
        return null;
      });
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
  // The opening line itself is NOT inspected (j > start), as before.
  return scanBlockLines(lines, start, (j, depth) =>
    j > start && depth >= 0 && propPattern.test(lines[j]) ? j : null
  );
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

  for (const block of eachBlock(lines, classPattern)) {
    // Quirk preserved: unlike searchClassBlock, the opening-brace line itself
    // is NOT inspected (j > openLine) — the shorthand fallback has never
    // targeted minified one-line blocks.
    const idx = scanBlockLines(lines, block.openLine, (j, depth) =>
      j > block.openLine && depth >= 0 && propPattern.test(lines[j]) ? j : null
    );
    if (idx != null) return idx;
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
export function tryShorthandFallback(
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
