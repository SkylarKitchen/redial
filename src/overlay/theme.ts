/**
 * theme.ts — Canonical design tokens for all panel components
 *
 * Every color, dimension, and shadow in the overlay must reference these tokens.
 * Values sourced from design-tokens.css (Anthropic Design System).
 * Inline styles reference these; Tailwind classes use the same values.
 *
 * Pattern follows timing.ts — single source of truth, import everywhere.
 * The showcase page also imports from here to stay in sync.
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
  /** --border-tertiary (10%) */
  default: color.border,
  /** Subtle — 6% (section dividers, lighter than any token) */
  subtle: "rgba(0,0,0,0.06)",
  /** Input border — --border-tertiary */
  input: "rgba(0,0,0,0.10)",
  /** Hover — --border-secondary (18%) */
  hover: "rgba(0,0,0,0.18)",
  /** Strong — --border-primary (30%) */
  strong: "rgba(0,0,0,0.30)",
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

/** Background at a given alpha. rgb(250,249,245) = #FAF9F5 */
export const bgAlpha = (a: number) => `rgba(250,249,245,${a})`;

/** Light-theme checkerboard for opacity/transparency backgrounds. */
export const checkerboard =
  "repeating-conic-gradient(#ccc 0% 25%, #fff 0% 50%) 50%/8px 8px";

// ─── Layout Dimensions ──────────────────────────────────────────

export const layout = {
  panelWidth: 300,
  panelRadius: 10,
  sectionPadding: "10px 12px 6px",
  sectionBodyPadding: 8,
  rowPadding: "2px 12px",
  footerPadding: "8px 12px",
  labelWidth: 64,
  controlGap: 6,
  inputWidth: 40,
  swatchSizeSaved: 22,
  swatchSizeRecent: 18,
  iconBtnSize: 28,
  alignCell: 28,
  colorSwatch: 24,
  sliderHeight: 3,
  pickerCanvasWidth: 216,
  pickerCanvasHeight: 150,
} as const;

// ─── Shadows ────────────────────────────────────────────────────

export const shadow = {
  /** Main panel shadow */
  panel: "0 8px 32px rgba(0,0,0,0.12), 0 0 0 0.5px rgba(0,0,0,0.04)",
  /** Dropdown/menu shadow */
  dropdown: "0 4px 12px rgba(0,0,0,0.1)",
  /** Color picker / large popover shadow */
  picker: "0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.08)",
} as const;

// ─── Indicator Colors ───────────────────────────────────────────

export type IndicatorColorType = "element" | "inherited" | "state" | "variable" | "direct" | "none";

export const indicatorColor: Record<IndicatorColorType, string> = {
  element: "#60a5fa",
  inherited: "#f59e0b",
  state: "#34d399",
  variable: "#a78bfa",
  direct: "#60a5fa",
  none: "rgba(0,0,0,0.45)",
} as const;

// ─── Spacing Zone Colors ────────────────────────────────────────

export const spacingZone = {
  marginBase: "rgba(255,152,87,0.08)",
  marginHover: "rgba(255,152,87,0.22)",
  paddingBase: "rgba(87,168,255,0.08)",
  paddingHover: "rgba(87,168,255,0.22)",
} as const;
