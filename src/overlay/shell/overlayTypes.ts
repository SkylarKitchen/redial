/**
 * overlayTypes.ts — shared discriminated unions for the overlay shell
 *
 * Canonical home for the panel/modal state shapes. Previously these were
 * duplicated across Overlay.tsx and three hooks (useElementSelection,
 * useOverlayHotkeys, usePageInteractions), which risked silent drift. Define
 * once here; everyone imports from this module.
 */

/** Which primary panel (if any) the overlay is showing. */
export type ActivePanel =
  | { type: "none" }
  | { type: "inspector"; tab: "custom" | "prompt" }
  | { type: "variables" };

/** Which transient modal is open (only one at a time). */
export type ActiveModal =
  | { type: "none" }
  | { type: "commandPalette" }
  | { type: "shortcutsHelp" }
  | { type: "contextMenu"; x: number; y: number };
