/**
 * breakpointPreview.ts — Live media-gated stylesheet for breakpoint edits (#35).
 *
 * The engine tracks non-base breakpoint edits under a composite key but does NOT
 * write them to the element's inline style (ADR-0005: their media-gated render
 * was deferred to #35). This module is that render: it projects every element's
 * breakpoint-tagged diffs into the `managedSheet("breakpoint-preview")` sheet
 * (constructable stylesheet on `document.adoptedStyleSheets`, with a `<style>`
 * fallback — see ADR-0009) as `@media` rules, each targeting the element
 * through a stable `[data-redial-bp="N"]` attribute selector.
 *
 * The result is a true media-gated live preview — the responsive edit takes
 * effect exactly when the viewport matches, and the base inline style is never
 * touched. It mirrors the modeOverrides.ts / statePreview.ts managed-sheet
 * pattern.
 */

import { diffAll, subscribeOverrides, type DiffEntry } from "./core/apply";
import { serializeBreakpointCSS } from "./breakpoints";
import { managedSheet, _readManagedSheetCss } from "./core/managedSheet";

const SHEET_KEY = "breakpoint-preview";
const ID_ATTR = "data-redial-bp";

let counter = 0;
let unsubscribe: (() => void) | null = null;

// Track which elements have been stamped so destroy can strip the
// attribute back out of the user's DOM (#83; mirrors statePreview).
const taggedElements = new Set<Element>();

/** Test-only read of the breakpoint-preview sheet's serialized CSS. */
export function getBreakpointPreviewCss(): string | null {
  return _readManagedSheetCss(SHEET_KEY);
}

/** Stable per-element preview id — reused across renders so the media selector
 *  doesn't churn while editing the same element. */
function previewIdFor(el: Element): string {
  taggedElements.add(el);
  const existing = el.getAttribute(ID_ATTR);
  if (existing) return existing;
  const id = String(++counter);
  el.setAttribute(ID_ATTR, id);
  return id;
}

/**
 * Preview-only cascade boost: force each injected declaration to win the same
 * way base edits do (inline styles applied with priority "important"). The
 * preview selector is a single attribute selector — specificity (0,1,0) — so
 * without `!important` any author rule with two simple selectors, an id, or its
 * own `!important` silently beats the edit and the slider appears dead.
 * Mirrors statePreview.ts / scope.ts, which append `!important` to their
 * injected rules. Applied here (not in serializeBreakpointCSS) so the
 * clipboard/export serialization stays clean.
 */
function withImportant(changes: DiffEntry[]): DiffEntry[] {
  return changes.map((c) =>
    /!important\s*$/i.test(c.to) ? c : { ...c, to: `${c.to} !important` },
  );
}

/**
 * Rebuild the breakpoint-preview <style> from the current session diffs. Only
 * elements that carry at least one breakpoint-tagged change contribute (base
 * edits are the live inline styles, not media-gated).
 */
export function renderBreakpointPreview(): void {
  const items: Array<{ selector: string; changes: ReturnType<typeof diffAll>[number]["changes"] }> = [];
  for (const { el, changes } of diffAll()) {
    if (!changes.some((c) => c.breakpoint)) continue;
    const id = previewIdFor(el);
    items.push({ selector: `[${ID_ATTR}="${id}"]`, changes: withImportant(changes) });
  }
  managedSheet(SHEET_KEY).replace(serializeBreakpointCSS(items));
}

/**
 * Begin keeping the preview in sync with engine changes. Idempotent: a second
 * call is a no-op. Subscribes to the override store so edits, undo/redo and
 * resets all re-render, then does an initial render.
 */
export function startBreakpointPreview(): void {
  if (unsubscribe) return;
  unsubscribe = subscribeOverrides(renderBreakpointPreview);
  renderBreakpointPreview();
}

/** Tear down the preview: unsubscribe, strip stamped attributes, and dispose
 *  the managed sheet. */
export function destroyBreakpointPreview(): void {
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }
  for (const el of taggedElements) {
    el.removeAttribute(ID_ATTR);
  }
  taggedElements.clear();
  managedSheet(SHEET_KEY).dispose();
}
