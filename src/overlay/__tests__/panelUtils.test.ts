// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from "vitest";
import {
  getIndicatorType,
  getIndicatorColor,
  getIndicatorTitle,
  getAuthoredValue,
  detectUnit,
  isVariableLinked,
  isTextBearing,
  TEXT_TAGS,
  INHERITABLE_PROPERTIES,
} from "../panelUtils";

// ─── Setup ────────────────────────────────────────────────────────────

beforeEach(() => {
  document.body.innerHTML = "";
});

function makeEl(tag = "div"): HTMLElement {
  const el = document.createElement(tag);
  document.body.appendChild(el);
  return el;
}

// ─── TEXT_TAGS ─────────────────────────────────────────────────────────

describe("TEXT_TAGS", () => {
  it("includes common text-bearing tags", () => {
    for (const tag of ["h1", "h2", "p", "span", "a", "button", "label", "input", "textarea"]) {
      expect(TEXT_TAGS.has(tag)).toBe(true);
    }
  });

  it("does not include non-text tags", () => {
    for (const tag of ["div", "section", "nav", "img", "video"]) {
      expect(TEXT_TAGS.has(tag)).toBe(false);
    }
  });
});

// ─── INHERITABLE_PROPERTIES ───────────────────────────────────────────

describe("INHERITABLE_PROPERTIES", () => {
  it("includes common inherited properties", () => {
    expect(INHERITABLE_PROPERTIES.has("color")).toBe(true);
    expect(INHERITABLE_PROPERTIES.has("font-family")).toBe(true);
    expect(INHERITABLE_PROPERTIES.has("font-size")).toBe(true);
    expect(INHERITABLE_PROPERTIES.has("line-height")).toBe(true);
    expect(INHERITABLE_PROPERTIES.has("cursor")).toBe(true);
  });

  it("does not include non-inherited properties", () => {
    expect(INHERITABLE_PROPERTIES.has("width")).toBe(false);
    expect(INHERITABLE_PROPERTIES.has("display")).toBe(false);
    expect(INHERITABLE_PROPERTIES.has("padding")).toBe(false);
    expect(INHERITABLE_PROPERTIES.has("margin")).toBe(false);
  });
});

// ─── getIndicatorType ─────────────────────────────────────────────────

describe("getIndicatorType", () => {
  it('returns "element" when property is set inline', () => {
    const el = makeEl();
    el.style.setProperty("color", "red");
    const cs = getComputedStyle(el);
    expect(getIndicatorType(el, "color", cs)).toBe("element");
  });

  it('returns "none" for untouched properties', () => {
    const el = makeEl();
    const cs = getComputedStyle(el);
    expect(getIndicatorType(el, "color", cs)).toBe("none");
  });

  it('returns "none" when no parent computed style is provided', () => {
    const el = makeEl();
    const cs = getComputedStyle(el);
    // Even for an inheritable prop, without parentCs it returns "none"
    expect(getIndicatorType(el, "font-size", cs, null)).toBe("none");
  });

  it('returns "element" even for inheritable props when set inline', () => {
    const parent = makeEl();
    const child = document.createElement("span");
    parent.appendChild(child);
    child.style.setProperty("color", "blue");
    const cs = getComputedStyle(child);
    const parentCs = getComputedStyle(parent);
    // Inline style takes priority over inheritance check
    expect(getIndicatorType(child, "color", cs, parentCs)).toBe("element");
  });
});

// ─── getAuthoredValue ─────────────────────────────────────────────────

describe("getAuthoredValue", () => {
  it("returns inline style value when set", () => {
    const el = makeEl();
    el.style.setProperty("color", "red");
    expect(getAuthoredValue(el, "color")).toBe("red");
  });

  it("returns null for properties not set anywhere", () => {
    const el = makeEl();
    expect(getAuthoredValue(el, "color")).toBeNull();
  });

  it("returns inline style containing var()", () => {
    const el = makeEl();
    el.style.setProperty("color", "var(--primary)");
    expect(getAuthoredValue(el, "color")).toBe("var(--primary)");
  });
});

// ─── isVariableLinked ─────────────────────────────────────────────────

describe("isVariableLinked", () => {
  it("returns true when inline style uses var()", () => {
    const el = makeEl();
    el.style.setProperty("color", "var(--primary)");
    expect(isVariableLinked(el, "color")).toBe(true);
  });

  it("returns false when value does not use var()", () => {
    const el = makeEl();
    el.style.setProperty("color", "red");
    expect(isVariableLinked(el, "color")).toBe(false);
  });

  it("returns false when property is not authored", () => {
    const el = makeEl();
    expect(isVariableLinked(el, "color")).toBe(false);
  });
});

