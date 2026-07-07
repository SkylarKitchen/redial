/**
 * commitUtils.ts — Shared enrichment logic for save/commit flows.
 *
 * Footer.tsx (the ONE save pipeline — the Save button and Cmd+S both trigger
 * it) and ChangesDrawer.tsx ("Save All") enrich raw DiffEntry[] with source
 * file info, class names, and pseudo-state before sending to the commit
 * endpoint. This module deduplicates that logic.
 */

import type { DiffEntry } from "./apply";
import type { ScopeContext } from "./engine";
import { resolveSource, getCSSSource, getModuleClassInfo, getGlobalCSSSource, getReactSource, getVariableDefinitionSource } from "./sourcemap";
import { getReadableName, isTailwindElement, isSessionAttachedClass, getSessionAttachedClasses } from "./scope";
import { getAuthoredValue } from "../getAuthoredValue";
import { parseVarRef } from "../cssParsers";
import { formatTailwindDiff, twStateVariant } from "../tailwind";
import { getBreakpoints, BASE_BREAKPOINT_ID } from "../breakpoints";

/**
 * `DiffEntry.breakpoint` is the engine's breakpoint ID (a string); the commit
 * payload replaces it with the resolved `{ id, minWidth }` pair (#53) so the
 * server can locate/create the right `@media (min-width: Npx)` block without
 * knowing the client's breakpoint configuration.
 */
export interface EnrichedChange extends Omit<DiffEntry, "breakpoint"> {
  /** Responsive breakpoint (#53): engine id + config-aware min-width (px). */
  breakpoint?: { id: string; minWidth: number };
  sourceFile?: string;
  sourceLine?: number;
  className?: string;
  componentName?: string;
  state?: string;
  /** Compiled CSS href for server-side source map resolution */
  cssHref?: string;
  mode?: "css" | "tailwind";
  /** Tailwind classes to merge (field name matches TailwindChange.newClasses) */
  newClasses?: string;
  existingClasses?: string;
  /**
   * Class-creation descriptor (audit 05): present when the change targets a
   * class attached to the element THIS session (scope.ts registry). The server
   * creates the `.name { }` rule in `sourceFile` when missing and attaches the
   * class token to the JSX className attribute located via
   * `jsxSourceFile`/`jsxSourceLine`/`existingClasses` (the element's classes
   * BEFORE the session attach).
   */
  createClass?: {
    name: string;
    jsxSourceFile?: string;
    jsxSourceLine?: number;
    existingClasses?: string;
  };
  /**
   * Element-scope persistence descriptor (audit 06): present when the panel's
   * scope was "element" at save time (opted in via `elementScopeSave`).
   * Element scope previews on ONE element, so it must save to that one
   * element: the server merges the change into the element's JSX `style`
   * attribute at the fiber-resolved location (same anchors createClass uses)
   * — NEVER into a shared CSS rule. No resolvable anchor → the server fails
   * per-item with an accurate message; it never falls back to the class rule.
   */
  elementScope?: {
    jsxSourceFile?: string;
    jsxSourceLine?: number;
    existingClasses?: string;
  };
}

/**
 * Resolve a breakpoint id to its min-width in px, config-aware: the ACTIVE
 * set (config → stylesheet detection → defaults, via getBreakpoints) first,
 * then the numeric-id fallback the serializers already use. Returns null for
 * the base breakpoint or an unparseable id — those can't be located or
 * written as a `@media (min-width)` block.
 */
function resolveBreakpointMinWidth(id: string): number | null {
  if (id === BASE_BREAKPOINT_ID) return null;
  const known = getBreakpoints().find((b) => b.id === id)?.minWidth;
  const min = known ?? parseInt(id, 10);
  return Number.isFinite(min) && min > 0 ? min : null;
}

/**
 * Find the stylesheet href for a rule matching the given element.
 * Used to pass the compiled CSS path to the server for source map resolution.
 */
