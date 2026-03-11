/**
 * constants.tsx — Option arrays and icon definitions for CSS property controls
 * Extracted from WebflowPanel.tsx.
 */

export const DISPLAY_OPTIONS = [
  { value: "block", label: "Block" }, { value: "flex", label: "Flex" },
  { value: "inline-flex", label: "Inline Flex" }, { value: "grid", label: "Grid" },
  { value: "inline-grid", label: "Inline Grid" }, { value: "inline-block", label: "Inline Block" },
  { value: "inline", label: "Inline" }, { value: "none", label: "None" },
];

export const FONT_WEIGHT_OPTIONS = [
  { value: "100", label: "100 - Thin" }, { value: "200", label: "200 - Extra Light" },
  { value: "300", label: "300 - Light" }, { value: "400", label: "400 - Regular" },
  { value: "500", label: "500 - Medium" }, { value: "600", label: "600 - Semi Bold" },
  { value: "700", label: "700 - Bold" }, { value: "800", label: "800 - Extra Bold" },
  { value: "900", label: "900 - Black" },
];

export const WHITE_SPACE_OPTIONS = [
  { value: "normal", label: "Normal" }, { value: "nowrap", label: "No Wrap" },
  { value: "pre", label: "Pre" }, { value: "pre-wrap", label: "Pre Wrap" },
  { value: "pre-line", label: "Pre Line" }, { value: "break-spaces", label: "Break Spaces" },
];

export const WORD_BREAK_OPTIONS = [
  { value: "normal", label: "Normal" }, { value: "break-all", label: "Break All" },
  { value: "keep-all", label: "Keep All" }, { value: "break-word", label: "Break Word" },
];

export const FLOAT_OPTIONS = [
  { value: "none", label: "None" }, { value: "left", label: "Left" }, { value: "right", label: "Right" },
];

export const CLEAR_OPTIONS = [
  { value: "none", label: "None" }, { value: "left", label: "Left" },
  { value: "right", label: "Right" }, { value: "both", label: "Both" },
];

export const SIZE_UNITS_W = ["px", "%", "vw", "em", "rem", "ch"];
export const SIZE_UNITS_H = ["px", "%", "vh", "em", "rem"];
export const POSITION_UNITS = ["px", "%", "vw", "vh"];
export const TYPO_SIZE_UNITS = ["px", "em", "rem"];
export const SPACING_UNITS = ["px", "%", "em", "rem", "vw", "vh"];
export const RADIUS_UNITS = ["px", "%", "em", "rem"];