// ─── detectUnit ───────────────────────────────────────────────────────

describe("detectUnit", () => {
  it('returns "px" from inline style with px value', () => {
    const el = makeEl();
    el.style.setProperty("width", "16px");
    expect(detectUnit(el, "width")).toBe("px");
  });

  it('returns "em" from inline style with em value', () => {
    const el = makeEl();
    el.style.setProperty("font-size", "2em");
    expect(detectUnit(el, "font-size")).toBe("em");
  });

  it('returns "%" from inline style with percentage value', () => {
    const el = makeEl();
    el.style.setProperty("width", "50%");
    expect(detectUnit(el, "width")).toBe("%");
  });

  it("returns fallback when property has no authored value", () => {
    const el = makeEl();
    expect(detectUnit(el, "width", "px")).toBe("px");
    expect(detectUnit(el, "width", "rem")).toBe("rem");
  });

  it("returns default fallback of px when no fallback specified", () => {
    const el = makeEl();
    expect(detectUnit(el, "width")).toBe("px");
  });
});

// ─── isTextBearing ────────────────────────────────────────────────────

describe("isTextBearing", () => {
  it("returns true for TEXT_TAGS elements", () => {
    expect(isTextBearing(makeEl("h1"))).toBe(true);
    expect(isTextBearing(makeEl("p"))).toBe(true);
    expect(isTextBearing(makeEl("span"))).toBe(true);
    expect(isTextBearing(makeEl("button"))).toBe(true);
    expect(isTextBearing(makeEl("input"))).toBe(true);
  });

  it("returns true for elements with text node children", () => {
    const el = makeEl("div");
    el.appendChild(document.createTextNode("Hello world"));
    expect(isTextBearing(el)).toBe(true);
  });

  it("returns false for empty div with no text", () => {
    const el = makeEl("div");
    expect(isTextBearing(el)).toBe(false);
  });

  it("returns false for div with only whitespace text", () => {
    const el = makeEl("div");
    el.appendChild(document.createTextNode("   "));
    expect(isTextBearing(el)).toBe(false);
  });

  it("returns true for elements with contenteditable attribute", () => {
    const el = makeEl("div");
    el.setAttribute("contenteditable", "true");
    expect(isTextBearing(el)).toBe(true);
  });

  it("returns true for elements with role=button", () => {
    const el = makeEl("div");
    el.setAttribute("role", "button");
    expect(isTextBearing(el)).toBe(true);
  });

  it("returns true for elements with role=heading", () => {
    const el = makeEl("div");
    el.setAttribute("role", "heading");
    expect(isTextBearing(el)).toBe(true);
  });
});

// ─── getIndicatorColor ────────────────────────────────────────────────

describe("getIndicatorColor", () => {
  it("returns a color string for each indicator type", () => {
    expect(typeof getIndicatorColor("element")).toBe("string");
    expect(typeof getIndicatorColor("inherited")).toBe("string");
    expect(typeof getIndicatorColor("state")).toBe("string");
    expect(typeof getIndicatorColor("variable")).toBe("string");
    expect(typeof getIndicatorColor("direct")).toBe("string");
    expect(typeof getIndicatorColor("none")).toBe("string");
  });

  it("returns distinct colors for different active types", () => {
    const element = getIndicatorColor("element");
    const inherited = getIndicatorColor("inherited");
    const variable = getIndicatorColor("variable");
    const state = getIndicatorColor("state");
    // All active types should be visually distinct
    const colors = new Set([element, inherited, variable, state]);
    expect(colors.size).toBe(4);
  });
});

// ─── getIndicatorTitle ────────────────────────────────────────────────

describe("getIndicatorTitle", () => {
  it("returns a title string for active types", () => {
    expect(getIndicatorTitle("element")).toBeDefined();
    expect(getIndicatorTitle("inherited")).toBeDefined();
    expect(getIndicatorTitle("state")).toBeDefined();
    expect(getIndicatorTitle("variable")).toBeDefined();
  });

  it("returns undefined for 'none' type", () => {
    expect(getIndicatorTitle("none")).toBeUndefined();
  });

  it("includes parent info for inherited type when element provided", () => {
    const parent = makeEl("section");
    parent.className = "wrapper";
    const child = document.createElement("p");
    parent.appendChild(child);
    const title = getIndicatorTitle("inherited", child, "color");
    expect(title).toContain("section");
    expect(title).toContain("wrapper");
    expect(title).toContain("Inherited");
  });
});
