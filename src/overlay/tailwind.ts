/**
 * tailwind.ts — CSS-to-Tailwind converter for clipboard export.
 *
 * Uses a 2-tier approach: property-specific converters → arbitrary value fallback.
 * All functions are pure — no DOM access, no side effects.
 */

import type { DiffEntry } from "./apply";

/** Convert a CSS diff to a space-separated Tailwind v4 class string. */
export function formatTailwindDiff(changes: DiffEntry[]): string {
  return changes
    .map((c) => cssToTailwind(c.prop, c.to))
    .filter((c): c is string => c !== null)
    .join(" ");
}

type Converter = (value: string) => string | null;

function cssToTailwind(prop: string, value: string): string | null {
  // Tier 1: Property-specific converter
  const converter = CONVERTERS[prop];
  if (converter) return converter(value);

  // Tier 2: Arbitrary value fallback
  const prefix = PROP_PREFIX[prop];
  if (prefix) return `${prefix}-[${escapeArbitrary(value)}]`;

  return null;
}

/** Escape characters that break Tailwind's arbitrary value syntax. */
function escapeArbitrary(v: string): string {
  return v.replace(/_/g, "\\_").replace(/\s+/g, "_");
}

// Tailwind v4 spacing: 1 unit = 4px (continuous scale)
const SPACING_EXCEPTIONS: Record<string, string> = { "1px": "px" };

function spacingValue(px: string): string {
  if (SPACING_EXCEPTIONS[px]) return SPACING_EXCEPTIONS[px];
  // Only apply the /4 scale to px values; everything else goes to bracket syntax
  if (!px.endsWith("px")) return `[${escapeArbitrary(px)}]`;
  const num = parseFloat(px);
  if (isNaN(num)) return `[${escapeArbitrary(px)}]`;
  if (num === 0) return "0";
  const tw = num / 4;
  if (Number.isFinite(tw)) return String(tw);
  return `[${px}]`;
}

function spaced(prefix: string, v: string): string {
  if (v === "auto") return `${prefix}-auto`;
  const tw = spacingValue(v);
  return `${prefix}-${tw}`;
}

function spacedSigned(prefix: string, v: string): string {
  if (v === "auto") return `${prefix}-auto`;
  const num = parseFloat(v);
  if (num < 0) return `-${prefix}-${spacingValue(v.replace(/^-/, ""))}`;
  return spaced(prefix, v);
}

// ─── Property-Specific Converters ────────────────────────────────────

const CONVERTERS: Record<string, Converter> = {
  // Display / Position: value IS the class
  display: (v) => (v === "none" ? "hidden" : v),
  position: (v) => (v === "static" ? null : v),

  // Sizing
  width: (v) => spaced("w", v),
  height: (v) => spaced("h", v),
  "min-width": (v) => spaced("min-w", v),
  "max-width": (v) => (v === "none" ? "max-w-none" : spaced("max-w", v)),
  "min-height": (v) => spaced("min-h", v),
  "max-height": (v) => (v === "none" ? "max-h-none" : spaced("max-h", v)),

  // Padding
  "padding-top": (v) => spaced("pt", v),
  "padding-right": (v) => spaced("pr", v),
  "padding-bottom": (v) => spaced("pb", v),
  "padding-left": (v) => spaced("pl", v),

  // Margin (supports negative values)
  "margin-top": (v) => spacedSigned("mt", v),
  "margin-right": (v) => spacedSigned("mr", v),
  "margin-bottom": (v) => spacedSigned("mb", v),
  "margin-left": (v) => spacedSigned("ml", v),

  // Gap
  gap: (v) => spaced("gap", v),
  "row-gap": (v) => spaced("gap-y", v),
  "column-gap": (v) => spaced("gap-x", v),

  // Colors — always arbitrary
  color: (v) => `text-[${escapeArbitrary(v)}]`,
  "background-color": (v) => `bg-[${escapeArbitrary(v)}]`,
  "border-color": (v) => `border-[${escapeArbitrary(v)}]`,

  // Typography
  "font-size": (v) => `text-[${escapeArbitrary(v)}]`,
  "font-weight": (v) => `font-[${v}]`,
  "line-height": (v) => `leading-[${escapeArbitrary(v)}]`,
  "letter-spacing": (v) => `tracking-[${escapeArbitrary(v)}]`,
  "text-align": (v) => `text-${v}`,
  "text-decoration-line": (v) => {
    if (v === "none") return "no-underline";
    if (v === "underline") return "underline";
    if (v === "overline") return "overline";
    if (v === "line-through") return "line-through";
    return `decoration-[${escapeArbitrary(v)}]`;
  },
  "text-transform": (v) => {
    if (v === "none") return "normal-case";
    if (v === "uppercase") return "uppercase";
    if (v === "lowercase") return "lowercase";
    if (v === "capitalize") return "capitalize";
    return null;
  },

  // Flexbox layout
  "flex-direction": (v) => {
    const map: Record<string, string> = {
      row: "flex-row",
      column: "flex-col",
      "row-reverse": "flex-row-reverse",
      "column-reverse": "flex-col-reverse",
    };
    return map[v] ?? `flex-[${v}]`;
  },
  "flex-wrap": (v) => {
    const map: Record<string, string> = {
      nowrap: "flex-nowrap",
      wrap: "flex-wrap",
      "wrap-reverse": "flex-wrap-reverse",
    };
    return map[v] ?? null;
  },
  "justify-content": (v) => {
    const map: Record<string, string> = {
      "flex-start": "justify-start",
      "flex-end": "justify-end",
      center: "justify-center",
      "space-between": "justify-between",
      "space-around": "justify-around",
      "space-evenly": "justify-evenly",
    };
    return map[v] ?? `justify-[${v}]`;
  },
  "align-items": (v) => {
    const map: Record<string, string> = {
      "flex-start": "items-start",
      "flex-end": "items-end",
      center: "items-center",
      stretch: "items-stretch",
      baseline: "items-baseline",
    };
    return map[v] ?? `items-[${v}]`;
  },
  "flex-grow": (v) =>
    v === "1" ? "grow" : v === "0" ? "grow-0" : `grow-[${v}]`,
  "flex-shrink": (v) =>
    v === "1" ? "shrink" : v === "0" ? "shrink-0" : `shrink-[${v}]`,
  "flex-basis": (v) => spaced("basis", v),
  order: (v) => `order-[${v}]`,

  // Position offsets
  top: (v) => spaced("top", v),
  right: (v) => spaced("right", v),
  bottom: (v) => spaced("bottom", v),
  left: (v) => spaced("left", v),
  "z-index": (v) => (v === "auto" ? "z-auto" : `z-[${v}]`),

  // Effects
  opacity: (v) => `opacity-[${v}]`,
  "border-radius": (v) => `rounded-[${escapeArbitrary(v)}]`,
  "border-width": (v) => (v === "1px" ? "border" : `border-[${v}]`),
  overflow: (v) => `overflow-${v}`,
  cursor: (v) => `cursor-${v}`,
  "mix-blend-mode": (v) => `mix-blend-${v}`,
  visibility: (v) => (v === "hidden" ? "invisible" : v === "visible" ? "visible" : null),
};

// ─── Arbitrary Value Fallback Prefix Map ─────────────────────────────

const PROP_PREFIX: Record<string, string> = {
  "backdrop-filter": "backdrop",
  filter: "filter",
  transform: "transform",
  transition: "transition",
  "box-shadow": "shadow",
  outline: "outline",
  "pointer-events": "pointer-events",
  "user-select": "select",
  "object-fit": "object",
  "object-position": "object",
  "aspect-ratio": "aspect",
};
