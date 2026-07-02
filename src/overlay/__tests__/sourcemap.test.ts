// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from "vitest";
import {
  getModuleClassInfo,
  getReactSource,
  getCSSSource,
  resolveSource,
  deriveSourceFromClassName,
} from "../core/sourcemap";

// ─── Helpers ──────────────────────────────────────────────────────────

function makeEl(tag = "div"): HTMLElement {
  const el = document.createElement(tag);
  document.body.appendChild(el);
  return el;
}

/** Attach a fake React fiber with optional _debugSource / _debugStack */
function attachFiber(
  el: Element,
  chain: Array<{
    _debugSource?: { fileName: string; lineNumber: number };
    _debugStack?: Error | string | null;
  }>
) {
  // Build the linked list via .return pointers
  for (let i = 0; i < chain.length - 1; i++) {
    (chain[i] as any).return = chain[i + 1];
  }
  (el as any)["__reactFiber$abc123"] = chain[0] ?? null;
}

/**
 * Build a React 19 dev _debugStack: an Error captured inside jsxDEV via
 * `Error("react-stack-top-frame")`. React never rethrows it — only its
 * .stack string is read (see formatOwnerStack in react-dom) — so tests
 * overwrite .stack with a deterministic fixture.
 */
function makeDebugStack(stack: string): Error {
  const err = new Error("react-stack-top-frame");
  err.stack = stack;
  return err;
}

/**
 * A realistic React 19 + Next.js (webpack dev) owner stack. The first user
 * frame after the jsx-dev-runtime frame is the JSX callsite in the owner
 * component; everything at/below react_stack_bottom_frame is renderer
 * internals.
 */
function nextWebpackStack(
  userFrame = "    at Page (webpack-internal:///(app-pages-browser)/./app/page.tsx:12:88)"
): string {
  return [
    "Error: react-stack-top-frame",
    "    at exports.jsxDEV (webpack-internal:///(app-pages-browser)/./node_modules/react/cjs/react-jsx-dev-runtime.development.js:333:36)",
    userFrame,
    "    at react_stack_bottom_frame (webpack-internal:///(app-pages-browser)/./node_modules/react-dom/cjs/react-dom-client.development.js:23091:20)",
    "    at renderWithHooks (webpack-internal:///(app-pages-browser)/./node_modules/react-dom/cjs/react-dom-client.development.js:4700:22)",
    "    at updateFunctionComponent (webpack-internal:///(app-pages-browser)/./node_modules/react-dom/cjs/react-dom-client.development.js:6000:19)",
  ].join("\n");
}

beforeEach(() => {
  document.body.innerHTML = "";
});

// ─── getModuleClassInfo ───────────────────────────────────────────────