function getStylesheetHref(el: Element): string | undefined {
  try {
    for (const sheet of document.styleSheets) {
      try {
        if (!sheet.href) continue;
        for (const rule of sheet.cssRules) {
          if (rule instanceof CSSStyleRule && el.matches(rule.selectorText)) {
            return sheet.href;
          }
        }
      } catch { /* CORS */ }
    }
  } catch { /* no access */ }
  return undefined;
}

/**
 * Enrich raw diff changes with source file, class, and state info
 * so the commit endpoint can locate and update the correct source blocks.
 */
export function enrichChangesForCommit(
  element: Element,
  changes: DiffEntry[],
  opts: ScopeContext & {
    /**
     * Element-scope persistence opt-in (audit 06). Only surfaces that KNOW
     * the user's scope choice set this (the Footer save pipeline — Save
     * button, Cmd+S, palette): in element scope, stateless base changes are
     * then tagged `elementScope` (inline JSX style write) instead of
     * resolving a shared CSS rule target. Scope-less aggregate surfaces
     * (ChangesDrawer "Save All" enriches every element with a placeholder
     * `scope: "element"` and no per-edit scope provenance) leave it unset and
     * keep legacy rule targeting.
     */
    elementScopeSave?: boolean;
  },
): EnrichedChange[] {
  // Tailwind path: convert CSS diffs to Tailwind classes and target JSX source.
  // Responsive Tailwind variants are NOT file-written (breakpoint file-save
  // (#53) targets CSS `@media` blocks) — drop breakpoint-tagged changes here;
  // the clipboard export (composeTailwindExport) carries them with their
  // sm:/md:/… variant prefixes instead.
  const isStateActive = opts.activeState !== undefined && opts.activeState !== "none";

  if (isTailwindElement(element)) {
    const reactSource = getReactSource(element);
    // State arrives in two shapes: the Footer/Overlay pipeline sends
    // diffState() entries with NO `.state` field (the active state lives in
    // opts.activeState), while ChangesDrawer "Save All" sends diffAll()
    // entries that carry `.state` per change. Normalize to per-change state
    // before formatting so both shapes get their variant prefix (issue #57's
    // Tailwind twin: a bare write silently restyles the RESTING state).
    const stateful = changes.flatMap((c) => {
      if (c.breakpoint) return [];
      const { breakpoint: _bp, ...base } = c;
      return [{
        ...base,
        state: c.state ?? (isStateActive ? opts.activeState : undefined),
      }];
    });
    // Refusal-first, mirroring the breakpoint drop-filter above: a state with
    // no Tailwind variant must never be written as a base utility.
    const writable = stateful.filter(
      (c) => c.state === undefined || twStateVariant(c.state) !== null,
    );
    const newClasses = formatTailwindDiff(writable);
    // Strip redial's own marker classes (statePreview.ts tags the element
    // with __tuner-state-preview while a state preview is live) — they don't
    // exist in the JSX source, so leaking them breaks the server's className
    // attribute match.
    const existingClasses = (typeof element.className === "string" ? element.className : "")
      .split(/\s+/)
      .filter((cls) => cls && !cls.startsWith("__tuner"))
      .join(" ");

    return writable.map((c) => ({
      ...c,
      sourceFile: reactSource?.file,
      sourceLine: reactSource?.line,
      mode: "tailwind" as const,
      newClasses,
      existingClasses,
    }));
  }

  // CSS path: standard enrichment

  // ─── Class creation (audit 05) ───
  // When the active class was attached to the element THIS session, every
  // change targeting it rides a `createClass` descriptor and is routed to ONE
  // conservatively-chosen target stylesheet (so the rule is created once, in
  // one file). No resolvable target → sourceFile stays undefined and the
  // server fails with an accurate "cannot create" message — never guesses.
  const attachedActive =
    opts.scope === "class" &&
    !!opts.activeClassName &&
    isSessionAttachedClass(element, opts.activeClassName);
  let createClass: EnrichedChange["createClass"];
  let createTargetFile: string | undefined;
  if (attachedActive) {
    const name = opts.activeClassName!;
    createTargetFile = resolveNewClassStylesheet(element);
    const jsxSource = getReactSource(element);
    const attached = new Set(getSessionAttachedClasses(element));
    const existingClasses = Array.from(element.classList)
      .filter((c) => !attached.has(c) && !c.startsWith("__tuner"))
      .join(" ");
    createClass = {
      name,
      jsxSourceFile: jsxSource?.file,
      jsxSourceLine: jsxSource?.line,
      existingClasses,
    };
  }
  // ─── Element-scope persistence (audit 06) ───
  // Element scope previews on ONE element, so saving must persist to that ONE
  // element: stateless base changes are tagged `elementScope` (the server
  // merges them into the element's JSX `style` attribute) instead of
  // resolving the shared class rule — the silent blast-radius widening this
  // fixes. Deliberately NOT rerouted:
  //   - var-redirected edits (a var edit is inherently global — the
  //     definition site stays the target);
  //   - state-tagged entries (an inline style can't express `:hover`; the
  //     `.class:state` rule path is the issue-#57 contract);
  //   - breakpoint-tagged entries (an inline style can't express `@media`;
  //     class-backed ones keep the #53 file-bound `@media` path, the rest
  //     stay on the clipboard side-channel).
  const elementScoped = opts.scope === "element" && opts.elementScopeSave === true;
  let elementScope: EnrichedChange["elementScope"];
  if (elementScoped) {
    const jsxSource = getReactSource(element);
    const attached = new Set(getSessionAttachedClasses(element));
    // Same anchor derivation as createClass: the element's classes as they
    // exist in SOURCE (session-attached classes and tuner chrome excluded).
    const existingClasses = Array.from(element.classList)
      .filter((c) => !attached.has(c) && !c.startsWith("__tuner"))
      .join(" ");
    elementScope = {
      jsxSourceFile: jsxSource?.file,
      jsxSourceLine: jsxSource?.line,
      existingClasses,
    };
  }
  // Class info is needed whenever ANY entry will carry a pseudo-state — the
  // panel's active state OR the entry's own state (diff() returns state-keyed
  // entries even when the panel is back on "None") — issue #57 — and for every
  // breakpoint-tagged entry (#53: the server writes `.class` rules inside the
  // `@media` block, so it needs a rule target).
  const needsClassInfo =
    opts.scope === "class" ||
    isStateActive ||
    changes.some((c) => c.state !== undefined || c.breakpoint !== undefined);
  const moduleInfo = needsClassInfo ? getModuleClassInfo(element) : null;
  const cssHref = getStylesheetHref(element);

  return changes.flatMap((c): EnrichedChange[] => {
    // Keep the entry's OWN state; only fall back to the panel's active state
    // for stateless entries — issue #57.
    const state = c.state ?? (isStateActive ? opts.activeState : undefined);

    // Responsive dimension (#53): resolve the engine breakpoint id to its
    // config-aware min-width. An unresolvable id can't be located or written
    // as a `@media (min-width)` block — leave that entry to the clipboard
    // side-channel (the Footer copies non-file-bound breakpoint edits there).
    const bpMinWidth = c.breakpoint ? resolveBreakpointMinWidth(c.breakpoint) : null;
    if (c.breakpoint && bpMinWidth == null) return [];
    const breakpoint = c.breakpoint
      ? { id: c.breakpoint, minWidth: bpMinWidth! }
      : undefined;
    // The payload replaces the string id with the resolved pair.
    const { breakpoint: _bpId, ...base } = c;

    // Check if the authored value is a var() reference. Breakpoint edits never
    // redirect: a responsive override writes the property into the `@media`
    // rule for THIS class, not the variable's (global) definition site — a
    // redirect would silently retheme every breakpoint.
    const authored = breakpoint ? null : getAuthoredValue(element, c.prop);
    const varName = authored ? parseVarRef(authored.trim()) : null;

    if (varName) {
      // Redirect: commit the custom property definition instead of the usage site
      const currentValue = getComputedStyle(document.documentElement)
        .getPropertyValue(varName)
        .trim();
      // Find where the variable is DEFINED, not where it's used
      const varSource = getVariableDefinitionSource(varName)
        ?? getGlobalCSSSource(element, c.prop);
      return [{
        ...base,
        prop: varName,
        from: currentValue || c.from,
        sourceFile: varSource?.file,
        sourceLine: varSource?.line,
        className: undefined,
        componentName: moduleInfo?.componentName,
        state,
        cssHref,
      }];
    }

    // Element scope (audit 06): stateless base changes persist to the
    // element's JSX style attribute. NO CSS rule targeting at all —
    // sourceFile/className stay unset so the server structurally cannot route
    // this into the shared class rule.
    if (elementScope && state === undefined && breakpoint === undefined) {
      return [{ ...base, elementScope }];
    }

    const source = resolveSource(element, c.prop);
    // The server only routes a change into a `.class:state { }` block when
    // BOTH `state` AND `className` are present — a state-tagged entry without
    // class info gets flattened into the base rule (issue #57). So resolve a
    // class for EVERY stateful entry, not just when the panel scope/state says
    // so: panel class first, then the element's CSS-module class, then a
    // global class backed by stylesheet evidence. Breakpoint entries need the
    // same resolution — the media block's rule is written against the class.
    const needsClassName =
      opts.scope === "class" || state !== undefined || breakpoint !== undefined;
    // A session-attached class has no readable-name mapping — its raw token IS
    // the source class name (audit 05, class creation).
    const resolvedClassName = needsClassName
      ? ((opts.activeClassName
          ? getReadableName(opts.activeClassName) ?? (attachedActive ? opts.activeClassName : null)
          : null)
          ?? moduleInfo?.className
          ?? (state !== undefined || breakpoint !== undefined
              ? findGlobalClassName(element, c.prop, state)
              : undefined))
      : undefined;
    // Breakpoint edits never ride the createClass descriptor: media-rule
    // creation is the server's breakpoint path; base-edit saves drive class
    // creation + JSX attach.
    const isCreateChange =
      createClass != null && resolvedClassName === createClass.name && breakpoint === undefined;
    // Breakpoint edits may target a prop the element's stylesheet never
    // authored at base — fall back to the element's conservative stylesheet
    // so the server can create the media block there.
    const sourceFile = isCreateChange
      ? createTargetFile
      : source?.file ?? (breakpoint ? resolveNewClassStylesheet(element) : undefined);

    // A breakpoint edit is FILE-BOUND only with a rule target and a host
    // stylesheet; otherwise it stays on the clipboard side-channel rather
    // than dead-ending server-side.
    if (breakpoint && (!resolvedClassName || !sourceFile)) return [];

    return [{
      ...base,
      // Create-class changes are pinned to the ONE conservative target file;
      // per-prop resolution could scatter the new rule across unrelated files
      // (e.g. a reset.css whose broad selector matches the element).
      sourceFile,
      sourceLine: isCreateChange || breakpoint ? undefined : source?.line,
      className: resolvedClassName ?? undefined,
      componentName: moduleInfo?.componentName,
      state,
      cssHref,
      ...(breakpoint ? { breakpoint } : {}),
      ...(isCreateChange ? { createClass } : {}),
    }];
  });
}

