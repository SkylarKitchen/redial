/**
 * discoverVariables.ts — Shared CSS custom property discovery logic.
 *
 * Extracts variable discovery from CSSVariablesSection so it can be
 * reused by SizeSection (for variable picker in UnitSelector).
 */

// ─── Types ───────────────────────────────────────────────────────────

export type VarSource = "element" | "inherited" | "root";
export type VarType = "color" | "length" | "number" | "string";
export interface CSSVariable {
  name: string;
  value: string;
  source: VarSource;
  type: VarType;
  /** For length values, the numeric part */
  numericValue?: number;
  /** For length values, the unit (px, em, rem, %, etc.) */
  unit?: string;
}

// ─── Color Detection ─────────────────────────────────────────────────

const HEX_RE = /^#([0-9a-f]{3,8})$/i;
const COMMON_COLOR_NAMES = new Set(["transparent", "currentcolor", "black", "white", "red", "blue", "green"]);

function isColorValue(value: string): boolean {
  const v = value.trim();
  if (!v) return false;
  if (HEX_RE.test(v)) return true;
  if (/^(rgb|rgba|hsl|hsla|oklch|oklab|lch|lab|color)\s*\(/i.test(v)) return true;
  if (COMMON_COLOR_NAMES.has(v.toLowerCase())) return true;
  return false;
}

// ─── Length / Number Detection ───────────────────────────────────────

export const LENGTH_RE = /^(-?[\d.]+)(px|em|rem|%|vw|vh|vmin|vmax|ch|ex|lh|cap|ic|svw|svh|lvw|lvh|dvw|dvh|cm|mm|in|pt|pc|Q)$/;
const NUMBER_RE = /^-?[\d.]+$/;

export function parseLength(value: string): { num: number; unit: string } | null {
  const m = value.trim().match(LENGTH_RE);
  if (!m) return null;
  const num = parseFloat(m[1]);
  return isNaN(num) ? null : { num, unit: m[2] };
}

export function detectVarType(value: string): { type: VarType; numericValue?: number; unit?: string } {
  if (isColorValue(value)) return { type: "color" };
  const len = parseLength(value);
  if (len) return { type: "length", numericValue: len.num, unit: len.unit };
  if (NUMBER_RE.test(value.trim())) return { type: "number", numericValue: parseFloat(value) };
  return { type: "string" };
}

// ─── Recursive Rule Walker ──────────────────────────────────────────

export function walkRules(rules: CSSRuleList, callback: (rule: CSSStyleRule) => void) {
  for (let i = 0; i < rules.length; i++) {
    const rule = rules[i];
    if (rule instanceof CSSStyleRule) {
      callback(rule);
    } else if ('cssRules' in rule) {
      // Handles CSSMediaRule, CSSSupportsRule, CSSLayerBlockRule
      walkRules((rule as CSSGroupingRule).cssRules, callback);
    }
  }
}

// ─── Variable Discovery ──────────────────────────────────────────────

export function discoverVariables(element: Element): CSSVariable[] {
  const found = new Map<string, CSSVariable>();
  const rootStyles = getComputedStyle(document.documentElement);
  const elStyles = getComputedStyle(element);

  // 1. Walk stylesheets once — collect :root vars and element-matching vars
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      walkRules(sheet.cssRules, (rule) => {
        const isRoot = rule.selectorText === ":root" || rule.selectorText === "html";
        let matchesEl = false;
        if (!isRoot) {
          try { matchesEl = element.matches(rule.selectorText); } catch { /* invalid selector */ }
        }
        if (!isRoot && !matchesEl) return;

        for (let i = 0; i < rule.style.length; i++) {
          const prop = rule.style[i];
          if (!prop.startsWith("--")) continue;
          const value = (isRoot ? rootStyles : elStyles).getPropertyValue(prop).trim();
          if (value) {
            const detected = detectVarType(value);
            found.set(prop, {
              name: prop,
              value,
              source: matchesEl ? "element" : "root",
              ...detected,
            });
          }
        }
      });
    } catch {
      // Cross-origin stylesheets throw SecurityError — skip silently
    }
  }

  // 2. Check inline styles on the element itself
  const htmlEl = element as HTMLElement;
  if (htmlEl.style) {
    for (let i = 0; i < htmlEl.style.length; i++) {
      const prop = htmlEl.style[i];
      if (prop.startsWith("--")) {
        const value = htmlEl.style.getPropertyValue(prop).trim();
        if (value) {
          found.set(prop, { name: prop, value, source: "element", ...detectVarType(value) });
        }
      }
    }
  }

  // 3. Check ancestors for inherited variables (walk up the DOM)
  let ancestor = element.parentElement;
  while (ancestor && ancestor !== document.documentElement) {
    if (ancestor.style) {
      for (let i = 0; i < ancestor.style.length; i++) {
        const prop = ancestor.style[i];
        if (prop.startsWith("--") && !found.has(prop)) {
          const value = elStyles.getPropertyValue(prop).trim();
          if (value) {
            found.set(prop, { name: prop, value, source: "inherited", ...detectVarType(value) });
          }
        }
      }
    }
    ancestor = ancestor.parentElement;
  }

  return Array.from(found.values()).sort((a, b) => a.name.localeCompare(b.name));
}