describe("getModuleClassInfo", () => {
  it("parses a webpack CSS module class", () => {
    const el = makeEl();
    el.className = "Button_btn__a8f2k";
    expect(getModuleClassInfo(el)).toEqual({
      className: "btn",
      componentName: "Button",
    });
  });

  it("parses a Turbopack CSS module class", () => {
    const el = makeEl();
    el.className = "page-module__IiFEKa__btnPrimary";
    expect(getModuleClassInfo(el)).toEqual({
      className: "btnPrimary",
      componentName: "page",
    });
  });

  it("picks the CSS module class from mixed classes", () => {
    const el = makeEl();
    el.className = "foo bar Button_btn__a8f2k baz";
    expect(getModuleClassInfo(el)).toEqual({
      className: "btn",
      componentName: "Button",
    });
  });

  it("returns null for non-module classes", () => {
    const el = makeEl();
    el.className = "btn primary active";
    expect(getModuleClassInfo(el)).toBeNull();
  });

  it("returns null for an SVG element (className is SVGAnimatedString)", () => {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    document.body.appendChild(svg);
    // In SVG elements, className is an SVGAnimatedString, not a string
    expect(getModuleClassInfo(svg)).toBeNull();
  });

  it("returns null for empty className", () => {
    const el = makeEl();
    el.className = "";
    expect(getModuleClassInfo(el)).toBeNull();
  });

  it("returns the first match when multiple module classes exist", () => {
    const el = makeEl();
    el.className = "Button_btn__a8f2k Card_wrapper__x9z1m";
    const result = getModuleClassInfo(el);
    expect(result).toEqual({
      className: "btn",
      componentName: "Button",
    });
  });

  it("handles a webpack class with multi-word component name", () => {
    const el = makeEl();
    el.className = "NavBar_container__f3k2j";
    expect(getModuleClassInfo(el)).toEqual({
      className: "container",
      componentName: "NavBar",
    });
  });

  it("does not match a class that starts with lowercase (not webpack pattern)", () => {
    const el = makeEl();
    el.className = "button_btn__a8f2k";
    // webpack pattern requires uppercase first letter: /^[A-Z]\w+/
    expect(getModuleClassInfo(el)).toBeNull();
  });

  it("parses Turbopack class with hyphenated file name", () => {
    const el = makeEl();
    el.className = "my-component-module__hash123__wrapper";
    expect(getModuleClassInfo(el)).toEqual({
      className: "wrapper",
      componentName: "my-component",
    });
  });

  it("parses new Turbopack SCSS class with extension in name", () => {
    const el = makeEl();
    el.className = "page-module-scss-module__8o7Fma__hero";
    expect(getModuleClassInfo(el)).toEqual({
      className: "hero",
      componentName: "page",
    });
  });

  it("parses new Turbopack CSS class with extension in name", () => {
    const el = makeEl();
    el.className = "page-module-css-module__abc123__main";
    expect(getModuleClassInfo(el)).toEqual({
      className: "main",
      componentName: "page",
    });
  });

  it("parses a Vite CSS module class", () => {
    const el = makeEl();
    el.className = "_btn_1a2b3_5";
    expect(getModuleClassInfo(el)).toEqual({
      className: "btn",
      componentName: undefined,
    });
  });

  it("parses Vite class with multi-word name", () => {
    const el = makeEl();
    el.className = "_cardWrapper_x9f2k_12";
    expect(getModuleClassInfo(el)).toEqual({
      className: "cardWrapper",
      componentName: undefined,
    });
  });
});

// ─── getReactSource ───────────────────────────────────────────────────

