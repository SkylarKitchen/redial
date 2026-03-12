/**
 * panelUtils.ts — Shared helpers and types for section components.
 *
 * Extracted from WebflowPanel.tsx so that LayoutSection, SizeSection, etc.
 * can import indicator logic, unit detection, and the SectionCtx prop type
 * without depending on the orchestrator.
 */

import type React from "react";
import { extractUnit } from "./cssParsers";
import type { IndicatorType } from "./StyleIndicator";
import type { UnitConversionContext } from "./unitConversion";

// ─── SectionCtx ──────────────────────────────────────────────────────

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
}

// ─── Indicator Helpers ───────────────────────────────────────────────

/** CSS properties that are inherited by default */
export const INHERITABLE_PROPERTIES = new Set([
  "color", "font-family", "font-size", "font-style", "font-weight", "font-variant",
  "line-height", "letter-spacing", "word-spacing", "text-align", "text-indent",
  "text-transform", "text-decoration", "white-space", "word-break", "word-wrap",
  "direction", "visibility", "cursor", "list-style", "list-style-type", "quotes",
  "hyphens", "tab-size", "text-shadow",
]);

export function getIndicatorType(
  el: Element,
  prop: string,
  cs?: CSSStyleDeclaration,
  parentCs?: CSSStyleDeclaration | null,
): IndicatorType {
  if ((el as HTMLElement).style.getPropertyValue(prop) !== "") return "element";
  if (isVariableLinked(el, prop)) return "variable";
  if (INHERITABLE_PROPERTIES.has(prop) && parentCs) {
    const computedValue = cs?.getPropertyValue(prop) ?? "";
    const parentValue = parentCs.getPropertyValue(prop);
    if (computedValue !== parentValue) return "inherited";
  }
  return "none";
}

// ─── Indicator Colors & Titles (Phase J) ────────────────────────────

const INDICATOR_COLORS: Record<IndicatorType, string> = {
  element: "#60a5fa",
  inherited: "#f59e0b",
  state: "#34d399",
  variable: "#a78bfa",
  direct: "#60a5fa",
  none: "rgba(0,0,0,0.45)",
};

const INDICATOR_TITLES: Record<IndicatorType, string | null> = {
  element: "Set locally. Alt+Click to reset.",
  inherited: "Inherited. Alt+Click to override.",
  state: "Set on state. Alt+Click to clear.",
  variable: "Uses CSS variable.",
  direct: "Set locally. Alt+Click to reset.",
  none: null,
};

export function getIndicatorColor(type: IndicatorType): string {
  return INDICATOR_COLORS[type];
}

export function getIndicatorTitle(type: IndicatorType, el?: Element, prop?: string): string | undefined {
  if (type === "inherited" && el && prop) {
    const parent = el.parentElement;
    const tag = parent?.tagName.toLowerCase() ?? "";
    const cls = parent?.className ? `.${parent.className.split(" ")[0]}` : "";
    return `Inherited from ${tag}${cls}. Alt+Click to override.`;
  }
  return INDICATOR_TITLES[type] ?? undefined;
}

// ─── Authored Value / Unit Detection ─────────────────────────────────

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

// ─── Unit Step Sizes ─────────────────────────────────────────────────

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

/** Decimal places needed to display the step cleanly */
export function precisionForStep(step: number): number {
  if (step >= 1) return 0;
  const s = step.toString();
  const dot = s.indexOf(".");
  return dot < 0 ? 0 : s.length - dot - 1;
}

// ─── Variable Detection ─────────────────────────────────────────────

/** WeakMap cache: element → set of properties that use var() */
const varCache = new WeakMap<Element, Map<string, boolean>>();

/** Check whether a property's authored value uses a CSS variable */
export function isVariableLinked(el: Element, prop: string): boolean {
  let propMap = varCache.get(el);
  if (!propMap) {
    propMap = new Map();
    varCache.set(el, propMap);
  }
  const cached = propMap.get(prop);
  if (cached !== undefined) return cached;

  const authored = getAuthoredValue(el, prop);
  const result = authored !== null && authored.includes("var(");
  propMap.set(prop, result);
  return result;
}

// ─── Text Detection ──────────────────────────────────────────────────

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
