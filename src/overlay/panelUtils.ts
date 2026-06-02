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

/** Indicator: "state" (green) when a pseudo-class state is active and the property is dirty
 *  for that state, "modified" (blue) for base-state changes, "none" otherwise. */
export function getIndicatorType(
  el: Element,
  prop: string,
  _cs?: CSSStyleDeclaration,
  _parentCs?: CSSStyleDeclaration | null,
  activeState?: string,
): IndicatorType {
  // When a pseudo-class state is active, check the state-keyed override
  if (activeState && activeState !== "none") {
    if (isDirty(el, stateKey(activeState, prop))) return "state";
  }
  if (isDirty(el, prop)) return "modified";
  return "none";
}

export function getIndicatorTitle(type: IndicatorType): string | undefined {
  if (type === "state") return "State-specific style — Option+Click to reset";
  if (type === "modified") return "Modified — Option+Click to reset";
  return undefined;
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
