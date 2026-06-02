/**
 * infer.ts — DOM element → spacing values + display name
 *
 * Takes a DOM element, reads getComputedStyle, and extracts the margin/padding
 * values consumed by the visual box model, plus a human-readable display name.
 *
 * (Historically infer() also built a full dialkit DialConfig, but the panel
 * sections render from getComputedStyle directly and never consumed that
 * config — it has been removed. The value-conversion helpers below remain
 * part of the public API surface re-exported from src/index.tsx.)
 *
 * Runs in <1ms.
 */

// --- Value conversion helpers (public API, re-exported from src/index.tsx) ---

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

/**
 * Convert a resolved dialkit value back to a CSS string.
 * @param prop - The CSS property name (e.g. `"font-size"`, `"color"`).
 * @param value - The resolved dialkit value (number, boolean, or string).
 * @returns A CSS-ready string, or `null` if the value type has no CSS representation (e.g. SpringConfig).
 */
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

/**
 * Flatten nested resolved dialkit values into a single-level `{ cssProp: value }` map.
 * @param obj - A potentially nested object of resolved dialkit values where leaf keys are CSS property names.
 * @returns A flat record mapping every CSS property name to its resolved value.
 */
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

import { parseNum } from "../cssParsers";

// --- Main ---

export type SpacingValues = {
  margin: { top: number; right: number; bottom: number; left: number };
  padding: { top: number; right: number; bottom: number; left: number };
};

export type InferResult = {
  name: string;
  /** Extracted spacing values for the visual box model */
  spacing: SpacingValues;
};

/** Spacing properties — used by action handler for reset */
export const SPACING_PROPS = [
  "padding-top", "padding-right", "padding-bottom", "padding-left",
  "margin-top", "margin-right", "margin-bottom", "margin-left",
];

/**
 * Inspect a DOM element and extract its display name plus the margin/padding
 * values used by the visual box model.
 * @param el - The DOM element to inspect via `getComputedStyle`.
 * @returns An `InferResult` containing a display name and extracted spacing values.
 */
export function infer(el: Element): InferResult {
  const tag = el.tagName.toLowerCase();

  let cs: CSSStyleDeclaration;
  try {
    cs = getComputedStyle(el);
  } catch {
    // Element is detached, inside a closed shadow root, or otherwise
    // inaccessible (e.g. SVG foreignObject). Return safe defaults.
    return {
      name: tag,
      spacing: {
        margin:  { top: 0, right: 0, bottom: 0, left: 0 },
        padding: { top: 0, right: 0, bottom: 0, left: 0 },
      },
    };
  }

  // --- Panel name ---
  const displayClass = getDisplayClassInline(el);
  const name = displayClass ? `${tag}.${displayClass}` : tag;

  // --- Spacing — rendered by SpacingBoxModel ---
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

  return { name, spacing };
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
