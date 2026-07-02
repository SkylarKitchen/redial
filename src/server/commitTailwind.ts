/**
 * commitTailwind.ts — Write Tailwind class changes back to JSX source files
 *
 * Finds the className attribute at the given source line, merges new classes
 * using conflict-aware logic (e.g. w-4 + w-6 -> w-6, not w-4 w-6).
 */

import { readFile, writeFile, stat, readdir } from "fs/promises";
import { resolve, join, extname } from "path";
import { EXCLUDED_DIRS, isRealPathWithinRoot, resolveSafe } from "./pathSafety";

export type TailwindChange = {
  sourceFile: string;
  sourceLine?: number;
  existingClasses: string;
  newClasses: string;
};

export type TailwindCommitResult = {
  written: string[];
  failed: Array<TailwindChange & { reason: string }>;
};

/**
 * Known single-segment Tailwind utility prefixes.
 * These match "prefix-value" where value can contain hyphens (e.g. bg-blue-500).
 */
const SINGLE_SEGMENT_PREFIXES = new Set([
  "w", "h", "p", "m", "bg", "text", "font", "border", "rounded", "shadow",
  "opacity", "z", "gap", "top", "right", "bottom", "left", "inset",
  "basis", "grow", "shrink", "order", "cursor", "select", "outline",
  "ring", "divide", "space", "tracking", "leading", "decoration",
  "underline", "overline", "accent", "caret", "fill", "stroke",
  "from", "via", "to", "blur", "brightness", "contrast", "grayscale",
  "saturate", "sepia", "backdrop", "transition", "duration", "ease", "delay",
  "animate", "scale", "rotate", "translate", "skew", "origin", "object",
  "aspect", "columns", "break", "list", "grid", "col", "row", "auto",
  "place", "content", "items", "justify", "self", "overflow", "overscroll",
  "scroll", "snap", "touch", "resize", "appearance", "will", "contain",
]);

/**
 * Known multi-segment Tailwind utility prefixes.
 * These match "prefix-x-value" patterns (e.g. min-w-4, max-h-screen).
 */
const MULTI_SEGMENT_PREFIXES = new Set([
  "min-w", "max-w", "min-h", "max-h",
  "pt", "pr", "pb", "pl", "px", "py",
  "mt", "mr", "mb", "ml", "mx", "my",
  "gap-x", "gap-y",
  "flex-row", "flex-col", "flex-wrap", "flex-nowrap",
  "grid-cols", "grid-rows", "grid-flow",
  "col-span", "col-start", "col-end",
  "row-span", "row-start", "row-end",
  "border-t", "border-r", "border-b", "border-l", "border-x", "border-y",
  "rounded-t", "rounded-r", "rounded-b", "rounded-l",
  "rounded-tl", "rounded-tr", "rounded-br", "rounded-bl",
  "translate-x", "translate-y",
  "scale-x", "scale-y",
  "skew-x", "skew-y",
  "scroll-m", "scroll-p",
  "ring-offset",
  "mix-blend", "bg-blend",
  "place-content", "place-items", "place-self",
  "text-decoration",
]);

/** Display-related standalone classes that conflict with each other */
const DISPLAY_CLASSES = new Set([
  "block", "inline-block", "inline", "flex", "inline-flex",
  "grid", "inline-grid", "table", "hidden", "contents", "flow-root",
]);

/**
 * Extract the utility group from a Tailwind class.
 * Used to determine if two classes conflict (same group = conflict).
 *
 * "w-4" -> "w", "bg-blue-500" -> "bg", "text-sm" -> "text"
 * "sm:w-4" -> "sm:w", "hover:bg-red-500" -> "hover:bg"
 * "flex" -> "flex", "hidden" -> "hidden"
 */
export function getUtilityGroup(cls: string): string {
  // Strip ALL leading "variant:" segments (preserving them as part of the
  // group) so stacked variants like "dark:md:hover:bg-x" dedup against each
  // other and so a variant chain never gets mistaken for the utility prefix.
  // Each segment is either a plain word-ish variant (e.g. "hover", "md",
  // "group-hover") or a bracketed arbitrary variant (e.g. "[&>svg]:").
  let rest = cls;
  let prefix = "";
  // Matches one leading variant segment ending in ':'. Bracketed arbitrary
  // variants ("[...]:") are matched as a whole; plain variants allow word
  // chars, '-' and '&' but not the chars that appear inside a utility value.
  const variantSegment = /^(?:\[[^\]]*\]|[\w&-]+):/;
  let m: RegExpMatchArray | null;
  while ((m = rest.match(variantSegment))) {
    prefix += m[0];
    rest = rest.slice(m[0].length);
  }

  // Important modifier: strip a leading "!" (Tailwind v3 syntax). It is NOT
  // re-applied to the group key — "!important" only raises specificity, so
  // "!mt-2" sets the same property as plain "mt-4" and must share its group.
  const bare = rest.startsWith("!") ? rest.slice(1) : rest;

  // Negative utilities: strip leading - and check the remaining prefix
  const isNeg = bare.startsWith("-");
  const unsigned = isNeg ? bare.slice(1) : bare;

  // Re-prepend the variant chain and (unlike "!") the negative sign to the
  // resolved group key, mirroring the pre-existing negative handling.
  const sign = isNeg ? "-" : "";

  // Display classes all conflict with each other
  if (DISPLAY_CLASSES.has(unsigned)) return prefix + sign + "__display";

  // Check multi-segment prefixes first (longer match wins)
  for (const mp of MULTI_SEGMENT_PREFIXES) {
    if (unsigned.startsWith(mp + "-") || unsigned === mp) {
      return prefix + sign + mp;
    }
  }

  // Check single-segment prefixes
  const dashIdx = unsigned.indexOf("-");
  if (dashIdx > 0) {
    const first = unsigned.slice(0, dashIdx);
    if (SINGLE_SEGMENT_PREFIXES.has(first)) {
      return prefix + sign + first;
    }
  }

  // Fallback: use the full class as its own group (standalone classes)
  return prefix + sign + unsigned;
}

