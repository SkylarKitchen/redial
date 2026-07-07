/**
 * cssSearch.ts — block scanners, tiered property search, and in-block
 * mutation helpers for the CSS save path.
 *
 * Structural split out of commit.ts (issue #138). Every scanner here takes the
 * MASKED view (see cssMask.ts) for matching and brace counting; functions that
 * mutate take the ORIGINAL `lines` alongside it. Search results carry the hit
 * line, the strategy (confidence tier) that produced it, and — for minified /
 * same-line CSS — the char range the surgical replacement must be confined to
 * (issue #47).
 *
 * commit.ts remains the write orchestrator; nothing here reads or writes files.
 */

import { escapeRegex, maskedLinesOf } from "./cssMask";

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
export function replacePropRegex(prop: string, valuePattern: string): RegExp {
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
  return bodyRangeOnLine(maskedLine, m.index);
}

/**
 * Char-accurate body span for a block that opens AND closes on one physical
 * line: from the first `{` at/after `fromCol`, walk char-level brace depth to
 * the matching `}`. Returns [openCol + 1, closeCol) — the body between the
 * braces — or null when no `{` follows `fromCol` or the block doesn't close
 * on this line.
 */
function bodyRangeOnLine(
  maskedLine: string,
  fromCol: number
): [number, number] | null {
  const braceIdx = maskedLine.indexOf("{", fromCol);
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
 * Find a CSS pseudo-class block (`.className:hover { ... }`) and search within
 * it. Returns the hit line plus, when the block opens AND closes on that same
 * physical line (minified CSS), the char span of the block's body to which a
 * surgical replacement must be confined (issue #47, pseudo branch).
 */
export function searchPseudoClassBlock(
  lines: string[],
  className: string,
  state: string,
  prop: string,
  value: string
): { lineIdx: number; range?: [number, number] } | null {
  const pseudoPattern = new RegExp(
    `\\.${escapeRegex(className)}:${escapeRegex(state)}\\s*\\{`
  );

  for (let i = 0; i < lines.length; i++) {
    const m = pseudoPattern.exec(lines[i]);
    if (!m) continue;

    // Found the pseudo-class block — track braces to find extent
    let depth = 0;
    for (let j = i; j < lines.length; j++) {
      for (const ch of lines[j]) {
        if (ch === "{") depth++;
        if (ch === "}") depth--;
      }

      // The opening-brace line itself (j === i) is inspected too, so an
      // all-on-one-line minified pseudo block whose declaration shares the
      // line with the `{` is found rather than skipped — and the scan can't
      // fall through to a later sibling block's identical declaration
      // (issue #47, pseudo branch).
      if (depth >= 0) {
        if (lineHasDecl(lines[j], prop, value)) {
          return {
            lineIdx: j,
            range: j === i ? bodyRangeOnLine(lines[i], m.index) ?? undefined : undefined,
          };
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
export function searchNestedPseudoBlock(
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
export function findClassBlockEnd(
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

// --- Declaration insertion (the replace-only save gap) ---
// When the target rule block exists but never authored the property (fresh /
// AI-generated markup — the common case), every replace tier misses and the
// save used to dead-end. The helpers below INSERT the declaration into the
// existing block instead: before the closing brace with the block's own
// indentation for multi-line blocks, or as a body-range-confined splice for
// single-line/minified blocks (reusing the issue #47 confinement machinery so
// sibling blocks sharing the physical line are untouched). Creating a brand-
// new rule when NO block matches stays out of scope (class creation).

/** A block's opening (or closing) brace position: line index + column. */
export type BracePos = { line: number; col: number };

/**
 * Locate the opening brace of the FIRST `.className` rule block. Mirrors
 * searchClassBlock's selector rigor (`.card:hover` / `.card.active` /
 * `.cardigan` all fail the match) and its unbounded forward scan for the brace
 * (selector lists); the extra `$` alternative also tolerates Allman braces.
 */
export function findClassBlockOpen(
  masked: string[],
  className: string
): BracePos | null {
  const classPattern = new RegExp(`\\.${escapeRegex(className)}\\s*([{,]|$)`);
  for (let i = 0; i < masked.length; i++) {
    const m = classPattern.exec(masked[i]);
    if (!m) continue;
    if (m[1] === "{") return { line: i, col: m.index + m[0].length - 1 };
    // Selector list / Allman brace: the first `{` at/after the match.
    const sameLineCol = masked[i].indexOf("{", m.index + m[0].length);
    if (sameLineCol !== -1) return { line: i, col: sameLineCol };
    for (let j = i + 1; j < masked.length; j++) {
      const col = masked[j].indexOf("{");
      if (col !== -1) return { line: j, col };
    }
    return null;
  }
  return null;
}

/** Locate the opening brace of the FIRST flat `.className:state { }` block. */
export function findPseudoBlockOpen(
  masked: string[],
  className: string,
  state: string
): BracePos | null {
  const pseudoPattern = new RegExp(
    `\\.${escapeRegex(className)}:${escapeRegex(state)}\\s*\\{`
  );
  for (let i = 0; i < masked.length; i++) {
    const m = pseudoPattern.exec(masked[i]);
    if (m) return { line: i, col: m.index + m[0].length - 1 };
  }
  return null;
}

/**
 * Locate the opening brace of an existing nested `&:state { }` sub-block
 * inside `.className { }` (SCSS / native CSS nesting). Mirrors
 * searchNestedPseudoBlock's outer scan.
 */
export function findNestedPseudoBlockOpen(
  masked: string[],
  className: string,
  state: string
): BracePos | null {
  const classPattern = new RegExp(`\\.${escapeRegex(className)}\\s*\\{`);
  const nestedPattern = new RegExp(`&:${escapeRegex(state)}\\s*\\{`);
  const pseudoCheck = new RegExp(`\\.${escapeRegex(className)}:\\w`);
  for (let i = 0; i < masked.length; i++) {
    // Skip flat pseudo-class lines (e.g. .btn:hover) — we want the base class.
    if (masked[i].includes(":") && pseudoCheck.test(masked[i])) continue;
    if (!classPattern.test(masked[i])) continue;

    let depth = 0;
    for (let j = i; j < masked.length; j++) {
      for (const ch of masked[j]) {
        if (ch === "{") depth++;
        if (ch === "}") depth--;
      }
      if (j > i && depth >= 1) {
        const m = nestedPattern.exec(masked[j]);
        if (m) return { line: j, col: m.index + m[0].length - 1 };
      }
      if (depth <= 0 && j > i) break;
    }
  }
  return null;
}

/**
 * Char-accurate matching `}` for the block whose `{` sits at `open`, via a
 * depth walk on the masked view (so brace literals in strings/comments can't
 * fool it). Null when the block never closes.
 */
function findBlockClose(masked: string[], open: BracePos): BracePos | null {
  let depth = 0;
  for (let j = open.line; j < masked.length; j++) {
    for (let k = j === open.line ? open.col : 0; k < masked[j].length; k++) {
      if (masked[j][k] === "{") depth++;
      else if (masked[j][k] === "}") {
        depth--;
        if (depth === 0) return { line: j, col: k };
      }
    }
  }
  return null;
}

/**
 * Whether the block at `open` already authors `prop` (any value). Returns the
 * declaration's line plus the block's body char-span when the block opens AND
 * closes on one physical line (minified CSS), so a value rewrite can be
 * confined to the targeted block (issue #47).
 */
export function findPropInBlock(
  masked: string[],
  open: BracePos,
  prop: string
): { lineIdx: number; range?: [number, number] } | null {
  const propRe = declAnchoredPropRegex(prop);
  const sameLineRange = bodyRangeOnLine(masked[open.line], open.col);
  if (sameLineRange) {
    const body = masked[open.line].slice(sameLineRange[0], sameLineRange[1]);
    return propRe.test(body)
      ? { lineIdx: open.line, range: sameLineRange }
      : null;
  }
  let depth = 0;
  for (let j = open.line; j < masked.length; j++) {
    for (let k = j === open.line ? open.col : 0; k < masked[j].length; k++) {
      if (masked[j][k] === "{") depth++;
      else if (masked[j][k] === "}") depth--;
    }
    if (depth >= 0) {
      // On the opening line only the brace's tail can hold a declaration.
      const hay = j === open.line ? masked[j].slice(open.col + 1) : masked[j];
      if (propRe.test(hay)) return { lineIdx: j };
    }
    if (depth <= 0 && j > open.line) break;
  }
  return null;
}

export type InsertOutcome = "inserted" | "commented-out" | "unclosed";

/**
 * Insert `prop: value;` as the LAST declaration of the block whose opening
 * brace sits at `open`. Multi-line blocks get a new line above the closing
 * brace, copying the indentation of the block's first inner line; blocks whose
 * `}` shares a line with body content (minified / single-line CSS) get an
 * in-place splice immediately before the brace, so sibling blocks on the same
 * physical line are untouched.
 *
 * Refuses ("commented-out") when the block mentions `prop:` only inside a
 * comment — a commented-out declaration is a deliberate disable, and silently
 * re-enabling it next to its tombstone would be dishonest (outlier contract:
 * "only a comment mentions the property" must FAIL).
 */
export function insertDeclarationIntoBlock(
  lines: string[],
  masked: string[],
  open: BracePos,
  prop: string,
  value: string,
  /** Indent unit for an EMPTY block (no inner line to copy) — the file's own
   *  detected unit, so a freshly created class block in a tab-indented file
   *  gets tab-indented declarations. Defaults to two spaces (the pinned
   *  pre-existing behavior for files with no detectable indentation). */
  emptyBlockIndentUnit = "  "
): InsertOutcome {
  const close = findBlockClose(masked, open);
  if (!close) return "unclosed";

  // A `prop:` visible in the ORIGINAL block text but blanked on the masked
  // view lives inside a comment/string — treat as deliberately disabled.
  // Boundary `[^-\w]` keeps `background-color:` from flagging `color`.
  const mentionRe = new RegExp(`(?:^|[^-\\w])${escapeRegex(prop)}\\s*:`);
  for (let j = open.line; j <= close.line; j++) {
    const s = j === open.line ? open.col : 0;
    const e = j === close.line ? close.col : lines[j].length;
    if (
      mentionRe.test(lines[j].slice(s, e)) &&
      !mentionRe.test(masked[j].slice(s, e))
    ) {
      return "commented-out";
    }
  }

  const decl = `${prop}: ${value};`;

  // Masked body content preceding the closing brace on its own line.
  const prefixStart = close.line === open.line ? open.col + 1 : 0;
  const closePrefix = masked[close.line].slice(prefixStart, close.col);

  if (close.line === open.line || closePrefix.trim() !== "") {
    // Single-line block, or a declaration sharing the closing-brace line:
    // splice right before the `}`, adding a `;` separator unless the body is
    // empty or already terminated.
    const trimmed = closePrefix.trim();
    const sep = trimmed === "" || trimmed.endsWith(";") ? "" : ";";
    const line = lines[close.line];
    lines[close.line] = line.slice(0, close.col) + sep + decl + line.slice(close.col);
    return "inserted";
  }

  // Closing brace on its own line: new declaration line above it, indented
  // like the block's first non-blank inner line (empty block: opening-line
  // indent plus two spaces).
  let indent: string | null = null;
  for (let j = open.line + 1; j < close.line; j++) {
    if (masked[j].trim() !== "") {
      indent = lines[j].match(/^\s*/)![0];
      break;
    }
  }
  if (indent == null) indent = lines[open.line].match(/^\s*/)![0] + emptyBlockIndentUnit;
  lines.splice(close.line, 0, `${indent}${decl}`);
  return "inserted";
}

// --- Class creation (audit 05 — the Webflow "type a class name" flow) ---

/**
 * Detect the file's indentation unit: the leading whitespace of the first
 * indented non-blank line on the masked view. Returns null when the file has
 * no indented line to learn from (callers fall back to two spaces).
 */
export function detectIndentUnit(masked: string[]): string | null {
  for (const line of masked) {
    const m = line.match(/^([ \t]+)\S/);
    if (m) return m[1];
  }
  return null;
}

/**
 * Append an empty `.className { }` rule block at the end of the file,
 * separated from the last rule by one blank line and preserving the file's
 * trailing-newline state. The block is left empty — the batch's declarations
 * flow through the standard insert-missing-declaration path, which handles
 * indentation (via the file's detected unit) and the pseudo-state block
 * machinery uniformly.
 */
export function appendClassBlock(lines: string[], className: string): void {
  // split("\n") represents a trailing newline as a final "" element.
  let end = lines.length;
  while (end > 0 && lines[end - 1].trim() === "") end--;
  const hadTrailingNewline = end < lines.length;
  lines.length = end;
  if (end > 0) lines.push(""); // one blank line between the last rule and the new block
  lines.push(`.${className} {`, `}`);
  if (hadTrailingNewline || end === 0) lines.push("");
}

// --- Breakpoint (@media) file-save (issue #53) ---
// A change carrying `breakpoint: { minWidth }` is written INSIDE the matching
// `@media (min-width: Npx)` block, mirroring the base path's
// replace → broad-rewrite → insert → create ladder. The media block's BODY is
// extracted as a sub-document (boundary lines sliced at the braces), so the
// existing class/pseudo/insert machinery runs unchanged within it and sibling
// rules OUTSIDE the block — including a base rule with an identical
// declaration on the same physical line (minified CSS) — are invisible to it.

/** Matches ONE `(min-width: …px|em|rem)` term inside a media condition. */
const MEDIA_MIN_WIDTH_COND_RE = /\(\s*min-width\s*:\s*(\d+(?:\.\d+)?)\s*(px|em|rem)\s*\)/i;

/**
 * The px min-width of a PURE mobile-first media condition, or null when the
 * condition has no min-width or is a range band (contains max-width — writing
 * a cascade-tier override into a band would silently confine it). Tolerates
 * spacing variants; em/rem convert at the 16px root convention.
 */
function pureMinWidthPx(cond: string): number | null {
  if (/max-width/i.test(cond)) return null;
  const m = MEDIA_MIN_WIDTH_COND_RE.exec(cond);
  if (!m) return null;
  const n = parseFloat(m[1]);
  const px = m[2].toLowerCase() === "px" ? n : n * 16;
  return Number.isFinite(px) && px > 0 ? px : null;
}

type MediaBlockPos = { open: BracePos; close: BracePos };

/**
 * Every `@media` block (on the masked view) whose condition is a pure
 * min-width equal to `minWidth`. Conditions may span lines before the `{`;
 * a line may hold several blocks (minified CSS).
 */
function findMatchingMediaBlocks(
  masked: string[],
  minWidth: number
): MediaBlockPos[] {
  const out: MediaBlockPos[] = [];
  for (let i = 0; i < masked.length; i++) {
    let from = 0;
    for (;;) {
      const at = masked[i].indexOf("@media", from);
      if (at === -1) break;
      from = at + 6;
      // Gather the condition text up to the opening brace (may span lines).
      let cond = "";
      let open: BracePos | null = null;
      for (let j = i; j < masked.length && open == null; j++) {
        const startCol = j === i ? at + 6 : 0;
        const braceCol = masked[j].indexOf("{", startCol);
        if (braceCol !== -1) {
          cond += masked[j].slice(startCol, braceCol);
          open = { line: j, col: braceCol };
        } else {
          cond += masked[j].slice(startCol) + " ";
        }
      }
      if (!open) break; // no brace follows — nothing more to scan here
      if (pureMinWidthPx(cond) !== minWidth) continue;
      const close = findBlockClose(masked, open);
      if (close) out.push({ open, close });
    }
  }
  return out;
}

/**
 * The block's BODY as a sub-document: boundary lines sliced at the braces so
 * content outside the block never leaks into a search. Middle lines are the
 * original lines (indentation preserved). Always ≥ 1 element.
 */
function extractBlockBody(
  lines: string[],
  open: BracePos,
  close: BracePos
): string[] {
  if (open.line === close.line) {
    return [lines[open.line].slice(open.col + 1, close.col)];
  }
  return [
    lines[open.line].slice(open.col + 1),
    ...lines.slice(open.line + 1, close.line),
    lines[close.line].slice(0, close.col),
  ];
}

/**
 * Write a (possibly grown) body sub-document back into `lines`, re-attaching
 * the boundary-line prefix (up to and including `{`) and suffix (from `}`).
 */
function spliceBlockBody(
  lines: string[],
  open: BracePos,
  close: BracePos,
  body: string[]
): void {
  const prefix = lines[open.line].slice(0, open.col + 1);
  const suffix = lines[close.line].slice(close.col);
  const assembled =
    body.length === 1
      ? [prefix + body[0] + suffix]
      : [prefix + body[0], ...body.slice(1, -1), body[body.length - 1] + suffix];
  lines.splice(open.line, close.line - open.line + 1, ...assembled);
}

/**
 * Create a `selector { prop: value; }` rule inside a media block's body
 * sub-document: appended before the closing brace, blank-line separated from
 * existing rules, indented like the block's existing rules (falling back to
 * one file-indent unit). Single-line (minified) bodies get a text splice.
 */
function createRuleInBody(
  body: string[],
  bodyMasked: string[],
  selector: string,
  prop: string,
  value: string,
  fileIndent: string
): void {
  if (body.length === 1) {
    body[0] += `${selector}{${prop}: ${value};}`;
    return;
  }
  // Rule-level indent: the first non-blank FULL inner line (skip index 0 — a
  // boundary slice whose leading whitespace isn't line indentation).
  let ruleIndent: string | null = null;
  for (let j = 1; j < body.length - 1; j++) {
    if (bodyMasked[j].trim() !== "") {
      ruleIndent = body[j].match(/^\s*/)![0];
      break;
    }
  }
  ruleIndent ??= fileIndent;
  const rule = [
    `${ruleIndent}${selector} {`,
    `${ruleIndent}${fileIndent}${prop}: ${value};`,
    `${ruleIndent}}`,
  ];
  // Insert before the final element (the closing-brace line's prefix).
  const insertAt = body.length - 1;
  const hasContent = bodyMasked
    .slice(0, insertAt)
    .some((l) => l.trim() !== "");
  body.splice(insertAt, 0, ...(hasContent ? ["", ...rule] : rule));
}

/**
 * The subset of a commit change the block-scoped save ladder needs. Kept
 * structural (rather than importing CommitChange from commit.ts) so this
 * module never depends on the orchestrator — commit.ts's CommitChange is
 * assignable to it as-is.
 */
export type BlockChange = {
  prop: string;
  from: string;
  to: string;
  className?: string;
  /** CSS pseudo-class state (e.g. "hover") — targets the `:state` block. */
  state?: string;
  /** Responsive breakpoint (issue #53) — targets the matching @media block. */
  breakpoint?: { minWidth: number };
};

/**
 * The base save ladder (replace exact → broad rewrite → insert declaration →
 * create rule), scoped to ONE media block's body sub-document. Mutates `body`
 * in place; the caller splices it back on success.
 */
function applyChangeWithinBody(
  body: string[],
  bodyMasked: string[],
  change: BlockChange,
  fileIndent: string,
  sourceFile: string
): { modified: boolean; reason?: string } {
  const className = change.className!;
  const mediaLabel = `@media (min-width: ${change.breakpoint!.minWidth}px)`;

  // Locate the target rule: the pseudo block for a state edit, else the base
  // class block — the same open/prop/insert helpers the base path uses.
  const open = change.state
    ? findPseudoBlockOpen(bodyMasked, className, change.state) ??
      findNestedPseudoBlockOpen(bodyMasked, className, change.state)
    : findClassBlockOpen(bodyMasked, className);

  if (open) {
    const propHit = findPropInBlock(bodyMasked, open, change.prop);
    if (propHit) {
      // Authored — rewrite the value (exact `from` first, then the broad
      // representation-tolerant pattern), confined to the block's body span
      // on minified same-line blocks (issue #47 machinery).
      const segment = propHit.range
        ? body[propHit.lineIdx].slice(propHit.range[0], propHit.range[1])
        : body[propHit.lineIdx];
      const exact = replacePropRegex(change.prop, escapeRegex(change.from));
      const broad = replacePropRegex(change.prop, "([^;!}]+)");
      const pattern = exact.test(segment) ? exact : broad.test(segment) ? broad : null;
      if (!pattern) {
        return {
          modified: false,
          reason: `value "${change.from}" not found in the ${mediaLabel} rule for .${className}`,
        };
      }
      const safeValue = change.to.replace(/\$/g, "$$$$");
      const replaced = segment.replace(pattern, `$1$2${safeValue}`);
      body[propHit.lineIdx] = propHit.range
        ? body[propHit.lineIdx].slice(0, propHit.range[0]) +
          replaced +
          body[propHit.lineIdx].slice(propHit.range[1])
        : replaced;
      return { modified: true };
    }
    // Rule exists but never authored the prop — insert the declaration.
    const outcome = insertDeclarationIntoBlock(
      body, bodyMasked, open, change.prop, change.to, fileIndent
    );
    if (outcome === "inserted") return { modified: true };
    return {
      modified: false,
      reason: `property "${change.prop}: ${change.from}" not found in the ${mediaLabel} rule for .${className} in ${sourceFile}`,
    };
  }

  // No target rule inside the block yet. For a state edit whose BASE class
  // rule lives in the block, create the pseudo block right after it (mirrors
  // the base path's flat pseudo-block creation); otherwise create a fresh
  // rule at the end of the block.
  if (change.state && body.length > 1) {
    const baseOpen = findClassBlockOpen(bodyMasked, className);
    const baseEnd = baseOpen ? findClassBlockEnd(bodyMasked, className) : null;
    if (baseOpen && baseEnd != null) {
      const ruleIndent =
        baseOpen.line > 0 ? body[baseOpen.line].match(/^\s*/)![0] : fileIndent;
      body.splice(baseEnd + 1, 0,
        "",
        `${ruleIndent}.${className}:${change.state} {`,
        `${ruleIndent}${fileIndent}${change.prop}: ${change.to};`,
        `${ruleIndent}}`,
      );
      return { modified: true };
    }
  }
  const selector = change.state
    ? `.${className}:${change.state}`
    : `.${className}`;
  createRuleInBody(body, bodyMasked, selector, change.prop, change.to, fileIndent);
  return { modified: true };
}

/** A top-level own-line media block, for trailing-run ordering. */
type OwnLineMediaBlock = {
  startLine: number;
  closeLine: number;
  closeCol: number;
  minWidth: number;
};

/**
 * Media blocks that START their own line (only whitespace before `@media`)
 * and carry a pure min-width condition, in document order. Own-line is the
 * "redial-shaped" appended form — mid-line/minified blocks never participate
 * in ordering (they're matched for writes, just not treated as a sortable run).
 */
function collectOwnLineMediaBlocks(masked: string[]): OwnLineMediaBlock[] {
  const out: OwnLineMediaBlock[] = [];
  for (let i = 0; i < masked.length; i++) {
    const at = masked[i].indexOf("@media");
    if (at === -1 || masked[i].slice(0, at).trim() !== "") continue;
    let cond = "";
    let open: BracePos | null = null;
    for (let j = i; j < masked.length && open == null; j++) {
      const startCol = j === i ? at + 6 : 0;
      const braceCol = masked[j].indexOf("{", startCol);
      if (braceCol !== -1) {
        cond += masked[j].slice(startCol, braceCol);
        open = { line: j, col: braceCol };
      } else {
        cond += masked[j].slice(startCol) + " ";
      }
    }
    if (!open) continue;
    const close = findBlockClose(masked, open);
    if (!close) continue;
    const mw = pureMinWidthPx(cond);
    if (mw != null) {
      out.push({ startLine: i, closeLine: close.line, closeCol: close.col, minWidth: mw });
    }
    i = close.line; // never scan inside the block (nested @media stay out of the run)
  }
  return out;
}

/**
 * Insertion line for a NEW `@media (min-width: minWidth px)` block so the
 * TRAILING run of media blocks (the shape redial's own appends produce) stays
 * in ascending min-width order — or null for a plain EOF append. Author
 * blocks are never moved: ordering only ever picks an insertion POINT within
 * the run; anything followed by non-media content ends the run.
 */
function trailingMediaInsertionLine(
  masked: string[],
  minWidth: number
): number | null {
  const blocks = collectOwnLineMediaBlocks(masked);
  // Walk backwards, extending the trailing run while only blank space
  // separates each block from the next run block / EOF.
  let runStart = blocks.length;
  let boundary = masked.length;
  for (let k = blocks.length - 1; k >= 0; k--) {
    const b = blocks[k];
    if (masked[b.closeLine].slice(b.closeCol + 1).trim() !== "") break;
    let clean = true;
    for (let j = b.closeLine + 1; j < boundary; j++) {
      if (masked[j].trim() !== "") { clean = false; break; }
    }
    if (!clean) break;
    runStart = k;
    boundary = b.startLine;
  }
  for (let k = runStart; k < blocks.length; k++) {
    if (blocks[k].minWidth > minWidth) return blocks[k].startLine;
  }
  return null;
}

/**
 * Insert a brand-new `@media (min-width: Npx) { selector { prop: value; } }`
 * block: within the trailing media run in ascending min-width order when
 * practical, else appended at EOF (blank-line separated, preserving the
 * file's trailing-newline state — appendClassBlock conventions).
 */
function insertNewMediaBlock(
  lines: string[],
  masked: string[],
  minWidth: number,
  selector: string,
  prop: string,
  value: string,
  fileIndent: string
): void {
  const blockLines = [
    `@media (min-width: ${minWidth}px) {`,
    `${fileIndent}${selector} {`,
    `${fileIndent}${fileIndent}${prop}: ${value};`,
    `${fileIndent}}`,
    `}`,
  ];
  const insertLine = trailingMediaInsertionLine(masked, minWidth);
  if (insertLine == null) {
    // split("\n") represents a trailing newline as a final "" element.
    let end = lines.length;
    while (end > 0 && lines[end - 1].trim() === "") end--;
    const hadTrailingNewline = end < lines.length;
    lines.length = end;
    if (end > 0) lines.push("");
    lines.push(...blockLines);
    if (hadTrailingNewline || end === 0) lines.push("");
    return;
  }
  const needsBlankBefore = insertLine > 0 && lines[insertLine - 1].trim() !== "";
  lines.splice(insertLine, 0, ...(needsBlankBefore ? [""] : []), ...blockLines, "");
}

/**
 * Apply one breakpoint-tagged change (issue #53): pick the matching media
 * block — preferring one that already holds a rule for the class — extract
 * its body sub-document, run the base save ladder within it, and splice the
 * result back. No matching block → a new one is created.
 */
export function applyBreakpointChange(
  lines: string[],
  masked: string[],
  change: BlockChange,
  fileIndent: string,
  sourceFile: string
): { modified: boolean; reason?: string } {
  const minWidth = change.breakpoint!.minWidth;
  if (!change.className) {
    return {
      modified: false,
      reason: `breakpoint edit (@media (min-width: ${minWidth}px)) has no class info — refusing to write it without a rule target`,
    };
  }
  const className = change.className;

  const candidates = findMatchingMediaBlocks(masked, minWidth);
  let target: MediaBlockPos | null = null;
  for (const cand of candidates) {
    const bodyMasked = extractBlockBody(masked, cand.open, cand.close);
    const hasRule =
      findClassBlockOpen(bodyMasked, className) != null ||
      (change.state != null &&
        (findPseudoBlockOpen(bodyMasked, className, change.state) != null ||
          findNestedPseudoBlockOpen(bodyMasked, className, change.state) != null));
    if (hasRule) { target = cand; break; }
  }
  target ??= candidates[0] ?? null;

  if (!target) {
    const selector = change.state
      ? `.${className}:${change.state}`
      : `.${className}`;
    insertNewMediaBlock(
      lines, masked, minWidth, selector, change.prop, change.to, fileIndent
    );
    return { modified: true };
  }

  const body = extractBlockBody(lines, target.open, target.close);
  const bodyMasked = extractBlockBody(masked, target.open, target.close);
  const res = applyChangeWithinBody(body, bodyMasked, change, fileIndent, sourceFile);
  if (res.modified) spliceBlockBody(lines, target.open, target.close, body);
  return res;
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
export const LONGHAND_TO_SHORTHAND: Record<string, { shorthand: string; index: number }> = {
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
export function searchClassBlockFuzzy(
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
