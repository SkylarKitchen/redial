/**
 * panelUtils.ts — Shared helpers and types for section components.
 *
 * Extracted from WebflowPanel.tsx so that LayoutSection, SizeSection, etc.
 * can import indicator logic, unit detection, and the SectionCtx prop type
 * without depending on the orchestrator.
 */

import type React from "react";
import { isDirty, stateKey } from "./core/apply";
import { extractUnit } from "./cssParsers";
import type { IndicatorType } from "./theme";
import type { UnitConversionContext } from "./unitConversion";

// ─── Section Order ────────────────────────────────────────────────────────

/** Canonical order of CSS property sections (used by keyboard navigation). */
export const SECTION_ORDER = [
  "Layout", "Spacing", "Size", "Position",
  "Typography", "Backgrounds", "Borders", "Effects",
] as const;

// ─── SectionCtx ──────────────────────────────────────────────────────────

/** Shared prop bundle passed to every section component. */
export interface SectionCtx {
  element: Element;
  apply: (prop: string, value: string) => void;
  /** Reset (clear the inline override for) a property — mirrors `apply`. */
  reset: (prop: string) => void;
  /** Reset a property and read back its fresh computed numeric value. */
  resetRead: (prop: string) => number;
  /** Reset a property and read back its fresh computed string value. */
  resetReadStr: (prop: string) => string;
  ind: (prop: string) => IndicatorType;
  sectionInd: (props: string[]) => IndicatorType;
  cs: CSSStyleDeclaration;
  parentCs: CSSStyleDeclaration | null;
  getConversionCtx: () => UnitConversionContext;
  /** Creates an onContextMenu handler for right-click property menu */
  ctxMenu: (prop: string, value: string) => (e: React.MouseEvent) => void;
  /** True when the selected element uses Tailwind utility classes */
  isTailwind: boolean;
}

// ─── Indicator Helpers ───────────────────────────────────────────────────

/**
 * CSS properties that inherit by default. Used to decide whether a value that
 * matches the parent's computed value is genuinely cascaded (orange "inherited")
 * vs. coincidentally equal. Scoped to the properties the panel actually shows.
 */
const INHERITED_PROPS = new Set([
  "color", "font", "font-family", "font-size", "font-weight", "font-style",
  "font-variant", "font-stretch", "line-height", "letter-spacing", "word-spacing",
  "text-align", "text-indent", "text-transform", "text-shadow", "white-space",
  "word-break", "overflow-wrap", "tab-size", "direction", "visibility", "cursor",
  "list-style", "list-style-type", "list-style-position",
]);

/** Walk ancestors to see if any of them authors `prop` — distinguishes a real
 *  inherited cascade from a shared browser default (which has no author). */
function hasAuthoredAncestor(el: Element, prop: string): boolean {
  let p = el.parentElement;
  while (p) {
    if (getAuthoredValue(p, prop)) return true;
    p = p.parentElement;
  }
  return false;
}

/**
 * Cascade-provenance indicator (ADR-0007 / spec §11). Classifies WHERE a
 * property's value comes from, with two orthogonal session cues taking priority
 * so the "I edited this" signal — and the reset affordances gated on it — are
 * never lost:
 *
 *   1. "state"          — green:  active pseudo-state has a session edit
 *   2. "modified"       — amber:  edited THIS SESSION (dirty) — preserved cue
 *   3. "element-inline" — pink:   value set via the element's inline style attr
 *   4. "authored-here"  — blue:   value set on a CSS rule matching this element
 *   5. "inherited"      — orange: CSS-inherited prop cascaded from an ancestor
 *   6. "none"                   — browser default / unset
 *
 * Provenance (3–5) therefore surfaces only on properties not edited this session.
 */
