/**
 * infer.ts — DOM element → dialkit-native config
 *
 * Takes a DOM element, reads getComputedStyle, and returns a DialConfig
 * that can be passed directly to useDialKit(). Each section becomes a
 * nested object (dialkit renders these as collapsible folders).
 *
 * Also detects CSS custom properties (--var) affecting the element
 * and generates appropriate controls in a "Variables" folder.
 *
 * Runs in <1ms for standard sections. Variable detection may take
 * slightly longer due to stylesheet walking (still <5ms).
 */

import type {
  DialConfig,
  SpringConfig,
  SelectConfig,
  ColorConfig,
  TextConfig,
  ActionConfig,
} from "dialkit";
import { getCustomProperties } from "./scope";

// --- Value conversion helpers (used by Panel.tsx to apply values to DOM) ---

/** CSS properties that use px units */
export const PX_PROPS = new Set([
  "font-size",
  "letter-spacing",
  "padding-top",
  "padding-right",
  "padding-bottom",
  "padding-left",
  "margin-top",
  "margin-right",
  "margin-bottom",
  "margin-left",
  "gap",
  "border-radius",
  "border-width",
  "width",
  "height",
  "min-width",
  "max-width",
  "min-height",
  "max-height",
  "top",
  "right",
  "bottom",
  "left",
]);

/** Boolean CSS properties: toggle true/false ↔ CSS values */
export const TOGGLE_CSS: Record<string, { on: string; off: string }> = {
  "pointer-events": { on: "auto", off: "none" },
  visibility: { on: "visible", off: "hidden" },
};

/** Convert a resolved dialkit value back to a CSS string */
export function toCSSValue(prop: string, value: unknown): string | null {
  if (typeof value === "number") {
    if (PX_PROPS.has(prop)) return `${value}px`;
    return String(value);
  }
  if (typeof value === "boolean") {
    const map = TOGGLE_CSS[prop];
    return map ? (value ? map.on : map.off) : null;
  }
  if (typeof value === "string") {
    return value;
  }
  // SpringConfig, ActionConfig, etc. — not direct CSS values
  return null;
}

/** Flatten nested resolved values to a flat { cssProp: value } map */
export function flattenValues(
  obj: Record<string, unknown>
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (
      typeof value === "object" &&
      value !== null &&
      !("type" in value) &&
      !Array.isArray(value)
    ) {
      // Nested folder — recurse (leaf keys are CSS property names)
      Object.assign(result, flattenValues(value as Record<string, unknown>));
    } else {
      result[key] = value;
    }
  }
  return result;
}

// --- Internal helpers ---

import { cssColorToHex as rgbToHex } from "../colorUtils";
import { parseNum } from "../cssParsers";

/**
 * Magnitude-based slider range (matches dialkit's inferRange table).
 * Explicit opts take precedence over auto-inference.
 */
function range(
  value: number,
  opts?: { min?: number; max?: number; step?: number }
): [number, number, number, number] {
  const min = opts?.min ?? 0;
  const max = opts?.max;
  const step = opts?.step;

  if (max !== undefined && step !== undefined) {
    return [value, min, max, step];
  }

  const absVal = Math.abs(value);
  if (absVal <= 1) {
    return [value, min, max ?? 1, step ?? 0.01];
  }
  if (absVal <= 10) {
    return [value, min, max ?? Math.max(10, absVal * 3), step ?? 0.1];
  }
  if (absVal <= 100) {
    return [value, min, max ?? Math.max(100, absVal * 3), step ?? 1];
  }
  return [value, min, max ?? absVal * 3, step ?? 10];
}

// --- Text detection ---

const TEXT_TAGS = new Set([
  "h1", "h2", "h3", "h4", "h5", "h6",
  "p", "span", "a", "label", "button",
  "li", "td", "th", "input", "textarea",
  "strong", "em", "b", "i", "small", "blockquote",
]);

function isTextBearing(el: Element, tag: string): boolean {
  if (TEXT_TAGS.has(tag)) return true;
  if (el.matches("[role=button], [role=heading], [contenteditable]")) return true;
  for (const child of el.childNodes) {
    if (child.nodeType === Node.TEXT_NODE && child.textContent?.trim()) {
      return true;
    }
  }
  return false;
}

// --- Main ---

export type SpacingValues = {
  margin: { top: number; right: number; bottom: number; left: number };
  padding: { top: number; right: number; bottom: number; left: number };
};

