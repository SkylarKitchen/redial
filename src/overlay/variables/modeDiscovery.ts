/**
 * modeDiscovery.ts — Discover CSS variable "modes" from real-world patterns.
 *
 * Detects the 4 common CSS theming patterns:
 *   1. Class toggle:      :root { --bg: #fff } .dark { --bg: #111 }
 *   2. Data attribute:     [data-theme="light"] { --bg: #fff }
 *   3. Media query:        @media (prefers-color-scheme: dark) { :root { --bg: #111 } }
 *   4. Breakpoint query:   @media (min-width: 768px) { :root { --cols: 2 } }
 *
 * Produces a flat list of declarations (variable + selector + media context),
 * then infers named modes by grouping selectors/media conditions.
 */

import { walkRules } from "./discoverVariables";

// ─── Types ───────────────────────────────────────────────────────────

export interface ModeDeclaration {
  name: string;            // e.g. "--bg"
  rawValue: string;        // e.g. "#fff" or "var(--gray-900)"
  selector: string;        // e.g. ":root", ".dark", '[data-theme="dark"]'
  mediaCondition?: string; // e.g. "(prefers-color-scheme: dark)", "(min-width: 768px)"
}

export interface InferredMode {
  /** Human-readable name: "Base", "Dark", "Dark (system)", "≥768px" */
  name: string;
  /** How this mode was detected */
  source: "base" | "class" | "data-attr" | "media";
  /** The selector or media condition that triggers this mode */
  selector?: string;
  mediaCondition?: string;
  /** Variable values in this mode: { "--bg": "#111", "--text": "#fff" } */
  values: Record<string, string>;
}

// ─── Selector Parsing ────────────────────────────────────────────────

// Matches :root, html, :root.dark, html.theme-brand, .dark (alone)
const ROOT_CLASS_RE = /^(?::root|html)\.([a-zA-Z][\w-]*)$/;
const BARE_CLASS_RE = /^\.([a-zA-Z][\w-]*)$/;
// Matches [data-theme="dark"], :root[data-mode="compact"], etc.
const DATA_ATTR_RE = /\[data-[\w-]+=["']?([^"'\]]+)["']?\]/;

// Classes that look like mode toggles (not component classes)
const MODE_CLASS_HINTS = /^(dark|light|theme-|mode-|high-contrast|compact|comfortable|rtl|ltr)/i;

/**
 * Parse a CSS selector to extract a mode name, or return null if it's
 * not a mode-like selector (e.g. ".card" is component-scoped, not a mode).
 *
 * Returns:
 *  - "base" for :root / html
 *  - mode name string for recognized patterns
 *  - null for non-mode selectors
 */
export function parseModeSelector(selector: string): string | null {
  const trimmed = selector.trim();

  // Exact match :root or html → base
  if (trimmed === ":root" || trimmed === "html") return "base";

  // :root.dark or html.theme-brand
  const rootClassMatch = trimmed.match(ROOT_CLASS_RE);
  if (rootClassMatch) return rootClassMatch[1];

  // [data-theme="dark"] or :root[data-mode="compact"]
  const dataMatch = trimmed.match(DATA_ATTR_RE);
  if (dataMatch) return dataMatch[1];

  // Bare class like .dark — only if it looks like a mode toggle
  const bareMatch = trimmed.match(BARE_CLASS_RE);
  if (bareMatch && MODE_CLASS_HINTS.test(bareMatch[1])) return bareMatch[1];

  return null;
}

// ─── Declaration Discovery ───────────────────────────────────────────

/**
 * Extended walkRules that passes the enclosing @media condition through.
 */
function walkRulesWithMedia(
  rules: CSSRuleList,
  callback: (rule: CSSStyleRule, mediaCondition?: string) => void,
  mediaCondition?: string,
) {
  for (let i = 0; i < rules.length; i++) {
    const rule = rules[i];
    if (rule instanceof CSSStyleRule) {
      callback(rule, mediaCondition);
    } else if (rule instanceof CSSMediaRule) {
      walkRulesWithMedia(rule.cssRules, callback, rule.conditionText);
    } else if ("cssRules" in rule) {
      // CSSSupportsRule, CSSLayerBlockRule — pass through same media context
      walkRulesWithMedia((rule as CSSGroupingRule).cssRules, callback, mediaCondition);
    }
  }
}