export const OVERFLOW_OPTIONS = [
  { value: "visible", label: "Visible" }, { value: "hidden", label: "Hidden" },
  { value: "scroll", label: "Scroll" }, { value: "auto", label: "Auto" },
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

export const POSITION_OPTIONS = [
  { value: "static", label: "Static" }, { value: "relative", label: "Relative" },
  { value: "absolute", label: "Absolute" }, { value: "fixed", label: "Fixed" },
  { value: "sticky", label: "Sticky" },
];

export const BORDER_STYLE_OPTIONS = [
  { value: "solid", label: "Solid" }, { value: "dashed", label: "Dashed" },
  { value: "dotted", label: "Dotted" }, { value: "double", label: "Double" },
  { value: "groove", label: "Groove" }, { value: "ridge", label: "Ridge" },
  { value: "inset", label: "Inset" }, { value: "outset", label: "Outset" },
  { value: "none", label: "None" },
];

export const BLEND_MODE_OPTIONS = [
  { value: "normal", label: "Normal" }, { value: "multiply", label: "Multiply" },
  { value: "screen", label: "Screen" }, { value: "overlay", label: "Overlay" },
  { value: "darken", label: "Darken" }, { value: "lighten", label: "Lighten" },
  { value: "color-dodge", label: "Color Dodge" }, { value: "color-burn", label: "Color Burn" },
  { value: "hard-light", label: "Hard Light" }, { value: "soft-light", label: "Soft Light" },
  { value: "difference", label: "Difference" }, { value: "exclusion", label: "Exclusion" },
  { value: "hue", label: "Hue" }, { value: "saturation", label: "Saturation" },
  { value: "color", label: "Color" }, { value: "luminosity", label: "Luminosity" },
];

export const FALLBACK_FONTS = ["system-ui", "Georgia", "Times New Roman", "Courier New", "monospace", "sans-serif", "serif"];

export const CURSOR_OPTIONS = [
  { value: "auto", label: "Auto" }, { value: "pointer", label: "Pointer" },
  { value: "default", label: "Default" }, { value: "text", label: "Text" },
  { value: "move", label: "Move" }, { value: "grab", label: "Grab" },
  { value: "grabbing", label: "Grabbing" }, { value: "not-allowed", label: "Not Allowed" },
  { value: "crosshair", label: "Crosshair" }, { value: "wait", label: "Wait" },
  { value: "help", label: "Help" }, { value: "zoom-in", label: "Zoom In" },
  { value: "zoom-out", label: "Zoom Out" }, { value: "none", label: "None" },
];

export const POINTER_EVENTS_OPTIONS = [
  { value: "auto", label: "Auto" }, { value: "none", label: "None" },
];

export const VISIBILITY_OPTIONS = [
  { value: "visible", label: "Visible" }, { value: "hidden", label: "Hidden" },
  { value: "collapse", label: "Collapse" },
];

export const FLEX_WRAP_OPTIONS = [
  { value: "nowrap", label: "No Wrap" }, { value: "wrap", label: "Wrap" },
  { value: "wrap-reverse", label: "Wrap Reverse" },
];

export const FLEX_DIRECTION_ICONS = [
  { value: "row", title: "Row (\u2192)", icon: (<svg width="12" height="12" viewBox="0 0 12 12"><line x1="2" y1="6" x2="9" y2="6" stroke="currentColor" strokeWidth="1.2" /><polyline points="7,3.5 9.5,6 7,8.5" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" /></svg>) },
  { value: "column", title: "Column (\u2193)", icon: (<svg width="12" height="12" viewBox="0 0 12 12"><line x1="6" y1="2" x2="6" y2="9" stroke="currentColor" strokeWidth="1.2" /><polyline points="3.5,7 6,9.5 8.5,7" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" /></svg>) },
  { value: "row-reverse", title: "Row Reverse (\u2190)", icon: (<svg width="12" height="12" viewBox="0 0 12 12"><line x1="3" y1="6" x2="10" y2="6" stroke="currentColor" strokeWidth="1.2" /><polyline points="5,3.5 2.5,6 5,8.5" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" /></svg>) },
  { value: "column-reverse", title: "Column Reverse (\u2191)", icon: (<svg width="12" height="12" viewBox="0 0 12 12"><line x1="6" y1="3" x2="6" y2="10" stroke="currentColor" strokeWidth="1.2" /><polyline points="3.5,5 6,2.5 8.5,5" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" /></svg>) },
];

export const ALIGN_SELF_OPTIONS = [
  { value: "auto", label: "Auto" }, { value: "flex-start", label: "Start" },
  { value: "center", label: "Center" }, { value: "flex-end", label: "End" },
  { value: "stretch", label: "Stretch" }, { value: "baseline", label: "Baseline" },
];

export const TEXT_ALIGN_OPTIONS = [
  { value: "left", title: "Align left", icon: (<svg width="12" height="12" viewBox="0 0 12 12"><line x1="1" y1="3" x2="10" y2="3" stroke="currentColor" strokeWidth="1.2" /><line x1="1" y1="6" x2="7" y2="6" stroke="currentColor" strokeWidth="1.2" /><line x1="1" y1="9" x2="9" y2="9" stroke="currentColor" strokeWidth="1.2" /></svg>) },
  { value: "center", title: "Align center", icon: (<svg width="12" height="12" viewBox="0 0 12 12"><line x1="1" y1="3" x2="11" y2="3" stroke="currentColor" strokeWidth="1.2" /><line x1="3" y1="6" x2="9" y2="6" stroke="currentColor" strokeWidth="1.2" /><line x1="2" y1="9" x2="10" y2="9" stroke="currentColor" strokeWidth="1.2" /></svg>) },
  { value: "right", title: "Align right", icon: (<svg width="12" height="12" viewBox="0 0 12 12"><line x1="2" y1="3" x2="11" y2="3" stroke="currentColor" strokeWidth="1.2" /><line x1="5" y1="6" x2="11" y2="6" stroke="currentColor" strokeWidth="1.2" /><line x1="3" y1="9" x2="11" y2="9" stroke="currentColor" strokeWidth="1.2" /></svg>) },
  { value: "justify", title: "Justify", icon: (<svg width="12" height="12" viewBox="0 0 12 12"><line x1="1" y1="3" x2="11" y2="3" stroke="currentColor" strokeWidth="1.2" /><line x1="1" y1="6" x2="11" y2="6" stroke="currentColor" strokeWidth="1.2" /><line x1="1" y1="9" x2="11" y2="9" stroke="currentColor" strokeWidth="1.2" /></svg>) },
];

export const TEXT_DECORATION_OPTIONS = [
  { value: "underline", title: "Underline", icon: (<svg width="12" height="12" viewBox="0 0 12 12"><text x="6" y="8" textAnchor="middle" fill="currentColor" fontSize="9" fontWeight="bold">U</text><line x1="2" y1="11" x2="10" y2="11" stroke="currentColor" strokeWidth="1" /></svg>) },
  { value: "line-through", title: "Strikethrough", icon: (<svg width="12" height="12" viewBox="0 0 12 12"><text x="6" y="9" textAnchor="middle" fill="currentColor" fontSize="9" fontWeight="bold">S</text><line x1="1" y1="6" x2="11" y2="6" stroke="currentColor" strokeWidth="1" /></svg>) },
  { value: "overline", title: "Overline", icon: (<svg width="12" height="12" viewBox="0 0 12 12"><line x1="2" y1="1" x2="10" y2="1" stroke="currentColor" strokeWidth="1" /><text x="6" y="9" textAnchor="middle" fill="currentColor" fontSize="9" fontWeight="bold">O</text></svg>) },
];

export const TEXT_TRANSFORM_OPTIONS = [
  { value: "uppercase", title: "Uppercase", icon: (<svg width="12" height="12" viewBox="0 0 12 12"><text x="6" y="9" textAnchor="middle" fill="currentColor" fontSize="8" fontWeight="bold">AA</text></svg>) },
  { value: "capitalize", title: "Capitalize", icon: (<svg width="12" height="12" viewBox="0 0 12 12"><text x="6" y="9" textAnchor="middle" fill="currentColor" fontSize="8" fontWeight="bold">Aa</text></svg>) },
  { value: "lowercase", title: "Lowercase", icon: (<svg width="12" height="12" viewBox="0 0 12 12"><text x="6" y="9" textAnchor="middle" fill="currentColor" fontSize="8" fontWeight="bold">aa</text></svg>) },
];
