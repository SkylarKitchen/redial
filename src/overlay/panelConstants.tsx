/**
 * panelConstants.tsx — Option/constant arrays extracted from WebflowPanel.tsx
 *
 * JSX-containing constants require .tsx extension.
 */

import {
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  Underline, Strikethrough, Baseline,
  Eye, EyeOff, Scissors, ScrollText,
  ArrowRight, ArrowDown, WrapText,
  Italic, X, PilcrowLeft, PilcrowRight,
} from "lucide-react";

// ─── Text Alignment Icons ────────────────────────────────────────────

export const TEXT_ALIGN_OPTIONS = [
  { value: "left", title: "Align left", icon: <AlignLeft size={12} strokeWidth={1.5} /> },
  { value: "center", title: "Align center", icon: <AlignCenter size={12} strokeWidth={1.5} /> },
  { value: "right", title: "Align right", icon: <AlignRight size={12} strokeWidth={1.5} /> },
  { value: "justify", title: "Justify", icon: <AlignJustify size={12} strokeWidth={1.5} /> },
];

export const TEXT_DECORATION_OPTIONS = [
  { value: "none", title: "None", icon: <X size={11} strokeWidth={2} /> },
  { value: "line-through", title: "Strikethrough", icon: <Strikethrough size={12} strokeWidth={1.5} /> },
  { value: "underline", title: "Underline", icon: <Underline size={12} strokeWidth={1.5} /> },
  { value: "overline", title: "Overline", icon: <Baseline size={12} strokeWidth={1.5} style={{ transform: "scaleY(-1)" }} /> },
];

export const CAPITALIZE_OPTIONS = [
  { value: "none", title: "None", icon: <X size={11} strokeWidth={2} /> },
  { value: "uppercase", title: "Uppercase", icon: <span style={{ fontSize: "10px", fontWeight: 600, lineHeight: 1 }}>AA</span> },
  { value: "capitalize", title: "Capitalize", icon: <span style={{ fontSize: "10px", fontWeight: 600, lineHeight: 1 }}>Aa</span> },
  { value: "lowercase", title: "Lowercase", icon: <span style={{ fontSize: "10px", fontWeight: 600, lineHeight: 1 }}>aa</span> },
];

export const ITALIC_OPTIONS = [
  { value: "normal", title: "Normal", icon: <span style={{ fontSize: "12px", fontFamily: "Georgia, serif", lineHeight: 1 }}>I</span> },
  { value: "italic", title: "Italic", icon: <Italic size={12} strokeWidth={1.5} /> },
];

export const DIRECTION_OPTIONS = [
  { value: "ltr", title: "Left to Right", icon: <PilcrowLeft size={12} strokeWidth={1.5} /> },
  { value: "rtl", title: "Right to Left", icon: <PilcrowRight size={12} strokeWidth={1.5} /> },
];

// ─── Display Tabs ────────────────────────────────────────────────────

export const DISPLAY_TABS = ["block", "flex", "grid", "none"] as const;
export const DISPLAY_MORE = [
  { value: "inline-flex", label: "Inline Flex" },
  { value: "inline-grid", label: "Inline Grid" },
  { value: "inline-block", label: "Inline Block" },
  { value: "inline", label: "Inline" },
];

// ─── Font Options ────────────────────────────────────────────────────

export const FONT_WEIGHT_OPTIONS = [
  { value: "100", label: "100 - Thin" },
  { value: "200", label: "200 - Extra Light" },
  { value: "300", label: "300 - Light" },
  { value: "400", label: "400 - Regular" },
  { value: "500", label: "500 - Medium" },
  { value: "600", label: "600 - Semi Bold" },
  { value: "700", label: "700 - Bold" },
  { value: "800", label: "800 - Extra Bold" },
  { value: "900", label: "900 - Black" },
];

export const WHITE_SPACE_OPTIONS = [
  { value: "normal", label: "Normal" },
  { value: "nowrap", label: "No Wrap" },
  { value: "pre", label: "Pre" },
  { value: "pre-wrap", label: "Pre Wrap" },
  { value: "pre-line", label: "Pre Line" },
  { value: "break-spaces", label: "Break Spaces" },
];