/**
 * Partition helper (#53): which of ONE element's breakpoint-tagged changes did
 * the enrichment NOT bind to a file? enrichChangesForCommit includes a
 * breakpoint change in the commit payload only when a rule target (class) and
 * a host stylesheet resolved; the leftover (classless elements, Tailwind
 * responsive variants, unresolvable stylesheets) stays on the clipboard
 * side-channel. Footer.tsx's save pipeline and ChangesDrawer's "Save All"
 * must present the SAME file-vs-clipboard split — route through this instead
 * of growing private copies.
 *
 * Call PER ELEMENT: `enriched` must be the enrichment of these same `changes`
 * for the same element. (A cross-element set would collide — two elements
 * editing the same prop at the same breakpoint share a key.)
 */
export function filterClipboardBreakpointChanges(
  changes: DiffEntry[],
  enriched: EnrichedChange[],
): DiffEntry[] {
  const keyOf = (id: string, state: string | undefined, prop: string) =>
    `${id}@@${state ?? ""}::${prop}`;
  const fileBound = new Set(
    enriched.flatMap((e) =>
      e.breakpoint ? [keyOf(e.breakpoint.id, e.state, e.prop)] : [],
    ),
  );
  return changes.filter(
    (c) => c.breakpoint !== undefined && !fileBound.has(keyOf(c.breakpoint, c.state, c.prop)),
  );
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Map a stylesheet href to a project source path — the same build-prefix /
 * content-hash normalization getGlobalCSSSource applies, extracted for the
 * class-creation target walk (sourcemap.ts is per-prop; class creation needs a
 * per-ELEMENT answer). Returns undefined for hrefs that don't look like a
 * project stylesheet.
 */
function hrefToSourcePath(href: string): string | undefined {
  let file = href;
  try {
    file = new URL(href, typeof location !== "undefined" ? location.href : undefined).pathname;
  } catch {
    // Not a valid URL — use as-is
  }

  // Turbopack chunk URLs encode the source path:
  // /_next/static/chunks/test-app_app_page_module_scss_module_d2439084.css
  const turboChunk = file.match(
    /\/_next\/static\/chunks\/.*?([\w-]+)_module_(scss|css)_module_\w+\.css$/
  );
  if (turboChunk) {
    const baseName = turboChunk[1].replace(/^.*_/, "");
    return `${baseName}.module.${turboChunk[2]}`;
  }

  if (!/\.(css|scss)(\?.*)?$/.test(file)) return undefined;
  file = file
    .replace(/\?.*$/, "")
    .replace(/^\/_next\/static\/css\//, "")
    .replace(/^\/_next\/static\/chunks\//, "")
    .replace(/^\/assets\//, "")
    .replace(/^\//, "");
  // Remove content-hash suffixes (globals.abc12345.css → globals.css) and
  // Turbopack-style hash suffixes (_d2439084.css → .css).
  file = file.replace(/\.\w{8,}\.css$/, ".css").replace(/_\w{8}\.css$/, ".css");
  return file || undefined;
}

/**
 * Conservative target stylesheet for a CREATED class (audit 05):
 *  1. CSS-module elements → the element's resolved module file (the same
 *     derivation the ordinary save path uses);
 *  2. plain CSS → the stylesheet owning a rule that MATCHES the element
 *     (the file that owns its other rules);
 *  3. otherwise → the first project stylesheet on the page (the main global
 *     stylesheet the discovery walk finds).
 * Returns undefined when nothing resolves — the server then fails accurately
 * instead of guessing.
 */
function resolveNewClassStylesheet(element: Element): string | undefined {
  // 1. Module file. getCSSSource derives it from the element's module class;
  //    the prop argument only influences nothing here (derive ignores it).
  const moduleFile = getCSSSource(element, "color")?.file;
  if (moduleFile && !moduleFile.startsWith("*")) return moduleFile;

  let firstProjectSheet: string | undefined;
  try {
    for (const sheet of document.styleSheets) {
      try {
        if (!sheet.href) continue; // inline <style> tags (incl. redial's own) have no source file
        const file = hrefToSourcePath(sheet.href);
        if (!file) continue;
        firstProjectSheet ??= file;
        for (const rule of sheet.cssRules) {
          if (!(rule instanceof CSSStyleRule)) continue;
          try {
            if (element.matches(rule.selectorText)) return file; // 2. owns the element's rules
          } catch {
            // Invalid selector for matches()
          }
        }
      } catch {
        // CORS or security error — skip sheet
      }
    }
  } catch {
    // Stylesheet iteration failed
  }
  return firstProjectSheet; // 3. main stylesheet (or undefined — fail accurately)
}

/**
 * Last-resort class resolution for state-tagged changes on elements without a
 * CSS-module class (plain global CSS, e.g. `.btn` in globals.css). The server
 * can only write a `:hover`/`:focus` edit into the right place when it knows
 * which class block to target (`.cls:state { }`), so pick the element's class
 * with the strongest stylesheet evidence:
 *   1. a `.cls:state` rule that already declares the changed property
 *   2. any `.cls:state` rule
 *   3. a rule matching the element that declares the property and names `.cls`
 *   4. any rule matching the element that names `.cls`
 * Returns undefined when there is no evidence at all — the server then rejects
 * the change instead of flattening it into the base rule.
 *
 * `state` is optional (#53): breakpoint-tagged changes without a pseudo-state
 * need the same class resolution, using only the base-rule evidence tiers.
 */
function findGlobalClassName(
  el: Element,
  prop: string,
  state?: string,
): string | undefined {
  const classes = Array.from(el.classList).filter((cls) => !cls.startsWith("__tuner"));
  if (classes.length === 0) return undefined;

  // `(?![\w-])` keeps `.btn` from matching `.btn-primary` and `:focus` from
  // matching `:focus-within`.
  const stateRes = state !== undefined
    ? classes.map(
        (cls) => new RegExp(`\\.${escapeRegex(cls)}:${escapeRegex(state)}(?![\\w-])`),
      )
    : null;
  const baseRes = classes.map(
    (cls) => new RegExp(`\\.${escapeRegex(cls)}(?![\\w-])`),
  );

  let stateOnly: string | undefined;
  let matchWithProp: string | undefined;
  let matchOnly: string | undefined;

  try {
    for (const sheet of document.styleSheets) {
      // Skip redial's own managed tags (state/class previews, breakpoint and
      // mode overrides) — they must never count as authored-source evidence.
      const owner = sheet.ownerNode;
      if (
        owner instanceof Element &&
        (owner.hasAttribute("data-tuner-scope") || /^(redial-|__tuner|tuner-)/.test(owner.id))
      ) {
        continue;
      }
      try {
        for (const rule of sheet.cssRules) {
          if (!(rule instanceof CSSStyleRule)) continue;
          const selector = rule.selectorText;
          // Belt-and-braces for environments where ownerNode is unavailable:
          // redial-injected rules carry these markers in their selectors.
          if (selector.includes("data-tuner") || selector.includes("__tuner")) continue;
          const declaresProp = !!rule.style.getPropertyValue(prop);
          if (stateRes) {
            for (let i = 0; i < classes.length; i++) {
              if (stateRes[i].test(selector)) {
                if (declaresProp) return classes[i]; // strongest evidence
                stateOnly ??= classes[i];
              }
            }
          }
          // Base-rule evidence requires the rule to actually match the element.
          // (`:state` selectors never match at save time, hence the tier above.)
          let matchesEl = false;
          try {
            matchesEl = el.matches(selector);
          } catch {
            // Invalid/unsupported selector
          }
          if (!matchesEl) continue;
          for (let i = 0; i < classes.length; i++) {
            if (baseRes[i].test(selector)) {
              if (declaresProp) matchWithProp ??= classes[i];
              matchOnly ??= classes[i];
              break;
            }
          }
        }
      } catch {
        // CORS or security error — skip sheet
      }
    }
  } catch {
    // Stylesheet access failed
  }

  return stateOnly ?? matchWithProp ?? matchOnly;
}
