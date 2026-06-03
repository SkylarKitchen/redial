/**
 * commitTailwind.ts — Write Tailwind class changes back to JSX source files
 *
 * Finds the className attribute at the given source line, merges new classes
 * using conflict-aware logic (e.g. w-4 + w-6 -> w-6, not w-4 w-6).
 */

import { readFile, writeFile, stat, readdir } from "fs/promises";
import { resolve, normalize, join, extname } from "path";

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
 * Ensure a resolved path is contained within the project root.
 * Prevents path traversal attacks.
 */
function assertWithinRoot(resolvedPath: string, projectRoot: string): void {
  const normalizedRoot = normalize(projectRoot);
  const normalizedPath = normalize(resolvedPath);
  if (
    !normalizedPath.startsWith(normalizedRoot + "/") &&
    normalizedPath !== normalizedRoot
  ) {
    throw new Error(
      "Path traversal detected: resolved path escapes project root"
    );
  }
}

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
 * "flex items-center" + "p-4" -> "flex items-center p-4"
 * "w-4 h-8" + "w-6" -> "w-6 h-8"
 * "bg-blue-500 text-white" + "bg-red-500" -> "bg-red-500 text-white"
 */
export function mergeClasses(existing: string, newClasses: string): string {
  const existingList = existing.trim().split(/\s+/).filter(Boolean);
  const newList = newClasses.trim().split(/\s+/).filter(Boolean);

  if (newList.length === 0) return existing;
  if (existingList.length === 0) return newClasses;

  // Build a set of groups from the new classes
  const newGroups = new Map<string, string>();
  for (const cls of newList) {
    newGroups.set(getUtilityGroup(cls), cls);
  }

  // Filter out existing classes that conflict with new ones
  const kept = existingList.filter(
    (cls) => !newGroups.has(getUtilityGroup(cls))
  );

  // Append the new classes
  return [...kept, ...newList].join(" ");
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

/**
 * Search project JSX/TSX files for one containing the given className string.
 * Used as a fallback when React _debugSource is unavailable (e.g., Turbopack).
 * Returns the relative file path or null.
 */
async function findFileByClassName(
  projectRoot: string,
  className: string,
): Promise<string | null> {
  if (!className) return null;

  const JSX_EXTENSIONS = new Set([".tsx", ".jsx", ".js", ".ts"]);
  const SKIP_DIRS = new Set(["node_modules", ".next", ".git", "dist", "build", ".turbo"]);

  async function walk(dir: string): Promise<string | null> {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch { return null; }

    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue;
        const found = await walk(join(dir, entry.name));
        if (found) return found;
      } else if (JSX_EXTENSIONS.has(extname(entry.name))) {
        const filePath = join(dir, entry.name);
        try {
          const content = await readFile(filePath, "utf-8");
          if (content.includes(className)) {
            // Verify it's actually inside a className attribute
            const lines = content.split("\n");
            const found = findClassNameAttribute(lines);
            if (found) {
              const foundClasses = lines[found.lineIdx].slice(found.start, found.end);
              if (foundClasses === className) {
                // Return path relative to project root
                return filePath.slice(projectRoot.length + 1);
              }
            }
          }
        } catch { /* unreadable file */ }
      }
    }
    return null;
  }

  return walk(projectRoot);
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
    // Fallback: when _debugSource is unavailable, search project for the className
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
      // Reject path traversal attempts
      const segments = sourceFile.split(/[/\\]/);
      if (segments.includes("..")) {
        throw new Error(
          "Path traversal detected: sourceFile contains '..' segment"
        );
      }

      const filePath = resolve(projectRoot, sourceFile);
      assertWithinRoot(filePath, projectRoot);

      // Verify file exists
      await stat(filePath);

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