describe("getReactSource", () => {
  it("returns null when no fiber key exists", () => {
    const el = makeEl();
    expect(getReactSource(el)).toBeNull();
  });

  it("returns null when fiber key exists but value is falsy", () => {
    const el = makeEl();
    (el as any)["__reactFiber$abc123"] = null;
    expect(getReactSource(el)).toBeNull();
  });

  it("returns null when fiber chain has no _debugSource", () => {
    const el = makeEl();
    attachFiber(el, [{}, {}, {}]);
    expect(getReactSource(el)).toBeNull();
  });

  // React 19 removed _debugSource entirely (issue #67). A production-mode or
  // owner-stack-disabled React 19 fiber has _debugStack: null and no
  // _debugSource — resolution must return null FAST so the fallback
  // discovery paths (className walk, CSS source maps) engage.
  it("returns null for a React 19 fiber with _debugStack: null (no _debugSource exists)", () => {
    const el = makeEl();
    attachFiber(el, [
      { _debugStack: null },
      { _debugStack: null },
      { _debugStack: null },
    ]);
    expect(getReactSource(el)).toBeNull();
  });

  it("returns source info from immediate fiber _debugSource", () => {
    const el = makeEl();
    attachFiber(el, [
      { _debugSource: { fileName: "/app/src/Button.tsx", lineNumber: 12 } },
    ]);
    const result = getReactSource(el);
    expect(result).toEqual({
      file: "/app/src/Button.tsx",
      line: 12,
      displayPath: "src/Button.tsx:12",
    });
  });

  it("walks up the fiber chain to find _debugSource", () => {
    const el = makeEl();
    attachFiber(el, [
      {}, // no source
      {}, // no source
      { _debugSource: { fileName: "/project/src/Card.tsx", lineNumber: 55 } },
    ]);
    const result = getReactSource(el);
    expect(result).toEqual({
      file: "/project/src/Card.tsx",
      line: 55,
      displayPath: "src/Card.tsx:55",
    });
  });

  it("treats lineNumber 0 as undefined", () => {
    const el = makeEl();
    attachFiber(el, [
      { _debugSource: { fileName: "/src/App.tsx", lineNumber: 0 } },
    ]);
    const result = getReactSource(el);
    expect(result).toEqual({
      file: "/src/App.tsx",
      line: undefined,
      displayPath: "src/App.tsx",
    });
  });

  it("strips path prefix up to /src/", () => {
    const el = makeEl();
    attachFiber(el, [
      {
        _debugSource: {
          fileName: "/Users/me/projects/app/src/components/Nav.tsx",
          lineNumber: 3,
        },
      },
    ]);
    const result = getReactSource(el);
    expect(result!.displayPath).toBe("src/components/Nav.tsx:3");
  });

  it("keeps full path when no /src/ segment exists", () => {
    const el = makeEl();
    attachFiber(el, [
      {
        _debugSource: {
          fileName: "/app/components/Nav.tsx",
          lineNumber: 7,
        },
      },
    ]);
    const result = getReactSource(el);
    expect(result!.displayPath).toBe("/app/components/Nav.tsx:7");
    expect(result!.file).toBe("/app/components/Nav.tsx");
  });

  it("works with __reactInternalInstance$ key", () => {
    const el = makeEl();
    (el as any)["__reactInternalInstance$xyz789"] = {
      _debugSource: { fileName: "/src/Old.tsx", lineNumber: 1 },
      return: null,
    };
    const result = getReactSource(el);
    expect(result).toEqual({
      file: "/src/Old.tsx",
      line: 1,
      displayPath: "src/Old.tsx:1",
    });
  });

  it("stops walking after 10 levels without _debugSource", () => {
    const el = makeEl();
    // Build a chain of 15 nodes — none with _debugSource
    const chain: Array<{}> = [];
    for (let i = 0; i < 15; i++) chain.push({});
    attachFiber(el, chain);
    expect(getReactSource(el)).toBeNull();
  });
});

// ─── getReactSource — React 19 fibers (issue #67) ────────────────────
//
// React 19 removed _debugSource. Dev fibers instead carry _debugStack:
// an Error captured at JSX element creation (jsxDEV) whose first user
// frame is the JSX callsite inside the owner component. These tests use
// the REAL React 19 fiber shape: no _debugSource anywhere.