/**
 * Merge new Tailwind classes into an existing class string.
 * Conflict-aware: classes in the same utility group are replaced, not duplicated.
 *
 * Replacements land at the END of the list (last occurrence wins):
 * "flex items-center" + "p-4" -> "flex items-center p-4"
 * "w-4 h-8" + "w-6" -> "h-8 w-6"
 * "bg-blue-500 text-white" + "bg-red-500" -> "text-white bg-red-500"
 */
export function mergeClasses(existing: string, newClasses: string): string {
  const existingList = existing.trim().split(/\s+/).filter(Boolean);
  const newList = newClasses.trim().split(/\s+/).filter(Boolean);

  if (newList.length === 0) return dedupeUtilityGroups(existingList).join(" ");
  if (existingList.length === 0) return dedupeUtilityGroups(newList).join(" ");

  // Merge existing + new, then dedupe by utility group (last occurrence wins).
  // This collapses intra-existing conflicts (#49), intra-new conflicts, and
  // cross-side conflicts in one pass: newer classes (appended last) beat older ones.
  return dedupeUtilityGroups([...existingList, ...newList]).join(" ");
}

/**
 * Keep only the last occurrence of each utility group, preserving order at that
 * last position. e.g. ["p-2","p-4","flex"] → ["p-4","flex"].
 */
function dedupeUtilityGroups(list: string[]): string[] {
  const lastIndexByGroup = new Map<string, number>();
  list.forEach((cls, i) => lastIndexByGroup.set(getUtilityGroup(cls), i));
  return list.filter((cls, i) => lastIndexByGroup.get(getUtilityGroup(cls)) === i);
}

export type ClassNameMatch = {
  lineIdx: number;
  start: number;
  end: number;
  quote: string;
  isCnWrapper: boolean;
};

/**
 * Parse a single line for any className attribute and return its location,
 * or null if no className syntax is present. (One match per line — matches
 * the original single-line, single-attribute assumption.)
 */
function parseClassNameOnLine(line: string, lineIdx: number): ClassNameMatch | null {
  // className="..."
  const dqMatch = line.match(/className="([^"]*)"/);
  if (dqMatch) {
    const start = line.indexOf('className="') + 'className="'.length;
    return {
      lineIdx,
      start,
      end: start + dqMatch[1].length,
      quote: '"',
      isCnWrapper: false,
    };
  }

  // className={'...'}
  const sqMatch = line.match(/className=\{'([^']*)'\}/);
  if (sqMatch) {
    const start = line.indexOf("className={'") + "className={'".length;
    return {
      lineIdx,
      start,
      end: start + sqMatch[1].length,
      quote: "'",
      isCnWrapper: false,
    };
  }

  // className={`...`}
  const btMatch = line.match(/className=\{`([^`]*)`\}/);
  if (btMatch) {
    // Refuse to edit interpolated template literals — rewriting the captured
    // string would clobber the "${...}" expression and feed the literal token
    // to mergeClasses as if it were a utility. Decline so the commit reports a
    // clear failure instead of corrupting the interpolation.
    if (btMatch[1].includes("${")) return null;
    const start = line.indexOf("className={`") + "className={`".length;
    return {
      lineIdx,
      start,
      end: start + btMatch[1].length,
      quote: "`",
      isCnWrapper: false,
    };
  }

  // className={cn(...)} or className={clsx(...)}
  // Don't rely on a balanced-paren regex ([^)]* stops at the FIRST ')', so a
  // nested call like cn("flex p-2", active && toggle(x)) never matches). Instead
  // locate the cn(/clsx( opener, then anchor on the FIRST quoted string literal
  // after it (without requiring a trailing ")}").
  const openerMatch = line.match(/className=\{(?:cn|clsx)\(/);
  if (openerMatch) {
    const openerEnd = openerMatch.index! + openerMatch[0].length;
    const firstStr = line.slice(openerEnd).match(/"([^"]*)"/);
    if (firstStr) {
      // Refuse interpolation in the captured literal, consistent with the
      // template-literal guard above.
      if (firstStr[1].includes("${")) return null;
      const strStart = openerEnd + firstStr.index! + 1;
      return {
        lineIdx,
        start: strStart,
        end: strStart + firstStr[1].length,
        quote: '"',
        isCnWrapper: true,
      };
    }
  }

  return null;
}

/**
 * Return every className attribute occurrence in the file.
 * Used to detect ambiguity when the same className string repeats.
 */
export function findAllClassNameAttributes(lines: string[]): ClassNameMatch[] {
  const matches: ClassNameMatch[] = [];
  for (let i = 0; i < lines.length; i++) {
    const m = parseClassNameOnLine(lines[i], i);
    if (m) matches.push(m);
  }
  return matches;
}

