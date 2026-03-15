// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import { FOCUSABLE_SELECTOR, getNextFocusTarget } from "../hooks/useFocusTrap";

/* ------------------------------------------------------------------ */
/*  FOCUSABLE_SELECTOR                                                 */
/* ------------------------------------------------------------------ */
describe("FOCUSABLE_SELECTOR", () => {
  it("matches <button>", () => {
    const el = document.createElement("button");
    document.body.appendChild(el);
    const found = document.querySelectorAll(FOCUSABLE_SELECTOR);
    expect(Array.from(found)).toContain(el);
    el.remove();
  });

  it("matches <input>", () => {
    const el = document.createElement("input");
    document.body.appendChild(el);
    const found = document.querySelectorAll(FOCUSABLE_SELECTOR);
    expect(Array.from(found)).toContain(el);
    el.remove();
  });

  it("matches <select>", () => {
    const el = document.createElement("select");
    document.body.appendChild(el);
    const found = document.querySelectorAll(FOCUSABLE_SELECTOR);
    expect(Array.from(found)).toContain(el);
    el.remove();
  });

  it("matches <textarea>", () => {
    const el = document.createElement("textarea");
    document.body.appendChild(el);
    const found = document.querySelectorAll(FOCUSABLE_SELECTOR);
    expect(Array.from(found)).toContain(el);
    el.remove();
  });

  it("matches element with [href]", () => {
    const el = document.createElement("a");
    el.setAttribute("href", "#");
    document.body.appendChild(el);
    const found = document.querySelectorAll(FOCUSABLE_SELECTOR);
    expect(Array.from(found)).toContain(el);
    el.remove();
  });

  it("matches [tabindex='0']", () => {
    const el = document.createElement("div");
    el.setAttribute("tabindex", "0");
    document.body.appendChild(el);
    const found = document.querySelectorAll(FOCUSABLE_SELECTOR);
    expect(Array.from(found)).toContain(el);
    el.remove();
  });

  it("does NOT match [tabindex='-1']", () => {
    const el = document.createElement("div");
    el.setAttribute("tabindex", "-1");
    document.body.appendChild(el);
    const found = document.querySelectorAll(FOCUSABLE_SELECTOR);
    expect(Array.from(found)).not.toContain(el);
    el.remove();
  });
});

/* ------------------------------------------------------------------ */
/*  getNextFocusTarget                                                 */
/* ------------------------------------------------------------------ */
describe("getNextFocusTarget", () => {
  function makeEls(n: number): HTMLElement[] {
    return Array.from({ length: n }, () => document.createElement("button"));
  }

  it("returns null for empty array", () => {
    expect(getNextFocusTarget([], document.body, false)).toBe(null);
    expect(getNextFocusTarget([], document.body, true)).toBe(null);
  });

  it("returns last element when Shift+Tab on first element", () => {
    const els = makeEls(3);
    expect(getNextFocusTarget(els, els[0], true)).toBe(els[2]);
  });

  it("returns first element when Tab on last element", () => {
    const els = makeEls(3);
    expect(getNextFocusTarget(els, els[2], false)).toBe(els[0]);
  });

  it("returns null when no wrapping needed (Tab on middle element)", () => {
    const els = makeEls(3);
    expect(getNextFocusTarget(els, els[1], false)).toBe(null);
  });

  it("returns null when no wrapping needed (Shift+Tab on middle element)", () => {
    const els = makeEls(3);
    expect(getNextFocusTarget(els, els[1], true)).toBe(null);
  });

  it("handles single element — Tab wraps to itself", () => {
    const els = makeEls(1);
    // single element is both first and last
    expect(getNextFocusTarget(els, els[0], false)).toBe(els[0]);
  });

  it("handles single element — Shift+Tab wraps to itself", () => {
    const els = makeEls(1);
    expect(getNextFocusTarget(els, els[0], true)).toBe(els[0]);
  });

  it("returns null when activeElement is not in the list", () => {
    const els = makeEls(3);
    const outsider = document.createElement("div");
    expect(getNextFocusTarget(els, outsider, false)).toBe(null);
    expect(getNextFocusTarget(els, outsider, true)).toBe(null);
  });
});