export type InferResult = {
  config: DialConfig;
  name: string;
  /** Custom property units for slider → CSS conversion: { "--spacing-sm": "px" } */
  varUnits: Record<string, string>;
  /** Extracted spacing values for the visual box model */
  spacing: SpacingValues;
};

/** Spacing properties — used by action handler for reset */
export const SPACING_PROPS = [
  "padding-top", "padding-right", "padding-bottom", "padding-left",
  "margin-top", "margin-right", "margin-bottom", "margin-left",
];

export function infer(el: Element): InferResult {
  const cs = getComputedStyle(el);
  const tag = el.tagName.toLowerCase();
  const config: DialConfig = {};
  const varUnits: Record<string, string> = {};

  // --- Panel name ---
  const displayClass = getDisplayClassInline(el);
  const name = displayClass ? `${tag}.${displayClass}` : tag;

  const display = cs.display;
  const isFlex = display === "flex" || display === "inline-flex";
  const isGrid = display === "grid" || display === "inline-grid";
  const isMedia = tag === "img" || tag === "video" || tag === "canvas";

  // ─── 1. Layout (always visible — Webflow shows display for every element) ───

  const layout: DialConfig = {
    "display": {
      type: "select",
      options: [
        { value: "block", label: "Block" },
        { value: "flex", label: "Flex" },
        { value: "inline-flex", label: "Inline Flex" },
        { value: "grid", label: "Grid" },
        { value: "inline-grid", label: "Inline Grid" },
        { value: "inline-block", label: "Inline Block" },
        { value: "inline", label: "Inline" },
        { value: "none", label: "None" },
      ],
      default: display,
    } as SelectConfig,
  };

  if (isFlex) {
    layout["flex-direction"] = {
      type: "select",
      options: [
        { value: "row", label: "Row" },
        { value: "column", label: "Column" },
        { value: "row-reverse", label: "Row Rev" },
        { value: "column-reverse", label: "Col Rev" },
      ],
      default: cs.flexDirection,
    } as SelectConfig;
    layout["justify-content"] = {
      type: "select",
      options: [
        { value: "flex-start", label: "Start" },
        { value: "center", label: "Center" },
        { value: "flex-end", label: "End" },
        { value: "space-between", label: "Between" },
        { value: "space-around", label: "Around" },
        { value: "space-evenly", label: "Evenly" },
      ],
      default: cs.justifyContent,
    } as SelectConfig;
    layout["align-items"] = {
      type: "select",
      options: [
        { value: "stretch", label: "Stretch" },
        { value: "flex-start", label: "Start" },
        { value: "center", label: "Center" },
        { value: "flex-end", label: "End" },
        { value: "baseline", label: "Baseline" },
      ],
      default: cs.alignItems,
    } as SelectConfig;
    layout["flex-wrap"] = {
      type: "select",
      options: [
        { value: "nowrap", label: "No Wrap" },
        { value: "wrap", label: "Wrap" },
        { value: "wrap-reverse", label: "Wrap Rev" },
      ],
      default: cs.flexWrap,
    } as SelectConfig;
    layout["gap"] = range(parseNum(cs.gap), { max: 64 });
    layout["center"] = { type: "action", label: "Center" } as ActionConfig;
    layout["fill"] = { type: "action", label: "Fill Parent" } as ActionConfig;
  }

  if (isGrid) {
    layout["gap"] = range(parseNum(cs.gap), { max: 64 });
    layout["justify-items"] = {
      type: "select",
      options: [
        { value: "start", label: "Start" },
        { value: "center", label: "Center" },
        { value: "end", label: "End" },
        { value: "stretch", label: "Stretch" },
      ],
      default: cs.justifyItems,
    } as SelectConfig;
    layout["align-items"] = {
      type: "select",
      options: [
        { value: "start", label: "Start" },
        { value: "center", label: "Center" },
        { value: "end", label: "End" },
        { value: "stretch", label: "Stretch" },
      ],
      default: cs.alignItems,
    } as SelectConfig;
    layout["center"] = { type: "action", label: "Center" } as ActionConfig;
  }

  config["layout"] = layout;

  // ─── 2. Spacing — rendered by SpacingBoxModel, not DialKit ───

  const spacing: SpacingValues = {
    margin: {
      top: parseNum(cs.marginTop),
      right: parseNum(cs.marginRight),
      bottom: parseNum(cs.marginBottom),
      left: parseNum(cs.marginLeft),
    },
    padding: {
      top: parseNum(cs.paddingTop),
      right: parseNum(cs.paddingRight),
      bottom: parseNum(cs.paddingBottom),
      left: parseNum(cs.paddingLeft),
    },
  };

  // ─── 3. Size (always visible — Webflow shows w/h for all elements) ───

  const size: DialConfig = {
    "width": range(parseNum(cs.width), { max: 1200 }),
    "height": range(parseNum(cs.height), { max: 800 }),
    "min-width": range(parseNum(cs.minWidth), { max: 1200 }),
    "max-width": range(parseNum(cs.maxWidth === "none" ? "0" : cs.maxWidth), { max: 1920 }),
    "min-height": range(parseNum(cs.minHeight), { max: 800 }),
    "max-height": range(parseNum(cs.maxHeight === "none" ? "0" : cs.maxHeight), { max: 1200 }),
    "overflow": {
      type: "select",
      options: [
        { value: "visible", label: "Visible" },
        { value: "hidden", label: "Hidden" },
        { value: "scroll", label: "Scroll" },
        { value: "auto", label: "Auto" },
      ],
      default: cs.overflow,
    } as SelectConfig,
  };

  if (isMedia) {
    size["object-fit"] = {
      type: "select",
      options: [
        { value: "cover", label: "Cover" },
        { value: "contain", label: "Contain" },
        { value: "fill", label: "Fill" },
        { value: "none", label: "None" },
        { value: "scale-down", label: "Scale Down" },
      ],
      default: cs.objectFit,
    } as SelectConfig;
  }

  config["size"] = size;

  // ─── 4. Position ───

  const positionVal = cs.position;
  const position: DialConfig = {
    _collapsed: positionVal === "static",
    "position": {
      type: "select",
      options: [
        { value: "static", label: "Static" },
        { value: "relative", label: "Relative" },
        { value: "absolute", label: "Absolute" },
        { value: "fixed", label: "Fixed" },
        { value: "sticky", label: "Sticky" },
      ],
      default: positionVal,
    } as SelectConfig,
  };

  if (positionVal !== "static") {
    position["top"] = range(parseNum(cs.top), { min: -200, max: 200 });
    position["right"] = range(parseNum(cs.right), { min: -200, max: 200 });
    position["bottom"] = range(parseNum(cs.bottom), { min: -200, max: 200 });
    position["left"] = range(parseNum(cs.left), { min: -200, max: 200 });
    position["z-index"] = range(parseInt(cs.zIndex) || 0, { min: -10, max: 9999, step: 1 });
  }

  config["position"] = position;

  // ─── 5. Typography (text-bearing elements only) ───

  if (isTextBearing(el, tag)) {
    const fontSize = parseNum(cs.fontSize);
    const typography: DialConfig = {
      "font-size": [
        fontSize,
        Math.max(8, Math.round(fontSize * 0.5)),
        Math.round(fontSize * 2.5),
        1,
      ],
      "font-weight": [parseInt(cs.fontWeight) || 400, 100, 900, 100],
      "line-height": [
        Math.round((parseNum(cs.lineHeight) / fontSize || 1.4) * 100) / 100,
        0.8,
        2.5,
        0.05,
      ],
      "letter-spacing": [parseNum(cs.letterSpacing), -2, 8, 0.25],
      "font-family": { type: "text", default: cs.fontFamily } as TextConfig,
    };

    const color = rgbToHex(cs.color);
    if (color !== "transparent") {
      typography["color"] = { type: "color", default: color } as ColorConfig;
    }

    config["typography"] = typography;
  }

  // ─── 6. Backgrounds (only shown when element has a background) ───

  const bg = rgbToHex(cs.backgroundColor);
  if (bg !== "transparent") {
    config["backgrounds"] = {
      "background-color": {
        type: "color",
        default: bg,
      } as ColorConfig,
    };
  }

  // ─── 7. Borders ───

  const borderWidth = parseNum(cs.borderWidth);
  const borderRadius = parseNum(cs.borderTopLeftRadius);
  const borders: DialConfig = {
    _collapsed: borderWidth === 0 && borderRadius === 0,
  };

  if (borderWidth > 0) {
    borders["border-width"] = range(borderWidth, { max: 8 });
    borders["border-style"] = {
      type: "select",
      options: [
        { value: "solid", label: "Solid" },
        { value: "dashed", label: "Dashed" },
        { value: "dotted", label: "Dotted" },
        { value: "double", label: "Double" },
        { value: "none", label: "None" },
      ],
      default: cs.borderStyle,
    } as SelectConfig;
    const borderColor = rgbToHex(cs.borderColor);
    if (borderColor !== "transparent") {
      borders["border-color"] = {
        type: "color",
        default: borderColor,
      } as ColorConfig;
    }
  }

  borders["border-radius"] = range(parseNum(cs.borderTopLeftRadius), {
    max: 48,
    step: 4,
  });

  config["borders"] = borders;

  // ─── 8. Effects ───

  const effects: DialConfig = {
    _collapsed: true,
    "opacity": [parseFloat(cs.opacity) || 1, 0, 1, 0.05],
    "visibility": cs.visibility !== "hidden",
    "pointer-events": cs.pointerEvents !== "none",
    "cursor": {
      type: "select",
      options: [
        { value: "auto", label: "Auto" },
        { value: "pointer", label: "Pointer" },
        { value: "default", label: "Default" },
        { value: "text", label: "Text" },
        { value: "move", label: "Move" },
        { value: "grab", label: "Grab" },
        { value: "not-allowed", label: "Not Allowed" },
      ],
      default: cs.cursor,
    } as SelectConfig,
  };

  // Transition (spring inference) — folded into Effects
  if (cs.transitionProperty && cs.transitionProperty !== "none") {
    const duration = parseFloat(cs.transitionDuration);
    if (duration > 0) {
      effects["transition"] = {
        type: "spring",
        visualDuration: duration,
        bounce: 0.2,
      } as SpringConfig;
    }
  }

  config["effects"] = effects;

  // ─── 9. Variables (CSS custom properties) ───

  const customProps = getCustomProperties(el);
  if (customProps.length > 0) {
    const variables: DialConfig = { _collapsed: true };
    let varCount = 0;

    for (const cp of customProps) {
      const value = cp.value;

      if (isColorValue(value)) {
        variables[cp.name] = {
          type: "color",
          default: rgbToHex(value),
        } as ColorConfig;
        varCount++;
      } else if (isNumericValue(value)) {
        const parsed = parseNumWithUnit(value);
        if (parsed) {
          variables[cp.name] = range(parsed.num, {
            min: parsed.unit ? 0 : Math.min(0, parsed.num),
            max: Math.max(64, parsed.num * 3),
            step: parsed.unit === "px" ? 1 : 0.1,
          });
          varUnits[cp.name] = parsed.unit;
          varCount++;
        }
      }
      // Skip non-color, non-numeric values (e.g. font families, gradients)
    }

    if (varCount > 0) {
      config["variables"] = variables;
    }
  }

  return { config, name, varUnits, spacing };
}