/**
 * Find a className attribute in JSX source lines.
 * Supports: className="...", className={'...'}, className={`...`}, className={cn("...", "...")}
 *
 * If targetLine is provided, searches near it first (within 10 lines).
 * Otherwise searches the full file.
 */
export function findClassNameAttribute(
  lines: string[],
  targetLine?: number
): ClassNameMatch | null {
  // Search near targetLine first, then full file
  const searchOrder: number[] = [];

  if (targetLine != null && targetLine > 0) {
    // 0-indexed targetLine from 1-indexed source
    const target = targetLine - 1;
    for (let offset = 0; offset <= 10; offset++) {
      if (target + offset < lines.length) searchOrder.push(target + offset);
      if (offset > 0 && target - offset >= 0) searchOrder.push(target - offset);
    }
  }

  // Then add all remaining lines
  for (let i = 0; i < lines.length; i++) {
    if (!searchOrder.includes(i)) searchOrder.push(i);
  }

  for (const i of searchOrder) {
    const m = parseClassNameOnLine(lines[i], i);
    if (m) return m;
  }

  return null;
}

/**
 * Locate the className attribute corresponding to a specific change.
 *
 * Disambiguation strategy (issue #42):
 *  1. Restrict to className attributes whose content exactly equals
 *     `existingClasses` (when provided). Different classNames on
 *     unrelated elements are never confused with each other.
 *  2. If `sourceLine` is provided, pick the candidate whose line is
 *     closest to it (Strategy #1 — React fiber source location).
 *  3. If no `sourceLine` and >1 candidate matches: refuse with an
 *     "ambiguous" error rather than silently picking the first
 *     (Strategy #3 — refuse + clear error).
 */
export function findClassNameForChange(
  lines: string[],
  existingClasses: string,
  sourceLine?: number
):
  | { ok: true; match: ClassNameMatch }
  | { ok: false; reason: "not-found" | "ambiguous"; count: number } {
  const all = findAllClassNameAttributes(lines);

  // When existingClasses is provided, narrow to exact content matches.
  // (When empty, fall back to any className — preserves the
  // "first className in file" behaviour used by callers that only want
  // to verify a file contains a className at all.)
  const candidates = existingClasses
    ? all.filter((m) => lines[m.lineIdx].slice(m.start, m.end) === existingClasses)
    : all;

  if (candidates.length === 0) {
    // Fallback to the legacy near-line search so callers that pass a
    // mismatched `existingClasses` (e.g. classes already rewritten by
    // a prior change in the same commit) still find a target.
    const legacy = findClassNameAttribute(lines, sourceLine);
    if (legacy) return { ok: true, match: legacy };
    return { ok: false, reason: "not-found", count: 0 };
  }

  if (candidates.length === 1) {
    return { ok: true, match: candidates[0] };
  }

  // Multiple candidates — need sourceLine to disambiguate.
  if (sourceLine == null || sourceLine <= 0) {
    return { ok: false, reason: "ambiguous", count: candidates.length };
  }

  // Pick the candidate whose lineIdx is closest to (sourceLine - 1).
  const target = sourceLine - 1;
  let best = candidates[0];
  let bestDist = Math.abs(best.lineIdx - target);
  for (let i = 1; i < candidates.length; i++) {
    const d = Math.abs(candidates[i].lineIdx - target);
    if (d < bestDist) {
      best = candidates[i];
      bestDist = d;
    }
  }
  return { ok: true, match: best };
}

// Per-process className → relative-file memo for the Turbopack fallback walk
// (issue #43). The walk is O(files-in-project); a dev session re-saves the same
// few elements many times, so caching the resolved file turns repeat saves into
// an O(1) lookup. The entry is VALIDATED on hit (the file is re-checked for the
// className), so a stale entry simply falls through to a fresh walk — the cache
// is a pure optimization with no effect on which file is chosen.
const classNameFileCache = new Map<string, string>();

/** Drop the className→file memo (exported for tests / explicit invalidation). */
export function clearClassNameFileCache(): void {
  classNameFileCache.clear();
}

/**
 * Does any className attribute in `lines` have exactly `className` as its
 * content? Scans ALL attributes (issue #66) — the first-match-only check
 * missed elements whose className isn't the first one in the file.
 */
function linesHaveExactClassName(lines: string[], className: string): boolean {
  return findAllClassNameAttributes(lines).some(
    (m) => lines[m.lineIdx].slice(m.start, m.end) === className,
  );
}

/** Does `relPath` (relative to projectRoot) still define `className` in a className attribute? */
async function fileStillHasClassName(
  projectRoot: string,
  relPath: string,
  className: string,
): Promise<boolean> {
  try {
    const content = await readFile(resolve(projectRoot, relPath), "utf-8");
    if (!content.includes(className)) return false;
    return linesHaveExactClassName(content.split("\n"), className);
  } catch {
    return false;
  }
}

// Common source roots are visited first so a typical repo resolves before the
// walk wanders into unrelated trees; ordering is a hint, not a restriction.
const SOURCE_DIR_PRIORITY = new Set(["src", "app", "pages", "components", "lib", "ui"]);

/**
 * Search project JSX/TSX files for one containing the given className string.
 * Used as a fallback when the client's JSX source hint is unavailable — no
 * usable fiber dev metadata (React ≤18 _debugSource / React 19 _debugStack),
 * e.g. Turbopack compiled-chunk stacks or production builds.
 * Returns the relative file path or null. Memoized per (projectRoot, className).
 */