export function getIndicatorType(
  el: Element,
  prop: string,
  cs?: CSSStyleDeclaration,
  parentCs?: CSSStyleDeclaration | null,
  activeState?: string,
): IndicatorType {
  // 1–2. Session cues take priority (orthogonal to provenance, ADR-0007).
  if (activeState && activeState !== "none") {
    if (isDirty(el, stateKey(activeState, prop))) return "state";
  }
  if (isDirty(el, prop)) return "modified";

  // 3. Element-scope inline override (read the attribute directly, not via
  //    getAuthoredValue, so it's unambiguously inline rather than a rule match).
  if ((el as HTMLElement).style?.getPropertyValue(prop)) return "element-inline";

  // 4. Authored on a CSS rule that matches this element.
  if (getAuthoredValue(el, prop)) return "authored-here";

  // 5. Inherited: a CSS-inherited prop whose computed value equals the parent's
  //    and is sourced from an authored ancestor (not a shared browser default).
  if (
    INHERITED_PROPS.has(prop) && cs && parentCs &&
    cs.getPropertyValue(prop) &&
    cs.getPropertyValue(prop) === parentCs.getPropertyValue(prop) &&
    hasAuthoredAncestor(el, prop)
  ) {
    return "inherited";
  }

  return "none";
}

export function getIndicatorTitle(type: IndicatorType): string | undefined {
  switch (type) {
    case "state": return "State-specific style — Option+Click to reset";
    case "modified": return "Modified — Option+Click to reset";
    case "authored-here": return "Authored on this element";
    case "inherited": return "Inherited from a parent";
    case "element-inline": return "Element-scope (inline) override";
    case "none": return undefined;
  }
}

// ─── Authored Value / Unit Detection ─────────────────────────────────────

export function getAuthoredValue(el: Element, prop: string): string | null {
  const inline = (el as HTMLElement).style.getPropertyValue(prop);
  if (inline) return inline;
  let found: string | null = null;
  try {
    for (const sheet of document.styleSheets) {
      try {
        for (const rule of sheet.cssRules) {
          if (rule instanceof CSSStyleRule && el.matches(rule.selectorText)) {
            const val = rule.style.getPropertyValue(prop);
            if (val) found = val;
          }
        }
      } catch { /* cross-origin sheet */ }
    }
  } catch { /* no access */ }
  return found;
}

/** Extract the CSS unit from the authored value of a property, falling back to `fallback` */
export function detectUnit(el: Element, prop: string, fallback: string = "px"): string {
  const authored = getAuthoredValue(el, prop);
  if (!authored) return fallback;
  return extractUnit(authored, fallback);
}

// ─── Unit Step Sizes ─────────────────────────────────────────────────────

/** Return the drag/scrub step for a given CSS unit.
 *  px → 4, rem/em → 0.25, % and viewport units → 1 */
export function stepForUnit(unit: string): number {
  switch (unit) {
    case "px":
      return 4;
    case "rem":
    case "em":
      return 0.25;
    default:
      return 1;
  }
}

/** Convert preset values from one CSS unit to another using the stepForUnit ratio. */
export function convertPresets(
  values: (string | number)[],
  fromUnit: string,
  toUnit: string,
): (string | number)[] {
  if (fromUnit === toUnit) return values;
  const ratio = stepForUnit(toUnit) / stepForUnit(fromUnit);
  return values.map((v) =>
    typeof v === "number" ? Math.round(v * ratio * 100) / 100 : v
  );
}

/** Decimal places needed to display the step cleanly */
export function precisionForStep(step: number): number {
  if (step >= 1) return 0;
  const s = step.toString();
  const dot = s.indexOf(".");
  return dot < 0 ? 0 : s.length - dot - 1;
}

// ─── Text Detection ──────────────────────────────────────────────────────

export const TEXT_TAGS = new Set([
  "h1", "h2", "h3", "h4", "h5", "h6", "p", "span", "a", "label",
  "button", "li", "td", "th", "input", "textarea", "strong", "em",
  "b", "i", "small", "blockquote",
]);

export function isTextBearing(el: Element): boolean {
  if (TEXT_TAGS.has(el.tagName.toLowerCase())) return true;
  if (el.matches("[role=button], [role=heading], [contenteditable]")) return true;
  for (const child of el.childNodes) {
    if (child.nodeType === Node.TEXT_NODE && child.textContent?.trim()) return true;
  }
  return false;
}
