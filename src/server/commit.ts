/**
 * commit.ts — the write orchestrator for direct CSS file saves.
 *
 * Receives a list of { prop, from, to, sourceFile?, sourceLine? } changes,
 * finds the property in the source file using tiered search,
 * and does a surgical string replacement.
 *
 * Works for the 90% case: literal CSS values in .module.scss files.
 * Falls back gracefully for SCSS variables, calc(), etc.
 *
 * The mechanics live in sibling modules (issue #138):
 *  - cssMask.ts     comment/string/url() masking (the masked-view contract)
 *  - cssSearch.ts   block scanners, tiered search, in-block mutation
 *  - cssResolve.ts  source-file resolution (path + confidence)
 * This file owns validation, batching, write serialization, and the
 * per-change save ladder that stitches those pieces together.
 */

import { readFile, writeFile } from "fs/promises";
import { isRealPathWithinRoot } from "./pathSafety";
import { attachClassToJSX, applyInlineStyleToJSX } from "./commitTailwind";
import { escapeRegex, maskedLinesOf } from "./cssMask";
import {
  replacePropRegex,
  searchPseudoClassBlock,
  searchNestedPseudoBlock,
  findClassBlockEnd,
  findClassBlockOpen,
  findPseudoBlockOpen,
  findNestedPseudoBlockOpen,
  findPropInBlock,
  insertDeclarationIntoBlock,
  detectIndentUnit,
  appendClassBlock,
  applyBreakpointChange,
  applyModeChange,
  searchClassBlockFuzzy,
  tryShorthandFallback,
  findPropertyInFile,
  LONGHAND_TO_SHORTHAND,
} from "./cssSearch";
import {
  resolveSourceFileDetailed,
  findVariableDefinitionFile,
} from "./cssResolve";
import {
  isValidCSSProp,
  isValidCSSClassName,
  isSafeCSSValue,
  isInvalidDeclaration,
} from "../lib/css";

/** Valid pseudo-class states — rejects anything not on this list to prevent CSS injection. */
const VALID_STATES = new Set([
  "hover", "focus", "active", "visited",
  "focus-within", "focus-visible", "first-child", "last-child",
]);

// Containment guards live in pathSafety.ts (single owner — issue #69, which
// fixed assertWithinRoot's hardcoded "/" separator breaking Windows saves);
// isRealPathWithinRoot is re-exported so existing importers keep working.
export { isRealPathWithinRoot } from "./pathSafety";

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
  /**
   * Class-creation descriptor (audit 05 — the Webflow "type a class name"
   * flow). When present, the server (a) appends a `.name { }` rule block to
   * the resolved stylesheet if the class has no rule there yet, and (b)
   * attaches the class token to the JSX source's className attribute
   * (commitTailwind.attachClassToJSX). `existingClasses` is the element's
   * class string BEFORE the session attach — the JSX disambiguation anchor.
   */
  createClass?: {
    name: string;
    jsxSourceFile?: string;
    jsxSourceLine?: number;
    existingClasses?: string;
  };
  /**
   * Element-scope persistence descriptor (audit 06 — element scope previews on
   * ONE element, so it must save to that one element). When present, the
   * change is merged into the element's JSX `style` attribute at the
   * fiber-resolved location (`applyInlineStyleToJSX`, same anchors createClass
   * uses) and is NEVER routed into a CSS rule — even when the payload also
   * carries `sourceFile`/`className`. An unresolvable anchor is an accurate
   * per-item failure, not a fallback to the shared class rule.
   */
  elementScope?: {
    jsxSourceFile?: string;
    jsxSourceLine?: number;
    existingClasses?: string;
  };
  /**
   * Responsive breakpoint (issue #53). When present, the change targets the
   * `@media (min-width: <minWidth>px)` block instead of the base rule:
   * locate a matching block containing a rule for `className` and
   * replace/insert the declaration there; create the rule inside a matching
   * block that lacks it; append a whole new block at EOF when no block
   * matches. Condition matching tolerates spacing variants and em/rem
   * equivalents (×16); NEW blocks are always written in the px form.
   */
  breakpoint?: {
    /** Engine breakpoint id (informational — the write keys off minWidth). */
    id?: string;
    /** min-width in px. Positive finite number. */
    minWidth: number;
  };
  /**
   * Theme-mode defining selector (issue #53, second half). When present, the
   * change is a CSS-variable mode override: `prop` (a custom property) is
   * written inside the top-level rule block whose selector text matches —
   * find-or-REFUSE. A missing block is a per-item failure (the client keeps
   * its clipboard side-channel); the change never falls through to the
   * base/variable search, which would happily land the value in `:root` or a
   * sibling mode's block. Mutually exclusive with `breakpoint` and `state`:
   * modes are their own override dimension.
   */
  modeSelector?: string;
};