async function findFileByClassName(
  projectRoot: string,
  className: string,
): Promise<string | null> {
  if (!className) return null;

  const cacheKey = `${projectRoot}\0${className}`;
  const cached = classNameFileCache.get(cacheKey);
  if (cached !== undefined) {
    if (await fileStillHasClassName(projectRoot, cached, className)) return cached;
    classNameFileCache.delete(cacheKey); // stale — fall through to a fresh walk
  }

  const JSX_EXTENSIONS = new Set([".tsx", ".jsx", ".js", ".ts"]);

  async function walk(dir: string): Promise<string | null> {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch { return null; }

    // Visit prioritized source directories first, then files, then the rest.
    const dirs = entries.filter((e) => e.isDirectory() && !e.isSymbolicLink() && !EXCLUDED_DIRS.has(e.name));
    dirs.sort((a, b) =>
      Number(SOURCE_DIR_PRIORITY.has(b.name)) - Number(SOURCE_DIR_PRIORITY.has(a.name)));
    const files = entries.filter((e) => e.isFile());

    for (const entry of files) {
      if (!JSX_EXTENSIONS.has(extname(entry.name))) continue;
      const filePath = join(dir, entry.name);
      try {
        const content = await readFile(filePath, "utf-8");
        if (content.includes(className)) {
          // Verify it's actually inside a className attribute — any attribute
          // in the file, not just the first (issue #66).
          if (linesHaveExactClassName(content.split("\n"), className)) {
            // Return path relative to project root
            return filePath.slice(projectRoot.length + 1);
          }
        }
      } catch { /* unreadable file */ }
    }

    for (const entry of dirs) {
      const found = await walk(join(dir, entry.name));
      if (found) return found;
    }
    return null;
  }

  const result = await walk(projectRoot);
  if (result) classNameFileCache.set(cacheKey, result);
  return result;
}

// ─── Class attach (class creation — audit 05) ───────────────────────────────
//
// commit.ts calls this after creating a `.name { }` rule for a class the user
// typed in the panel: the class token must also land on the JSX element's
// className attribute. This REUSES the className-location machinery above
// (findClassNameForChange / parseClassNameOnLine) but deliberately NOT
// mergeClasses — the Tailwind conflict merge groups by utility prefix, so a
// plain-class attach like "text-brand" onto "text-large" would EAT the
// existing class. A plain attach is a whole-token append with dedupe.

export type AttachClassResult =
  | { ok: true; file: string; changed: boolean }
  | { ok: false; reason: string };

/** Append `className` to a class string as a whole token (idempotent). */
function appendClassToken(current: string, className: string): string | null {
  const tokens = current.trim().split(/\s+/).filter(Boolean);
  if (tokens.includes(className)) return null; // already attached
  tokens.push(className);
  return tokens.join(" ");
}

/**
 * Insert ` className="x"` right after the tag name of the first JSX opener on
 * `line`. Returns null when the line has no opener (caller tries the next
 * candidate line).
 */
function insertClassNameAttributeOnLine(line: string, className: string): string | null {
  const m = line.match(/<([A-Za-z][\w.:-]*)/);
  if (!m) return null;
  const at = m.index! + m[0].length;
  return line.slice(0, at) + ` className="${className}"` + line.slice(at);
}

/**
 * Attach `className` to the JSX source element's className attribute.
 *
 *  - `existingClasses` non-empty → locate the attribute whose content matches
 *    (findClassNameForChange — the issue-#42 disambiguation) and append the
 *    token.
 *  - `existingClasses` empty → the element has no classes in source: insert a
 *    fresh `className="x"` attribute at the fiber's sourceLine (merging into
 *    a parseable empty/literal attribute if one is already there; refusing a
 *    non-literal expression with an accurate reason).
 *
 * Path safety mirrors handleTailwindCommit: resolveSafe (string-level) +
 * isRealPathWithinRoot (symlink-resolved) before any read/write.
 */
