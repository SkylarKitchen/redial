/**
 * scope.ts — element ↔ class ↔ variable resolution
 *
 * Determines how a style change should be applied:
 * - "element": inline style on the clicked DOM node (default)
 * - "class": write to a <style> tag targeting the CSS modules classname
 * - CSS custom properties: detected and editable on their definition scope
 */

import { isValidCSSProp, sanitizeCSSValue } from "../../lib/css";
import { onClassChange } from "./apply";
import { managedSheet, _readManagedSheetCss } from "./managedSheet";

const CLASS_SCOPE_KEY = "class-scope-overrides";

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

  // Resolve computed style once and thread it through — getComputedStyle and
  // each getPropertyValue force style recalc, and this used to run per
  // variable inside a nested loop.
  let cs: CSSStyleDeclaration;
  try {
    cs = getComputedStyle(el);
  } catch {
    return [];
  }

  // :root --* definitions discovered during the walk. Applied after the
  // var()-reference strategies so those keep dedupe precedence (a referenced
  // variable resolves its real definition scope, which may be an ancestor).
  const rootDefs: string[] = [];
  const seenRootDefs = new Set<string>();

  // Single walk over all stylesheets handles both:
  //  - rules matching el → var() references (Strategy 1)
  //  - :root rules → inherited --* definitions (Strategy 3)
  try {
    for (const sheet of document.styleSheets) {
      try {
        for (const rule of sheet.cssRules) {
          if (!(rule instanceof CSSStyleRule)) continue;

          let matchesEl = false;
          try {
            matchesEl = el.matches(rule.selectorText);
          } catch {
            // Invalid selector for matches() (e.g. ::-webkit-*) — not a match
          }
          const isRoot = rule.selectorText === ":root";
          if (!matchesEl && !isRoot) continue;

          for (let i = 0; i < rule.style.length; i++) {
            const prop = rule.style[i];

            if (matchesEl) {
              extractVarReferences(rule.style.getPropertyValue(prop), el, cs, found);
            }

            if (isRoot && prop.startsWith("--") && !seenRootDefs.has(prop)) {
              seenRootDefs.add(prop);
              rootDefs.push(prop);
            }
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
      extractVarReferences(el.style.getPropertyValue(prop), el, cs, found);
    }
  }

  // Strategy 3: :root --* used via inheritance, for any not already discovered
  for (const prop of rootDefs) {
    if (found.has(prop)) continue;
    const computedValue = cs.getPropertyValue(prop).trim();
    if (computedValue) {
      found.set(prop, {
        name: prop,
        value: computedValue,
        scope: document.documentElement,
        scopeSelector: ":root",
      });
    }
  }

  return Array.from(found.values());
}

/** Extract var(--name) references from a CSS value string. */
function extractVarReferences(
  value: string,
  el: Element,
  cs: CSSStyleDeclaration,
  found: Map<string, CustomProp>
): void {
  const varRegex = /var\(\s*(--[\w-]+)/g;
  let match: RegExpExecArray | null;
  while ((match = varRegex.exec(value)) !== null) {
    const name = match[1];
    if (found.has(name)) continue;

    const resolved = resolveCustomProperty(el, name, cs);
    if (resolved) {
      found.set(name, resolved);
    }
  }
}

/**
 * Resolve a custom property: find where it's defined and what its computed value is.
 * Walks up the DOM from el to find the nearest ancestor where --name is set.
 */
function resolveCustomProperty(
  el: Element,
  name: string,
  cs: CSSStyleDeclaration
): CustomProp | null {
  const computedValue = cs.getPropertyValue(name).trim();
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
 * Test if a class looks like a Tailwind utility class.
 * Matches standard utilities (w-4, text-sm, flex, bg-blue-500, p-4, rounded-lg),
 * responsive prefixes (sm:, md:, lg:), state prefixes (hover:, focus:, dark:),
 * and arbitrary values (w-[200px], bg-[#ff0000]).
 */
function isTailwindUtilityClass(cls: string): boolean {
  // Strip responsive/state prefixes: "sm:w-4" → "w-4", "hover:bg-red-500" → "bg-red-500"
  const bare = cls.replace(
    /^(sm|md|lg|xl|2xl|hover|focus|active|dark|group-hover|focus-within|focus-visible|first|last|odd|even|disabled|placeholder|before|after):/,
    ""
  );

  // Standalone utilities: flex, hidden, absolute, relative, block, inline, grid, etc.
  if (/^(flex|hidden|block|inline|inline-block|inline-flex|grid|absolute|relative|fixed|sticky|overflow-hidden|overflow-auto|overflow-scroll|truncate|sr-only|not-sr-only|isolate|grow|shrink|underline|overline|line-through|no-underline|uppercase|lowercase|capitalize|normal-case|italic|not-italic|antialiased|visible|invisible|collapse)$/.test(bare)) {
    return true;
  }

  // Utility with value: prefix-value pattern (w-4, bg-blue-500, text-sm, pt-2, rounded-lg, etc.)
  if (/^[a-z][\w]*-[\w./[\]#]+$/.test(bare)) {
    return true;
  }

  // Negative utilities: -mt-4, -translate-x-1/2
  if (/^-[a-z][\w]*-[\w./[\]#]+$/.test(bare)) {
    return true;
  }

  return false;
}

/**
 * Test if an element appears to be styled with Tailwind utility classes.
 * Checks for common patterns: responsive prefixes, Tailwind utility names.
 * Distinguishes from CSS Module classes (which have hash suffixes).
 *
 * Logic: If an element has 3+ classes matching Tailwind utility patterns
 * (after filtering out CSS module classes), consider it a Tailwind element.
 */
export function isTailwindElement(el: Element): boolean {
  const classes = el.className;
  if (typeof classes !== "string" || !classes.trim()) return false;

  const classList = classes.split(/\s+/);
  let twCount = 0;

  for (const cls of classList) {
    // Skip CSS module classes — they're not Tailwind
    if (isCSSModuleClass(cls)) continue;
    if (isTailwindUtilityClass(cls)) {
      twCount++;
      if (twCount >= 3) return true;
    }
  }

  return false;
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

/** Test-only read of the class-scope sheet's serialized CSS. */
export function getClassScopeCss(): string | null {
  return _readManagedSheetCss(CLASS_SCOPE_KEY);
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

// ─── Batched rebuilds (issue #29) ──────────────────────────────────────
// A slider drag fires applyClassStyle on every pointermove, and a full <style>
// rewrite per call is wasteful. While a batch is open (drags wrap their apply
// calls in beginBatch/endBatch), rebuilds are deferred and coalesced into a
// SINGLE rewrite when the outermost batch closes. Outside a batch the rebuild
// stays synchronous, so callers (and tests) see the <style> update immediately.
// This rides the existing batch lifecycle rather than a time-based debounce.
let classStyleBatchDepth = 0;
let rebuildDeferred = false;

/** Open a class-style batch — called from apply.ts's beginBatch. */
export function beginClassStyleBatch(): void {
  classStyleBatchDepth++;
}

/** Close a class-style batch — flushes one rebuild when the outermost closes. */
export function endClassStyleBatch(): void {
  classStyleBatchDepth = Math.max(0, classStyleBatchDepth - 1);
  if (classStyleBatchDepth === 0 && rebuildDeferred) {
    rebuildDeferred = false;
    doRebuildClassStyles();
  }
}

/**
 * Rebuild the class-scope <style> tag from current overrides. Deferred while a
 * batch is open so a drag produces one rewrite, not one per pointermove.
 */
function rebuildClassStyles(): void {
  if (classStyleBatchDepth > 0) {
    rebuildDeferred = true;
    return;
  }
  doRebuildClassStyles();
}

/** The actual <style> rewrite. */
function doRebuildClassStyles(): void {
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

  managedSheet(CLASS_SCOPE_KEY).replace(rules.join("\n\n"));
}

/**
 * Clean up the class-scope managed sheet.
 */
export function destroyClassStyles(): void {
  managedSheet(CLASS_SCOPE_KEY).dispose();
  classOverrides.clear();
}

/** Mirror apply.ts class-scoped undo/redo into the class-scope <style> tag
 *  (issue #29). Mirrors statePreview.ts's syncWithApplyUndoRedo. Wire once on
 *  overlay mount; returns an unsubscribe. */
export function syncWithApplyUndoRedo(): () => void {
  return onClassChange(({ className, prop, value }) => {
    if (value !== null) {
      applyClassStyle(className, prop, value);
    } else {
      removeClassStyle(className, prop);
    }
  });
}
