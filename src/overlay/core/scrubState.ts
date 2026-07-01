/**
 * scrubState.ts — Module-level flag to indicate an active LabelScrub drag.
 *
 * During a scrub, keyboard shortcuts (Escape, arrow keys, etc.) should be
 * suppressed so they don't close the panel or navigate elements while
 * setPointerCapture is active.  Both Overlay.tsx and LabelScrub.tsx import
 * from here to avoid a circular dependency.
 *
 * Also tracks which property group ("margin" | "padding") is being scrubbed
 * so the SpacingGuidesOverlay can show guides only for the active group.
 */

let scrubActive = false;
let scrubGroup: "margin" | "padding" | null = null;
let hoverGroup: "margin" | "padding" | null = null;

// Subscribers notified whenever any scrub/hover flag changes. This turns the
// module-level flags — which fire no DOM event — into an event source the
// spacing overlays can plug into their element tracker's invalidate signal, so
// they re-measure on hover/scrub changes without polling every frame.
const listeners = new Set<() => void>();

function notify(): void {
  for (const cb of listeners) cb();
}

/**
 * Subscribe to scrub/hover state changes. The callback fires after any of
 * setScrubActive / setScrubGroup / setHoverGroup runs.
 *
 * @param cb - invoked on every change (no arguments; read the getters).
 * @returns an unsubscribe function.
 */
export function subscribeScrubState(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

/**
 * Returns whether a LabelScrub drag is currently in progress.
 *
 * @returns `true` while a scrub drag is active, `false` otherwise.
 */
export function isScrubActive(): boolean {
  return scrubActive;
}

/**
 * Sets the module-level flag that tracks whether a LabelScrub drag is active.
 * When `true`, keyboard shortcuts such as Escape and arrow keys are suppressed
 * by the overlay so they don't interfere with the drag.
 *
 * @param active - `true` to mark a scrub as in progress, `false` to clear it.
 */
export function setScrubActive(active: boolean): void {
  if (scrubActive === active) return; // no change — don't wake subscribers
  scrubActive = active;
  notify();
}

/**
 * Returns the property group currently being scrubbed, or `null` when no
 * scrub is in progress.
 *
 * @returns `"margin"`, `"padding"`, or `null`.
 */
export function getScrubGroup(): "margin" | "padding" | null {
  return scrubGroup;
}

/**
 * Sets the property group that is actively being scrubbed.
 * SpacingGuidesOverlay reads this to decide which guides to display.
 *
 * @param group - `"margin"`, `"padding"`, or `null` to clear.
 */
export function setScrubGroup(group: "margin" | "padding" | null): void {
  if (scrubGroup === group) return; // no change — don't wake subscribers
  scrubGroup = group;
  notify();
}

/**
 * Returns the property group currently under hover focus, or `null` when no
 * group is hovered.
 *
 * @returns `"margin"`, `"padding"`, or `null`.
 */
export function getHoverGroup(): "margin" | "padding" | null {
  return hoverGroup;
}

/**
 * Sets the property group that the user is currently hovering over.
 * SpacingGuidesOverlay reads this to show preview guides on hover.
 *
 * @param group - `"margin"`, `"padding"`, or `null` to clear.
 */
export function setHoverGroup(group: "margin" | "padding" | null): void {
  if (hoverGroup === group) return; // no change — don't wake subscribers
  hoverGroup = group;
  notify();
}