export async function attachClassToJSX(
  projectRoot: string,
  opts: {
    className: string;
    sourceFile?: string;
    sourceLine?: number;
    existingClasses?: string;
  }
): Promise<AttachClassResult> {
  let file = opts.sourceFile;
  if (!file && opts.existingClasses) {
    file = (await findFileByClassName(projectRoot, opts.existingClasses)) ?? undefined;
  }
  if (!file) {
    return { ok: false, reason: "no JSX source file resolved for the element" };
  }

  let filePath: string;
  try {
    filePath = resolveSafe(projectRoot, file);
    await stat(filePath);
    if (!(await isRealPathWithinRoot(filePath, projectRoot))) {
      return { ok: false, reason: `resolved path escapes project root: "${file}"` };
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, reason: `cannot open "${file}": ${message}` };
  }

  const source = await readFile(filePath, "utf-8");
  const lines = source.split("\n");
  const existing = (opts.existingClasses ?? "").trim();

  const write = async (): Promise<void> => {
    await writeFile(filePath, lines.join("\n"), "utf-8");
  };

  if (existing) {
    const lookup = findClassNameForChange(lines, existing, opts.sourceLine);
    if (!lookup.ok) {
      return {
        ok: false,
        reason:
          lookup.reason === "ambiguous"
            ? `ambiguous className "${existing}" in ${file}: ${lookup.count} matching elements and no sourceLine to disambiguate`
            : `className attribute matching "${existing}" not found in ${file}`,
      };
    }
    const { lineIdx, start, end } = lookup.match;
    const next = appendClassToken(lines[lineIdx].slice(start, end), opts.className);
    if (next === null) return { ok: true, file, changed: false }; // idempotent re-save
    lines[lineIdx] = lines[lineIdx].slice(0, start) + next + lines[lineIdx].slice(end);
    await write();
    return { ok: true, file, changed: true };
  }

  // No classes in source — insert a fresh className attribute at the element.
  if (opts.sourceLine == null || opts.sourceLine <= 0) {
    return {
      ok: false,
      reason: `element has no className in ${file} and no source line was provided to insert one`,
    };
  }
  const target = opts.sourceLine - 1; // 1-indexed fiber line → 0-indexed
  const order = [target, target + 1, target - 1, target + 2, target - 2].filter(
    (i) => i >= 0 && i < lines.length
  );
  for (const i of order) {
    const line = lines[i];
    if (!/<[A-Za-z]/.test(line)) continue;
    if (/className\s*=/.test(line)) {
      // The element ALREADY carries a className in source. A parseable literal
      // (e.g. className="") gets the token appended; a non-literal expression
      // (className={styles.card}) is refused — rewriting it would corrupt code.
      const parsed = parseClassNameOnLine(line, i);
      if (parsed) {
        const next = appendClassToken(line.slice(parsed.start, parsed.end), opts.className);
        if (next === null) return { ok: true, file, changed: false };
        lines[i] = line.slice(0, parsed.start) + next + line.slice(parsed.end);
        await write();
        return { ok: true, file, changed: true };
      }
      return {
        ok: false,
        reason: `className at ${file}:${i + 1} is a non-literal expression — attach ".${opts.className}" manually`,
      };
    }
    const inserted = insertClassNameAttributeOnLine(line, opts.className);
    if (inserted === null) continue;
    lines[i] = inserted;
    await write();
    return { ok: true, file, changed: true };
  }
  return {
    ok: false,
    reason: `no JSX element found near ${file}:${opts.sourceLine} — cannot attach ".${opts.className}"`,
  };
}

// ─── Element-scope inline style write (audit 06) ─────────────────────────────
//
// Element scope previews on ONE element, so it must persist to that one
// element: commit.ts routes `elementScope`-tagged changes here, and the change
// lands in the element's JSX `style` attribute — NEVER in the shared CSS class
// rule (the silent blast-radius widening this fixes). Reuses the
// className-location machinery above (findClassNameForChange /
// findFileByClassName — the issue-#42 disambiguation and the issue-#43
// fallback walk) to anchor on the element's opening tag.

export type InlineStyleResult =
  | { ok: true; file: string; changed: boolean }
  | { ok: false; reason: string };

type TagSpan = {
  /** Offset of the opening `<`. */
  start: number;
  /** Offset just past the tag name (the insertion point for a new attribute). */
  nameEnd: number;
  /** Offset of the closing `>` of the opening tag. */
  end: number;
};

/** Skip a quoted string starting at `i` (source[i] is the quote). Returns the
 *  offset just past the closing quote (or `limit`). */
function skipString(source: string, i: number, limit: number): number {
  const q = source[i];
  i++;
  while (i < limit && source[i] !== q) {
    if (source[i] === "\\") i++;
    i++;
  }
  return i + 1;
}

/**
 * Scan a JSX opening tag from its `<`. Tracks strings and `{ }` expression
 * depth so a `>` inside an attribute expression (arrow function, comparison)
 * never terminates the scan early. Returns null when `start` isn't actually a
 * tag opener (e.g. a `<` comparison) or the tag never closes.
 */
function scanTagSpan(source: string, start: number): TagSpan | null {
  const m = /^<[A-Za-z][\w.:-]*/.exec(source.slice(start, start + 200));
  if (!m) return null;
  let i = start + m[0].length;
  const nameEnd = i;
  let depth = 0;
  const limit = Math.min(source.length, start + 20000);
  while (i < limit) {
    const ch = source[i];
    if (ch === '"' || ch === "'" || ch === "`") {
      i = skipString(source, i, limit);
      continue;
    }
    if (ch === "{") { depth++; i++; continue; }
    if (ch === "}") { depth--; i++; continue; }
    if (depth === 0) {
      if (ch === ">") return { start, nameEnd, end: i };
      if (ch === "<") return null; // another opener before this one closed
    }
    i++;
  }
  return null;
}

/** The nearest opening tag whose span contains `anchorOffset` (a position
 *  inside one of its attributes, e.g. the className content). */
function findEnclosingTag(source: string, anchorOffset: number): TagSpan | null {
  for (let i = anchorOffset; i >= 0 && anchorOffset - i <= 4000; i--) {
    if (source[i] === "<" && /[A-Za-z]/.test(source[i + 1] ?? "")) {
      const span = scanTagSpan(source, i);
      if (span && span.end >= anchorOffset) return span;
    }
  }
  return null;
}

/** Offset of the `}` matching the `{` at `openPos` (string-aware), or null. */
function matchBrace(source: string, openPos: number): number | null {
  let depth = 0;
  let i = openPos;
  const limit = Math.min(source.length, openPos + 20000);
  while (i < limit) {
    const ch = source[i];
    if (ch === '"' || ch === "'" || ch === "`") {
      i = skipString(source, i, limit);
      continue;
    }
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return i;
    }
    i++;
  }
  return null;
}

