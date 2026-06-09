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
import { formatTailwindDiff, twStateVariant } from "../tailwind";

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

  const isStateActive = opts.activeState !== undefined && opts.activeState !== "none";

  // Tailwind path: convert CSS diffs to Tailwind classes and target JSX source
  if (isTailwindElement(element)) {
    const reactSource = getReactSource(element);
    // State arrives in two shapes: diffState() entries carry no `.state`
    // (the active state lives in opts.activeState), while diffAll() entries
    // carry it per change. Normalize to per-change state before formatting.
    const stateful = changes.map((c) => ({
      ...c,
      state: c.state ?? (isStateActive ? opts.activeState : undefined),
    }));
    // Refusal-first, like the breakpoint drop-filter above: a state with no
    // Tailwind variant must never be written as a base utility, since that
    // would silently restyle the element's resting state.
    const writable = stateful.filter((c) => !c.state || twStateVariant(c.state) !== null);
    const newClasses = formatTailwindDiff(writable);
    // Strip redial's own marker classes (statePreview.ts tags the element with
    // __tuner-state-preview while a state preview is live) — they don't exist
    // in the JSX source, so leaking them breaks the server's className match.
    const existingClasses = (typeof element.className === "string" ? element.className : "")
      .split(/\s+/)
      .filter((cls) => cls && !cls.startsWith("__tuner-"))
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
  const needsClassInfo = opts.scope === "class" || isStateActive;
  const moduleInfo = needsClassInfo ? getModuleClassInfo(element) : null;
  const cssHref = getStylesheetHref(element);

  return changes.map((c) => {
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
        state: isStateActive ? opts.activeState : undefined,
        cssHref,
      };
    }

    const source = resolveSource(element, c.prop);
    return {
      ...c,
      sourceFile: source?.file,
      sourceLine: source?.line,
      className: needsClassInfo && opts.activeClassName
        ? (getReadableName(opts.activeClassName) ?? moduleInfo?.className)
        : undefined,
      componentName: moduleInfo?.componentName,
      state: isStateActive ? opts.activeState : undefined,
      cssHref,
    };
  });
}