describe("getReactSource — React 19 _debugStack", () => {
  it("extracts file and line from a Next.js webpack-internal owner stack", () => {
    const el = makeEl();
    attachFiber(el, [{ _debugStack: makeDebugStack(nextWebpackStack()) }]);
    const result = getReactSource(el);
    expect(result).toEqual({
      file: "app/page.tsx",
      line: 12,
      displayPath: "app/page.tsx:12",
    });
  });

  it("normalizes webpack-internal URLs without a route-group segment", () => {
    const el = makeEl();
    attachFiber(el, [
      {
        _debugStack: makeDebugStack(
          nextWebpackStack(
            "    at Button (webpack-internal:///./src/components/Button.tsx:42:13)"
          )
        ),
      },
    ]);
    const result = getReactSource(el);
    expect(result).toEqual({
      file: "src/components/Button.tsx",
      line: 42,
      displayPath: "src/components/Button.tsx:42",
    });
  });

  it("skips the react-jsx-dev-runtime and node_modules frames", () => {
    const el = makeEl();
    attachFiber(el, [{ _debugStack: makeDebugStack(nextWebpackStack()) }]);
    const result = getReactSource(el);
    // Must NOT resolve to the runtime frame that precedes the user frame
    expect(result!.file).not.toContain("react-jsx-dev-runtime");
    expect(result!.file).not.toContain("node_modules");
  });

  it("ignores frames at or below react_stack_bottom_frame", () => {
    const el = makeEl();
    // Only "user-looking" frame is BELOW the bottom marker — must not be used.
    const stack = [
      "Error: react-stack-top-frame",
      "    at exports.jsxDEV (webpack-internal:///(app-pages-browser)/./node_modules/react/cjs/react-jsx-dev-runtime.development.js:333:36)",
      "    at react_stack_bottom_frame (webpack-internal:///(app-pages-browser)/./node_modules/react-dom/cjs/react-dom-client.development.js:23091:20)",
      "    at Sneaky (webpack-internal:///(app-pages-browser)/./app/decoy.tsx:1:1)",
    ].join("\n");
    attachFiber(el, [{ _debugStack: makeDebugStack(stack) }]);
    expect(getReactSource(el)).toBeNull();
  });

  it("returns null for a Turbopack chunk-only stack (compiled URLs are unmappable)", () => {
    const el = makeEl();
    const stack = [
      "Error: react-stack-top-frame",
      "    at exports.jsxDEV (http://localhost:3000/_next/static/chunks/node_modules_react_cjs_8d1e37._.js:333:36)",
      "    at Page (http://localhost:3000/_next/static/chunks/app_page_tsx_6a3f21._.js:12:88)",
      "    at react_stack_bottom_frame (http://localhost:3000/_next/static/chunks/node_modules_react-dom_82bb97._.js:23091:20)",
    ].join("\n");
    attachFiber(el, [{ _debugStack: makeDebugStack(stack) }]);
    expect(getReactSource(el)).toBeNull();
  });

  it("resolves Vite-style dev-server source URLs served at their original path", () => {
    const el = makeEl();
    const stack = [
      "Error: react-stack-top-frame",
      "    at jsxDEV (http://localhost:5173/node_modules/.vite/deps/react_jsx-dev-runtime.js:100:20)",
      "    at App (http://localhost:5173/src/App.tsx:31:7)",
      "    at react_stack_bottom_frame (http://localhost:5173/node_modules/.vite/deps/react-dom_client.js:9000:1)",
    ].join("\n");
    attachFiber(el, [{ _debugStack: makeDebugStack(stack) }]);
    const result = getReactSource(el);
    expect(result).toEqual({
      file: "src/App.tsx",
      line: 31,
      displayPath: "src/App.tsx:31",
    });
  });

  it("walks up the fiber chain to a parent with a usable _debugStack", () => {
    const el = makeEl();
    attachFiber(el, [
      { _debugStack: null },
      { _debugStack: null },
      { _debugStack: makeDebugStack(nextWebpackStack()) },
    ]);
    const result = getReactSource(el);
    expect(result).toEqual({
      file: "app/page.tsx",
      line: 12,
      displayPath: "app/page.tsx:12",
    });
  });

  it("accepts a plain-string _debugStack", () => {
    const el = makeEl();
    attachFiber(el, [{ _debugStack: nextWebpackStack() }]);
    const result = getReactSource(el);
    expect(result).toEqual({
      file: "app/page.tsx",
      line: 12,
      displayPath: "app/page.tsx:12",
    });
  });

  it("parses Firefox/Safari frame format (Name@url:line:col)", () => {
    const el = makeEl();
    const stack = [
      "jsxDEV@webpack-internal:///(app-pages-browser)/./node_modules/react/cjs/react-jsx-dev-runtime.development.js:333:36",
      "Page@webpack-internal:///(app-pages-browser)/./app/page.tsx:12:88",
      "react_stack_bottom_frame@webpack-internal:///(app-pages-browser)/./node_modules/react-dom/cjs/react-dom-client.development.js:23091:20",
    ].join("\n");
    attachFiber(el, [{ _debugStack: makeDebugStack(stack) }]);
    const result = getReactSource(el);
    expect(result).toEqual({
      file: "app/page.tsx",
      line: 12,
      displayPath: "app/page.tsx:12",
    });
  });

  it("prefers _debugSource when both fields exist (React 18 fiber wins)", () => {
    const el = makeEl();
    attachFiber(el, [
      {
        _debugSource: { fileName: "/app/src/Legacy.tsx", lineNumber: 7 },
        _debugStack: makeDebugStack(nextWebpackStack()),
      },
    ]);
    const result = getReactSource(el);
    expect(result).toEqual({
      file: "/app/src/Legacy.tsx",
      line: 7,
      displayPath: "src/Legacy.tsx:7",
    });
  });
});

