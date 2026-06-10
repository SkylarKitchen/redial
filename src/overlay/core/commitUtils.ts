/**
 * commitUtils.ts — Shared enrichment logic for save/commit flows.
 *
 * Both Overlay.tsx (Cmd+S shortcut) and Footer.tsx (Save button) need to
 * enrich raw DiffEntry[] with source file info, class names, and pseudo-state
 * before sending to the commit endpoint. This module deduplicates that logic.
 */

import type { DiffEntry } from "./apply";
import { resolveSource, getModuleClassInfo, getGlobalCSSSource, getReactSource, getVariableDefinitionSource } from "./sourcemap";
import { getReadableName, isTailwindElement } from "./scope";
import type { Scope } from "./scope";
import { getAuthoredValue } from "../getAuthoredValue";
import { parseVarRef } from "../cssParsers";
import { formatTailwindDiff } from "../tailwind";

export interface EnrichedChange extends DiffEntry {
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
  opts: {
    scope: Scope;
    activeClassName?: string | null;
    activeState?: string;
  },
): EnrichedChange[] {
  // #35 ships the breakpoint UI + live media-gated preview, but file-WRITING
  // `@media` blocks to source is still a tracked follow-up (like CSS-variable
  // mode overrides, which are clipboard-only — see engine.ts UnifiedDiff). So we
  // still must never write a breakpoint change as an un-mediated base style:
  // drop breakpoint-tagged changes from the file-commit payload here. They are
  // NOT lost — the Footer copies them to the clipboard as @media on save, and
  // the "Copy CSS" actions emit them as @media blocks.
  changes = changes.filter((c) => !c.breakpoint);

  // Tailwind path: convert CSS diffs to Tailwind classes and target JSX source
  if (isTailwindElement(element)) {
    const reactSource = getReactSource(element);
    const newClasses = formatTailwindDiff(changes);
    const existingClasses = typeof element.className === "string" ? element.className : "";

    return changes.map((c) => ({
      ...c,
      sourceFile: reactSource?.file,
      sourceLine: reactSource?.line,
      mode: "tailwind" as const,
      newClasses,
      existingClasses,
    }));
  }

  // CSS path: standard enrichment
  const isStateActive = opts.activeState !== undefined && opts.activeState !== "none";
  // Class info is needed whenever ANY entry will carry a pseudo-state — the
  // panel's active state OR the entry's own state (diff() returns state-keyed
  // entries even when the panel is back on "None") — issue #57.
  const needsClassInfo =
    opts.scope === "class" || isStateActive || changes.some((c) => c.state !== undefined);
  const moduleInfo = needsClassInfo ? getModuleClassInfo(element) : null;
  const cssHref = getStylesheetHref(element);

  return changes.map((c) => {
    // Keep the entry's OWN state; only fall back to the panel's active state
    // for stateless entries — issue #57.
    const state = c.state ?? (isStateActive ? opts.activeState : undefined);

    // Check if the authored value is a var() reference
    const authored = getAuthoredValue(element, c.prop);
    const varName = authored ? parseVarRef(authored.trim()) : null;

    if (varName) {
      // Redirect: commit the custom property definition instead of the usage site
      const currentValue = getComputedStyle(document.documentElement)
        .getPropertyValue(varName)
        .trim();
      // Find where the variable is DEFINED, not where it's used
      const varSource = getVariableDefinitionSource(varName)
        ?? getGlobalCSSSource(element, c.prop);
      return {
        ...c,
        prop: varName,
        from: currentValue || c.from,
        sourceFile: varSource?.file,
        sourceLine: varSource?.line,
        className: undefined,
        componentName: moduleInfo?.componentName,
        state,
        cssHref,
      };
    }

    const source = resolveSource(element, c.prop);
    // The server only routes a change into a `.class:state { }` block when
    // BOTH `state` AND `className` are present — a state-tagged entry without
    // class info gets flattened into the base rule (issue #57). So resolve a
    // class for EVERY stateful entry, not just when the panel scope/state says
    // so: panel class first, then the element's CSS-module class, then a
    // global class backed by stylesheet evidence.
    const needsClassName = opts.scope === "class" || state !== undefined;
    return {
      ...c,
      sourceFile: source?.file,
      sourceLine: source?.line,
      className: needsClassName
        ? ((opts.activeClassName ? getReadableName(opts.activeClassName) : null)
            ?? moduleInfo?.className
            ?? (state !== undefined ? findGlobalClassName(element, c.prop, state) : undefined))
        : undefined,
      componentName: moduleInfo?.componentName,
      state,
      cssHref,
    };
  });
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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
 */
function findGlobalClassName(
  el: Element,
  prop: string,
  state: string,
): string | undefined {
  const classes = Array.from(el.classList).filter((cls) => !cls.startsWith("__tuner"));
  if (classes.length === 0) return undefined;

  // `(?![\w-])` keeps `.btn` from matching `.btn-primary` and `:focus` from
  // matching `:focus-within`.
  const stateRes = classes.map(
    (cls) => new RegExp(`\\.${escapeRegex(cls)}:${escapeRegex(state)}(?![\\w-])`),
  );
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
          for (let i = 0; i < classes.length; i++) {
            if (stateRes[i].test(selector)) {
              if (declaresProp) return classes[i]; // strongest evidence
              stateOnly ??= classes[i];
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
