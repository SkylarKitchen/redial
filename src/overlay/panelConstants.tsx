/**
 * panelConstants.tsx — Option/constant arrays extracted from WebflowPanel.tsx
 *
 * JSX-containing constants require .tsx extension.
 */

import {
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  Underline, Strikethrough, Baseline,
  Eye, EyeOff, ScrollText,
  WrapText,
  Italic, X, PilcrowLeft, PilcrowRight,
  AlignStartVertical, AlignCenterVertical, AlignEndVertical, MoveVertical,
  AlignHorizontalJustifyStart, AlignHorizontalJustifyCenter, AlignHorizontalJustifyEnd,
  AlignHorizontalSpaceBetween, AlignHorizontalSpaceAround, AlignHorizontalDistributeCenter,
} from "lucide-react";
import {
  AlignStartIcon, AlignCenterIcon, AlignEndIcon, AlignStretchIcon, AlignBaselineIcon,
  JustifyStartIcon, JustifyCenterIcon, JustifyEndIcon, JustifySpaceBetweenIcon, JustifySpaceAroundIcon,
  FlexRowIcon, FlexColumnIcon,
} from "./webflowIcons";

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
  { value: "uppercase", title: "Uppercase", icon: <span className="text-[10px] font-semibold leading-none">AA</span> },
  { value: "capitalize", title: "Capitalize", icon: <span className="text-[10px] font-semibold leading-none">Aa</span> },
  { value: "lowercase", title: "Lowercase", icon: <span className="text-[10px] font-semibold leading-none">aa</span> },
];

