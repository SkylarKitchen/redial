/**
 * textStyleScanner.ts — Detect text styles from the host page's design system
 *
 * Creates hidden probe elements (h1–h6, p, small, blockquote), reads their
 * computed typography properties, and returns a list of TextStyle objects.
 * Uses visibility:hidden (not display:none) so computed styles resolve.
 * Cross-origin safe — no stylesheet walking needed.
 */

export interface TextStyle {
  name: string;
  tag: string;
  fontFamily: string;
  fontWeight: string;
  fontSize: string;
  lineHeight: string;
  letterSpacing: string;
  color: string;
  textTransform: string;
}

const PROBES: Array<{ tag: string; name: string }> = [
  { tag: "h1", name: "Heading 1" },
  { tag: "h2", name: "Heading 2" },
  { tag: "h3", name: "Heading 3" },
  { tag: "h4", name: "Heading 4" },
  { tag: "h5", name: "Heading 5" },
  { tag: "h6", name: "Heading 6" },
  { tag: "p", name: "Paragraph" },
  { tag: "small", name: "Small" },
  { tag: "blockquote", name: "Blockquote" },
];

/**
 * Browser-default heading sizes (used when a CSS reset flattens them).
 * Maps tag → { fontSize in px, fontWeight }.
 */
const HEADING_DEFAULTS: Record<string, { fontSize: number; fontWeight: string }> = {
  h1: { fontSize: 32, fontWeight: "700" },
  h2: { fontSize: 24, fontWeight: "700" },
  h3: { fontSize: 19, fontWeight: "700" },
  h4: { fontSize: 16, fontWeight: "700" },
  h5: { fontSize: 13, fontWeight: "700" },
  h6: { fontSize: 11, fontWeight: "700" },
};

/**
 * Scan the host page for text styles by creating hidden probe elements.
 * Returns up to 9 TextStyle entries (one per probe tag).
 * Runs in <1ms — safe to call on every panel mount.
 *
 * If all h1–h6 resolve to the same font-size (indicating a CSS reset like
 * Tailwind Preflight), applies standard browser-default sizes so the style
 * picker always shows a useful typographic hierarchy.
 */
export function scanTextStyles(): TextStyle[] {
  const container = document.createElement("div");
  container.style.cssText =
    "position:absolute;left:-9999px;visibility:hidden;pointer-events:none;width:300px";
  document.body.appendChild(container);

  const elements: HTMLElement[] = [];
  for (const { tag } of PROBES) {
    const el = document.createElement(tag);
    el.textContent = "Ag"; // triggers font metrics
    container.appendChild(el);
    elements.push(el);
  }

  const styles: TextStyle[] = [];
  for (let i = 0; i < PROBES.length; i++) {
    const cs = getComputedStyle(elements[i]);
    styles.push({
      name: PROBES[i].name,
      tag: PROBES[i].tag,
      fontFamily: cs.fontFamily,
      fontWeight: cs.fontWeight,
      fontSize: cs.fontSize,
      lineHeight: cs.lineHeight,
      letterSpacing: cs.letterSpacing,
      color: cs.color,
      textTransform: cs.textTransform,
    });
  }

  document.body.removeChild(container);

  // Detect CSS reset: if all h1–h6 share the same font-size, apply defaults
  const headingStyles = styles.filter((s) => s.tag.match(/^h[1-6]$/));
  const allSameSize =
    headingStyles.length > 1 &&
    headingStyles.every((s) => s.fontSize === headingStyles[0].fontSize);

  if (allSameSize) {
    for (const style of styles) {
      const defaults = HEADING_DEFAULTS[style.tag];
      if (defaults) {
        style.fontSize = `${defaults.fontSize}px`;
        style.fontWeight = defaults.fontWeight;
        // Scale line-height proportionally: 1.2× the font size
        style.lineHeight = `${Math.round(defaults.fontSize * 1.2)}px`;
      }
    }
  }

  return styles;
}

/**
 * Match an element's current styles against the scanned text styles.
 *
 * Phase 1: Tag match — if element.tagName matches a probe tag, return it.
 * Phase 2: Property match — compare fontFamily, fontWeight, fontSize,
 *          lineHeight, textTransform (skip color/letterSpacing — too volatile).
 *
 * Returns the matched TextStyle or null.
 */
export function matchTextStyle(
  element: Element,
  cs: CSSStyleDeclaration,
  styles: TextStyle[],
): TextStyle | null {
  const tag = element.tagName.toLowerCase();

  // Phase 1: exact tag match
  const tagMatch = styles.find((s) => s.tag === tag);
  if (tagMatch) return tagMatch;

  // Phase 2: property match
  const family = cs.fontFamily;
  const weight = cs.fontWeight;
  const size = cs.fontSize;
  const lh = cs.lineHeight;
  const transform = cs.textTransform;

  for (const style of styles) {
    if (
      style.fontFamily === family &&
      style.fontWeight === weight &&
      style.fontSize === size &&
      style.lineHeight === lh &&
      style.textTransform === transform
    ) {
      return style;
    }
  }

  return null;
}
