// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from "vitest";
import {
  buildBreadcrumb,
  getStableSelector,
  isNavigableElement,
  formatCSSDiff,
  getSelector,
  getDisplayClass,
} from "../util";

// ─── Setup ────────────────────────────────────────────────────────────

beforeEach(() => {
  document.body.innerHTML = "";
});

function makeEl(tag = "div"): HTMLElement {
  const el = document.createElement(tag);
  document.body.appendChild(el);
  return el;
}

/** Build a nested DOM tree: body > tags[0] > tags[1] > ... and return the deepest element. */
function buildTree(...tags: string[]): HTMLElement {
  let parent: HTMLElement = document.body;
  let last: HTMLElement = parent;
  for (const tag of tags) {
    const el = document.createElement(tag);
    parent.appendChild(el);
    parent = el;
    last = el;
  }
  return last;
}

// ─── buildBreadcrumb ──────────────────────────────────────────────────

describe("buildBreadcrumb", () => {
  it("returns path from body to element (excluding body)", () => {
    const h1 = buildTree("div", "main", "h1");
    const crumbs = buildBreadcrumb(h1);
    const tags = crumbs.map((c) => c.tag);
    expect(tags).toEqual(["div", "main", "h1"]);
  });

  it("excludes body from the output", () => {
    const el = makeEl("section");
    const crumbs = buildBreadcrumb(el);
    expect(crumbs.every((c) => c.tag !== "body")).toBe(true);
  });

  it("includes className when present", () => {
    const el = makeEl("div");
    el.className = "hero";
    const crumbs = buildBreadcrumb(el);
    expect(crumbs[0].className).toBe("hero");
  });

  it("sets className to null when no class", () => {
    const el = makeEl("div");
    const crumbs = buildBreadcrumb(el);
    expect(crumbs[0].className).toBeNull();
  });

  it("respects maxDepth truncation", () => {
    const deepEl = buildTree("div", "section", "main", "article", "p", "span");
    const crumbs = buildBreadcrumb(deepEl, 3);
    expect(crumbs).toHaveLength(3);
    // Should be the last 3 segments (closest to the element)
    const tags = crumbs.map((c) => c.tag);
    expect(tags).toEqual(["article", "p", "span"]);
  });

  it("returns all segments when depth is less than maxDepth", () => {
    const el = buildTree("div", "p");
    const crumbs = buildBreadcrumb(el, 10);
    expect(crumbs).toHaveLength(2);
  });

  it("stores element references", () => {
    const el = makeEl("div");
    const crumbs = buildBreadcrumb(el);
    expect(crumbs[0].el).toBe(el);
  });
});

// ─── getStableSelector ────────────────────────────────────────────────

describe("getStableSelector", () => {
  it("prefers id when element has one", () => {
    const el = makeEl("div");
    el.id = "hero";
    expect(getStableSelector(el)).toBe("#hero");
  });

  it("prefers data-testid over nth-child", () => {
    const el = makeEl("div");
    el.setAttribute("data-testid", "submit-btn");
    expect(getStableSelector(el)).toBe('[data-testid="submit-btn"]');
  });

  it("prefers CSS module class over nth-child", () => {
    const el = makeEl("div");
    el.className = "Button_btn__a8f2k";
    const selector = getStableSelector(el);
    expect(selector).toBe(".Button_btn__a8f2k");
  });

  it("recognizes Vite CSS module class", () => {
    const el = makeEl("div");
    el.className = "_card_x9f2k_3";
    const selector = getStableSelector(el);
    expect(selector).toBe("._card_x9f2k_3");
  });

  it("falls back to nth-child when no id, testid, or module class", () => {
    const el = makeEl("div");
    const selector = getStableSelector(el);
    expect(selector.startsWith("body")).toBe(true);
    expect(selector).toMatch(/nth-child\(\d+\)/);
  });

  it("nth-child fallback works for deeply nested elements", () => {
    const el = buildTree("div", "main", "section", "p");
    const selector = getStableSelector(el);
    const parts = selector.split(" > ");
    // body > div:nth-child(N) > main:nth-child(N) > section:nth-child(N) > p:nth-child(N)
    expect(parts).toHaveLength(5);
    expect(parts[0]).toBe("body");
    expect(parts[1]).toMatch(/^div:nth-child\(\d+\)$/);
    expect(parts[4]).toMatch(/^p:nth-child\(\d+\)$/);
  });

  it("correctly indexes among siblings in nth-child fallback", () => {
    const parent = makeEl("div");
    const first = document.createElement("span");
    const second = document.createElement("span");
    const third = document.createElement("p");
    parent.appendChild(first);
    parent.appendChild(second);
    parent.appendChild(third);

    const selector = getStableSelector(third);
    // p is the 3rd child
    expect(selector).toContain("p:nth-child(3)");
  });

  it("id takes priority over data-testid and CSS module class", () => {
    const el = makeEl("div");
    el.id = "main-hero";
    el.setAttribute("data-testid", "hero-section");
    el.className = "Hero_wrapper__abc12";
    expect(getStableSelector(el)).toBe("#main-hero");
  });

  it("data-testid takes priority over CSS module class", () => {
    const el = makeEl("div");
    el.setAttribute("data-testid", "card");
    el.className = "Card_root__x1y2z";
    expect(getStableSelector(el)).toBe('[data-testid="card"]');
  });
});

// ─── isNavigableElement ───────────────────────────────────────────────

