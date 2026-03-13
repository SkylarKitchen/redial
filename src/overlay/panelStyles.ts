/**
 * panelStyles.ts — Canonical inline style objects for section internals.
 *
 * Variant 1: Strict Token Grid
 * Every value from theme.ts, all inline styles, precise pixel grid.
 *
 * Usage in any section file:
 *   import { ROW, LABEL, HINT, SUB_HEADER, ICON_GROUP } from "./panelStyles";
 *   <div style={ROW}> ... </div>
 *
 * This file ensures every section uses identical spacing, colors, and sizing.
 */

import { text, border, surface, font, color } from "./theme";
import { layout } from "./theme";
import { ms } from "./timing";

// ─── Row ────────────────────────────────────────────────────────────
// Standard property row: label + controls in a flex row.

export const ROW: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: layout.controlGap,
  paddingTop: 2,
  paddingBottom: 2,
  paddingLeft: 12,
  paddingRight: 12,
  minHeight: layout.iconBtnSize,
};

// ─── Label ──────────────────────────────────────────────────────────
// Left-hand label for a property row (e.g. "Font", "Weight", "Align").

export const LABEL: React.CSSProperties = {
  width: layout.labelWidth,
  fontSize: 11,
  fontFamily: font.sans,
  color: text.label,
  flexShrink: 0,
  userSelect: "none",
  cursor: "ew-resize",
  lineHeight: "24px",
  WebkitFontSmoothing: "antialiased",
};

/** Label without fixed width — for inline secondary labels like "Height" next to "Size". */
export const LABEL_INLINE: React.CSSProperties = {
  ...LABEL,
  width: "auto",
};

// ─── Hint ───────────────────────────────────────────────────────────
// Tiny caption below a control (e.g. "Italicize", "Letter spacing").

export const HINT: React.CSSProperties = {
  fontSize: 9,
  color: text.hint,
  textAlign: "center",
  marginTop: 3,
};

// ─── Sub-section header ─────────────────────────────────────────────
// "More type options", "Flex Child", etc.

export const SUB_HEADER: React.CSSProperties = {
  fontSize: 11,
  fontFamily: font.sans,
  color: text.secondary,
  fontWeight: 500,
};

export const SUB_HEADER_ROW: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "8px 12px 4px",
  cursor: "pointer",
  background: color.background,
};

// ─── Sub-section label ──────────────────────────────────────────────
// Uppercase grouping label inside sections (e.g. "FLEX CHILD", "GRID CHILD").

export const SUB_LABEL: React.CSSProperties = {
  padding: "6px 12px 2px",
  fontSize: 10,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  color: text.label,
};

// ─── Compact input container ────────────────────────────────────────
// Used for Grow/Shrink/Basis/Order inline cells.

export const COMPACT_INPUT: React.CSSProperties = {
  flex: 1,
  display: "flex",
  alignItems: "center",
  height: layout.iconBtnSize,
  background: surface.subtle,
  border: `1px solid ${border.default}`,
  borderRadius: 4,
};

/** Inline label inside a compact input (e.g. "Grow", "Shrink"). */
export const COMPACT_INPUT_LABEL: React.CSSProperties = {
  padding: "0 6px",
  fontSize: 10,
  color: text.label,
  flexShrink: 0,
  whiteSpace: "nowrap",
  display: "inline-flex",
  alignItems: "center",
  gap: 3,
};

// ─── Icon button group wrapper ──────────────────────────────────────
// Consistent container for IconButtonGroup rows.

export const ICON_GROUP_ROW: React.CSSProperties = {
  ...ROW,
};

// ─── Toggle pill ────────────────────────────────────────────────────
// Small pill-style toggle (e.g. grid overlay Show/Hide).

export const PILL_BUTTON: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 4,
  padding: "3px 8px",
  fontSize: 10,
  fontFamily: font.mono,
  borderRadius: layout.pillRadius,
  cursor: "pointer",
  outline: "none",
  border: `1px solid ${border.default}`,
  background: surface.subtle,
  color: text.label,
};

// ─── "More options" toggle button ───────────────────────────────────
// Full-width button that expands an advanced sub-section.

export const EXPAND_BUTTON: React.CSSProperties = {
  width: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  padding: "6px 0",
  cursor: "pointer",
  background: surface.subtle,
  border: `1px solid ${border.default}`,
  borderRadius: 4,
  color: text.label,
  fontSize: 11,
  fontFamily: font.sans,
  outline: "none",
  transition: `background ${ms("fast")} ease`,
};

// ─── Segmented toggle ───────────────────────────────────────────────
// Two-segment inline toggle (e.g. Clip/Ellipsis).

export const SEGMENT_GROUP: React.CSSProperties = {
  display: "flex",
  flex: 1,
  borderRadius: 4,
  overflow: "hidden",
  border: `1px solid ${border.default}`,
};

export const segmentButton = (active: boolean): React.CSSProperties => ({
  flex: 1,
  height: layout.iconBtnSize,
  cursor: "pointer",
  border: "none",
  fontSize: 11,
  fontFamily: font.sans,
  outline: "none",
  transition: `background ${ms("fast")} ease, color ${ms("fast")} ease`,
  background: active ? surface.active : "transparent",
  color: active ? text.primary : text.disabled,
  fontWeight: active ? 500 : 400,
});

// ─── Mini action button ─────────────────────────────────────────────
// Small icon button for sub-section headers (e.g. "+" add shadow).

export const MINI_ACTION_BUTTON: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: 22,
  height: 22,
  cursor: "pointer",
  background: "transparent",
  border: `1px solid ${border.default}`,
  borderRadius: 3,
  color: text.label,
  fontSize: 14,
  lineHeight: 1,
  outline: "none",
  transition: `background ${ms("fast")} ease`,
};

// ─── Inline color swatch ────────────────────────────────────────────
// Small color preview in an input row (e.g. stroke color).

export const INLINE_SWATCH: React.CSSProperties = {
  width: 16,
  height: 16,
  borderRadius: 3,
  border: `1px solid ${border.hover}`,
  flexShrink: 0,
  cursor: "pointer",
  display: "block",
};

// ─── Sub-section rows container ─────────────────────────────────────
// Flex column for child rows of an expanded sub-section.

export const SUB_ROWS: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
};
