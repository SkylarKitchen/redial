/**
 * theme.ts — Canonical color tokens for all panel components
 *
 * Every color in the overlay must reference these tokens.
 * Mirrors the CSS custom properties in globals.css so inline styles
 * stay in sync with Tailwind utility classes.
 *
 * Pattern follows timing.ts — single source of truth, import everywhere.
 */

// ─── Core Palette ────────────────────────────────────────────────

export const color = {
  /** Page background — #f5f0ea */
  background: "#f5f0ea",
  /** Text — rgba(0,0,0,0.87) */
  foreground: "rgba(0,0,0,0.87)",

  /** Terracotta accent */
  primary: "#c17a50",
  primaryForeground: "#ffffff",

  /** Popover/dropdown surface — #eae5df */
  popover: "#eae5df",

  /** Muted surface — rgba(0,0,0,0.05) */
  muted: "rgba(0,0,0,0.05)",
  /** Labels, secondary text — rgba(0,0,0,0.45) */
  mutedForeground: "rgba(0,0,0,0.45)",

  /** Input background — rgba(0,0,0,0.04) */
  input: "rgba(0,0,0,0.04)",
  /** Default border — rgba(0,0,0,0.08) */
  border: "rgba(0,0,0,0.08)",
  /** Focus ring — rgba(193,122,80,0.3) */
  ring: "rgba(193,122,80,0.3)",

  /** Destructive red */
  destructive: "#ef4444",
} as const;

// ─── Opacity Variants ────────────────────────────────────────────

/** Primary color at a given alpha. e.g. primaryAlpha(0.3) → "rgba(193,122,80,0.3)" */
export const primaryAlpha = (a: number) => `rgba(193,122,80,${a})`;

/** Black at a given alpha. e.g. blackAlpha(0.12) → "rgba(0,0,0,0.12)" */
export const blackAlpha = (a: number) => `rgba(0,0,0,${a})`;

// ─── Semantic Aliases ────────────────────────────────────────────

export const text = {
  /** Primary text — 87% opacity */
  primary: color.foreground,
  /** Secondary text — 70% */
  secondary: "rgba(0,0,0,0.7)",
  /** Label/hint text — 45% (same as mutedForeground) */
  label: color.mutedForeground,
  /** Disabled/placeholder — 35% */
  disabled: "rgba(0,0,0,0.35)",
  /** Subtle hint — 25% */
  hint: "rgba(0,0,0,0.25)",
} as const;

export const border = {
  /** Default — 8% */
  default: color.border,
  /** Subtle — 6% (section dividers) */
  subtle: "rgba(0,0,0,0.06)",
  /** Input border — 7% */
  input: "rgba(0,0,0,0.07)",
  /** Hover — 12% */
  hover: "rgba(0,0,0,0.12)",
  /** Strong — 15% */
  strong: "rgba(0,0,0,0.15)",
} as const;

export const surface = {
  /** Hover background — 5% */
  hover: "rgba(0,0,0,0.05)",
  /** Active/pressed — 8% */
  active: "rgba(0,0,0,0.08)",
  /** Subtle background — 4% (same as input) */
  subtle: color.input,
  /** Scrollbar / track — 12% */
  track: "rgba(0,0,0,0.12)",
} as const;

// ─── Typography ──────────────────────────────────────────────────

export const font = {
  mono: "ui-monospace, 'SF Mono', monospace",
  sans: "system-ui, sans-serif",
} as const;

// ─── Helpers ─────────────────────────────────────────────────────

/** Filled slider track gradient: primary up to pct%, then track color. */
export const filledTrackBg = (pct: number) =>
  `linear-gradient(to right, ${color.primary} ${pct}%, ${surface.track} ${pct}%)`;

/** Focus border shorthand. */
export const focusBorder = (focused: boolean) =>
  focused ? `1px solid ${primaryAlpha(0.5)}` : `1px solid ${border.input}`;

/** Focus ring box-shadow. */
export const focusRing = `0 0 0 2px ${color.ring}`;

/** Light-theme checkerboard for opacity/transparency backgrounds. */
export const checkerboard =
  "repeating-conic-gradient(#ccc 0% 25%, #fff 0% 50%) 50%/8px 8px";