export const WORD_BREAK_OPTIONS = [
  { value: "normal", label: "Normal" },
  { value: "break-all", label: "Break All" },
  { value: "keep-all", label: "Keep All" },
  { value: "break-word", label: "Break Word" },
];

export const LINE_BREAK_OPTIONS = [
  { value: "auto", label: "Auto" },
  { value: "normal", label: "Normal" },
  { value: "loose", label: "Loose" },
  { value: "strict", label: "Strict" },
  { value: "anywhere", label: "Anywhere" },
];

// ─── Position Options ────────────────────────────────────────────────

export const FLOAT_OPTIONS = [
  { value: "none", label: "None" },
  { value: "left", label: "Left" },
  { value: "right", label: "Right" },
];

export const CLEAR_OPTIONS = [
  { value: "none", label: "None" },
  { value: "left", label: "Left" },
  { value: "right", label: "Right" },
  { value: "both", label: "Both" },
];

// ─── Unit Lists ──────────────────────────────────────────────────────

export const SIZE_UNITS_W = ["px", "%", "vw", "em", "rem", "ch"];
export const SIZE_UNITS_H = ["px", "%", "vh", "em", "rem"];
export const POSITION_UNITS = ["px", "%", "vw", "vh"];
export const TYPO_SIZE_UNITS = ["px", "em", "rem"];
export const LAYOUT_UNITS = ["px", "%", "em", "rem"];
export const BORDER_UNITS = ["px", "em", "rem"];
export const SPACING_UNITS = ["px", "%", "em", "rem"];
export const LINE_HEIGHT_UNITS = ["\u2014", "px", "em", "%"];

// ─── Overflow / Size Options ─────────────────────────────────────────

export const OVERFLOW_OPTIONS = [
  { value: "visible", label: "Visible" },
  { value: "hidden", label: "Hidden" },
  { value: "scroll", label: "Scroll" },
  { value: "auto", label: "Auto" },
];

export const OVERFLOW_ICON_OPTIONS = [
  { value: "visible", icon: <Eye size={14} strokeWidth={1.5} />, title: "Visible" },
  { value: "hidden", icon: <EyeOff size={14} strokeWidth={1.5} />, title: "Hidden" },
  { value: "clip", icon: <Scissors size={14} strokeWidth={1.5} />, title: "Clip" },
  { value: "scroll", icon: <ScrollText size={14} strokeWidth={1.5} />, title: "Scroll" },
  { value: "auto", icon: <span style={{ fontSize: "9px", fontFamily: "system-ui, sans-serif", fontWeight: 500 }}>Auto</span>, title: "Auto" },
];

export const OBJECT_FIT_OPTIONS = [
  { value: "fill", label: "Fill" }, { value: "contain", label: "Contain" },
  { value: "cover", label: "Cover" }, { value: "none", label: "None" },
  { value: "scale-down", label: "Scale Down" },
];

export const OBJECT_POSITION_OPTIONS = [
  { value: "center", label: "Center" }, { value: "top", label: "Top" },
  { value: "bottom", label: "Bottom" }, { value: "left", label: "Left" },
  { value: "right", label: "Right" }, { value: "top left", label: "Top Left" },
  { value: "top right", label: "Top Right" }, { value: "bottom left", label: "Bottom Left" },
  { value: "bottom right", label: "Bottom Right" },
];

// ─── Border Options ──────────────────────────────────────────────────

export const BORDER_STYLE_OPTIONS = [
  { value: "solid", label: "Solid" },
  { value: "dashed", label: "Dashed" },
  { value: "dotted", label: "Dotted" },
  { value: "double", label: "Double" },
  { value: "groove", label: "Groove" },
  { value: "ridge", label: "Ridge" },
  { value: "inset", label: "Inset" },
  { value: "outset", label: "Outset" },
  { value: "none", label: "None" },
];

// ─── Effects Options ─────────────────────────────────────────────────

export const BLEND_MODE_OPTIONS = [
  { value: "normal", label: "Normal" },
  { value: "multiply", label: "Multiply" },
  { value: "screen", label: "Screen" },
  { value: "overlay", label: "Overlay" },
  { value: "darken", label: "Darken" },
  { value: "lighten", label: "Lighten" },
  { value: "color-dodge", label: "Color Dodge" },
  { value: "color-burn", label: "Color Burn" },
  { value: "hard-light", label: "Hard Light" },
  { value: "soft-light", label: "Soft Light" },
  { value: "difference", label: "Difference" },
  { value: "exclusion", label: "Exclusion" },
  { value: "hue", label: "Hue" },
  { value: "saturation", label: "Saturation" },
  { value: "color", label: "Color" },
  { value: "luminosity", label: "Luminosity" },
];

