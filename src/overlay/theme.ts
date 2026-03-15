/**
 * theme.ts — Canonical design tokens for all panel components
 *
 * Every color, dimension, and shadow in the overlay must reference these tokens.
 * Values sourced from design-tokens.css (Anthropic Design System).
 * Inline styles reference these; Tailwind classes use the same values.
 *
 * Pattern follows timing.ts — single source of truth, import everywhere.
 * The showcase page also imports from here to stay in sync.
 *
 * Architecture:
 *   1. hexToRgba() — internal utility (used by alpha helpers)
 *   2. color — primitive palette (raw hex/rgba values, the single source)
 *   3. Alpha helpers — derive from color.* via hexToRgba
 *   4. Semantic tokens — reference color.* or alpha helpers, never hardcode
 */

// ─── Internal Utility ───────────────────────────────────────────

/** Convert hex color (#RRGGBB) to rgba string at given alpha. */
const hexToRgba = (hex: string, a: number) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
};

// ─── Core Palette ────────────────────────────────────────────────

export const color = {
  // ── Backgrounds ──
  /** Panel background — --bg-primary */
  background: "#FFFFFF",
  /** Popover/dropdown surface — --bg-secondary */
  popover: "#F5F5F5",
  /** Muted surface — 5% black */
  muted: "rgba(0,0,0,0.05)",
  /** Input background — 4% black */
  input: "rgba(0,0,0,0.04)",

  // ── Foregrounds ──
  /** Text — --fg-primary */
  foreground: "#171717",
  /** Text — --fg-secondary */
  foregroundSecondary: "#404040",
  /** Labels, secondary text — --fg-tertiary */
  mutedForeground: "#525252",
  /** Disabled text — reduced contrast */
  foregroundDisabled: "#737373",
  /** Hint text — 4.6:1 contrast on white (WCAG AA) */
  foregroundHint: "#757575",

  // ── Blue accent ──
  /** Blue accent — primary */
  primary: "#3B82F6",
  /** Blue hover */
  primaryHover: "#2563EB",
  /** Slider thumb active/pressed */
  primaryActive: "#d4956a",
  /** Primary dark — navy (label indicators) */
  primaryDark: "#184f95",
  primaryForeground: "#ffffff",
  /** Secondary text on primary background — 60% white */
  primaryForegroundMuted: "rgba(255,255,255,0.6)",
  /** Indicator blue — label pill highlight base */
  indicatorBlue: "#007DF0",

  // ── Borders ──
  /** Default border — --border-tertiary (10% black) */
  border: "rgba(0,0,0,0.10)",
  /** Focus ring — accent-blue at 30% (derived from primary) */
  ring: "rgba(59,130,246,0.3)",

  // ── Status ──
  /** Destructive red */
  destructive: "#ef4444",
  /** Success green — bright (save confirmed) */
  success: "#22c55e",
  /** Success green — muted/darker (copy confirmed) */
  successMuted: "#16a34a",

  // ── Indicators ──
  /** Indicator green — state-specific style modifications (hover, focus, etc.) */
  indicatorGreen: "#16a34a",

  // ── Dark surfaces ──
  /** Dark menu/dropdown surface */
  darkMenu: "#363636",
  /** Dark toolbar / FAB surface */
  darkToolbar: "#1e1e1e",

  // ── Segment control ──
  /** Segment control background */
  segmentBg: "#F0F0F0",
  /** Segment active/pressed background */
  segmentActive: "#E5E5E5",
  /** Segment hover background */
  segmentHover: "#EBEBEB",

  // ── Badge ──
  /** Badge action — emerald-400 */
  badgeAction: "#34d399",
  /** Badge action base — emerald-500 (for alpha backgrounds) */
  badgeEmerald: "#10B981",
  /** Badge element — amber-400 */
  badgeElement: "#fbbf24",
  /** Badge element base — amber-500 (for alpha backgrounds) */
  badgeAmber: "#F59E0B",

  // ── Overlay visualization ──
  /** Grid overlay — warm orange */
  gridOrange: "#D97757",
  /** Flex gap overlay — magenta */
  flexGapMagenta: "#FF44CC",
  /** Spacing margin — blue */
  spacingBlue: "#57A8FF",
  /** Spacing padding — green */
  spacingGreen: "#4CAF50",
  /** Spacing zone — interactive green */
  zoneGreen: "#63C463",
  /** Warm white — label pill backgrounds */
  warmWhite: "#FAF9F5",
} as const;

