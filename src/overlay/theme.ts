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
  background: "#FFFFFF",
  /** Text — --fg-primary */
  foreground: "#171717",

  /** Blue accent */
  primary: "#3B82F6",
  /** Blue hover */
  primaryHover: "#2563EB",
  /** Slider thumb active/pressed */
  primaryActive: "#d4956a",
  primaryForeground: "#ffffff",
  /** Secondary text on primary background — 60% white */
  primaryForegroundMuted: "rgba(255,255,255,0.6)",

  /** Popover/dropdown surface — --bg-secondary */
  popover: "#F5F5F5",

  /** Muted surface */
  muted: "rgba(0,0,0,0.05)",
  /** Labels, secondary text — --fg-tertiary */
  mutedForeground: "#525252",

  /** Input background */
  input: "rgba(0,0,0,0.04)",
  /** Default border — --border-tertiary */
  border: "rgba(0,0,0,0.10)",
  /** Focus ring — accent-blue at 30% */
  ring: "rgba(59,130,246,0.3)",

  /** Destructive red */
  destructive: "#ef4444",

  /** Success green — bright (save confirmed) */
  success: "#22c55e",
  /** Success green — muted/darker (copy confirmed) */
  successMuted: "#16a34a",
} as const;

// ─── Opacity Variants ────────────────────────────────────────────

/** Accent blue at a given alpha. rgb(59,130,246) = #3B82F6 */
export const primaryAlpha = (a: number) => `rgba(59,130,246,${a})`;

/** Destructive red at a given alpha. rgb(239,68,68) = #ef4444 */
export const destructiveAlpha = (a: number) => `rgba(239,68,68,${a})`;

/** Black at a given alpha. e.g. blackAlpha(0.12) → "rgba(0,0,0,0.12)" */
export const blackAlpha = (a: number) => `rgba(0,0,0,${a})`;
export const greenAlpha = (a: number) => `rgba(99,196,99,${a})`;

/** Success green (bright) at a given alpha. rgb(34,197,94) = #22c55e */
export const successAlpha = (a: number) => `rgba(34,197,94,${a})`;
/** Success green (muted) at a given alpha. rgb(22,163,74) = #16a34a */
export const successMutedAlpha = (a: number) => `rgba(22,163,74,${a})`;

// ─── Semantic Aliases ────────────────────────────────────────────