export const FALLBACK_FONTS = ["system-ui", "Georgia", "Times New Roman", "Courier New", "monospace", "sans-serif", "serif"];

export const CURSOR_OPTIONS = [
  { value: "auto", label: "Auto" },
  { value: "pointer", label: "Pointer" },
  { value: "default", label: "Default" },
  { value: "text", label: "Text" },
  { value: "move", label: "Move" },
  { value: "grab", label: "Grab" },
  { value: "grabbing", label: "Grabbing" },
  { value: "not-allowed", label: "Not Allowed" },
  { value: "crosshair", label: "Crosshair" },
  { value: "wait", label: "Wait" },
  { value: "help", label: "Help" },
  { value: "zoom-in", label: "Zoom In" },
  { value: "zoom-out", label: "Zoom Out" },
  { value: "none", label: "None" },
];

export const POINTER_EVENTS_OPTIONS = [
  { value: "auto", label: "Auto" },
  { value: "none", label: "None" },
];

export const VISIBILITY_OPTIONS = [
  { value: "visible", label: "Visible" },
  { value: "hidden", label: "Hidden" },
  { value: "collapse", label: "Collapse" },
];

// ─── Flex Options ────────────────────────────────────────────────────

export const ALIGN_SELF_OPTIONS = [
  { value: "auto", label: "Auto" },
  { value: "flex-start", label: "Start" },
  { value: "center", label: "Center" },
  { value: "flex-end", label: "End" },
  { value: "stretch", label: "Stretch" },
  { value: "baseline", label: "Baseline" },
];

// Direction icons reduced to row + column + wrap, with reverse in dropdown
export const DIRECTION_ICONS_SHORT = [
  { value: "row", title: "Row", icon: <ArrowRight size={14} strokeWidth={1.8} /> },
  { value: "column", title: "Column", icon: <ArrowDown size={14} strokeWidth={1.8} /> },
  { value: "__wrap__", title: "Wrap", icon: <WrapText size={14} strokeWidth={1.8} /> },
];

export const DIRECTION_MORE_OPTIONS = [
  { value: "row-reverse", label: "Row Reverse" },
  { value: "column-reverse", label: "Column Reverse" },
];

// X/Y alignment dropdowns for the Align row
export const JUSTIFY_OPTIONS = [
  { value: "flex-start", label: "Start" },
  { value: "center", label: "Center" },
  { value: "flex-end", label: "End" },
  { value: "space-between", label: "Between" },
  { value: "space-around", label: "Around" },
  { value: "space-evenly", label: "Evenly" },
];

export const ALIGN_ITEMS_OPTIONS = [
  { value: "flex-start", label: "Top" },
  { value: "center", label: "Center" },
  { value: "flex-end", label: "Bottom" },
  { value: "stretch", label: "Stretch" },
  { value: "baseline", label: "Baseline" },
];

// ─── Background Options ─────────────────────────────────────────────

export const BG_CLIP_OPTIONS = [
  { value: "border-box", label: "Border Box" },
  { value: "padding-box", label: "Padding Box" },
  { value: "content-box", label: "Content Box" },
  { value: "text", label: "Text" },
];

// ─── Interaction Options ────────────────────────────────────────────

export const USER_SELECT_OPTIONS = [
  { value: "auto", label: "Auto" },
  { value: "none", label: "None" },
  { value: "text", label: "Text" },
  { value: "all", label: "All" },
];

export const BACKFACE_OPTIONS = [
  { value: "visible", label: "Visible" },
  { value: "hidden", label: "Hidden" },
];

// ─── Box Model Options ──────────────────────────────────────────────

export const BOX_SIZING_OPTIONS = [
  { value: "border-box", icon: <span style={{ fontSize: "9px" }}>Border</span>, title: "border-box" },
  { value: "content-box", icon: <span style={{ fontSize: "9px" }}>Content</span>, title: "content-box" },
];
