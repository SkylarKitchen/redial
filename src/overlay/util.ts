/**
 * util.ts — shared element display helpers
 *
 * Extracted from Header.tsx and Footer.tsx to avoid duplication.
 */

/**
 * Extract the readable class name from a CSS modules class.
 * Supports both webpack and Turbopack naming patterns:
 *   webpack:   "Button_btn__a8f2k"       → "btn"
 *   Turbopack: "page-module__IiFEKa__btnPrimary" → "btnPrimary"
 */
function extractModuleName(cls: string): string | null {
  // webpack: ComponentName_className__hash
  const webpack = cls.match(/^[A-Z]\w+_(\w+)__\w+$/);
  if (webpack) return webpack[1];
  // Turbopack: file-module__hash__className (requires -module segment)
  const turbo = cls.match(/^[\w-]+-module__\w+__(\w+)$/);
  if (turbo) return turbo[1];
  return null;
}

/**
 * Extract the most meaningful class name for display.
 * CSS modules: "Button_btn__a8f2k" → "btn"
 * Regular: "btn primary" → "btn"
 */
export function getDisplayClass(el: Element): string | null {
  const classes = el.className;
  if (typeof classes !== "string" || !classes.trim()) return null;

  const list = classes.split(/\s+/);

  for (const cls of list) {
    const name = extractModuleName(cls);
    if (name) return name;
  }

  return list[0] || null;
}

/**
 * Build a breadcrumb path from an element up to <body>.
 * Returns an array of ancestor segments (closest to body first),
 * truncated to the last `maxDepth` entries.
 */
export function buildBreadcrumb(
  el: Element,
  maxDepth: number = 4
): Array<{ el: Element; tag: string; className: string | null }> {
  const segments: Array<{ el: Element; tag: string; className: string | null }> = [];
  let current: Element | null = el;

  while (current && current.tagName.toLowerCase() !== "html") {
    segments.push({
      el: current,
      tag: current.tagName.toLowerCase(),
      className: getDisplayClass(current),
    });
    current = current.parentElement;
  }

  segments.reverse(); // body → ... → el
  // Remove body itself if present
  if (segments.length > 0 && segments[0].tag === "body") {
    segments.shift();
  }

  // Truncate to last maxDepth
  if (segments.length > maxDepth) {
    return segments.slice(-maxDepth);
  }
  return segments;
}

/**
 * Build a stable CSS selector path that uniquely identifies an element across reloads.
 * Uses tag + nth-child from body down for maximum specificity.
 * e.g. "body > div:nth-child(1) > main:nth-child(2) > h1:nth-child(1)"
 */
export function getStableSelector(el: Element): string {
  const segments: string[] = [];
  let current: Element | null = el;

  while (current && current !== document.documentElement) {
    const tag = current.tagName.toLowerCase();
    if (tag === "body") {
      segments.unshift("body");
      break;
    }

    const parent: Element | null = current.parentElement;
    if (parent) {
      // Find nth-child index (1-based, counting only element siblings)
      let index = 1;
      for (let sibling = parent.firstElementChild; sibling; sibling = sibling.nextElementSibling) {
        if (sibling === current) break;
        index++;
      }
      segments.unshift(`${tag}:nth-child(${index})`);
    } else {
      segments.unshift(tag);
    }

    current = parent;
  }

  return segments.join(" > ");
}

/**
 * Build a CSS-like selector string for display/copy.
 * CSS modules: ".btn", regular: ".primary", bare: "div"
 */
export function getSelector(el: Element): string {
  const tag = el.tagName.toLowerCase();
  const classes = el.className;
  if (typeof classes !== "string" || !classes.trim()) return tag;

  for (const cls of classes.split(/\s+/)) {
    const name = extractModuleName(cls);
    if (name) return `.${name}`;
  }

  return `.${classes.split(/\s+/)[0]}`;
}