export type CommitResult = {
  written: string[];
  failed: Array<CommitChange & { reason: string }>;
};

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
  // Mode overrides (issue #53) are CSS-variable writes into a mode's defining
  // block. The selector travels into a block-text comparison, so structural
  // CSS characters would let a crafted payload break out of selector position;
  // and the narrow prop contract keeps this from becoming a generic
  // write-anything-anywhere backdoor.
  if (change.modeSelector != null) {
    if (!change.prop.startsWith("--"))
      return `modeSelector is only valid for CSS custom properties, got "${change.prop}"`;
    if (
      change.modeSelector.trim() === "" ||
      /[{};\n\r]|\/\*|\*\//.test(change.modeSelector)
    )
      return `unsafe mode selector: "${change.modeSelector}"`;
    if (change.breakpoint != null)
      return `a change can't carry both modeSelector and breakpoint — modes and breakpoints are distinct override dimensions`;
    if (change.state != null)
      return `a change can't carry both modeSelector and state — a mode block has no pseudo-state dimension`;
  }
  if (change.createClass != null && !isValidCSSClassName(change.createClass.name))
    return `invalid class name for createClass: "${change.createClass.name}"`;
  // Zero-width splice guard: escapeRegex("") is "", so a replacement pattern
  // built from an empty `from` matches only the declaration prefix and the
  // substitution SPLICES `to` into the middle of the old value ("color: blue;"
  // → "color: redblue;"). A plain base-path value replacement has no
  // legitimate empty `from` (getComputedStyle never returns "" for a standard
  // longhand), so it's malformed input. Exempt the shapes whose `from` is
  // legitimately empty: state saves (diffState reports from:"" by contract —
  // pseudo computed values can't be read), fresh custom-prop adds (unset vars
  // compute to ""), and createClass / breakpoint / elementScope
  // (append/create semantics — `from` is unused there).
  if (
    change.from.trim() === "" &&
    change.createClass == null &&
    change.breakpoint == null &&
    change.state == null &&
    change.elementScope == null &&
    !change.prop.startsWith("--")
  )
    return `empty "from" value — a literal value replacement would zero-width match and splice the new value into the old one`;
  return null;
}

// --- Write serialization (issue #64) ---
// The read → mutate → write phase must not interleave across overlapping
// requests that resolve to the same file: both would read the original
// content and the second write would silently discard the first request's
// edits (last writer wins). A module-level promise chain keyed by resolved
// absolute path serializes that phase; different files still run concurrently.
const fileWriteLocks = new Map<string, Promise<void>>();

/** Wait for the previous holder of `key`, then hold the lock until the
 *  returned release function is called. */
async function acquireFileLock(key: string): Promise<() => void> {
  const prev = fileWriteLocks.get(key) ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });
  const tail = prev.then(() => current);
  fileWriteLocks.set(key, tail);
  // Drop the map entry once the chain drains (we're still the tail), so the
  // lock table doesn't grow unboundedly across a long dev session.
  void tail.then(() => {
    if (fileWriteLocks.get(key) === tail) fileWriteLocks.delete(key);
  });
  await prev;
  return release;
}

/** Shape-check one batch element BEFORE any field access (issue #65), so a
 *  null / non-object / wrong-typed entry fails per-item instead of throwing
 *  a TypeError that 500s the whole request. */
