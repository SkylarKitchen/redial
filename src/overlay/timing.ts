/**
 * timing.ts — Canonical timing tokens for all panel transitions
 *
 * Every animation duration in the overlay must reference these tokens.
 * Export numbers only; use ms() helper for CSS strings.
 */

export const timing = {
  instant: 50, // selector highlight
  micro: 60, // dropdown option hover
  fast: 80, // button/control hover background
  normal: 100, // text feedback, state transitions
  expand: 150, // section collapse/expand, chevron rotate
  layout: 200, // drag displacement, focus ring transitions
  slow: 300, // scrollbar fade, complex animations
} as const;

export type TimingKey = keyof typeof timing;

// ─── Reduced Motion Support ──────────────────────────────────────────
/** Mutable flag set by Overlay.tsx based on prefers-reduced-motion media query */
let _reducedMotion = false;

export function setReducedMotion(v: boolean): void {
  _reducedMotion = v;
}

export function getReducedMotion(): boolean {
  return _reducedMotion;
}

/** Convert timing token to CSS duration string: ms("fast") → "80ms" (or "0ms" when reduced motion is active) */
export const ms = (key: TimingKey) => _reducedMotion ? "0ms" : `${timing[key]}ms`;
