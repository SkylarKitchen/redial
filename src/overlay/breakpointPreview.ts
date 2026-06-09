/**
 * breakpointPreview.ts — Live media-gated <style> for breakpoint edits (#35).
 *
 * The engine tracks non-base breakpoint edits under a composite key but does NOT
 * write them to the element's inline style (ADR-0005: their media-gated render
 * was deferred to #35). This module is that render: it projects every element's
 * breakpoint-tagged diffs into a single <style id="redial-breakpoint-preview">
 * as `@media` rules, each targeting the element through a stable
 * `[data-redial-bp="N"]` attribute selector.
 *
 * The result is a true media-gated live preview — the responsive edit takes
 * effect exactly when the viewport matches, and the base inline style is never
 * touched. It mirrors the modeOverrides.ts / statePreview.ts <style> pattern.
 */

import { diffAll, subscribeOverrides } from "./core/apply";
import { serializeBreakpointCSS } from "./breakpoints";

const STYLE_ID = "redial-breakpoint-preview";
const ID_ATTR = "data-redial-bp";

let styleEl: HTMLStyleElement | null = null;
let counter = 0;
let unsubscribe: (() => void) | null = null;

function ensureStyleEl(): HTMLStyleElement {
  if (styleEl && document.contains(styleEl)) return styleEl;
  styleEl = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (!styleEl) {
    styleEl = document.createElement("style");
    styleEl.id = STYLE_ID;
    document.head.appendChild(styleEl);
  }
  return styleEl;
}

/** Stable per-element preview id — reused across renders so the media selector
 *  doesn't churn while editing the same element. */
function previewIdFor(el: Element): string {
  const existing = el.getAttribute(ID_ATTR);
  if (existing) return existing;
  const id = String(++counter);
  el.setAttribute(ID_ATTR, id);
  return id;
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
    items.push({ selector: `[${ID_ATTR}="${id}"]`, changes });
  }
  ensureStyleEl().textContent = serializeBreakpointCSS(items);
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

/** Tear down the preview: unsubscribe and remove the <style> tag. */
export function destroyBreakpointPreview(): void {
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }
  if (styleEl && document.contains(styleEl)) styleEl.remove();
  styleEl = null;
}
