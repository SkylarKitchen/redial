/**
 * elementContext.ts — Gather rich element context for AI prompts
 *
 * Collects page info, element location, source file, and DOM structure
 * into a concise markdown format that can be pasted into Claude
 * or other AI tools.
 */

import { buildBreadcrumb, getDisplayClass } from "../util";
import { getReactSource } from "./sourcemap";

/**
 * Get the React component ancestry by walking up the fiber tree.
 * Returns component names from nearest to root.
 */
function getComponentHierarchy(el: Element, maxDepth = 6): string[] {
  const fiberKey = Object.keys(el).find(
    (k) => k.startsWith("__reactFiber$") || k.startsWith("__reactInternalInstance$"),
  );
  if (!fiberKey) return [];

  const components: string[] = [];
  let fiber = (el as any)[fiberKey];

  for (let i = 0; i < 30 && fiber; i++) {
    if (fiber.type && typeof fiber.type === "function") {
      const name = fiber.type.displayName || fiber.type.name;
      if (name && !name.startsWith("_") && name !== "Fragment") {
        components.push(name);
        if (components.length >= maxDepth) break;
      }
    }
    fiber = fiber.return;
  }

  return components;
}

/**
 * Build the breadcrumb location string (e.g. ".card > div > div > div").
 */
function buildLocationString(el: Element): string {
  const crumbs = buildBreadcrumb(el, 6);
  return crumbs
    .map((seg) => (seg.className ? `.${seg.className}` : seg.tag))
    .join(" > ");
}

/**
 * Get a truncated outerHTML snippet for the element.
 */
function getHTMLSnippet(el: Element, maxLen = 1500): string {
  const html = el.outerHTML;
  if (html.length <= maxLen) return html;
  return html.slice(0, maxLen) + "\n<!-- ...truncated -->";
}

/**
 * Build the full prompt context markdown for an element + user feedback.
 */
export function buildPromptContext(el: Element, feedback: string): string {
  const pathname = window.location.pathname;
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  // Element identity
  const tag = el.tagName.toLowerCase();
  const displayClass = getDisplayClass(el);
  const elementName = displayClass || tag;

  // Location breadcrumb
  const location = buildLocationString(el);

  // Source file
  const reactSource = getReactSource(el);
  const source = reactSource?.displayPath ?? null;

  // React component hierarchy
  const components = getComponentHierarchy(el);

  // Build markdown
  const lines: string[] = [];

  lines.push(`## Page Feedback: ${pathname}`);
  lines.push(`**Viewport:** ${vw}\u00d7${vh}`);
  lines.push("");
  lines.push(`### 1. ${elementName}`);
  lines.push(`**Location:** ${location}`);

  if (source) {
    lines.push(`**Source:** ${source}`);
  }

  if (components.length > 0) {
    lines.push(`**Components:** ${components.join(" \u2192 ")}`);
  }

  // HTML snippet for structural context
  lines.push("");
  lines.push("**HTML:**");
  lines.push("```html");
  lines.push(getHTMLSnippet(el));
  lines.push("```");

  lines.push("");
  lines.push(`**Feedback:** ${feedback}`);

  return lines.join("\n");
}
