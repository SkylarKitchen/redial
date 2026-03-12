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
  /** Panel background — --bg-primary */
  background: "#FAF9F5",
  /** Text — --fg-primary */
  foreground: "#141413",

  /** Clay accent — --accent-clay */
  primary: "#D97757",
  /** Clay hover — --accent-clay-interactive */
  primaryHover: "#C6613F",
  primaryForeground: "#ffffff",

  /** Popover/dropdown surface — --bg-secondary */
  popover: "#F5F4ED",

  /** Muted surface */
  muted: "rgba(0,0,0,0.05)",
  /** Labels, secondary text — --fg-tertiary */
  mutedForeground: "#5E5D59",

  /** Input background */
  input: "rgba(0,0,0,0.04)",
  /** Default border — --border-tertiary */
  border: "rgba(0,0,0,0.10)",
  /** Focus ring — accent-clay at 30% */
  ring: "rgba(217,119,87,0.3)",

  /** Destructive red */
  destructive: "#ef4444",
} as const;

// ─── Opacity Variants ────────────────────────────────────────────

/** Accent clay at a given alpha. rgb(217,119,87) = #D97757 */
export const primaryAlpha = (a: number) => `rgba(217,119,87,${a})`;

/** Black at a given alpha. e.g. blackAlpha(0.12) → "rgba(0,0,0,0.12)" */
export const blackAlpha = (a: number) => `rgba(0,0,0,${a})`;

// ─── Semantic Aliases ────────────────────────────────────────────

export const text = {
  /** --fg-primary */
  primary: color.foreground,
  /** --fg-secondary */
  secondary: "#30302E",
  /** --fg-tertiary (same as mutedForeground) */
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
