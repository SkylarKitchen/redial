// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from "vitest";
import {
  getModuleClassInfo,
  getReactSource,
  getCSSSource,
  resolveSource,
} from "../core/sourcemap";

// ─── Helpers ──────────────────────────────────────────────────────────

function makeEl(tag = "div"): HTMLElement {
  const el = document.createElement(tag);
  document.body.appendChild(el);
  return el;
}

/** Attach a fake React fiber with optional _debugSource */
function attachFiber(
  el: Element,
  chain: Array<{ _debugSource?: { fileName: string; lineNumber: number } }>
) {
  // Build the linked list via .return pointers
  for (let i = 0; i < chain.length - 1; i++) {
    (chain[i] as any).return = chain[i + 1];
  }
  (el as any)["__reactFiber$abc123"] = chain[0] ?? null;
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