describe("isNavigableElement", () => {
  it("returns false for script, style, noscript", () => {
    expect(isNavigableElement(document.createElement("script"))).toBe(false);
    expect(isNavigableElement(document.createElement("style"))).toBe(false);
    expect(isNavigableElement(document.createElement("noscript"))).toBe(false);
  });

  it("returns false for head, meta, link, template, title, base", () => {
    expect(isNavigableElement(document.createElement("head"))).toBe(false);
    expect(isNavigableElement(document.createElement("meta"))).toBe(false);
    expect(isNavigableElement(document.createElement("link"))).toBe(false);
    expect(isNavigableElement(document.createElement("template"))).toBe(false);
    expect(isNavigableElement(document.createElement("title"))).toBe(false);
    expect(isNavigableElement(document.createElement("base"))).toBe(false);
  });

  it("returns false for html and body", () => {
    expect(isNavigableElement(document.createElement("html"))).toBe(false);
    expect(isNavigableElement(document.createElement("body"))).toBe(false);
  });

  it("returns true for common visual elements", () => {
    expect(isNavigableElement(makeEl("div"))).toBe(true);
    expect(isNavigableElement(makeEl("span"))).toBe(true);
    expect(isNavigableElement(makeEl("p"))).toBe(true);
    expect(isNavigableElement(makeEl("section"))).toBe(true);
    expect(isNavigableElement(makeEl("h1"))).toBe(true);
    expect(isNavigableElement(makeEl("img"))).toBe(true);
  });

  it("returns false for elements inside .__tuner-root", () => {
    const root = makeEl("div");
    root.className = "__tuner-root";
    const child = document.createElement("div");
    root.appendChild(child);
    expect(isNavigableElement(child)).toBe(false);
  });
});

// ─── formatCSSDiff ────────────────────────────────────────────────────

describe("formatCSSDiff", () => {
  it("formats a single change as a CSS rule", () => {
    const el = makeEl("div");
    el.className = "card";
    const result = formatCSSDiff(el, [
      { prop: "color", from: "black", to: "red" },
    ]);
    expect(result).toContain(".card");
    expect(result).toContain("color: red;");
    expect(result).toContain("/* was black */");
  });

  it("formats multiple changes", () => {
    const el = makeEl("div");
    el.className = "box";
    const result = formatCSSDiff(el, [
      { prop: "width", from: "auto", to: "100px" },
      { prop: "height", from: "auto", to: "50px" },
    ]);
    expect(result).toContain("width: 100px;");
    expect(result).toContain("height: 50px;");
    expect(result).toContain("/* was auto */");
  });

  it("uses tag name as selector when no class", () => {
    const el = makeEl("article");
    const result = formatCSSDiff(el, [
      { prop: "color", from: "black", to: "blue" },
    ]);
    expect(result).toMatch(/^article\s*\{/);
  });

  it("wraps in curly braces with proper structure", () => {
    const el = makeEl("div");
    el.className = "test";
    const result = formatCSSDiff(el, [
      { prop: "opacity", from: "1", to: "0.5" },
    ]);
    expect(result).toMatch(/^\.test \{/);
    expect(result).toMatch(/\}$/);
  });
});

// ─── getSelector ──────────────────────────────────────────────────────

describe("getSelector", () => {
  it("returns .className for elements with a class", () => {
    const el = makeEl("div");
    el.className = "hero";
    expect(getSelector(el)).toBe(".hero");
  });

  it("returns tag name for elements without a class", () => {
    const el = makeEl("article");
    expect(getSelector(el)).toBe("article");
  });

  it("extracts CSS module name for webpack patterns", () => {
    const el = makeEl("div");
    el.className = "Button_btn__a8f2k";
    expect(getSelector(el)).toBe(".btn");
  });

  it("extracts CSS module name for Turbopack patterns", () => {
    const el = makeEl("div");
    el.className = "page-module__IiFEKa__btnPrimary";
    expect(getSelector(el)).toBe(".btnPrimary");
  });

  it("extracts CSS module name for Vite patterns", () => {
    const el = makeEl("div");
    el.className = "_btn_1a2b3_5";
    expect(getSelector(el)).toBe(".btn");
  });

  it("uses first class when multiple non-module classes", () => {
    const el = makeEl("div");
    el.className = "primary large bold";
    expect(getSelector(el)).toBe(".primary");
  });
});

// ─── getDisplayClass ──────────────────────────────────────────────────

describe("getDisplayClass", () => {
  it("returns first class for regular elements", () => {
    const el = makeEl("div");
    el.className = "hero";
    expect(getDisplayClass(el)).toBe("hero");
  });

  it("returns null when no classes", () => {
    const el = makeEl("div");
    expect(getDisplayClass(el)).toBeNull();
  });

  it("returns null for empty className string", () => {
    const el = makeEl("div");
    el.className = "  ";
    expect(getDisplayClass(el)).toBeNull();
  });

  it("extracts webpack CSS module name", () => {
    const el = makeEl("div");
    el.className = "Button_btn__a8f2k";
    expect(getDisplayClass(el)).toBe("btn");
  });

  it("extracts Turbopack CSS module name", () => {
    const el = makeEl("div");
    el.className = "page-module__IiFEKa__btnPrimary";
    expect(getDisplayClass(el)).toBe("btnPrimary");
  });

  it("extracts Vite CSS module name", () => {
    const el = makeEl("div");
    el.className = "_btn_1a2b3_5";
    expect(getDisplayClass(el)).toBe("btn");
  });

  it("returns first class when no module pattern matches", () => {
    const el = makeEl("div");
    el.className = "alpha beta gamma";
    expect(getDisplayClass(el)).toBe("alpha");
  });
});