/**
 * Find the top-level `style` attribute inside a tag span. Returns the offset
 * of the attribute value's first char after `=` (whitespace skipped), or
 * `{ valueStart: null }` when the tag has a bare `style` with no value, or
 * null when the tag has no style attribute at all.
 */
function findStyleAttr(
  source: string,
  tag: TagSpan
): { valueStart: number | null } | null {
  let i = tag.nameEnd;
  let depth = 0;
  while (i < tag.end) {
    const ch = source[i];
    if (ch === '"' || ch === "'" || ch === "`") {
      i = skipString(source, i, tag.end);
      continue;
    }
    if (ch === "{") { depth++; i++; continue; }
    if (ch === "}") { depth--; i++; continue; }
    if (depth === 0 && /[A-Za-z_]/.test(ch)) {
      const idm = /^[\w-]+/.exec(source.slice(i, i + 200))!;
      i += idm[0].length;
      if (idm[0] === "style") {
        let j = i;
        while (j < tag.end && /\s/.test(source[j])) j++;
        if (source[j] !== "=") return { valueStart: null };
        j++;
        while (j < tag.end && /\s/.test(source[j])) j++;
        return { valueStart: j };
      }
      continue;
    }
    i++;
  }
  return null;
}

/** Split `[from, to)` on top-level commas (string/brace/paren/bracket aware),
 *  dropping all-whitespace segments. */
function splitTopLevel(
  source: string,
  from: number,
  to: number
): Array<{ start: number; end: number }> {
  const segs: Array<{ start: number; end: number }> = [];
  let depth = 0;
  let segStart = from;
  let i = from;
  while (i < to) {
    const ch = source[i];
    if (ch === '"' || ch === "'" || ch === "`") {
      i = skipString(source, i, to);
      continue;
    }
    if (ch === "{" || ch === "(" || ch === "[") { depth++; i++; continue; }
    if (ch === "}" || ch === ")" || ch === "]") { depth--; i++; continue; }
    if (ch === "," && depth === 0) {
      segs.push({ start: segStart, end: i });
      segStart = i + 1;
    }
    i++;
  }
  segs.push({ start: segStart, end: to });
  return segs.filter((s) => source.slice(s.start, s.end).trim() !== "");
}

/**
 * CSS property → React style-object key. `background-color` → backgroundColor,
 * `-webkit-line-clamp` → WebkitLineClamp, `-ms-overflow-style` →
 * msOverflowStyle. Custom properties (`--x`) keep their verbatim (quoted) form.
 */
function cssPropToJsxKey(prop: string): string {
  if (prop.startsWith("--")) return prop;
  let p = prop;
  let vendor = false;
  if (p.startsWith("-")) {
    vendor = true;
    p = p.slice(1);
  }
  const segs = p.split("-").filter(Boolean);
  if (segs.length === 0) return prop;
  let out =
    segs[0] +
    segs
      .slice(1)
      .map((s) => s[0].toUpperCase() + s.slice(1))
      .join("");
  if (vendor && !p.startsWith("ms-")) out = out[0].toUpperCase() + out.slice(1);
  return out;
}

/** Normalize an authored style-object key for comparison: quoted css-case
 *  spellings ("background-color") fold onto the camelCase key. */
function normalizeStyleKey(key: string): string {
  if (key.startsWith("--")) return key;
  return key.includes("-") ? cssPropToJsxKey(key) : key;
}

/** Identifier keys stay bare; anything else (custom properties) is quoted. */
function formatStyleKey(key: string): string {
  return /^[A-Za-z_$][\w$]*$/.test(key) ? key : JSON.stringify(key);
}

type SourceEdit = { start: number; end: number; text: string };

function applyEdits(source: string, edits: SourceEdit[]): string {
  const sorted = [...edits].sort((a, b) => b.start - a.start || b.end - a.end);
  let out = source;
  for (const e of sorted) {
    out = out.slice(0, e.start) + e.text + out.slice(e.end);
  }
  return out;
}

/** 1-indexed line number of `offset` in `source` (for error messages). */
function lineOf(source: string, offset: number): number {
  let line = 1;
  for (let i = 0; i < offset && i < source.length; i++) {
    if (source[i] === "\n") line++;
  }
  return line;
}

/**
 * Pure merge: locate the element's opening tag in `source` and merge the
 * declarations into its `style` attribute. Returns the next source text, or an
 * accurate refusal — non-literal style expressions (`style={styles}`,
 * spreads, computed entries) are never rewritten.
 */
