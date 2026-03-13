/**
 * commitUtils.ts — Shared enrichment logic for save/commit flows.
 *
 * Both Overlay.tsx (Cmd+S shortcut) and Footer.tsx (Save button) need to
 * enrich raw DiffEntry[] with source file info, class names, and pseudo-state
 * before sending to the commit endpoint. This module deduplicates that logic.
 */

import type { DiffEntry } from "./apply";
import { resolveSource, getModuleClassInfo } from "./sourcemap";
import { getReadableName } from "./scope";
import type { Scope } from "./scope";

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