// ─── Opacity Variants ────────────────────────────────────────────

/** Accent blue at a given alpha — derived from color.primary */
export const primaryAlpha = (a: number) => hexToRgba(color.primary, a);

/** Destructive red at a given alpha — derived from color.destructive */
export const destructiveAlpha = (a: number) => hexToRgba(color.destructive, a);

/** Black at a given alpha. e.g. blackAlpha(0.12) → "rgba(0,0,0,0.12)" */
export const blackAlpha = (a: number) => `rgba(0,0,0,${a})`;

/** Zone green at a given alpha — derived from color.zoneGreen */
export const greenAlpha = (a: number) => hexToRgba(color.zoneGreen, a);

/** White at a given alpha. e.g. whiteAlpha(0.7) → "rgba(255,255,255,0.7)" */
export const whiteAlpha = (a: number) => `rgba(255,255,255,${a})`;

/** Success green (bright) at a given alpha — derived from color.success */
export const successAlpha = (a: number) => hexToRgba(color.success, a);
/** Success green (muted) at a given alpha — derived from color.successMuted */
export const successMutedAlpha = (a: number) => hexToRgba(color.successMuted, a);

// ─── Semantic Aliases ────────────────────────────────────────────

export const text = {
  /** --fg-primary */
  primary: color.foreground,
  /** --fg-secondary */
  secondary: color.foregroundSecondary,
  /** --fg-tertiary (same as mutedForeground) */
  label: color.mutedForeground,
  /** Disabled/placeholder */
  disabled: color.foregroundDisabled,
  /** Subtle hint (4.6:1 contrast on white — passes WCAG AA) */
  hint: color.foregroundHint,
} as const;

export const border = {
  /** --border-tertiary (10%) */
  default: color.border,
  /** Subtle — 6% (section dividers, lighter than any token) */
  subtle: blackAlpha(0.06),
  /** Input border — --border-tertiary */
  input: color.border,
  /** Hover — --border-secondary (18%) */
  hover: blackAlpha(0.18),
  /** Strong — --border-primary (30%) */
  strong: blackAlpha(0.30),
} as const;

/**
 * Hover convention:
 * - Light backgrounds → `surface.hover` / `surface.active`
 * - Dark backgrounds → `darkToolbar.hover` / `darkToolbar.active`
 * - Never use raw `rgba()` for hover states
 */
export const surface = {
  /** Hover background — 5% (same as color.muted) */
  hover: color.muted,
  /** Active/pressed — 8% */
  active: blackAlpha(0.08),
  /** Subtle background — 4% (same as input) */
  subtle: color.input,
  /** Scrollbar / track — 12% */
  track: blackAlpha(0.12),
  /** Dark dropdown menu surface */
  darkMenu: color.darkMenu,
  /** Dark toolbar / FAB surface */
  darkToolbar: color.darkToolbar,
} as const;