export const text = {
  /** --fg-primary */
  primary: color.foreground,
  /** --fg-secondary */
  secondary: "#404040",
  /** --fg-tertiary (same as mutedForeground) */
  label: color.mutedForeground,
  /** Disabled/placeholder */
  disabled: "#737373",
  /** Subtle hint (4.6:1 contrast on white — passes WCAG AA) */
  hint: "#757575",
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

/**
 * Hover convention:
 * - Light backgrounds → `surface.hover` / `surface.active`
 * - Dark backgrounds → `darkToolbar.hover` / `darkToolbar.active`
 * - Never use raw `rgba()` for hover states
 */
export const surface = {
  /** Hover background — 5% */
  hover: "rgba(0,0,0,0.05)",
  /** Active/pressed — 8% */
  active: "rgba(0,0,0,0.08)",
  /** Subtle background — 4% (same as input) */
  subtle: color.input,
  /** Scrollbar / track — 12% */
  track: "rgba(0,0,0,0.12)",
  /** Dark dropdown menu surface */
  darkMenu: "#363636",
  /** Dark toolbar / FAB surface */
  darkToolbar: "#1e1e1e",
} as const;

/** Dark toolbar token family — white-alpha values for dark-on-dark UI */
export const darkToolbar = {
  /** Full white — active/selected text */
  text: "rgba(255,255,255,1)",
  /** 70% white — default/idle text */
  textMuted: "rgba(255,255,255,0.7)",
  /** 90% white — icon fill */
  icon: "rgba(255,255,255,0.9)",
  /** 18% white — active/pressed background */
  active: "rgba(255,255,255,0.18)",
  /** 10% white — hover background */
  hover: "rgba(255,255,255,0.1)",
  /** 8% white — subtle border */
  border: "rgba(255,255,255,0.08)",
} as const;

// ─── Typography ──────────────────────────────────────────────────

export const font = {
  mono: "ui-monospace, 'SF Mono', monospace",
  sans: "Inter, system-ui, sans-serif",
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

/** Background at a given alpha. rgb(255,255,255) = #FFFFFF */
export const bgAlpha = (a: number) => `rgba(255,255,255,${a})`;

/** Light-theme checkerboard for opacity/transparency backgrounds. */
export const checkerboard =
  "repeating-conic-gradient(#ccc 0% 25%, #fff 0% 50%) 50%/8px 8px";

// ─── Segmented Control Tokens ────────────────────────────────────
// Canonical values for SegmentedControl, WebflowSegmentedControl,
// ReverseButton, and all toggle-style button groups.

export const segment = {
  /** Container background */
  bg: "#F0F0F0",
  /** Active segment / toggle background */
  activeBg: "#E5E5E5",
  /** Hover background */
  hoverBg: "#EBEBEB",
  /** Container border radius */
  radius: 4,
  /** Segment inner border radius */
  segmentRadius: 3,
  /** Container padding (creates border effect) */
  padding: 1,
  /** Standard segment height */
  height: 22,
} as const;

// ─── Badge Colors ───────────────────────────────────────────────

export const badge = {
  /** Action category — emerald green */
  action: "#34d399",
  actionBg: "rgba(16,185,129,0.15)",
  /** Element category — amber */
  element: "#fbbf24",
  elementBg: "rgba(245,158,11,0.15)",
} as const;

// ─── Layout Dimensions ──────────────────────────────────────────

export const layout = {
  panelWidth: 340,
  panelRadius: 10,
  sectionPadding: "10px 12px 6px",
  sectionBodyPadding: 8,
  rowPadding: "2px 12px",
  footerPadding: "8px 12px",
  labelWidth: 64,
  controlGap: 6,
  compactGap: 4,
  inputWidth: 40,
  swatchSizeSaved: 22,
  swatchSizeRecent: 18,
  iconBtnSize: 28,
  alignCell: 28,
  colorSwatch: 24,
  sliderHeight: 3,
  pickerCanvasWidth: 216,
  pickerCanvasHeight: 150,
  /** Pill-shaped buttons (scope pills, keyword pills, toggle pills) */
  pillRadius: 4,
} as const;

// ─── Z-Index Layers ─────────────────────────────────────────────
// All overlay z-indices anchored at max-int to stay above host page.

export const zIndex = {
  /** Panels, popovers, toolbar, dropdowns — topmost layer */
  max: 2147483647,
  /** Selector overlays, hover labels — above guides, below panels */
  overlay: 2147483646,
  /** Visual guides: grid, flex-gap, spacing, box-model overlays */
  guide: 2147483645,
  /** Preview backdrops — behind all other overlay layers */
  backdrop: 2147483644,

  // ── Internal stacking (within the panel, relative to siblings) ──
  /** Simple above-sibling layering (absolute overlays, badge dots) */
  above: 1,
  /** Sticky section headers */
  sticky: 2,
  /** Tooltip/hint overlays within panel content */
  float: 10,
  /** Dropdown menus within the panel */
  dropdown: 100,
  /** Higher-priority popups/portals (e.g. MiniDropdown) */
  popover: 200,
} as const;

// ─── Shadows ────────────────────────────────────────────────────

export const shadow = {
  /** Main panel shadow */
  panel: "0 8px 32px rgba(0,0,0,0.12), 0 0 0 0.5px rgba(0,0,0,0.04)",
  /** Elevated panel shadow while dragging */
  panelDrag: "0 16px 48px rgba(0,0,0,0.18), 0 0 0 0.5px rgba(0,0,0,0.06)",
  /** Dropdown/menu shadow */
  dropdown: "0 4px 12px rgba(0,0,0,0.1)",
  /** Color picker / large popover shadow */
  picker: "0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.08)",
} as const;

// ─── Indicator Colors ───────────────────────────────────────────────
// INTENTIONAL SIMPLIFICATION: user requested binary modified/none only.

export const indicatorColor: Record<string, string> = {
  modified: "#3b82f6",
  none: "#525252",
};

// ─── Label Indicator Colors ─────────────────────────────────────────

export type IndicatorType = "modified" | "none";

export const labelIndicator: Record<IndicatorType, { bg: string; text: string }> = {
  modified: { bg: "rgba(0,125,240,0.2)", text: "#184f95" },
  none: { bg: "transparent", text: "#404040" },
};

/** Shared highlight pill style for modified labels — use with labelIndicator colors. */
export const labelHighlight = {
  borderRadius: 3,
  padding: "1px 4px",
  width: "fit-content",
} as const;

/** Returns inline style object for a label indicator highlight (or empty object for "none"). */
export function indicatorStyle(type: IndicatorType | undefined): Record<string, unknown> {
  if (!type || type === "none") return {};
  const c = labelIndicator[type];
  return { background: c.bg, color: c.text, ...labelHighlight };
}

/** Alt+click handler for reset — attach as onClick on label spans. */
export function altClickReset(onReset?: () => void) {
  return (e: { altKey: boolean; stopPropagation(): void }) => { if (e.altKey && onReset) { e.stopPropagation(); onReset(); } };
}

// ─── Value Presets ──────────────────────────────────────────────

export const presets: Record<string, (string | number)[]> = {
  gap: [0, 4, 8, 16],
};

/** Declares the base unit for preset values — used by convertPresets() to scale chips on unit change. */
export const presetBaseUnit: Record<string, string> = {
  gap: "px",
};

// ─── Grid Overlay Colors ────────────────────────────────────────
// Warm orange base: rgb(217,119,87) = #D97757

/** Grid overlay orange at a given alpha. rgb(217,119,87) */
export const gridAlpha = (a: number) => `rgba(217,119,87,${a})`;

/** Flex gap overlay magenta at a given alpha. rgb(255,68,204) = #FF44CC */
export const flexGapAlpha = (a: number) => `rgba(255,68,204,${a})`;

/** Spacing margin overlay blue at a given alpha. rgb(87,168,255) = #57A8FF */
export const spacingMarginAlpha = (a: number) => `rgba(87,168,255,${a})`;

/** Spacing padding overlay green at a given alpha. rgb(76,175,80) = #4CAF50 */
export const spacingPaddingAlpha = (a: number) => `rgba(76,175,80,${a})`;

export const overlay = {
  grid: {
    /** Dashed grid lines between tracks */
    line: gridAlpha(0.4),
    /** Gap band fill */
    gap: gridAlpha(0.08),
    /** Track number labels */
    label: gridAlpha(0.8),
    /** Label pill background */
    labelBg: "rgba(250,249,245,0.85)",
    /** Container outline border */
    outline: gridAlpha(0.25),
  },
  flexGap: {
    /** Badge background & solid color — full opacity */
    solid: "#FF44CC",
    /** Hatched fill */
    hatch: flexGapAlpha(0.15),
    /** Dashed border around gap region */
    border: flexGapAlpha(0.5),
  },
  spacing: {
    /** Margin solid color — blue */
    margin: "#57A8FF",
    /** Margin zone fill — 30% alpha */
    marginFill: spacingMarginAlpha(0.30),
    /** Padding solid color — green */
    padding: "#4CAF50",
    /** Padding zone fill — 30% alpha */
    paddingFill: spacingPaddingAlpha(0.30),
  },
} as const;

// ─── Spacing Zone Colors ────────────────────────────────────────

export const spacingZone = {
  marginBase: "transparent",
  marginHover: primaryAlpha(0.14),
  marginBorderBase: primaryAlpha(0.25),
  marginBorderHover: primaryAlpha(0.5),
  paddingBase: "transparent",
  paddingHover: greenAlpha(0.14),
  paddingBorderBase: greenAlpha(0.25),
  paddingBorderHover: greenAlpha(0.5),
} as const;