function isWellFormedChange(change: unknown): change is CommitChange {
  if (typeof change !== "object" || change === null || Array.isArray(change)) {
    return false;
  }
  const c = change as Record<string, unknown>;
  const cc = c.createClass;
  const bp = c.breakpoint;
  const es = c.elementScope;
  return (
    typeof c.prop === "string" &&
    typeof c.from === "string" &&
    typeof c.to === "string" &&
    // modeSelector, when present, must be a string — it is compared against
    // selector text and interpolated into failure reasons.
    (c.modeSelector === undefined || typeof c.modeSelector === "string") &&
    // elementScope, when present, must be an object whose (all optional)
    // anchor fields carry the right types — they flow into path resolution
    // and line arithmetic, so anything else fails per-item, never as a 500.
    (es === undefined ||
      (typeof es === "object" &&
        es !== null &&
        !Array.isArray(es) &&
        ((es as Record<string, unknown>).jsxSourceFile === undefined ||
          typeof (es as Record<string, unknown>).jsxSourceFile === "string") &&
        ((es as Record<string, unknown>).jsxSourceLine === undefined ||
          typeof (es as Record<string, unknown>).jsxSourceLine === "number") &&
        ((es as Record<string, unknown>).existingClasses === undefined ||
          typeof (es as Record<string, unknown>).existingClasses === "string"))) &&
    // createClass, when present, must be an object with a string name — an
    // arbitrary shape here would defeat the isValidCSSClassName gate below.
    (cc === undefined ||
      (typeof cc === "object" &&
        cc !== null &&
        !Array.isArray(cc) &&
        typeof (cc as Record<string, unknown>).name === "string")) &&
    // breakpoint, when present, must carry a positive finite numeric minWidth
    // (issue #53) — the number is interpolated into a written `@media`
    // condition, so anything else fails per-item here, never as a 500.
    (bp === undefined ||
      (typeof bp === "object" &&
        bp !== null &&
        !Array.isArray(bp) &&
        typeof (bp as Record<string, unknown>).minWidth === "number" &&
        Number.isFinite((bp as Record<string, unknown>).minWidth as number) &&
        ((bp as Record<string, unknown>).minWidth as number) > 0))
  );
}

