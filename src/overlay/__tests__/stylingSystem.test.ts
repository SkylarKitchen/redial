// @vitest-environment happy-dom
/**
 * stylingSystem.test.ts — classifyStylingSystem(element) must detect which
 * styling system authored an element's styles and report `saveable` in a way
 * that matches the REAL save pipeline (enrichChangesForCommit + server
 * commit.ts, which only writes .css/.scss files or Tailwind JSX class merges).
 *
 * Gap being closed: styled-components / Emotion / runtime style tags /
 * external stylesheets / inline-only elements all fail AT SAVE TIME with
 * per-property "not found" errors. The classifier is the upfront signal.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { classifyStylingSystem } from "../core/stylingSystem";

// ─── Fixtures ─────────────────────────────────────────────────────────

function makeEl(className = "", tag = "div"): HTMLElement {
  const el = document.createElement(tag);
  if (className) el.className = className;
  document.body.appendChild(el);
  return el;
}

const injectedStyles: HTMLStyleElement[] = [];

function addStyle(css: string, attrs: Record<string, string> = {}): HTMLStyleElement {
  const style = document.createElement("style");
  style.textContent = css;
  for (const [k, v] of Object.entries(attrs)) style.setAttribute(k, v);
  document.head.appendChild(style);
  injectedStyles.push(style);
  return style;
}

/** Duck-typed fake CSSStyleSheet for href-based cases happy-dom can't build
 *  (external CDNs, compiled project CSS served via <link>). */
type FakeSheet = {
  href: string | null;
  ownerNode: Element | null;
  cssRules: Array<{ selectorText: string; style: Record<string, string> }>;
};

function stubStyleSheets(sheets: FakeSheet[]): void {
  Object.defineProperty(document, "styleSheets", {
    configurable: true,
    get: () => sheets,
  });
}

/** A fake cross-origin sheet whose cssRules access throws (CORS). */
function corsBlockedSheet(href: string): FakeSheet {
  const sheet = { href, ownerNode: null } as FakeSheet;
  Object.defineProperty(sheet, "cssRules", {
    get() {
      throw new DOMException("CORS", "SecurityError");
    },
  });
  return sheet;
}

beforeEach(() => {
  document.body.innerHTML = "";
});

afterEach(() => {
  document.body.innerHTML = "";
  for (const style of injectedStyles.splice(0)) style.remove();
  // Restore the prototype styleSheets getter if a test stubbed it
  delete (document as unknown as Record<string, unknown>).styleSheets;
});

// ─── Saveable systems ─────────────────────────────────────────────────

describe("classifyStylingSystem — saveable systems", () => {
  it("classifies webpack CSS-module classes as css-modules (saveable)", () => {
    const el = makeEl("Button_btn__a8f2k");
    expect(classifyStylingSystem(el)).toMatchObject({
      system: "css-modules",
      saveable: true,
    });
  });

  it("classifies Turbopack CSS-module classes as css-modules (saveable)", () => {
    const el = makeEl("page-module__IiFEKa__btnPrimary");
    expect(classifyStylingSystem(el)).toMatchObject({
      system: "css-modules",
      saveable: true,
    });
  });

  it("classifies Vite CSS-module classes as css-modules (saveable)", () => {
    const el = makeEl("_btn_abc_123");
    expect(classifyStylingSystem(el)).toMatchObject({
      system: "css-modules",
      saveable: true,
    });
  });

  it("classifies 3+ Tailwind utilities as tailwind (saveable)", () => {
    const el = makeEl("flex items-center mt-4 bg-blue-500");
    expect(classifyStylingSystem(el)).toMatchObject({
      system: "tailwind",
      saveable: true,
    });
  });

  it("prefers tailwind over css-modules when both are present — mirrors enrichChangesForCommit routing", () => {
    // enrichChangesForCommit checks isTailwindElement() FIRST, so an element
    // with both a module class and 3+ utilities saves via the Tailwind path.
    const el = makeEl("Button_btn__a8f2k flex items-center mt-4");
    expect(classifyStylingSystem(el)).toMatchObject({
      system: "tailwind",
      saveable: true,
    });
  });

  it("classifies same-origin project stylesheet rules as saveable", () => {
    // Compiled project CSS served via <link> from the dev origin — the save
    // path resolves this through getGlobalCSSSource (href → source file).
    const el = makeEl("btn");
    stubStyleSheets([
      {
        href: `${location.origin}/_next/static/css/app.css`,
        ownerNode: null,
        cssRules: [{ selectorText: ".btn", style: {} }],
      },
    ]);
    expect(classifyStylingSystem(el)).toMatchObject({
      system: "unknown",
      saveable: true,
    });
  });
});

