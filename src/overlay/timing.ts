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
  toolbar: 400, // toolbar expand/collapse
  dismissal: 1700, // auto-dismiss for hints, tooltips, success messages
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

// ─── Spring Presets (Motion library) ────────────────────────────────

export const spring = {
  /** Panel open — snappy with slight overshoot (Linear/Raycast feel) */
  panelOpen: { type: "spring" as const, stiffness: 400, damping: 30, mass: 0.8 },
  /** Panel close — fast, decisive, no overshoot */
  panelClose: { type: "tween" as const, duration: 0.15, ease: [0.2, 0, 0.5, 1] as const },
  /** Toolbar expand — pill spring with natural feel */
  toolbarExpand: { type: "spring" as const, stiffness: 300, damping: 28, mass: 0.9 },
  /** Reduced motion fallback — instant */
  instant: { type: "tween" as const, duration: 0 },
} as const;

/** Get spring config with reduced-motion awareness */
export function springConfig(key: keyof typeof spring) {
  return _reducedMotion ? spring.instant : spring[key];
}
