/**
 * getAuthoredValue.ts — Detect explicitly authored CSS values
 *
 * getComputedStyle() always resolves to pixels for size properties,
 * so we must check inline styles + stylesheet rules to know whether
 * a value was explicitly authored or is just the browser default.
 *
 * Returns the authored CSS string (e.g. "100%", "auto", "200px")
 * or null if no rule explicitly sets the property on this element.
 */

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

const AUTO_KEYWORDS = new Set([
  "auto", "initial", "unset", "inherit", "revert",
  "fit-content", "max-content", "min-content",
  "stretch", "-webkit-fill-available", "-moz-available",
]);

/** Returns true when the element's property should display as "auto" (no explicit authored value, or a CSS-wide / intrinsic sizing keyword) */
export function isAutoSize(el: Element, prop: string): boolean {
  const authored = getAuthoredValue(el, prop);
  if (!authored) return true;
  const trimmed = authored.trim().toLowerCase();
  if (AUTO_KEYWORDS.has(trimmed)) return true;
  // width: 100% is the block default — treat as auto
  if (prop === "width" && trimmed === "100%") return true;
  return false;
}
