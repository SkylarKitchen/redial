// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from "vitest";
import { getAuthoredValue, isAutoSize } from "../getAuthoredValue";

// ─── Setup ────────────────────────────────────────────────────────────

function makeEl(tag = "div"): HTMLElement {
  const el = document.createElement(tag);
  document.body.appendChild(el);
  return el;
}

beforeEach(() => {
  document.body.innerHTML = "";
  // Remove any test stylesheets
  for (const sheet of [...document.styleSheets]) {
    if (sheet.ownerNode && sheet.ownerNode.parentNode) {
      sheet.ownerNode.parentNode.removeChild(sheet.ownerNode);
    }
  }
});

// ─── getAuthoredValue ─────────────────────────────────────────────────

describe("getAuthoredValue", () => {
  it("returns null for element with no explicit width", () => {
    const el = makeEl();
    expect(getAuthoredValue(el, "width")).toBeNull();
  });

  it("returns null for element with no explicit height", () => {
    const el = makeEl();
    expect(getAuthoredValue(el, "height")).toBeNull();
  });

  it("returns the inline style value when set", () => {
    const el = makeEl();
    el.style.width = "200px";
    expect(getAuthoredValue(el, "width")).toBe("200px");
  });

  it("returns 'auto' when inline style is explicitly auto", () => {
    const el = makeEl();
    el.style.width = "auto";
    expect(getAuthoredValue(el, "width")).toBe("auto");
  });

  it("returns CSS rule value for matching selector", () => {
    const el = makeEl();
    el.classList.add("fixed-width");

    const style = document.createElement("style");
    style.textContent = ".fixed-width { width: 300px; }";
    document.head.appendChild(style);

    expect(getAuthoredValue(el, "width")).toBe("300px");
  });

  it("returns null when CSS rule does not match element", () => {
    const el = makeEl();
    // No .other-class on this element
    const style = document.createElement("style");
    style.textContent = ".other-class { width: 300px; }";
    document.head.appendChild(style);

    expect(getAuthoredValue(el, "width")).toBeNull();
  });
});

// ─── isAutoSize ───────────────────────────────────────────────────────

describe("isAutoSize", () => {
  it("returns true when no width is authored (the bug: CommonPanel shows computed pixels instead)", () => {
    const el = makeEl();
    // In CommonPanel today, this element would show W: 680 from getComputedStyle().
    // It should show "auto" because no width was explicitly set.
    expect(isAutoSize(el, "width")).toBe(true);
  });

  it("returns true when no height is authored", () => {
    const el = makeEl();
    expect(isAutoSize(el, "height")).toBe(true);
  });

  it("returns true when width is explicitly 'auto'", () => {
    const el = makeEl();
    el.style.width = "auto";
    expect(isAutoSize(el, "width")).toBe(true);
  });

  it("returns false when width is explicitly set to a fixed value", () => {
    const el = makeEl();
    el.style.width = "200px";
    expect(isAutoSize(el, "width")).toBe(false);
  });

  it("returns false when width is set via stylesheet", () => {
    const el = makeEl();
    el.classList.add("sized");

    const style = document.createElement("style");
    style.textContent = ".sized { width: 50%; }";
    document.head.appendChild(style);

    expect(isAutoSize(el, "width")).toBe(false);
  });
});
