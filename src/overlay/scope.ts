/**
 * scope.ts — element ↔ class ↔ variable resolution
 *
 * Determines how a style change should be applied:
 * - "element": inline style on the clicked DOM node (default)
 * - "class": write to a <style> tag targeting the CSS modules classname
 * - CSS custom properties: detected and editable on their definition scope
 */

export type Scope = "element" | "class";

// --- CSS Custom Property Detection ---

export type CustomProp = {
  /** The variable name, e.g. "--color-primary" */
  name: string;
  /** The resolved computed value, e.g. "#E8764B" */
  value: string;
  /** The element where this variable is defined (e.g. documentElement for :root) */
  scope: Element;
  /** CSS selector for the scope, e.g. ":root" or ".theme-dark" */
  scopeSelector: string;
};

/**
 * Detect CSS custom properties that affect an element.
 *
 * Strategy:
 * 1. Walk stylesheets to find rules matching the element
 * 2. Check if any property values reference var(--name)
 * 3. Resolve the variable's definition scope (nearest ancestor or :root)
 */
export function getCustomProperties(el: Element): CustomProp[] {
  const found = new Map<string, CustomProp>(); // dedupe by name

  // Strategy 1: Walk stylesheets to find var() references in rules matching this element
  try {
    for (const sheet of document.styleSheets) {
      try {
        for (const rule of sheet.cssRules) {
          if (!(rule instanceof CSSStyleRule)) continue;
          if (!el.matches(rule.selectorText)) continue;

          // Check each property's value for var(--name) references
          for (let i = 0; i < rule.style.length; i++) {
            const prop = rule.style[i];
            const value = rule.style.getPropertyValue(prop);
            extractVarReferences(value, el, found);
          }
        }
      } catch {
        // CORS or security error — skip this stylesheet
      }
    }
  } catch {
    // Stylesheet iteration failed
  }

  // Strategy 2: Check inline style for var() references
  if (el instanceof HTMLElement) {
    for (let i = 0; i < el.style.length; i++) {
      const prop = el.style[i];
      const value = el.style.getPropertyValue(prop);
      extractVarReferences(value, el, found);
    }
  }

  // Strategy 3: Also collect any --* properties directly defined on ancestor scopes
  // that might be relevant (e.g. :root variables used via inheritance)
  collectAncestorCustomProperties(el, found);

  return Array.from(found.values());
}