// ─── Convenience: Length Variables Only ──────────────────────────────

export function discoverLengthVariables(element: Element): CSSVariable[] {
  return discoverVariables(element).filter(v => v.type === "length");
}

// ─── Global Variable Discovery ──────────────────────────────────────

/**
 * Discover ALL CSS custom properties defined on :root / html across all
 * stylesheets. Unlike discoverVariables() which is element-scoped, this
 * returns every project-level variable for the global variables panel.
 */
export function discoverAllVariables(): CSSVariable[] {
  const found = new Map<string, CSSVariable>();
  const rootStyles = getComputedStyle(document.documentElement);

  for (const sheet of Array.from(document.styleSheets)) {
    try {
      walkRules(sheet.cssRules, (rule) => {
        if (rule.selectorText !== ":root" && rule.selectorText !== "html") return;
        for (let i = 0; i < rule.style.length; i++) {
          const prop = rule.style[i];
          if (!prop.startsWith("--")) continue;
          const value = rootStyles.getPropertyValue(prop).trim();
          if (value) {
            found.set(prop, { name: prop, value, source: "root", ...detectVarType(value) });
          }
        }
      });
    } catch {
      // Cross-origin stylesheets — skip
    }
  }

  // Also include any inline overrides on documentElement
  const rootEl = document.documentElement;
  for (let i = 0; i < rootEl.style.length; i++) {
    const prop = rootEl.style[i];
    if (prop.startsWith("--")) {
      const value = rootEl.style.getPropertyValue(prop).trim();
      if (value) {
        found.set(prop, { name: prop, value, source: "root", ...detectVarType(value) });
      }
    }
  }

  return Array.from(found.values()).sort((a, b) => a.name.localeCompare(b.name));
}

// ─── Category Grouping ──────────────────────────────────────────────

export type VarCategory = "colors" | "spacing" | "typography" | "other";

const TYPOGRAPHY_RE = /font|text|line|letter|heading|title/i;

/**
 * Group variables into semantic categories based on detected type and
 * name heuristics. No hardcoded presets — purely derived from the actual
 * variable names and values.
 */
export function groupByCategory(vars: CSSVariable[]): Record<VarCategory, CSSVariable[]> {
  const groups: Record<VarCategory, CSSVariable[]> = {
    colors: [],
    spacing: [],
    typography: [],
    other: [],
  };

  for (const v of vars) {
    if (v.type === "color") {
      groups.colors.push(v);
    } else if (TYPOGRAPHY_RE.test(v.name)) {
      groups.typography.push(v);
    } else if (v.type === "length") {
      groups.spacing.push(v);
    } else {
      groups.other.push(v);
    }
  }

  return groups;
}
