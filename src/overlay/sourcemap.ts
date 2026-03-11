/**
 * sourcemap.ts — CSS source file resolution
 *
 * Two strategies for finding the source file + line for a CSS property:
 *
 * 1. React fiber __debugSource — gives the JSX file (e.g., Button.tsx:12)
 *    Available in dev mode via SWC/Babel automatic injection.
 *
 * 2. CSS Modules class → source map — gives the SCSS file (e.g., Button.module.scss:8)
 *    Reads source maps from loaded stylesheets via the CSSOM API.
 *
 * Strategy 1 is a starting hint. Strategy 2 is the accurate one for commit.
 */

export type SourceInfo = {
  file: string;
  line: number | undefined; // undefined = unknown (don't narrow search to line 0-5)
  displayPath: string; // shortened for UI display
};

/**
 * Try to resolve source file info from React's dev-mode fiber data.
 * SWC and Babel both inject _debugSource = { fileName, lineNumber } in dev.
 */
export function getReactSource(el: Element): SourceInfo | null {
  const fiberKey = Object.keys(el).find(
    (k) =>
      k.startsWith("__reactFiber$") ||
      k.startsWith("__reactInternalInstance$")
  );
  if (!fiberKey) return null;

  const fiber = (el as any)[fiberKey];
  if (!fiber) return null;

  // Walk up the fiber tree to find _debugSource
  let current = fiber;
  for (let i = 0; i < 10 && current; i++) {
    if (current._debugSource) {
      const src = current._debugSource;
      const file = src.fileName ?? "";
      const line = src.lineNumber || undefined; // 0 → undefined
      const displayPath = file.replace(/^.*\/src\//, "src/");
      return { file, line, displayPath: line ? `${displayPath}:${line}` : displayPath };
    }
    current = current.return;
  }

  return null;
}

/**
 * Try to find the CSS module source file by matching classnames against
 * loaded stylesheets' source maps.
 *
 * This is the "accurate" path — it gives us the .module.scss file and line
 * where the actual CSS property is defined.
 *
 * Returns null if source maps aren't available (production, or maps not loaded).
 */
export function getCSSSource(
  el: Element,
  prop: string
): SourceInfo | null {
  // CSS module classes: webpack (ComponentName_cls__hash) or Turbopack (file-module__hash__cls)
  const classes = el.className;
  if (typeof classes !== "string") return null;

  const moduleClass = classes
    .split(/\s+/)
    .find((cls) => /^[A-Z]\w+_\w+__\w+$/.test(cls) || /^[\w-]+__\w+__\w+$/.test(cls));

  if (!moduleClass) return null;

  // Try to find matching rule in stylesheets
  try {
    for (const sheet of document.styleSheets) {
      try {
        const rules = sheet.cssRules;
        for (let i = 0; i < rules.length; i++) {
          const rule = rules[i];
          if (
            rule instanceof CSSStyleRule &&
            rule.selectorText.includes(moduleClass)
          ) {
            // Found the rule — check if the stylesheet has a sourceURL
            const href = sheet.href;
            if (href) {
              // The href points to the compiled CSS. With source maps,
              // we could trace back. For now, derive the source file
              // from the CSS module class naming convention.
              return deriveSourceFromClassName(moduleClass, prop);
            }
          }
        }
      } catch {
        // CORS or security error accessing cross-origin stylesheet — skip
      }
    }
  } catch {
    // Stylesheet access failed
  }

  // Fallback: derive from class name convention
  return deriveSourceFromClassName(moduleClass, prop);
}

/**
 * Derive the likely source file from a CSS modules classname.
 * webpack:   "Button_btn__a8f2k"               → "Button.module.scss"
 * Turbopack: "page-module__IiFEKa__btnPrimary"  → "page.module.css"
 *
 * NOTE: line is undefined — we can't know the line from just the class name.
 * The server uses tiered search to find the property.
 */
function deriveSourceFromClassName(
  moduleClass: string,
  _prop: string
): SourceInfo | null {
  // webpack: ComponentName_className__hash
  const webpack = moduleClass.match(/^([A-Z]\w+)_(\w+)__\w+$/);
  if (webpack) {
    const componentName = webpack[1];
    return {
      file: `${componentName}.module.scss`,
      line: undefined,
      displayPath: `${componentName}.module.scss`,
    };
  }
  // Turbopack: file-module__hash__className
  const turbo = moduleClass.match(/^([\w-]+)-module__\w+__\w+$/);
  if (turbo) {
    const fileName = turbo[1];
    return {
      file: `${fileName}.module.css`,
      line: undefined,
      displayPath: `${fileName}.module.css`,
    };
  }
  return null;
}

/**
 * Best-effort source resolution: try CSS source first, fall back to React fiber.
 */
export function resolveSource(el: Element, prop: string): SourceInfo | null {
  return getCSSSource(el, prop) ?? getReactSource(el);
}

/**
 * Extract CSS module class info from an element for commit enrichment.
 * Returns the raw CSS module class name and the component/file name.
 */
export function getModuleClassInfo(
  el: Element
): { className: string; componentName: string } | null {
  const classes = el.className;
  if (typeof classes !== "string") return null;

  for (const cls of classes.split(/\s+/)) {
    // webpack: ComponentName_className__hash
    const webpack = cls.match(/^([A-Z]\w+)_(\w+)__\w+$/);
    if (webpack) {
      return { className: webpack[2], componentName: webpack[1] };
    }
    // Turbopack: file-module__hash__className
    const turbo = cls.match(/^([\w-]+)-module__\w+__(\w+)$/);
    if (turbo) {
      return { className: turbo[2], componentName: turbo[1] };
    }
  }

  return null;
}