/** Extract var(--name) references from a CSS value string. */
function extractVarReferences(
  value: string,
  el: Element,
  found: Map<string, CustomProp>
): void {
  const varRegex = /var\(\s*(--[\w-]+)/g;
  let match: RegExpExecArray | null;
  while ((match = varRegex.exec(value)) !== null) {
    const name = match[1];
    if (found.has(name)) continue;

    const resolved = resolveCustomProperty(el, name);
    if (resolved) {
      found.set(name, resolved);
    }
  }
}

/**
 * Collect custom properties defined on ancestor elements (including :root).
 * Only includes properties that are actually used (have non-empty values).
 */
function collectAncestorCustomProperties(
  el: Element,
  found: Map<string, CustomProp>
): void {
  // Check :root for --* properties
  try {
    for (const sheet of document.styleSheets) {
      try {
        for (const rule of sheet.cssRules) {
          if (!(rule instanceof CSSStyleRule)) continue;
          if (rule.selectorText !== ":root") continue;

          for (let i = 0; i < rule.style.length; i++) {
            const prop = rule.style[i];
            if (!prop.startsWith("--")) continue;
            if (found.has(prop)) continue;

            const computedValue = getComputedStyle(el).getPropertyValue(prop).trim();
            if (computedValue) {
              found.set(prop, {
                name: prop,
                value: computedValue,
                scope: document.documentElement,
                scopeSelector: ":root",
              });
            }
          }
        }
      } catch {
        // CORS error — skip
      }
    }
  } catch {
    // ignore
  }
}

/**
 * Resolve a custom property: find where it's defined and what its computed value is.
 * Walks up the DOM from el to find the nearest ancestor where --name is set.
 */
function resolveCustomProperty(el: Element, name: string): CustomProp | null {
  const computedValue = getComputedStyle(el).getPropertyValue(name).trim();
  if (!computedValue) return null;

  // Walk up to find the definition scope
  let scope: Element = document.documentElement;
  let scopeSelector = ":root";
  let current: Element | null = el;

  while (current) {
    if (current instanceof HTMLElement) {
      const inlineValue = current.style.getPropertyValue(name);
      if (inlineValue) {
        scope = current;
        scopeSelector = current === document.documentElement
          ? ":root"
          : current.tagName.toLowerCase() + (current.className ? `.${current.className.split(/\s+/)[0]}` : "");
        break;
      }
    }
    current = current.parentElement;
  }

  return { name, value: computedValue, scope, scopeSelector };
}

/**
 * Test if a class looks like a CSS module class (webpack or Turbopack).
 */
function isCSSModuleClass(cls: string): boolean {
  // webpack: ComponentName_className__hash (uppercase start)
  if (/^[A-Z]\w+_\w+__\w+$/.test(cls)) return true;
  // Turbopack: file-module__hash__className (requires -module segment)
  if (/^[\w-]+-module__\w+__\w+$/.test(cls)) return true;
  return false;
}

/**
 * Get all CSS module classnames on an element.
 * Supports both webpack and Turbopack naming conventions.
 */
export function getCSSModuleClasses(el: Element): string[] {
  const classes = el.className;
  if (typeof classes !== "string" || !classes.trim()) return [];

  return classes.split(/\s+/).filter(isCSSModuleClass);
}

/**
 * Get the readable name from a CSS module class.
 * webpack:   "Button_btn__a8f2k"              → "btn"
 * Turbopack: "page-module__IiFEKa__btnPrimary" → "btnPrimary"
 */
export function getReadableName(cls: string): string | null {
  const webpack = cls.match(/^[A-Z]\w+_(\w+)__\w+$/);
  if (webpack) return webpack[1];
  const turbo = cls.match(/^[\w-]+-module__\w+__(\w+)$/);
  if (turbo) return turbo[1];
  return null;
}

// Managed <style> tag for class-scope overrides
let classScopeStyle: HTMLStyleElement | null = null;

function getClassScopeStyle(): HTMLStyleElement {
  if (!classScopeStyle) {
    classScopeStyle = document.createElement("style");
    classScopeStyle.setAttribute("data-tuner-scope", "class");
    document.head.appendChild(classScopeStyle);
  }
  return classScopeStyle;
}

// Track class-scope overrides: className → Map<prop, value>
const classOverrides = new Map<string, Map<string, string>>();

/**
 * Apply a style change in class scope — affects all instances of the class.
 */
export function applyClassStyle(
  className: string,
  prop: string,
  value: string
): void {
  if (!classOverrides.has(className)) {
    classOverrides.set(className, new Map());
  }
  classOverrides.get(className)!.set(prop, value);
  rebuildClassStyles();
}

/**
 * Remove a class-scope override.
 */
export function removeClassStyle(className: string, prop: string): void {
  const overrides = classOverrides.get(className);
  if (!overrides) return;
  overrides.delete(prop);
  if (overrides.size === 0) classOverrides.delete(className);
  rebuildClassStyles();
}

/**
 * Reset all class-scope overrides for a class.
 */
export function resetClassStyles(className: string): void {
  classOverrides.delete(className);
  rebuildClassStyles();
}

/** Validate a CSS property name: lowercase letters + hyphens, or custom props starting with -- */
function isValidCSSProp(prop: string): boolean {
  return /^--[\w-]+$/.test(prop) || /^[a-z][a-z-]*$/.test(prop);
}

/** Strip characters that could break out of a CSS value context */
function sanitizeCSSValue(value: string): string {
  return value.replace(/[{}]/g, "").replace(/<\/style>/gi, "");
}

/**
 * Rebuild the class-scope <style> tag from current overrides.
 */
function rebuildClassStyles(): void {
  const style = getClassScopeStyle();
  const rules: string[] = [];

  for (const [className, props] of classOverrides) {
    const escapedClass = CSS.escape(className);
    const declarations = Array.from(props.entries())
      .filter(([prop]) => isValidCSSProp(prop))
      .map(([prop, value]) => `  ${prop}: ${sanitizeCSSValue(value)} !important;`)
      .join("\n");
    if (!declarations) continue;
    rules.push(`.${escapedClass} {\n${declarations}\n}`);
  }

  style.textContent = rules.join("\n\n");
}

/**
 * Clean up the class-scope <style> tag.
 */
export function destroyClassStyles(): void {
  if (classScopeStyle) {
    classScopeStyle.remove();
    classScopeStyle = null;
  }
  classOverrides.clear();
}