// ─── getCSSSource ─────────────────────────────────────────────────────

describe("getCSSSource", () => {
  it("derives source file from webpack CSS module class", () => {
    const el = makeEl();
    el.className = "Button_btn__a8f2k";
    const result = getCSSSource(el, "color");
    expect(result).toEqual({
      file: "Button.module.scss",
      line: undefined,
      displayPath: "Button.module.scss",
    });
  });

  it("derives source file from Turbopack CSS module class", () => {
    const el = makeEl();
    el.className = "page-module__IiFEKa__btnPrimary";
    const result = getCSSSource(el, "color");
    expect(result).toEqual({
      file: "page.module.css",
      line: undefined,
      displayPath: "page.module.css",
    });
  });

  it("derives source file from Vite CSS module class", () => {
    const el = makeEl();
    el.className = "_btn_1a2b3_5";
    const result = getCSSSource(el, "color");
    expect(result).toEqual({
      file: "*.module.css",
      line: undefined,
      displayPath: "module.css (Vite)",
    });
  });

  it("derives source file from new Turbopack SCSS class format", () => {
    const el = makeEl();
    el.className = "page-module-scss-module__8o7Fma__btnPrimary";
    const result = getCSSSource(el, "color");
    expect(result).toEqual({
      file: "page.module.scss",
      line: undefined,
      displayPath: "page.module.scss",
    });
  });

  it("returns null for element with no module class", () => {
    const el = makeEl();
    el.className = "btn primary";
    expect(getCSSSource(el, "color")).toBeNull();
  });

  it("returns null for non-string className (SVG element)", () => {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    document.body.appendChild(svg);
    expect(getCSSSource(svg, "fill")).toBeNull();
  });

  it("always has undefined line in derived results", () => {
    const el = makeEl();
    el.className = "Header_title__z9k2m";
    const result = getCSSSource(el, "font-size");
    expect(result!.line).toBeUndefined();
  });

  it("handles element with no className attribute", () => {
    const el = makeEl();
    // className defaults to "" which is a string, but let's verify it still works
    expect(getCSSSource(el, "color")).toBeNull();
  });
});

// ─── resolveSource ────────────────────────────────────────────────────

describe("resolveSource", () => {
  it("returns CSS source when CSS module class exists", () => {
    const el = makeEl();
    el.className = "Button_btn__a8f2k";
    const result = resolveSource(el, "color");
    expect(result).toEqual({
      file: "Button.module.scss",
      line: undefined,
      displayPath: "Button.module.scss",
    });
  });

  it("falls back to React source when no CSS module class", () => {
    const el = makeEl();
    el.className = "plain";
    attachFiber(el, [
      { _debugSource: { fileName: "/src/App.tsx", lineNumber: 10 } },
    ]);
    const result = resolveSource(el, "color");
    expect(result).toEqual({
      file: "/src/App.tsx",
      line: 10,
      displayPath: "src/App.tsx:10",
    });
  });

  it("returns null when neither source is available", () => {
    const el = makeEl();
    el.className = "plain";
    expect(resolveSource(el, "color")).toBeNull();
  });

  it("prefers CSS source over React source when both exist", () => {
    const el = makeEl();
    el.className = "Card_wrapper__x1y2z";
    attachFiber(el, [
      { _debugSource: { fileName: "/src/Card.tsx", lineNumber: 5 } },
    ]);
    const result = resolveSource(el, "padding");
    // Should return CSS source, not React source
    expect(result).toEqual({
      file: "Card.module.scss",
      line: undefined,
      displayPath: "Card.module.scss",
    });
  });
});

