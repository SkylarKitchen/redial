/**
 * scrubState.ts — Module-level flag to indicate an active LabelScrub drag.
 *
 * During a scrub, keyboard shortcuts (Escape, arrow keys, etc.) should be
 * suppressed so they don't close the panel or navigate elements while
 * setPointerCapture is active.  Both Overlay.tsx and LabelScrub.tsx import
 * from here to avoid a circular dependency.
 */

let scrubActive = false;

export function isScrubActive(): boolean {
  return scrubActive;
}

export function setScrubActive(active: boolean): void {
  scrubActive = active;
}
