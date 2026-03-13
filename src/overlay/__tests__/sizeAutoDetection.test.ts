/**
 * sizeAutoDetection.test.ts — Reproduces two bugs in SizeSection initialization:
 *
 * BUG 1: Value/unit mismatch
 * When an element has `width: 100%` in CSS, the panel shows "418 %" because:
 *   - The number (418) comes from parseNum(cs.width) — computed pixels
 *   - The unit (%) comes from detectUnit() — the authored unit
 * It should show "100 %" (the authored number with authored unit).
 *
 * BUG 2: Missing auto detection for default block sizing
 * `width: 100%` on a block element is the browser default (same as `auto`).
 * Webflow shows this as "Auto". isAutoSize should recognize 100% as auto
 * for block-level width.
 */

// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from "vitest";
import { getAuthoredValue, isAutoSize } from "../getAuthoredValue";
import { parseNum } from "../cssParsers";
import { detectUnit } from "../panelUtils";

function makeEl(tag = "div"): HTMLElement {
  const el = document.createElement(tag);
  document.body.appendChild(el);
  return el;
}

function addStyle(css: string): void {
  const style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);
}

beforeEach(() => {
  document.body.innerHTML = "";
  for (const sheet of [...document.styleSheets]) {
    if (sheet.ownerNode?.parentNode) {
      sheet.ownerNode.parentNode.removeChild(sheet.ownerNode);
    }
  }
});

describe("BUG 1: Value/unit mismatch — authored number should be used, not computed px", () => {
  it("width: 100% should display as 100, not the computed pixel value", () => {
    const el = makeEl();
    el.classList.add("full");
    addStyle(".full { width: 100%; }");

    const authored = getAuthoredValue(el, "width");
    expect(authored).toBe("100%");

    // The FIX: parse the number from the authored value
    const authoredNum = parseNum(authored!);
    expect(authoredNum).toBe(100);

    // The BROKEN behavior: parsing from computed style gives pixels, not %
    // parseNum(getComputedStyle(el).width) would give a pixel value like 418
    // This is the mismatch — you'd see "418 %" in the panel
  });

  it("width: 50% should display as 50, not the computed pixel value", () => {
    const el = makeEl();
    el.classList.add("half");
    addStyle(".half { width: 50%; }");

    const authored = getAuthoredValue(el, "width");
    expect(authored).toBe("50%");
    expect(parseNum(authored!)).toBe(50);
  });

  it("width: 20em should display as 20, not the computed pixel value", () => {
    const el = makeEl();
    el.classList.add("em-width");
    addStyle(".em-width { width: 20em; }");

    const authored = getAuthoredValue(el, "width");
    expect(authored).toBe("20em");
    expect(parseNum(authored!)).toBe(20);
  });

  it("height with explicit px should still use the correct value", () => {
    const el = makeEl();
    el.classList.add("fixed-h");
    addStyle(".fixed-h { height: 134px; }");

    const authored = getAuthoredValue(el, "height");
    expect(authored).toBe("134px");
    expect(parseNum(authored!)).toBe(134);
  });
});

describe("BUG 2: 100% width on block elements should be treated as auto", () => {
  it("width: 100% is the default for block elements — should be auto", () => {
    const el = makeEl();
    el.classList.add("full-w");
    addStyle(".full-w { width: 100%; }");

    // Currently isAutoSize returns false for "100%", but it should be true
    // because 100% width on a block element is equivalent to the browser default
    expect(isAutoSize(el, "width")).toBe(true);
  });

  it("width: 50% is NOT the default — should NOT be auto", () => {
    const el = makeEl();
    el.classList.add("half-w");
    addStyle(".half-w { width: 50%; }");

    expect(isAutoSize(el, "width")).toBe(false);
  });

  it("height: 100% is NOT auto (height defaults to content-fit, not 100%)", () => {
    const el = makeEl();
    el.classList.add("full-h");
    addStyle(".full-h { height: 100%; }");

    // Unlike width, height: 100% is NOT the browser default for block elements
    expect(isAutoSize(el, "height")).toBe(false);
  });

  it("width with no authored value remains auto", () => {
    const el = makeEl();
    expect(isAutoSize(el, "width")).toBe(true);
  });

  it("width: 200px is fixed, not auto", () => {
    const el = makeEl();
    el.style.width = "200px";
    expect(isAutoSize(el, "width")).toBe(false);
  });
});