/** Dark toolbar token family — white-alpha values for dark-on-dark UI */
export const darkToolbar = {
  /** Full white — active/selected text */
  text: whiteAlpha(1),
  /** 70% white — default/idle text */
  textMuted: whiteAlpha(0.7),
  /** 90% white — icon fill */
  icon: whiteAlpha(0.9),
  /** 18% white — active/pressed background */
  active: whiteAlpha(0.18),
  /** 10% white — hover background */
  hover: whiteAlpha(0.1),
  /** 8% white — subtle border */
  border: whiteAlpha(0.08),
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

/** Background at a given alpha — derived from color.background */
export const bgAlpha = (a: number) => hexToRgba(color.background, a);

/** Light-theme checkerboard for opacity/transparency backgrounds. */
export const checkerboard =
  "repeating-conic-gradient(#ccc 0% 25%, #fff 0% 50%) 50%/8px 8px";

// ─── Segmented Control Tokens ────────────────────────────────────
// Canonical values for SegmentedControl, WebflowSegmentedControl,
// ReverseButton, and all toggle-style button groups.

export const segment = {
  /** Container background */
  bg: color.segmentBg,
  /** Active segment / toggle background */
  activeBg: color.segmentActive,
  /** Hover background */
  hoverBg: color.segmentHover,
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
  action: color.badgeAction,
  actionBg: hexToRgba(color.badgeEmerald, 0.15),
  /** Element category — amber */
  element: color.badgeElement,
  elementBg: hexToRgba(color.badgeAmber, 0.15),
} as const;

// ─── Layout Dimensions ──────────────────────────────────────────

export const layout = {
  panelWidth: 340,
  panelRadius: 10,
  sectionPadding: "10px 8px 6px",
  sectionBodyPadding: 8,
  rowPadding: "2px 8px",
  footerPadding: "8px 8px",
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

export const indicatorColor: Record<string, string> = {
  modified: color.primary,
  state: color.indicatorGreen,
  none: color.mutedForeground,
};

// ─── Label Indicator Colors ─────────────────────────────────────────

export type IndicatorType = "modified" | "state" | "none";

export const labelIndicator: Record<IndicatorType, { bg: string; text: string }> = {
  modified: { bg: hexToRgba(color.indicatorBlue, 0.2), text: color.primaryDark },
  state: { bg: hexToRgba(color.indicatorGreen, 0.2), text: color.indicatorGreen },
  none: { bg: "transparent", text: color.foregroundSecondary },
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

/** Grid overlay orange at a given alpha — derived from color.gridOrange */
export const gridAlpha = (a: number) => hexToRgba(color.gridOrange, a);

/** Flex gap overlay magenta at a given alpha — derived from color.flexGapMagenta */
export const flexGapAlpha = (a: number) => hexToRgba(color.flexGapMagenta, a);

/** Spacing margin overlay blue at a given alpha — derived from color.spacingBlue */
export const spacingMarginAlpha = (a: number) => hexToRgba(color.spacingBlue, a);

/** Spacing padding overlay green at a given alpha — derived from color.spacingGreen */
export const spacingPaddingAlpha = (a: number) => hexToRgba(color.spacingGreen, a);

export const overlay = {
  grid: {
    /** Dashed grid lines between tracks */
    line: gridAlpha(0.4),
    /** Gap band fill */
    gap: gridAlpha(0.08),
    /** Track number labels */
    label: gridAlpha(0.8),
    /** Label pill background */
    labelBg: hexToRgba(color.warmWhite, 0.85),
    /** Container outline border */
    outline: gridAlpha(0.25),
  },
  flexGap: {
    /** Badge background & solid color — full opacity */
    solid: color.flexGapMagenta,
    /** Hatched fill */
    hatch: flexGapAlpha(0.15),
    /** Dashed border around gap region */
    border: flexGapAlpha(0.5),
  },
  spacing: {
    /** Margin solid color — blue */
    margin: color.spacingBlue,
    /** Margin zone fill — 30% alpha */
    marginFill: spacingMarginAlpha(0.30),
    /** Padding solid color — green */
    padding: color.spacingGreen,
    /** Padding zone fill — 30% alpha */
    paddingFill: spacingPaddingAlpha(0.30),
  },
} as const;

// ─── Spacing Zone Colors ────────────────────────────────────────
// Margin = warm (orange), Padding = cool (green), Content = solid dark

/** Warm-orange alpha for margin zones — derived from color.gridOrange */
export const marginWarmAlpha = (a: number) => hexToRgba(color.gridOrange, a);

export const spacingZone = {
  /** Subtle warm tint — always visible so zones are distinguishable at rest */
  marginBase: marginWarmAlpha(0.08),
  /** Warm highlight on hover — strong enough to read as "orange" */
  marginHover: marginWarmAlpha(0.22),
  marginBorderBase: marginWarmAlpha(0.3),
  marginBorderHover: marginWarmAlpha(0.55),
  /** Subtle cool tint — always visible at rest */
  paddingBase: greenAlpha(0.08),
  /** Cool highlight on hover */
  paddingHover: greenAlpha(0.22),
  paddingBorderBase: greenAlpha(0.3),
  paddingBorderHover: greenAlpha(0.55),
  /** Content center — solid darker fill (spec: "solid darker rectangle") */
  content: blackAlpha(0.12),
} as const;