export const ITALIC_OPTIONS = [
  { value: "normal", title: "Normal", icon: <span className="text-xs leading-none" style={{ fontFamily: "Georgia, serif" }}>I</span> },
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

// ─── Align Icon Options (align-items, 5 buttons) ───────────────────

const iconSw = 1.5;

export const ALIGN_ICON_OPTIONS = [
  { value: "flex-start", icon: <AlignStartVertical size={14} strokeWidth={iconSw} />,  title: "Start" },
  { value: "center",     icon: <AlignCenterVertical size={14} strokeWidth={iconSw} />, title: "Center" },
  { value: "flex-end",   icon: <AlignEndVertical size={14} strokeWidth={iconSw} />,    title: "End" },
  { value: "stretch",    icon: <MoveVertical size={14} strokeWidth={iconSw} />,        title: "Stretch" },
  { value: "baseline",   icon: <Baseline size={14} strokeWidth={iconSw} />,            title: "Baseline" },
];

/** Webflow-style align segment options (for SegmentedControl) */
export const ALIGN_SEGMENT_OPTIONS = [
  { value: "flex-start", icon: <AlignStartIcon size={16} />,   title: "Start" },
  { value: "center",     icon: <AlignCenterIcon size={16} />,  title: "Center" },
  { value: "flex-end",   icon: <AlignEndIcon size={16} />,     title: "End" },
  { value: "stretch",    icon: <AlignStretchIcon size={16} />, title: "Stretch" },
  { value: "baseline",   icon: <AlignBaselineIcon size={16} />,title: "Baseline" },
];

// ─── Justify Icon Options (justify-content, 5+1 buttons) ───────────

export const JUSTIFY_ICON_OPTIONS = [
  { value: "flex-start",    icon: <AlignHorizontalJustifyStart size={14} strokeWidth={iconSw} />,   title: "Start" },
  { value: "center",        icon: <AlignHorizontalJustifyCenter size={14} strokeWidth={iconSw} />,  title: "Center" },
  { value: "flex-end",      icon: <AlignHorizontalJustifyEnd size={14} strokeWidth={iconSw} />,     title: "End" },
  { value: "space-between", icon: <AlignHorizontalSpaceBetween size={14} strokeWidth={iconSw} />,   title: "Between" },
  { value: "space-around",  icon: <AlignHorizontalSpaceAround size={14} strokeWidth={iconSw} />,    title: "Around" },
  { value: "space-evenly",  icon: <AlignHorizontalDistributeCenter size={14} strokeWidth={iconSw} />, title: "Evenly" },
];

/** Webflow-style justify segment options (for SegmentedControl) — 5 options matching Figma */
export const JUSTIFY_SEGMENT_OPTIONS = [
  { value: "flex-start",    icon: <JustifyStartIcon size={16} />,        title: "Start" },
  { value: "center",        icon: <JustifyCenterIcon size={16} />,       title: "Center" },
  { value: "flex-end",      icon: <JustifyEndIcon size={16} />,          title: "End" },
  { value: "space-between", icon: <JustifySpaceBetweenIcon size={16} />, title: "Between" },
  { value: "space-around",  icon: <JustifySpaceAroundIcon size={16} />,  title: "Around" },
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

export const HYPHENS_OPTIONS = [
  { value: "none", label: "None" },
  { value: "manual", label: "Manual" },
  { value: "auto", label: "Auto" },
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

/**
 * Pin presets — each defines which edges to pin (offset=0) and which to leave auto.
 * The `pin` object maps edge names → true (pinned to 0) or false (auto).
 */
export const PIN_PRESETS: Array<{ label: string; pin: { top: boolean; right: boolean; bottom: boolean; left: boolean } }> = [
  { label: "TL",  pin: { top: true,  right: false, bottom: false, left: true  } },
  { label: "T",   pin: { top: true,  right: false, bottom: false, left: false } },
  { label: "TR",  pin: { top: true,  right: true,  bottom: false, left: false } },
  { label: "L",   pin: { top: false, right: false, bottom: false, left: true  } },
  { label: "All", pin: { top: true,  right: true,  bottom: true,  left: true  } },
  { label: "R",   pin: { top: false, right: true,  bottom: false, left: false } },
  { label: "BL",  pin: { top: false, right: false, bottom: true,  left: true  } },
  { label: "B",   pin: { top: false, right: false, bottom: true,  left: false } },
  { label: "BR",  pin: { top: false, right: true,  bottom: true,  left: false } },
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

export const OVERFLOW_ICON_OPTIONS = [
  { value: "visible", icon: <Eye size={14} strokeWidth={1.5} />, title: "Visible" },
  { value: "hidden", icon: <EyeOff size={14} strokeWidth={1.5} />, title: "Hidden" },
  { value: "scroll", icon: <ScrollText size={14} strokeWidth={1.5} />, title: "Scroll" },
  { value: "auto", icon: <span className="text-[9px] font-sans font-medium">Auto</span>, title: "Auto" },
];

export const CHILDREN_MODE_OPTIONS = [
  { value: "fill", label: "Fill" },
  { value: "fit", label: "Fit" },
  { value: "fixed", label: "Fixed" },
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
  { value: "none", label: "None" },
  { value: "solid", label: "Solid" },
  { value: "dotted", label: "Dotted" },
  { value: "dashed", label: "Dashed" },
];

/** Border style icons for IconButtonGroup (matches Webflow's 4-option toggle). */
const borderLineIcon = (dasharray?: string) => (
  <svg width="14" height="14" viewBox="0 0 14 14" style={{ display: "block" }}>
    <line x1="2" y1="7" x2="12" y2="7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeDasharray={dasharray} />
  </svg>
);

export const BORDER_STYLE_ICON_OPTIONS = [
  { value: "none", title: "None", icon: <X size={12} strokeWidth={2} /> },
  { value: "solid", title: "Solid", icon: borderLineIcon() },
  { value: "dotted", title: "Dotted", icon: borderLineIcon("1 2") },
  { value: "dashed", title: "Dashed", icon: borderLineIcon("4 2") },
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

// ─── Grid Alignment Options ─────────────────────────────────────────

export const GRID_ALIGN_OPTIONS = [
  { value: "stretch", label: "Stretch" },
  { value: "start", label: "Start" },
  { value: "center", label: "Center" },
  { value: "end", label: "End" },
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
  { value: "row", title: "Row", icon: <FlexRowIcon size={14} /> },
  { value: "column", title: "Column", icon: <FlexColumnIcon size={14} /> },
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

export const BG_SIZE_OPTIONS = [
  { value: "auto", label: "Auto" },
  { value: "cover", label: "Cover" },
  { value: "contain", label: "Contain" },
];

export const BG_POSITION_OPTIONS = [
  { value: "center", label: "Center" },
  { value: "top", label: "Top" },
  { value: "bottom", label: "Bottom" },
  { value: "left", label: "Left" },
  { value: "right", label: "Right" },
  { value: "top left", label: "Top Left" },
  { value: "top right", label: "Top Right" },
  { value: "bottom left", label: "Bottom Left" },
  { value: "bottom right", label: "Bottom Right" },
];

export const BG_REPEAT_OPTIONS = [
  { value: "repeat", label: "Repeat" },
  { value: "repeat-x", label: "Repeat X" },
  { value: "repeat-y", label: "Repeat Y" },
  { value: "no-repeat", label: "No Repeat" },
  { value: "space", label: "Space" },
  { value: "round", label: "Round" },
];

export const BG_ATTACHMENT_OPTIONS = [
  { value: "scroll", label: "Scroll" },
  { value: "fixed", label: "Fixed" },
  { value: "local", label: "Local" },
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

// ─── Outline Style Icons ────────────────────────────────────────────

const lineIcon = (style: string) => (
  <span style={{ display: "inline-block", width: 16, height: 12, borderBottom: `2px ${style} currentColor` }} />
);

export const OUTLINE_STYLE_OPTIONS = [
  { value: "none", icon: <X size={11} strokeWidth={2} />, title: "None" },
  { value: "solid", icon: lineIcon("solid"), title: "Solid" },
  { value: "dashed", icon: lineIcon("dashed"), title: "Dashed" },
  { value: "dotted", icon: lineIcon("dotted"), title: "Dotted" },
];

// ─── Empty Field → Contextual Keyword ───────────────────────────────

/** When a numeric input is cleared and committed, these properties get a keyword instead of 0. */
export const EMPTY_KEYWORD_MAP: Record<string, string> = {
  'width': 'auto', 'height': 'auto', 'max-width': 'none', 'max-height': 'none',
  'min-width': '0', 'min-height': '0', 'z-index': 'auto', 'flex-basis': 'auto',
};

// ─── Box Model Options ──────────────────────────────────────────────

export const BOX_SIZING_OPTIONS = [
  { value: "border-box", icon: <span className="text-[9px]">Border</span>, title: "border-box" },
  { value: "content-box", icon: <span className="text-[9px]">Content</span>, title: "content-box" },
];

// ─── Keyboard Shortcuts Reference ───────────────────────────────────

export interface ShortcutEntry { keys: string; description: string; group: string }

export const SHORTCUTS: ShortcutEntry[] = [
  // Selection
  { keys: "↑ / ↓", description: "Select sibling element", group: "Selection" },
  { keys: "← / →", description: "Select parent / first child", group: "Selection" },
  { keys: "Escape", description: "Deselect element / close panel", group: "Selection" },
  { keys: "Cmd+F", description: "Search properties in panel", group: "Selection" },
  // Values
  { keys: "↑ / ↓ (in input)", description: "Increment / decrement value", group: "Values" },
  { keys: "Shift + ↑/↓", description: "Step by 10", group: "Values" },
  { keys: "Alt + ↑/↓", description: "Step by 0.1", group: "Values" },
  { keys: "Scroll wheel", description: "Adjust focused value", group: "Values" },
  { keys: "Alt+Click label", description: "Reset property to default", group: "Values" },
  { keys: "Math expr (e.g. *2)", description: "Evaluate expression in input", group: "Values" },
  // Panel
  { keys: "Alt+Shift+S", description: "Toggle focus mode", group: "Panel" },
  { keys: "Tab / Shift+Tab", description: "Navigate between controls", group: "Panel" },
  { keys: "S", description: "Cycle scope (element/class/page)", group: "Panel" },
  { keys: "R", description: "Reset all styles", group: "Panel" },
  // File
  { keys: "Cmd+S", description: "Save to source file", group: "File" },
  { keys: "Cmd+C", description: "Copy CSS to clipboard", group: "File" },
  { keys: "Cmd+Z / Cmd+Shift+Z", description: "Undo / Redo", group: "File" },
];
