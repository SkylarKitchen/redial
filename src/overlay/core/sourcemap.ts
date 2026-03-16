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
    .find((cls) =>
      /^[A-Z]\w+_\w+__\w+$/.test(cls) ||    // webpack
      /^[\w-]+__\w+__\w+$/.test(cls) ||      // Turbopack
      /^_\w+_\w+_\d+$/.test(cls)             // Vite
    );

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
              // The href points to the compiled CSS. Derive source file
              // from the class naming convention, using the href to
              // detect .scss vs .css (Turbopack/Vite encode source paths).
              return deriveSourceFromClassName(moduleClass, prop, href);
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
 * Turbopack: "page-module__IiFEKa__btnPrimary"  → "page.module.css" or ".scss"
 * Vite:      "_btn_abc_123"                     → "*.module.css" or ".scss"
 *
 * When a stylesheet href is available, checks for SCSS signals in the URL
 * (Turbopack encodes source paths like ..._module_scss_..., Vite serves
 * original paths like /src/Button.module.scss?used).
 *
 * NOTE: line is undefined — we can't know the line from just the class name.
 * The server uses tiered search to find the property.
 */
export function deriveSourceFromClassName(
  moduleClass: string,
  _prop: string,
  href?: string,
): SourceInfo | null {
  // Detect SCSS from stylesheet URL (Turbopack/Vite encode source paths)
  const isScss = href ? /\.scss|_scss/i.test(href) : false;

  // webpack: ComponentName_className__hash
  // webpack URLs are content-hashed — no source path signal. Default to .scss.
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
    const ext = isScss ? ".module.scss" : ".module.css";
    return {
      file: `${fileName}${ext}`,
      line: undefined,
      displayPath: `${fileName}${ext}`,
    };
  }
  // Vite: _className_hash_digits — class name doesn't embed the filename
  const vite = moduleClass.match(/^_(\w+)_\w+_\d+$/);
  if (vite) {
    const ext = isScss ? ".module.scss" : ".module.css";
    return {
      file: `*${ext}`,
      line: undefined,
      displayPath: `${ext.slice(1)} (Vite)`,
    };
  }
  return null;
}

/**
 * Try to find the source file for an element styled by global CSS (not modules).
 * Walks loaded stylesheets, finds rules matching `el` that set `prop`,
 * and derives the source file from the stylesheet href.
 */
export function getGlobalCSSSource(
  el: Element,
  prop: string
): SourceInfo | null {
  try {
    for (const sheet of document.styleSheets) {
      try {
        const href = sheet.href;
        if (!href) continue;

        const rules = sheet.cssRules;
        for (let i = 0; i < rules.length; i++) {
          const rule = rules[i];
          if (!(rule instanceof CSSStyleRule)) continue;
          // Check if the rule sets the property we care about
          if (!rule.style.getPropertyValue(prop)) continue;
          // Check if the rule matches the element
          try {
            if (!el.matches(rule.selectorText)) continue;
          } catch {
            continue; // Invalid selector
          }

          // Strip build prefixes to get the original file path
          let file = href;
          try {
            file = new URL(href).pathname;
          } catch {
            // Not a valid URL — use as-is
          }
          // Strip common build prefixes
          file = file
            .replace(/^\/_next\/static\/css\//, "")
            .replace(/^\/assets\//, "")
            .replace(/^\//, "");
          // Remove content hash suffixes (e.g., globals.abc123.css → globals.css)
          file = file.replace(/\.\w{8,}\.css$/, ".css");

          const displayPath = file.replace(/^.*\/src\//, "src/");
          return { file, line: undefined, displayPath };
        }
      } catch {
        // CORS or security error — skip
      }
    }
  } catch {
    // Stylesheet access failed
  }
  return null;
}

/**
 * Best-effort source resolution: try CSS module source first, then global CSS, fall back to React fiber.
 */
export function resolveSource(el: Element, prop: string): SourceInfo | null {
  return getCSSSource(el, prop) ?? getGlobalCSSSource(el, prop) ?? getReactSource(el);
}

/**
 * Extract CSS module class info from an element for commit enrichment.
 * Returns the raw CSS module class name and the component/file name.
 */
export function getModuleClassInfo(
  el: Element
): { className: string; componentName: string | undefined } | null {
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
    // Vite: _className_hash_digits — no filename embedded
    const vite = cls.match(/^_(\w+)_\w+_\d+$/);
    if (vite) {
      return { className: vite[1], componentName: undefined };
    }
  }

  return null;
}
