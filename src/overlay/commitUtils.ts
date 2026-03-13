/**
 * commitUtils.ts — Shared enrichment logic for save/commit flows.
 *
 * Both Overlay.tsx (Cmd+S shortcut) and Footer.tsx (Save button) need to
 * enrich raw DiffEntry[] with source file info, class names, and pseudo-state
 * before sending to the commit endpoint. This module deduplicates that logic.
 */

import type { DiffEntry } from "./apply";
import { resolveSource, getModuleClassInfo, getGlobalCSSSource } from "./sourcemap";
import { getReadableName } from "./scope";
import type { Scope } from "./scope";
import { getAuthoredValue } from "./getAuthoredValue";
import { parseVarRef } from "./colorVariables";

export interface EnrichedChange extends DiffEntry {
  sourceFile?: string;
  sourceLine?: number;
  className?: string;
  componentName?: string;
  state?: string;
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
  const isStateActive = opts.activeState !== undefined && opts.activeState !== "none";
  const needsClassInfo = opts.scope === "class" || isStateActive;
  const moduleInfo = needsClassInfo ? getModuleClassInfo(element) : null;

  return changes.map((c) => {
    // Check if the authored value is a var() reference
    const authored = getAuthoredValue(element, c.prop);
    const varName = authored ? parseVarRef(authored.trim()) : null;

    if (varName) {
      // Redirect: commit the custom property definition instead of the usage site
      const currentValue = getComputedStyle(document.documentElement)
        .getPropertyValue(varName)
        .trim();
      const globalSource = getGlobalCSSSource(element, c.prop);
      return {
        ...c,
        prop: varName,
        from: currentValue || c.from,
        sourceFile: globalSource?.file,
        sourceLine: globalSource?.line,
        className: undefined,
        componentName: moduleInfo?.componentName,
        state: isStateActive ? opts.activeState : undefined,
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
    };
  });
}
