/**
 * sourcemap.ts — CSS source file resolution
 *
 * Two strategies for finding the source file + line for a CSS property:
 *
 * 1. React fiber dev metadata — gives the JSX file (e.g., Button.tsx:12).
 *    - React ≤18: `fiber._debugSource = { fileName, lineNumber }`, injected
 *      by SWC/Babel in dev.
 *    - React 19: `_debugSource` was REMOVED (issue #67). Dev fibers instead
 *      carry `fiber._debugStack` — an Error captured at JSX element creation
 *      (jsxDEV) whose first user frame is the JSX callsite in the owner
 *      component. We parse that frame for file + line. Line numbers refer to
 *      the dev-transformed module, so they are a near-line HINT, not exact.
 *    When neither field yields a source (e.g. Turbopack compiled-chunk URLs,
 *    production builds), this strategy returns null fast so the fallback
 *    discovery paths (CSS source maps, server className walk) engage.
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

/** Build a SourceInfo from a file path + optional line, shortening for display. */
function toSourceInfo(file: string, line: number | undefined): SourceInfo {
  const displayPath = file.replace(/^.*\/src\//, "src/");
  return { file, line, displayPath: line ? `${displayPath}:${line}` : displayPath };
}

/**
 * Normalize a stack-frame URL to a project source path, or null when the
 * frame can't be mapped back to an original source file client-side.
 *
 *  - webpack-internal:///(app-pages-browser)/./app/page.tsx → app/page.tsx
 *  - webpack-internal:///./src/Button.tsx                   → src/Button.tsx
 *  - http://localhost:5173/src/App.tsx?t=123 (Vite)         → src/App.tsx
 *  - file:///Users/me/app/src/App.tsx                       → /Users/me/app/src/App.tsx
 *  - /Users/me/app/src/App.tsx                              → unchanged
 *  - http://…/_next/static/chunks/….js (compiled chunk)     → null
 */
function normalizeStackFrameUrl(url: string): string | null {
  if (url.includes("node_modules")) return null;

  // webpack-internal:///(group)/./path or webpack-internal:///./path
  const webpackInternal = url.match(/^webpack-internal:\/\/\/(?:\([^)]*\)\/)?(.+)$/);
  if (webpackInternal) {
    const path = webpackInternal[1].replace(/^\.\//, "");
    return path || null;
  }

  // file:// URLs → filesystem path
  if (url.startsWith("file://")) {
    try {
      return decodeURIComponent(new URL(url).pathname);
    } catch {
      return null;
    }
  }

  // http(s) dev-server URLs: only original-source paths are usable.
  // Compiled bundles (Next/Turbopack chunks, plain .js output) can't be
  // mapped client-side — reject so the fallback paths engage instead.
  if (/^https?:\/\//.test(url)) {
    let pathname: string;
    try {
      pathname = decodeURIComponent(new URL(url).pathname);
    } catch {
      return null;
    }
    if (pathname.startsWith("/_next/")) return null;
    // Vite (and similar) serve sources at their real path with the real
    // extension. A served .js could be compiled output — too ambiguous.
    if (!/\.(tsx|ts|jsx|mjsx|mtsx)$/.test(pathname)) return null;
    return pathname.replace(/^\//, "");
  }

  // Bare filesystem path (some runtimes emit these directly)
  if (url.startsWith("/")) return url;

  return null;
}

/**
 * Parse a React 19 `_debugStack` (Error captured in jsxDEV) into a SourceInfo.
 *
 * Mirrors React's own formatOwnerStack contract: the "react-stack-top-frame"
 * message and runtime frames sit above the user frame; everything at/below
 * `react_stack_bottom_frame` is renderer internals and must be ignored.
 * The first mappable user frame is the JSX callsite in the owner component.
 */
function sourceFromDebugStack(debugStack: unknown): SourceInfo | null {
  const stack =
    typeof debugStack === "string"
      ? debugStack
      : debugStack instanceof Error
        ? debugStack.stack
        : typeof (debugStack as { stack?: unknown } | null)?.stack === "string"
          ? (debugStack as { stack: string }).stack
          : null;
  if (!stack) return null;

  for (const rawLine of stack.split("\n")) {
    const frame = rawLine.trim();
    if (!frame || /^Error\b/.test(frame)) continue; // the "Error: react-stack-top-frame" message line
    // React internals below this marker — stop entirely (matches
    // formatOwnerStack's cut in react-dom).
    if (frame.includes("react_stack_bottom_frame")) break;

    // Extract the "url:line:col" location from the frame. The URL itself may
    // contain parens (webpack-internal route groups) and colons (http ports),
    // so grab the outermost (...) group / @-suffix first, then split
    // ":line:col" off the END greedily.
    let loc: string | null = null;
    const v8Named = frame.match(/^at\s.*?\((.*)\)$/); // V8: "at Name (url:line:col)"
    if (v8Named) {
      loc = v8Named[1];
    } else if (frame.startsWith("at ")) {
      loc = frame.slice(3); // V8 anonymous: "at url:line:col"
    } else {
      const firefox = frame.match(/^[^@]*@(.*)$/); // Firefox/Safari: "Name@url:line:col"
      if (firefox) loc = firefox[1];
    }
    if (!loc) continue;

    const locMatch = loc.match(/^(.*):(\d+):(\d+)$/);
    if (!locMatch) continue;

    const file = normalizeStackFrameUrl(locMatch[1]);
    if (!file) continue; // runtime / compiled-chunk frame — keep looking

    const line = parseInt(locMatch[2], 10) || undefined; // 0 → undefined
    return toSourceInfo(file, line);
  }

  return null;
}

/**
 * Try to resolve source file info from React's dev-mode fiber data.
 *
 * React ≤18: SWC/Babel inject _debugSource = { fileName, lineNumber } in dev.
 * React 19: _debugSource was removed — fall back to parsing the fiber's
 * _debugStack owner stack (see sourceFromDebugStack). Feature-detected per
 * fiber, so both React majors work (peer dep is react >=18).
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

  // Walk up the fiber tree looking for usable dev metadata
  let current = fiber;
  for (let i = 0; i < 10 && current; i++) {
    // React ≤18
    if (current._debugSource) {
      const src = current._debugSource;
      const file = src.fileName ?? "";
      const line = src.lineNumber || undefined; // 0 → undefined
      return toSourceInfo(file, line);
    }
    // React 19
    if (current._debugStack) {
      const fromStack = sourceFromDebugStack(current._debugStack);
      if (fromStack) return fromStack;
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
  // Turbopack (new format): file-module-scss-module__hash__cls or file-module-css-module__hash__cls
  // The file extension is encoded in the class name itself.
  const turboExt = moduleClass.match(/^([\w-]+)-module-(scss|css)-module__\w+__\w+$/);
  if (turboExt) {
    const fileName = turboExt[1];
    const ext = `.module.${turboExt[2]}`;
    return {
      file: `${fileName}${ext}`,
      line: undefined,
      displayPath: `${fileName}${ext}`,
    };
  }
  // Turbopack (legacy format): file-module__hash__className
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

          // Turbopack chunk URLs encode the source path:
          // /_next/static/chunks/test-app_app_page_module_scss_module_d2439084.css
          // → source: page.module.scss
          const turboChunk = file.match(
            /\/_next\/static\/chunks\/.*?([\w-]+)_module_(scss|css)_module_\w+\.css$/
          );
          if (turboChunk) {
            const baseName = turboChunk[1].replace(/^.*_/, ""); // last path segment
            file = `${baseName}.module.${turboChunk[2]}`;
          } else {
            // Strip common build prefixes
            file = file
              .replace(/^\/_next\/static\/css\//, "")
              .replace(/^\/_next\/static\/chunks\//, "")
              .replace(/^\/assets\//, "")
              .replace(/^\//, "");
            // Remove content hash suffixes (e.g., globals.abc123.css → globals.css)
            file = file.replace(/\.\w{8,}\.css$/, ".css");
            // Remove Turbopack-style hash suffixes (e.g., _d2439084.css → .css)
            file = file.replace(/_\w{8}\.css$/, ".css");
          }

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
 * Find the source file where a CSS custom property is defined.
 * Searches all stylesheets for rules that set the given variable name
 * (e.g., `--font-size-base`). Looks in :root, html, body, and any
 * selector that defines the property.
 */
export function getVariableDefinitionSource(
  varName: string
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
          if (!rule.style.getPropertyValue(varName)) continue;

          // Found a rule that defines this variable — derive source file
          let file = href;
          try {
            file = decodeURIComponent(new URL(href).pathname);
          } catch {
            // Not a valid URL — use as-is
          }

          // Skip Turbopack root bundles — they aggregate all global CSS
          // and can't be mapped to a specific source file client-side.
          // Return null so the server can search for the variable definition.
          if (file.includes("[root-of-the-server]") || file.includes("root-of-the-server")) {
            continue;
          }

          // Turbopack chunk URL decoding
          const turboChunk = file.match(
            /\/_next\/static\/chunks\/.*?([\w-]+)_module_(scss|css)_module_\w+\.css$/
          );
          if (turboChunk) {
            const baseName = turboChunk[1].replace(/^.*_/, "");
            file = `${baseName}.module.${turboChunk[2]}`;
          } else {
            file = file
              .replace(/^\/_next\/static\/css\//, "")
              .replace(/^\/_next\/static\/chunks\//, "")
              .replace(/^\/assets\//, "")
              .replace(/^\//, "");
            file = file.replace(/\.\w{8,}\.css$/, ".css");
            file = file.replace(/_\w{8}\.css$/, ".css");
          }

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
    // Turbopack (new format): file-module-scss-module__hash__cls or file-module-css-module__hash__cls
    const turboExt = cls.match(/^([\w-]+)-module-(scss|css)-module__\w+__(\w+)$/);
    if (turboExt) {
      return { className: turboExt[3], componentName: turboExt[1] };
    }
    // Turbopack (legacy format): file-module__hash__className
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
