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

export function isScrubActive(): boolean {
  return scrubActive;
}

export function setScrubActive(active: boolean): void {
  scrubActive = active;
}

export function getScrubGroup(): "margin" | "padding" | null {
  return scrubGroup;
}

export function setScrubGroup(group: "margin" | "padding" | null): void {
  scrubGroup = group;
}