// ─── deriveSourceFromClassName (SCSS detection via href) ─────────────

describe("deriveSourceFromClassName", () => {
  // Turbopack — no href (default .css)
  it("defaults Turbopack to .module.css without href", () => {
    const result = deriveSourceFromClassName("page-module__IiFEKa__btn", "color");
    expect(result).toEqual({
      file: "page.module.css",
      line: undefined,
      displayPath: "page.module.css",
    });
  });

  // Turbopack — href with SCSS signal
  it("detects .module.scss for Turbopack from href containing _scss", () => {
    const href = "/_next/static/chunks/src_app_page_module_scss_abc123.css";
    const result = deriveSourceFromClassName("page-module__IiFEKa__btn", "color", href);
    expect(result).toEqual({
      file: "page.module.scss",
      line: undefined,
      displayPath: "page.module.scss",
    });
  });

  // Turbopack — href without SCSS signal
  it("keeps .module.css for Turbopack when href has no SCSS signal", () => {
    const href = "/_next/static/chunks/src_app_page_module_css_abc123.css";
    const result = deriveSourceFromClassName("page-module__IiFEKa__btn", "color", href);
    expect(result).toEqual({
      file: "page.module.css",
      line: undefined,
      displayPath: "page.module.css",
    });
  });

  // Vite — href with .scss in path
  it("detects .module.scss for Vite from href containing .scss", () => {
    const href = "/src/components/Button.module.scss?used";
    const result = deriveSourceFromClassName("_btn_1a2b3_5", "color", href);
    expect(result).toEqual({
      file: "*.module.scss",
      line: undefined,
      displayPath: "module.scss (Vite)",
    });
  });

  // Vite — href without SCSS
  it("defaults Vite to .module.css without SCSS signal", () => {
    const result = deriveSourceFromClassName("_btn_1a2b3_5", "color");
    expect(result).toEqual({
      file: "*.module.css",
      line: undefined,
      displayPath: "module.css (Vite)",
    });
  });

  // webpack — always .scss regardless of href (can't detect from hashed URLs)
  it("always returns .module.scss for webpack classes", () => {
    const result = deriveSourceFromClassName("Button_btn__a8f2k", "color");
    expect(result).toEqual({
      file: "Button.module.scss",
      line: undefined,
      displayPath: "Button.module.scss",
    });
  });

  // Non-module class
  it("returns null for unrecognized class patterns", () => {
    expect(deriveSourceFromClassName("plain-class", "color")).toBeNull();
  });

  // ─── New Turbopack format (extension in class name) ──────────────────

  it("handles new Turbopack SCSS class: page-module-scss-module__hash__cls", () => {
    const result = deriveSourceFromClassName(
      "page-module-scss-module__8o7Fma__page",
      "color"
    );
    expect(result).toEqual({
      file: "page.module.scss",
      line: undefined,
      displayPath: "page.module.scss",
    });
  });

  it("handles new Turbopack CSS class: page-module-css-module__hash__cls", () => {
    const result = deriveSourceFromClassName(
      "page-module-css-module__abc123__main",
      "color"
    );
    expect(result).toEqual({
      file: "page.module.css",
      line: undefined,
      displayPath: "page.module.css",
    });
  });

  it("handles new Turbopack format with hyphenated filename", () => {
    const result = deriveSourceFromClassName(
      "my-component-module-scss-module__xYz789__wrapper",
      "color"
    );
    expect(result).toEqual({
      file: "my-component.module.scss",
      line: undefined,
      displayPath: "my-component.module.scss",
    });
  });
});