/**
 * Walk all stylesheets and collect every CSS custom property declaration
 * with its full context (selector + media condition).
 *
 * Unlike discoverAllVariables() which deduplicates to one value per name,
 * this returns ALL declarations — the same variable may appear multiple times
 * across different selectors/media conditions.
 */
export function discoverModeDeclarations(): ModeDeclaration[] {
  const declarations: ModeDeclaration[] = [];

  for (const sheet of Array.from(document.styleSheets)) {
    try {
      walkRulesWithMedia(sheet.cssRules, (rule, mediaCondition) => {
        for (let i = 0; i < rule.style.length; i++) {
          const prop = rule.style[i];
          if (!prop.startsWith("--")) continue;

          const rawValue = rule.style.getPropertyValue(prop).trim();
          if (!rawValue) continue;

          declarations.push({
            name: prop,
            rawValue,
            selector: rule.selectorText,
            ...(mediaCondition ? { mediaCondition } : {}),
          });
        }
      });
    } catch {
      // Cross-origin stylesheets — skip
    }
  }

  return declarations;
}

// ─── Mode Inference ──────────────────────────────────────────────────

/** Capitalize first letter */
function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Format a media condition into a human-readable mode name */
function formatMediaModeName(condition: string): string {
  // prefers-color-scheme: dark → "Dark (system)"
  const schemeMatch = condition.match(/prefers-color-scheme:\s*(dark|light)/i);
  if (schemeMatch) return `${capitalize(schemeMatch[1])} (system)`;

  // min-width: 768px → "≥768px"
  const minWidth = condition.match(/min-width:\s*(\d+(?:\.\d+)?)(px|em|rem)/i);
  if (minWidth) return `≥${minWidth[1]}${minWidth[2]}`;

  // max-width: 767px → "≤767px"
  const maxWidth = condition.match(/max-width:\s*(\d+(?:\.\d+)?)(px|em|rem)/i);
  if (maxWidth) return `≤${maxWidth[1]}${maxWidth[2]}`;

  // Fallback: use the condition text directly
  return condition;
}

/**
 * Given a flat list of declarations, infer named modes.
 *
 * Groups declarations by their context (selector + media) into distinct modes.
 * Filters out component-scoped selectors (.card, .btn-sm) that aren't modes.
 */
export function inferModes(declarations: ModeDeclaration[]): InferredMode[] {
  // Step 1: Group declarations by their "mode key" (unique selector+media combo)
  const modeGroups = new Map<string, {
    selector?: string;
    mediaCondition?: string;
    values: Record<string, string>;
  }>();

  for (const decl of declarations) {
    // Parse the selector to see if it's a mode-like selector
    const modeName = parseModeSelector(decl.selector);

    // Skip component-scoped selectors that aren't modes
    if (modeName === null && !decl.mediaCondition) continue;

    // Build a unique key for this mode context
    const key = decl.mediaCondition
      ? `media:${decl.mediaCondition}`
      : `selector:${decl.selector}`;

    let group = modeGroups.get(key);
    if (!group) {
      group = {
        selector: decl.selector,
        mediaCondition: decl.mediaCondition,
        values: {},
      };
      modeGroups.set(key, group);
    }
    group.values[decl.name] = decl.rawValue;
  }

  // Step 2: Convert groups into InferredMode objects with names
  const modes: InferredMode[] = [];

  for (const [key, group] of modeGroups) {
    let name: string;
    let source: InferredMode["source"];

    if (group.mediaCondition) {
      name = formatMediaModeName(group.mediaCondition);
      source = "media";
    } else {
      const parsed = parseModeSelector(group.selector || "");
      if (parsed === "base") {
        name = "Base";
        source = "base";
      } else if (parsed && DATA_ATTR_RE.test(group.selector || "")) {
        name = capitalize(parsed);
        source = "data-attr";
      } else if (parsed) {
        name = capitalize(parsed);
        source = "class";
      } else {
        // Shouldn't reach here (filtered above), but be safe
        continue;
      }
    }

    modes.push({
      name,
      source,
      ...(group.selector ? { selector: group.selector } : {}),
      ...(group.mediaCondition ? { mediaCondition: group.mediaCondition } : {}),
      values: group.values,
    });
  }

  // Sort: Base first, then alphabetically
  modes.sort((a, b) => {
    if (a.source === "base") return -1;
    if (b.source === "base") return 1;
    return a.name.localeCompare(b.name);
  });

  return modes;
}
