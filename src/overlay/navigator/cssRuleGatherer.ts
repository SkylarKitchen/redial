/**
 * cssRuleGatherer.ts — Walk stylesheets to find CSS rules matching a DOM element.
 *
 * Used by the CSS Editor tab to display authored rules for the selected element.
 * Returns blocks in cascade order: stylesheet rules first (source order), inline last.
 */

import { VALID_STATES } from "../core/statePreview";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CSSRuleBlock {
  selector: string;
  declarations: { prop: string; value: string }[];
  source: string;
  isState: boolean;
  pseudoState?: string;
  mediaCondition?: string;
}

// ---------------------------------------------------------------------------
// stripPseudoClasses
// ---------------------------------------------------------------------------

const PSEUDO_CLASS_RE = new RegExp(
  `:(?:${Array.from(VALID_STATES).join("|")})`,
  "g",
);
const PSEUDO_ELEMENT_RE = /::[\w-]+/g;

/**
 * Strip known pseudo-classes and pseudo-elements from a selector.
 * Returns the base selector and the first pseudo-class found (if any).
 */
export function stripPseudoClasses(selector: string): {
  base: string;
  pseudo?: string;
} {
  let pseudo: string | undefined;

  // Capture first pseudo-class match before stripping
  const firstMatch = selector.match(PSEUDO_CLASS_RE);
  if (firstMatch) {
    pseudo = firstMatch[0].slice(1); // remove leading ":"
  }

  let base = selector.replace(PSEUDO_CLASS_RE, "").replace(PSEUDO_ELEMENT_RE, "");
  // Clean up any trailing empty selectors (e.g. ".card" from ".card:hover")
  base = base.trim();

  return { base, pseudo };
}

// ---------------------------------------------------------------------------
// walkRulesWithMedia (internal)
// ---------------------------------------------------------------------------

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
      walkRulesWithMedia(
        (rule as CSSGroupingRule).cssRules,
        callback,
        mediaCondition,
      );
    }
  }
}

// ---------------------------------------------------------------------------
// getMatchingRules
// ---------------------------------------------------------------------------

/** Selectors belonging to the panel itself — skip these. */
const TUNER_SELECTOR_RE = /\.__tuner-root|\[data-tuner-/;

/**
 * Walk all stylesheets and return CSS rule blocks whose selectors match `el`.
 * Inline styles (if any) are appended as the last block.
 */
export function getMatchingRules(el: Element): CSSRuleBlock[] {
  const blocks: CSSRuleBlock[] = [];

  for (let s = 0; s < document.styleSheets.length; s++) {
    const sheet = document.styleSheets[s];
    let rules: CSSRuleList;
    try {
      rules = sheet.cssRules;
    } catch {
      // Cross-origin sheets throw SecurityError — skip gracefully
      continue;
    }

    const source = sheet.href || "embedded";

    walkRulesWithMedia(rules, (rule, mediaCondition) => {
      const selectorText = rule.selectorText;
      if (!selectorText) return;

      // Skip panel's own styles
      if (TUNER_SELECTOR_RE.test(selectorText)) return;

      const { base, pseudo } = stripPseudoClasses(selectorText);
      if (!base) return;

      let matches = false;
      try {
        matches = el.matches(base);
      } catch {
        // Malformed selectors may throw — skip
        return;
      }
      if (!matches) return;

      // Gather declarations, skipping custom properties (--*)
      const declarations: { prop: string; value: string }[] = [];
      for (let i = 0; i < rule.style.length; i++) {
        const prop = rule.style[i];
        if (prop.startsWith("--")) continue;
        declarations.push({ prop, value: rule.style.getPropertyValue(prop) });
      }

      if (declarations.length === 0) return;

      blocks.push({
        selector: selectorText,
        declarations,
        source,
        isState: !!pseudo,
        pseudoState: pseudo,
        mediaCondition,
      });
    });
  }

  // Append inline styles as last block (highest cascade priority)
  const htmlEl = el as HTMLElement;
  if (htmlEl.style && htmlEl.style.length > 0) {
    const declarations: { prop: string; value: string }[] = [];
    for (let i = 0; i < htmlEl.style.length; i++) {
      const prop = htmlEl.style[i];
      if (prop.startsWith("--")) continue;
      declarations.push({ prop, value: htmlEl.style.getPropertyValue(prop) });
    }
    if (declarations.length > 0) {
      blocks.push({
        selector: "element.style",
        declarations,
        source: "inline",
        isState: false,
      });
    }
  }

  return blocks;
}