export async function handleCommit(
  changes: CommitChange[],
  cwd?: string
): Promise<CommitResult> {
  const projectRoot = cwd ?? process.cwd();
  const result: CommitResult = { written: [], failed: [] };

  // Element-scope changes (audit 06) are partitioned FIRST — before any
  // sourceFile handling — so they can never reach the CSS rule writer below.
  // Falling back to the shared class rule is the exact bug element scope
  // fixes, so the routing is structural, not best-effort. Grouped per anchor:
  // one element = one JSX style-object write.
  const inlineGroups = new Map<
    string,
    { anchor: NonNullable<CommitChange["elementScope"]>; changes: CommitChange[] }
  >();

  // Group changes by file to batch writes
  const changesByFile = new Map<string, CommitChange[]>();
  for (const change of changes) {
    // Issue #65: reject malformed elements per-item before any dereference.
    if (!isWellFormedChange(change)) {
      result.failed.push({
        prop: "",
        from: "",
        to: "",
        ...(typeof change === "object" && change !== null && !Array.isArray(change)
          ? change
          : {}),
        reason:
          "malformed change entry — expected an object with string prop/from/to fields",
      });
      continue;
    }
    if (change.elementScope) {
      const es = change.elementScope;
      const key = `${es.jsxSourceFile ?? ""}\0${es.jsxSourceLine ?? ""}\0${es.existingClasses ?? ""}`;
      const group = inlineGroups.get(key) ?? { anchor: es, changes: [] };
      group.changes.push(change);
      inlineGroups.set(key, group);
      continue;
    }
    if (!change.sourceFile) {
      result.failed.push({
        ...change,
        // Class creation is conservative: when the client couldn't resolve a
        // target stylesheet we say so — we never guess a file to create into.
        reason: change.createClass
          ? `cannot create class ".${change.createClass.name}" — no target stylesheet resolved`
          : "no source file specified",
      });
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
    let releaseLock: (() => void) | null = null;
    try {
      // Resolve the actual file path (handles bare filenames + source maps).
      // `resolution` carries HOW the path was chosen (strategy + confidence)
      // alongside the path itself — bugs #66/#68 came from callers discarding
      // that. The write path's observable behavior doesn't branch on it (yet);
      // it's threaded here so diagnostics don't have to re-resolve.
      let resolution = await resolveSourceFileDetailed(
        projectRoot,
        sourceFile,
        fileChanges[0]?.componentName,
        fileChanges[0]?.cssHref
      );
      let filePath = resolution?.path ?? null;

      if (!filePath) {
        // Fallback: if the property is a CSS custom property, search project for its definition
        const firstProp = fileChanges[0]?.prop;
        if (firstProp?.startsWith("--")) {
          const varFile = await findVariableDefinitionFile(projectRoot, firstProp);
          if (varFile) {
            filePath = varFile;
            // Project-wide first-hit search — a low-confidence guess.
            resolution = {
              path: varFile,
              strategy: "variable-definition",
              confidence: "low",
              matchCount: 1,
            };
          }
        }
        if (!filePath) {
          for (const change of fileChanges) {
            failed.push({
              ...change,
              reason: change.createClass
                ? `cannot create class ".${change.createClass.name}" — target stylesheet not found: "${sourceFile}"`
                : `file not found: "${sourceFile}"`,
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

      // Serialize the read-modify-write for this resolved path (issue #64) so
      // an overlapping request can't read stale content and clobber our write.
      releaseLock = await acquireFileLock(filePath);

      const source = await readFile(filePath, "utf-8");
      const lines = source.split("\n");
      let modified = false;

      // Recompute lazily: after any structural splice (state block creation) the
      // masked view must be rebuilt before the next change is processed.
      let masked = maskedLinesOf(lines);
      const remask = () => { masked = maskedLinesOf(lines); };

      // The file's indentation unit, learned once — new (empty) class blocks
      // get their declarations indented to the file's own convention.
      const fileIndent = detectIndentUnit(masked) ?? "  ";

      // --- Class creation (audit 05) ---
      // Ensure a `.name { }` block exists for every class this batch creates.
      // Idempotent: an existing block short-circuits (so the flow doubles as
      // "attach existing class" and a re-save never appends a duplicate).
      // Invalid names are skipped here — the per-change validation below
      // fails them with an accurate reason.
      const classesToCreate = new Map<string, NonNullable<CommitChange["createClass"]>>();
      for (const change of fileChanges) {
        const cc = change.createClass;
        if (!cc || typeof cc.name !== "string" || !isValidCSSClassName(cc.name)) continue;
        if (!classesToCreate.has(cc.name)) classesToCreate.set(cc.name, cc);
      }
      for (const name of classesToCreate.keys()) {
        if (findClassBlockOpen(masked, name) == null) {
          appendClassBlock(lines, name);
          modified = true;
          remask();
        }
      }

      for (const change of fileChanges) {
        // Reject malformed client input up front (issue #16).
        const invalid = changeValidationError(change);
        if (invalid) {
          failed.push({ ...change, reason: invalid });
          continue;
        }

        // --- Theme-mode override handling (issue #53, second half) ---
        // A change carrying `modeSelector` targets that mode's defining block
        // — it must NEVER fall through to the base/variable search (tier 1.5
        // would land the value in `:root` or a sibling mode's block: exactly
        // the wrong-destination write find-or-refuse exists to prevent).
        if (change.modeSelector) {
          const res = applyModeChange(
            lines, masked, change, fileIndent, sourceFile
          );
          if (res.modified) {
            modified = true;
            remask();
          } else {
            failed.push({ ...change, reason: res.reason ?? "mode write failed" });
          }
          continue;
        }

        // --- Breakpoint (@media) handling (issue #53) ---
        // A change carrying `breakpoint` targets the matching media block —
        // it must NEVER fall through to the base search (that's exactly the
        // "flatten a responsive edit into the base rule" corruption).
        if (change.breakpoint) {
          if (change.state && !VALID_STATES.has(change.state)) {
            failed.push({
              ...change,
              reason: `invalid state "${change.state}" — not in allowlist`,
            });
            continue;
          }
          const res = applyBreakpointChange(
            lines, masked, change, fileIndent, sourceFile
          );
          if (res.modified) {
            modified = true;
            remask();
          } else {
            failed.push({ ...change, reason: res.reason ?? "breakpoint write failed" });
          }
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
          const pseudoHit = searchPseudoClassBlock(
            masked,
            change.className,
            change.state,
            change.prop,
            change.from
          );
          const nestedIdx = pseudoHit == null
            ? searchNestedPseudoBlock(
                masked,
                change.className,
                change.state,
                change.prop,
                change.from
              )
            : null;
          const pseudoIdx = pseudoHit?.lineIdx ?? nestedIdx;

          if (pseudoIdx != null) {
            // Found the property in the pseudo-class block — do surgical
            // replacement. When a char range is set (minified same-line block,
            // issue #47), confine the match+replace to the targeted block's
            // body so an identical sibling declaration earlier on the line is
            // left untouched. The range is computed on the masked view, which
            // is same-length as `lines`.
            const range = pseudoHit?.range;
            const segment = range
              ? lines[pseudoIdx].slice(range[0], range[1])
              : lines[pseudoIdx];

            // An empty `from` (state saves post from:"" by contract) must
            // never build the exact pattern — escapeRegex("") makes it
            // zero-width and the replacement splices `to` into the middle of
            // the old value. Skip to the broad whole-value rewrite below.
            const pattern =
              change.from.trim() === ""
                ? null
                : replacePropRegex(change.prop, escapeRegex(change.from));
            if (pattern !== null && pattern.test(segment)) {
              const safeValue = change.to.replace(/\$/g, "$$$$");
              const replaced = segment.replace(pattern, `$1$2${safeValue}`);
              lines[pseudoIdx] = range
                ? lines[pseudoIdx].slice(0, range[0]) +
                  replaced +
                  lines[pseudoIdx].slice(range[1])
                : replaced;
              modified = true;
              remask();
            } else {
              // Try broad replacement (handles hex vs rgb, etc.)
              const broadPattern = replacePropRegex(change.prop, "([^;!}]+)");
              if (broadPattern.test(segment)) {
                const safeValue = change.to.replace(/\$/g, "$$$$");
                const replaced = segment.replace(broadPattern, `$1$2${safeValue}`);
                lines[pseudoIdx] = range
                  ? lines[pseudoIdx].slice(0, range[0]) +
                    replaced +
                    lines[pseudoIdx].slice(range[1])
                  : replaced;
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

          // The pseudo block EXISTS but the value-aware search missed: either
          // the block never authored `prop` (replace-only save gap — insert
          // it) or it authors `prop` under a different value representation
          // than `from` (hex vs rgb — rewrite it). Falling through to the
          // create path would append a DUPLICATE `.class:state` sibling block.
          const pseudoOpen =
            findPseudoBlockOpen(masked, change.className, change.state) ??
            findNestedPseudoBlockOpen(masked, change.className, change.state);
          if (pseudoOpen) {
            const propHit = findPropInBlock(masked, pseudoOpen, change.prop);
            if (propHit) {
              // Authored with an unrecognized value — broad value rewrite,
              // confined to the block's body span on minified same-line
              // blocks (issue #47).
              const segment = propHit.range
                ? lines[propHit.lineIdx].slice(propHit.range[0], propHit.range[1])
                : lines[propHit.lineIdx];
              const broadPattern = replacePropRegex(change.prop, "([^;!}]+)");
              if (broadPattern.test(segment)) {
                const safeValue = change.to.replace(/\$/g, "$$$$");
                const replaced = segment.replace(broadPattern, `$1$2${safeValue}`);
                lines[propHit.lineIdx] = propHit.range
                  ? lines[propHit.lineIdx].slice(0, propHit.range[0]) +
                    replaced +
                    lines[propHit.lineIdx].slice(propHit.range[1])
                  : replaced;
                modified = true;
                remask();
              } else {
                failed.push({
                  ...change,
                  reason: `value "${change.from}" not found in .${change.className}:${change.state} block`,
                });
              }
              continue;
            }
            // Never authored here — insert the declaration into the block.
            const outcome = insertDeclarationIntoBlock(
              lines, masked, pseudoOpen, change.prop, change.to, fileIndent
            );
            if (outcome === "inserted") {
              modified = true;
              remask();
            } else {
              failed.push({
                ...change,
                reason: `property "${change.prop}: ${change.from}" not found in ${sourceFile}`,
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

          // The file never authored `prop` anywhere (every tier + the
          // shorthand fallback missed). When the target class block exists,
          // INSERT the declaration into it instead of dead-ending the save.
          // Insert-vs-replace is derived server-side: any authored
          // declaration found above always wins as a replace.
          if (change.className) {
            // A longhand whose shorthand parent IS authored in the block
            // (e.g. padding-top under `padding: $x` / mismatched sub-values)
            // keeps today's honest failure instead of inserting a longhand
            // override — pinned by the shorthand-bail tests.
            const mapping = LONGHAND_TO_SHORTHAND[change.prop];
            const shorthandAuthored =
              mapping != null &&
              searchClassBlockFuzzy(masked, change.className, mapping.shorthand) != null;
            if (!shorthandAuthored) {
              const open = findClassBlockOpen(masked, change.className);
              if (!open) {
                failed.push({
                  ...change,
                  reason: `no rule for .${change.className} in ${sourceFile} — create the class first`,
                });
                continue;
              }
              const outcome = insertDeclarationIntoBlock(
                lines, masked, open, change.prop, change.to, fileIndent
              );
              if (outcome === "inserted") {
                modified = true;
                remask();
                continue;
              }
              // "commented-out" (deliberately disabled declaration) and
              // "unclosed" (no safe insertion point) fall through to the
              // honest not-found failure below.
            }
          }

          failed.push({
            ...change,
            reason: `property "${change.prop}: ${change.from}" not found in ${sourceFile}`,
          });
          continue;
        }

        // Surgical replacement: only change the value, preserve everything else.
        // The pattern carries a LEFT boundary so `color` can't match inside
        // `background-color` even if both share a line. An empty `from`
        // (only the validation-exempt shapes reach here with one, e.g. fresh
        // custom-prop adds) must never build the exact pattern — it would be
        // zero-width and splice `to` into the middle of the old value — so
        // skip to the fuzzy broad rewrite / honest failure below.
        const pattern =
          change.from.trim() === ""
            ? null
            : replacePropRegex(change.prop, escapeRegex(change.from));

        // When a char range is set (minified same-line block, issue #47),
        // confine the match+replace to that block's body so an identical sibling
        // declaration earlier on the line is left untouched. The range is
        // computed on the masked view, which is same-length as `lines`.
        const range = found.range;
        const segment = range
          ? lines[found.lineIdx].slice(range[0], range[1])
          : lines[found.lineIdx];

        if (pattern !== null && pattern.test(segment)) {
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

      // --- JSX className attach for created classes (audit 05) ---
      // Once per created class: append the class token to the JSX source's
      // className attribute (or insert a fresh attribute for a class-less
      // element). A refusal is an honest per-batch failure — the rule exists
      // in CSS but the class is NOT attached in source, and the user must know.
      for (const [name, cc] of classesToCreate) {
        const attach = await attachClassToJSX(projectRoot, {
          className: name,
          sourceFile: cc.jsxSourceFile,
          sourceLine: cc.jsxSourceLine,
          existingClasses: cc.existingClasses,
        });
        if (attach.ok) {
          if (attach.changed && !written.includes(attach.file)) written.push(attach.file);
        } else {
          const carrier = fileChanges.find((c) => c.createClass?.name === name);
          failed.push({
            ...(carrier ?? { prop: "", from: "", to: "" }),
            reason: `could not attach ".${name}" to the JSX className: ${attach.reason}`,
          });
        }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      for (const change of fileChanges) {
        failed.push({
          ...change,
          reason: `file error: ${message}`,
        });
      }
    } finally {
      releaseLock?.();
    }
    return { written, failed };
  }));

  // --- Element-scope inline writes (audit 06) ---
  // One JSX style-attribute merge per anchor group, concurrently — the
  // per-file mutex (acquireFileLock, injected into the writer) serializes
  // groups that resolve to the same file, so overlapping read-modify-writes
  // can't clobber each other (issue #64).
  const perInline = await Promise.all(
    Array.from(inlineGroups.values()).map(async ({ anchor, changes: groupChanges }) => {
      const written: string[] = [];
      const failed: CommitResult["failed"] = [];
      const declarations: Array<{ prop: string; value: string }> = [];
      const carriers: CommitChange[] = [];
      for (const change of groupChanges) {
        // Same malformed-input gate as the CSS path (issue #16).
        const invalid = changeValidationError(change);
        if (invalid) {
          failed.push({ ...change, reason: invalid });
          continue;
        }
        // An inline style attribute can express neither a pseudo-state nor a
        // media query — refuse truthfully instead of flattening a `:hover`
        // value into the resting style or a responsive value into all widths.
        if (change.state) {
          failed.push({
            ...change,
            reason: `":${change.state}" can't be expressed in an inline style attribute — use class scope to save state edits`,
          });
          continue;
        }
        if (change.breakpoint) {
          failed.push({
            ...change,
            reason:
              "a breakpoint edit can't be expressed in an inline style attribute (@media has no inline form) — element-scoped responsive edits stay on the clipboard",
          });
          continue;
        }
        declarations.push({ prop: change.prop, value: change.to });
        carriers.push(change);
      }
      if (declarations.length > 0) {
        const res = await applyInlineStyleToJSX(
          projectRoot,
          {
            declarations,
            sourceFile: anchor.jsxSourceFile,
            sourceLine: anchor.jsxSourceLine,
            existingClasses: anchor.existingClasses,
          },
          acquireFileLock
        );
        if (res.ok) {
          if (res.changed) written.push(res.file);
        } else {
          // Truthful per-item failure; the CSS class rule is NEVER a fallback.
          for (const change of carriers) {
            failed.push({ ...change, reason: res.reason });
          }
        }
      }
      return { written, failed };
    })
  );

  for (const { written, failed } of [...perFile, ...perInline]) {
    for (const f of written) {
      if (!result.written.includes(f)) result.written.push(f);
    }
    result.failed.push(...failed);
  }

  return result;
}