function mergeInlineStyleIntoSource(
  source: string,
  opts: {
    declarations: Array<{ prop: string; value: string }>;
    sourceLine?: number;
    existingClasses?: string;
  },
  file: string
): { ok: true; next: string } | { ok: false; reason: string } {
  const lines = source.split("\n");
  const lineStarts: number[] = new Array(lines.length);
  {
    let off = 0;
    for (let i = 0; i < lines.length; i++) {
      lineStarts[i] = off;
      off += lines[i].length + 1;
    }
  }

  // ── Anchor: the element's opening tag ──
  const existing = (opts.existingClasses ?? "").trim();
  let tag: TagSpan | null = null;
  if (existing) {
    const lookup = findClassNameForChange(lines, existing, opts.sourceLine);
    if (!lookup.ok) {
      return {
        ok: false,
        reason:
          lookup.reason === "ambiguous"
            ? `ambiguous className "${existing}" in ${file}: ${lookup.count} matching elements and no sourceLine to disambiguate — refusing to guess which element to style`
            : `can't locate the element's JSX in ${file} (no className attribute matches "${existing}") — use class scope or edit the source manually`,
      };
    }
    const anchorOffset = lineStarts[lookup.match.lineIdx] + lookup.match.start;
    tag = findEnclosingTag(source, anchorOffset);
    if (!tag) {
      return {
        ok: false,
        reason: `can't parse the JSX opening tag at ${file}:${lookup.match.lineIdx + 1} — edit the style attribute manually`,
      };
    }
  } else {
    if (opts.sourceLine == null || opts.sourceLine <= 0) {
      return {
        ok: false,
        reason: `can't locate the element's JSX in ${file} (element has no classes and no source line) — use class scope or edit the source manually`,
      };
    }
    const target = opts.sourceLine - 1; // 1-indexed fiber line → 0-indexed
    const order = [target, target + 1, target - 1, target + 2, target - 2].filter(
      (i) => i >= 0 && i < lines.length
    );
    for (const i of order) {
      const m = lines[i].match(/<[A-Za-z]/);
      if (!m) continue;
      const span = scanTagSpan(source, lineStarts[i] + m.index!);
      if (span) {
        tag = span;
        break;
      }
    }
    if (!tag) {
      return {
        ok: false,
        reason: `no JSX element found near ${file}:${opts.sourceLine} — can't write the inline style`,
      };
    }
  }

  const at = `${file}:${lineOf(source, tag.start)}`;

  // ── Declarations, deduped by resolved key (last write wins) ──
  const byKey = new Map<string, { key: string; value: string }>();
  for (const d of opts.declarations) {
    byKey.set(cssPropToJsxKey(d.prop), {
      key: cssPropToJsxKey(d.prop),
      value: d.value,
    });
  }
  const decls = Array.from(byKey.values());

  // ── No style attribute: insert a fresh one after the tag name ──
  const attr = findStyleAttr(source, tag);
  if (attr === null) {
    const body = decls
      .map((d) => `${formatStyleKey(d.key)}: ${JSON.stringify(d.value)}`)
      .join(", ");
    return {
      ok: true,
      next: applyEdits(source, [
        { start: tag.nameEnd, end: tag.nameEnd, text: ` style={{ ${body} }}` },
      ]),
    };
  }

  // ── Existing style attribute: it must be a plain object literal ──
  const nonLiteral = {
    ok: false as const,
    reason: `style at ${at} is not a plain object literal — edit the style object manually`,
  };
  if (attr.valueStart === null || source[attr.valueStart] !== "{") {
    return nonLiteral;
  }
  const exprClose = matchBrace(source, attr.valueStart);
  if (exprClose === null) return nonLiteral;
  let objOpen = attr.valueStart + 1;
  while (objOpen < exprClose && /\s/.test(source[objOpen])) objOpen++;
  if (source[objOpen] !== "{") return nonLiteral; // style={styles} / expressions
  const objClose = matchBrace(source, objOpen);
  if (
    objClose === null ||
    objClose > exprClose ||
    source.slice(objClose + 1, exprClose).trim() !== ""
  ) {
    return nonLiteral; // e.g. style={cond ? {…} : {…}}
  }

  // ── Parse the object body into simple `key: value` entries ──
  type ObjEntry = { key: string; valStart: number; valEnd: number };
  const entries: ObjEntry[] = [];
  for (const seg of splitTopLevel(source, objOpen + 1, objClose)) {
    const text = source.slice(seg.start, seg.end);
    if (/^\s*\.\.\./.test(text)) {
      return {
        ok: false,
        reason: `style object at ${at} contains a spread — edit the style object manually`,
      };
    }
    const km = /^(\s*)("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|[A-Za-z_$][\w$]*)(\s*):/.exec(
      text
    );
    if (!km) {
      return {
        ok: false,
        reason: `style object at ${at} has an entry that isn't a simple key: value pair — edit the style object manually`,
      };
    }
    const rawKey = km[2];
    const key =
      rawKey.startsWith('"') || rawKey.startsWith("'")
        ? rawKey.slice(1, -1)
        : rawKey;
    let valStart = seg.start + km[0].length;
    while (valStart < seg.end && /\s/.test(source[valStart])) valStart++;
    let valEnd = seg.end;
    while (valEnd > valStart && /\s/.test(source[valEnd - 1])) valEnd--;
    if (valEnd <= valStart) return nonLiteral; // `key:` with no value
    entries.push({ key, valStart, valEnd });
  }

  // ── Merge: replace matching keys (last occurrence wins), append the rest ──
  const edits: SourceEdit[] = [];
  const additions: string[] = [];
  for (const d of decls) {
    const matching = entries.filter((e) => normalizeStyleKey(e.key) === d.key);
    const target = matching[matching.length - 1];
    const lit = JSON.stringify(d.value);
    if (target) {
      edits.push({ start: target.valStart, end: target.valEnd, text: lit });
    } else {
      additions.push(`${formatStyleKey(d.key)}: ${lit}`);
    }
  }
  if (additions.length > 0) {
    let p = objClose - 1;
    while (p > objOpen && /\s/.test(source[p])) p--;
    if (p === objOpen) {
      // empty object literal `{}`
      edits.push({ start: objOpen + 1, end: objOpen + 1, text: ` ${additions.join(", ")} ` });
    } else if (source[p] === ",") {
      edits.push({ start: p + 1, end: p + 1, text: ` ${additions.join(", ")}` });
    } else {
      edits.push({ start: p + 1, end: p + 1, text: `, ${additions.join(", ")}` });
    }
  }

  return { ok: true, next: applyEdits(source, edits) };
}