// --- Variable value classification helpers ---

function isColorValue(value: string): boolean {
  if (value.startsWith("#")) return true;
  if (value.startsWith("rgb")) return true;
  if (value.startsWith("hsl")) return true;
  return false;
}

function isNumericValue(value: string): boolean {
  return /^-?[\d.]+(\w+|%)?$/.test(value.trim());
}

function parseNumWithUnit(
  value: string
): { num: number; unit: string } | null {
  const match = value.trim().match(/^(-?[\d.]+)(\w+|%)?$/);
  if (!match) return null;
  const num = parseFloat(match[1]);
  if (isNaN(num)) return null;
  return { num, unit: match[2] || "" };
}

// --- Inline helpers (avoid circular import with util.ts) ---

function getDisplayClassInline(el: Element): string | null {
  const classes = el.className;
  if (typeof classes !== "string" || !classes.trim()) return null;

  const list = classes.split(/\s+/);
  for (const cls of list) {
    // webpack: ComponentName_className__hash
    const webpack = cls.match(/^[A-Z]\w+_(\w+)__\w+$/);
    if (webpack) return webpack[1];
    // Turbopack: file-module__hash__className (requires -module segment)
    const turbo = cls.match(/^[\w-]+-module__\w+__(\w+)$/);
    if (turbo) return turbo[1];
    // Vite: _className_hash_digits
    const vite = cls.match(/^_(\w+)_\w+_\d+$/);
    if (vite) return vite[1];
  }

  return list[0] || null;
}
