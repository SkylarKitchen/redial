/**
 * colorVariables.ts — Discovers CSS custom properties with color values
 * from the page's stylesheets. Used by ColorPickerEnhanced to offer
 * variable swatches in any color field.
 */

// ─── Types ──────────────────────────────────────────────────────────

export interface ColorVariable {
  /** Full custom property name, e.g. "--brand-primary" */
  name: string;
  /** Resolved color value, e.g. "#ff6600" or "rgb(255, 102, 0)" */
  resolvedValue: string;
}

// ─── Color Detection ────────────────────────────────────────────────

const HEX_RE = /^#([0-9a-f]{3,8})$/i;
const COLOR_FN_RE = /^(rgb|rgba|hsl|hsla|oklch|oklab|lch|lab|color)\s*\(/i;
const COMMON_COLORS = new Set([
  "transparent", "currentcolor", "black", "white", "red", "blue",
  "green", "orange", "yellow", "purple", "pink", "gray", "grey",
]);

function isColorValue(value: string): boolean {
  const v = value.trim();
  if (!v) return false;
  if (HEX_RE.test(v)) return true;
  if (COLOR_FN_RE.test(v)) return true;
  if (COMMON_COLORS.has(v.toLowerCase())) return true;
  return false;
}

// ─── Rule Walker ────────────────────────────────────────────────────

function walkRules(rules: CSSRuleList, cb: (rule: CSSStyleRule) => void) {
  for (let i = 0; i < rules.length; i++) {
    const rule = rules[i];
    if (rule instanceof CSSStyleRule) cb(rule);
    else if ("cssRules" in rule) walkRules((rule as CSSGroupingRule).cssRules, cb);
  }
}

// ─── Discovery ──────────────────────────────────────────────────────

/**
 * Discover all CSS custom properties with color values from the page's
 * stylesheets. Resolves computed values via :root. Deduplicated, sorted
 * alphabetically by name.
 */
export function discoverColorVariables(): ColorVariable[] {
  const found = new Map<string, ColorVariable>();
  const rootStyles = getComputedStyle(document.documentElement);

  for (const sheet of Array.from(document.styleSheets)) {
    try {
      walkRules(sheet.cssRules, (rule) => {
        for (let i = 0; i < rule.style.length; i++) {
          const prop = rule.style[i];
          if (!prop.startsWith("--")) continue;
          if (found.has(prop)) continue;
          const resolvedValue = rootStyles.getPropertyValue(prop).trim();
          if (resolvedValue && isColorValue(resolvedValue)) {
            found.set(prop, { name: prop, resolvedValue });
          }
        }
      });
    } catch {
      // Cross-origin stylesheets throw SecurityError — skip
    }
  }

  return Array.from(found.values()).sort((a, b) => a.name.localeCompare(b.name));
}

// ─── Resolve a var() reference ──────────────────────────────────────

const VAR_RE = /^var\(\s*(--[\w-]+)\s*(?:,.*)?\)$/;

/** Extract the custom property name from a `var(--foo)` expression. */
export function parseVarRef(value: string): string | null {
  const m = value.match(VAR_RE);
  return m ? m[1] : null;
}

/** Resolve a `var(--foo)` expression to its computed color value. */
export function resolveVarColor(value: string): string | null {
  const name = parseVarRef(value);
  if (!name) return null;
  const resolved = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return resolved || null;
}