// ─── CSS-in-JS ────────────────────────────────────────────────────────

describe("classifyStylingSystem — css-in-js (not saveable)", () => {
  it("detects styled-components via data-styled style tag + matching rule", () => {
    const el = makeEl("hKzXpc");
    addStyle(".hKzXpc { color: red; }", { "data-styled": "active" });
    const info = classifyStylingSystem(el);
    expect(info.system).toBe("css-in-js");
    expect(info.saveable).toBe(false);
    expect(info.reason).toMatch(/styled-components/);
    expect(info.reason).toMatch(/can't be saved/);
  });

  it("detects styled-components via sc- class shape alone", () => {
    const el = makeEl("sc-bdVaJa gJkLmn");
    const info = classifyStylingSystem(el);
    expect(info.system).toBe("css-in-js");
    expect(info.saveable).toBe(false);
    expect(info.reason).toMatch(/styled-components/);
  });

  it("detects Emotion via data-emotion style tag + css-hash class", () => {
    const el = makeEl("css-1q2w3e");
    addStyle(".css-1q2w3e { color: red; }", { "data-emotion": "css" });
    const info = classifyStylingSystem(el);
    expect(info.system).toBe("css-in-js");
    expect(info.saveable).toBe(false);
    expect(info.reason).toMatch(/Emotion/);
  });

  it("detects generic runtime style tags (no href, no marker) as css-in-js", () => {
    const el = makeEl("widget");
    addStyle(".widget { color: red; }");
    const info = classifyStylingSystem(el);
    expect(info.system).toBe("css-in-js");
    expect(info.saveable).toBe(false);
  });

  it("ignores redial's own managed style tags", () => {
    const el = makeEl("widget2");
    addStyle(".widget2 { color: red; }", { "data-tuner-scope": "state-preview" });
    const info = classifyStylingSystem(el);
    expect(info.system).not.toBe("css-in-js");
  });

  it("does not count a css-in-js global reset (e.g. body rule) as evidence for unrelated elements", () => {
    // createGlobalStyle emits body/universal rules — those must not flag
    // every element on the page as css-in-js.
    const el = makeEl("Button_btn__a8f2k");
    addStyle("body { margin: 0; }", { "data-styled": "active" });
    expect(classifyStylingSystem(el)).toMatchObject({
      system: "css-modules",
      saveable: true,
    });
  });
});

// ─── External stylesheets ─────────────────────────────────────────────

describe("classifyStylingSystem — external stylesheets (not saveable)", () => {
  it("detects rules from a sheet whose href is outside the dev origin", () => {
    const el = makeEl("ext-btn");
    stubStyleSheets([
      {
        href: "https://cdn.example.com/lib.css",
        ownerNode: null,
        cssRules: [{ selectorText: ".ext-btn", style: {} }],
      },
    ]);
    const info = classifyStylingSystem(el);
    expect(info.system).toBe("external-stylesheet");
    expect(info.saveable).toBe(false);
    expect(info.reason).toMatch(/external stylesheet/i);
  });

  it("flags a classed element as external when the only candidate sheet is CORS-blocked cross-origin", () => {
    const el = makeEl("cdn-thing");
    stubStyleSheets([corsBlockedSheet("https://cdn.example.com/lib.css")]);
    const info = classifyStylingSystem(el);
    expect(info.system).toBe("external-stylesheet");
    expect(info.saveable).toBe(false);
  });
});

// ─── Inline / unknown ─────────────────────────────────────────────────

describe("classifyStylingSystem — inline and unknown", () => {
  it("classifies inline-only styling as inline (not saveable)", () => {
    const el = makeEl();
    el.setAttribute("style", "color: red");
    const info = classifyStylingSystem(el);
    expect(info.system).toBe("inline");
    expect(info.saveable).toBe(false);
    expect(info.reason).toMatch(/inline/i);
  });

  it("classifies a bare element with no styling signals as unknown (not saveable)", () => {
    const el = makeEl();
    const info = classifyStylingSystem(el);
    expect(info.system).toBe("unknown");
    expect(info.saveable).toBe(false);
  });

  it("always returns a non-empty human-readable reason", () => {
    for (const el of [
      makeEl("Button_btn__a8f2k"),
      makeEl("flex items-center mt-4"),
      makeEl("sc-bdVaJa"),
      makeEl(),
    ]) {
      const { reason } = classifyStylingSystem(el);
      expect(reason.length).toBeGreaterThan(0);
    }
  });
});
