/**
 * infer.ts — DOM element → spacing values + display name
 *
 * Takes a DOM element, reads getComputedStyle, and extracts the margin/padding
 * values consumed by the visual box model, plus a human-readable display name.
 *
 * (Historically infer() also built a full dialkit DialConfig plus a set of
 * value-conversion helpers, but the panel sections render from
 * getComputedStyle directly and never consumed them — they have been removed.)
 *
 * Runs in <1ms.
 */

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