/**
 * Merge element-scoped declarations into the element's JSX `style` attribute.
 *
 * Anchoring mirrors attachClassToJSX: `existingClasses` locates the className
 * attribute (issue-#42 disambiguation via `sourceLine`; issue-#43 project walk
 * when no source-file hint exists); a class-less element falls back to the
 * fiber `sourceLine`. Path safety mirrors every other write: resolveSafe
 * (string-level) + isRealPathWithinRoot (symlink-resolved) before any
 * read/write. `acquireLock` (injected by commit.ts) serializes the
 * read-modify-write against overlapping requests on the same file (issue #64).
 *
 * Never falls back to a CSS rule — an unresolvable anchor is an accurate
 * per-batch failure and the file is left untouched.
 */
export async function applyInlineStyleToJSX(
  projectRoot: string,
  opts: {
    declarations: Array<{ prop: string; value: string }>;
    sourceFile?: string;
    sourceLine?: number;
    existingClasses?: string;
  },
  acquireLock?: (absPath: string) => Promise<() => void>
): Promise<InlineStyleResult> {
  let file = opts.sourceFile;
  if (!file && opts.existingClasses) {
    file = (await findFileByClassName(projectRoot, opts.existingClasses)) ?? undefined;
  }
  if (!file) {
    return {
      ok: false,
      reason:
        "can't locate the element's JSX (no source hint and no className anchor) — use class scope or edit the source manually",
    };
  }

  let filePath: string;
  try {
    filePath = resolveSafe(projectRoot, file);
    await stat(filePath);
    if (!(await isRealPathWithinRoot(filePath, projectRoot))) {
      return { ok: false, reason: `resolved path escapes project root: "${file}"` };
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, reason: `cannot open "${file}": ${message}` };
  }

  const release = acquireLock ? await acquireLock(filePath) : null;
  try {
    const source = await readFile(filePath, "utf-8");
    const merged = mergeInlineStyleIntoSource(source, opts, file);
    if (!merged.ok) return merged;
    if (merged.next === source) return { ok: true, file, changed: false };
    await writeFile(filePath, merged.next, "utf-8");
    return { ok: true, file, changed: true };
  } finally {
    release?.();
  }
}

/**
 * Handle Tailwind class commit: read JSX files, merge classes, write back.
 */
export async function handleTailwindCommit(
  changes: TailwindChange[],
  cwd?: string
): Promise<TailwindCommitResult> {
  const projectRoot = cwd ?? process.cwd();
  const result: TailwindCommitResult = { written: [], failed: [] };

  // Group changes by file to batch writes
  const changesByFile = new Map<string, TailwindChange[]>();
  for (const change of changes) {
    let file: string | undefined = change.sourceFile;
    // Fallback: when the client couldn't derive a JSX source hint from fiber
    // dev metadata (React ≤18 _debugSource / React 19 _debugStack), search
    // the project for the className
    if (!file && change.existingClasses) {
      file = (await findFileByClassName(projectRoot, change.existingClasses)) ?? undefined;
    }
    if (!file) {
      result.failed.push({ ...change, reason: "no source file specified" });
      continue;
    }
    const resolved = { ...change, sourceFile: file };
    const existing = changesByFile.get(file) ?? [];
    existing.push(resolved);
    changesByFile.set(file, existing);
  }

  for (const [sourceFile, fileChanges] of changesByFile) {
    try {
      // Reject path traversal attempts ("..": throw; string containment:
      // throw) and resolve the candidate confined to the root.
      const filePath = resolveSafe(projectRoot, sourceFile);

      // Verify file exists
      await stat(filePath);

      // Reject a resolved path that is a symlink escaping the root (issue #22),
      // so a malicious repo can't redirect a className write outside the project.
      if (!(await isRealPathWithinRoot(filePath, projectRoot))) {
        throw new Error("Path traversal detected: resolved path escapes project root");
      }

      const source = await readFile(filePath, "utf-8");
      const lines = source.split("\n");
      let modified = false;

      for (const change of fileChanges) {
        const lookup = findClassNameForChange(
          lines,
          change.existingClasses,
          change.sourceLine
        );
        if (!lookup.ok) {
          const reason =
            lookup.reason === "ambiguous"
              ? `ambiguous className "${change.existingClasses}" in ${sourceFile}: ${lookup.count} matching elements found and no sourceLine provided to disambiguate — refusing to save to avoid modifying the wrong element`
              : `className attribute not found in ${sourceFile}`;
          result.failed.push({ ...change, reason });
          continue;
        }

        const found = lookup.match;
        const currentClasses = lines[found.lineIdx].slice(
          found.start,
          found.end
        );
        const merged = mergeClasses(currentClasses, change.newClasses);

        lines[found.lineIdx] =
          lines[found.lineIdx].slice(0, found.start) +
          merged +
          lines[found.lineIdx].slice(found.end);

        modified = true;
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
