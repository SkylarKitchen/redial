/**
 * controls/colorPickerPosition.ts — viewport-aware placement for the color
 * picker popover (ColorPickerEnhanced, opened from a swatch in ColorRow).
 *
 * The picker is portalled to document.body as a `position:fixed` surface, so it
 * is responsible for keeping itself on screen. Pure + dependency-free so the
 * containment invariant is unit-testable without a browser
 * (see colorPickerPosition.test.ts); the live geometry is also swept by
 * tests/visual/panel-popovers.spec.ts.
 */

/** Intrinsic size of the color picker popover. */
export const PICKER_WIDTH = 240 + 24; // container width + padding; over-estimate only tightens the right clamp (safe)
export const PICKER_HEIGHT = 420; // canvas + hue/opacity sliders + hex row + variables list (measured ~416)
export const PICKER_GAP = 4;

/**
 * Position the popover so it is ALWAYS fully within the viewport, for any swatch
 * rect. Prefers opening below the swatch, flips above when there is no room, and
 * caps its height to the viewport (the caller applies the returned `maxHeight` +
 * `overflowY:auto`).
 *
 * Clamping `top` with the SAME capped height the popover renders at is what
 * guarantees containment — a fixed height *estimate* alone under-clamps and lets
 * a tall picker escape the top/bottom on short viewports (the bug this fixes).
 */
export function computeColorPickerPosition(
  rect: { top: number; bottom: number; left: number },
  viewport: { width: number; height: number },
  gap = PICKER_GAP
): { top: number; left: number; maxHeight: number } {
  const { width: vw, height: vh } = viewport;
  const maxHeight = Math.min(PICKER_HEIGHT, vh - gap * 2);
  const fitsBelow = rect.bottom + gap + maxHeight + gap <= vh;
  const rawTop = fitsBelow ? rect.bottom + gap : rect.top - maxHeight - gap;
  const top = Math.max(gap, Math.min(rawTop, vh - maxHeight - gap));
  const left = Math.max(gap, Math.min(rect.left, vw - PICKER_WIDTH - gap));
  return { top, left, maxHeight };
}
