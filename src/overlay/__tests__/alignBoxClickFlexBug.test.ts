// @vitest-environment happy-dom
/**
 * alignBoxClickFlexBug.test.ts — Regression test for GH #24
 *
 * Bug (reported live on /demo):
 *   Clicking any AlignBox 3×3 cell on a `display: flex` element changed the
 *   element's inline style to `display: inline-grid !important` instead of
 *   setting `justify-content` and `align-items`.
 *
 * The original WIP test set `display: flex` INLINE on the element. In the
 * real `/demo` page, `section.hero` inherits `display: flex` from a CSS
 * rule, so `el.style.display === ""` while `getComputedStyle(el).display
 * === "flex"`. To make the regression guard mirror live conditions we:
 *
 *   1. Inject a <style> tag so `display: flex` comes from a CSS rule
 *      (not from inline style). Now if `apply("display", …)` is ever
 *      called the assertion `el.style.cssText` not containing "inline-grid"
 *      and `el.style.display === ""` are both meaningful.
 *   2. Dispatch a real pointer sequence (pointerdown → pointerup → click)
 *      to match how a user actually interacts with the cell.
 *   3. Exercise both the high-fidelity flex path AND the lower-level
 *      "single rendered AlignBox" gating, so a future regression that
 *      mounts both AlignBoxes simultaneously fails the test.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import type { SectionCtx } from "../panelUtils";
import type { UnitConversionContext } from "../unitConversion";
import { applyInlineStyle } from "../core/apply";

// ─── Helpers ──────────────────────────────────────────────────────────

/**
 * Make a flex container whose `display: flex` comes from a stylesheet
 * rule (mirrors how `section.hero` is styled in test-app SCSS).
 */
function makeStylesheetFlexElement(): { element: HTMLElement; cleanup: () => void } {
  const styleEl = document.createElement("style");
  styleEl.id = "gh24-test-stylesheet";
  styleEl.textContent = `
    section.hero-test {
      display: flex;
      flex-direction: column;
      justify-content: normal;
      align-items: normal;
      flex-wrap: nowrap;
      gap: 0;
    }
  `;
  document.head.appendChild(styleEl);

  const element = document.createElement("section");
  element.className = "hero-test";
  document.body.appendChild(element);

  return {
    element,
    cleanup: () => {
      styleEl.remove();
      element.remove();
    },
  };
}

function makeFlexCtx(element: HTMLElement): { ctx: SectionCtx; applyFn: ReturnType<typeof vi.fn> } {
  const cs = getComputedStyle(element);
  const applyFn = vi.fn((prop: string, value: string) => {
    // Use the REAL applyInlineStyle so we exercise the same code path as production
    applyInlineStyle(element, prop, value);
  });

  const ctx: SectionCtx = {
    element,
    apply: applyFn,
    reset: vi.fn(),
    resetRead: () => 0,
    resetReadStr: () => "",
    ind: () => "none",
    sectionInd: () => "none",
    cs,
    parentCs: null,
    getConversionCtx: (): UnitConversionContext => ({
      computedFontSize: 16,
      rootFontSize: 16,
      parentWidth: 800,
      parentHeight: 600,
      viewportWidth: 1280,
      viewportHeight: 720,
    }),
    ctxMenu: () => vi.fn(),
    isTailwind: false,
  };
  return { ctx, applyFn };
}

/** Real pointer sequence — closer to a user's mouse click than `.click()`. */
function userClick(el: HTMLElement) {
  el.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true }));
  el.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, cancelable: true }));
  el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
}

describe("AlignBox click on flex container (GH #24)", () => {
  let container: HTMLDivElement;
  let root: Root;
  let stylesheetCleanup: (() => void) | null = null;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => { root.unmount(); });
    container.remove();
    stylesheetCleanup?.();
    stylesheetCleanup = null;
    document.body.querySelectorAll("section, div").forEach((el) => {
      if (el.parentElement === document.body && el !== container) el.remove();
    });
  });

  async function renderLayoutSection(ctx: SectionCtx, display: string, isFlex: boolean, isGrid: boolean, isBlockContainer: boolean) {
    const { LayoutSection } = await import("../sections/LayoutSection");
    act(() => {
      root.render(
        createElement(LayoutSection, {
          ctx,
          display,
          onDisplayChange: vi.fn(),
          columnGap: 0,
          columnGapUnit: "px",
          onColumnGapChange: vi.fn(),
          onColumnGapUnitChange: vi.fn(),
          isFlex,
          isGrid,
          isBlockContainer,
          parentIsFlex: false,
          parentIsGrid: false,
          forceOpen: true,
        }),
      );
    });
  }

  it("renders exactly ONE AlignBox 'Align bottom-right' for a flex container", async () => {
    const { element, cleanup } = makeStylesheetFlexElement();
    stylesheetCleanup = cleanup;
    const { ctx } = makeFlexCtx(element);
    await renderLayoutSection(ctx, "flex", /*isFlex*/ true, /*isGrid*/ false, /*isBlockContainer*/ true);

    const cells = container.querySelectorAll('[aria-label="Align bottom-right"]');
    expect(cells.length, "Expected exactly one 'Align bottom-right' cell on a flex container").toBe(1);
  });

  it("clicking 'Align bottom-right' (display from stylesheet) sets justify/align, NOT display", async () => {
    const { element, cleanup } = makeStylesheetFlexElement();
    stylesheetCleanup = cleanup;
    const { ctx, applyFn } = makeFlexCtx(element);

    // Sanity: display comes from CSS, not inline — this is what the live
    // browser repro looks like (the previous test had inline display:flex
    // which masked any spurious `apply("display", "inline-grid")` call).
    expect(element.style.display).toBe("");
    expect(getComputedStyle(element).display).toBe("flex");

    await renderLayoutSection(ctx, "flex", /*isFlex*/ true, /*isGrid*/ false, /*isBlockContainer*/ true);

    const cell = container.querySelector<HTMLElement>('[aria-label="Align bottom-right"]');
    expect(cell, "AlignBox bottom-right cell should exist").toBeTruthy();

    act(() => {
      userClick(cell!);
    });

    // The element's inline `display` must remain unset — display comes from
    // the stylesheet. If the bug recurs (`apply("display", "inline-grid")`),
    // inline style.display becomes "inline-grid" and this fails.
    expect(element.style.display).toBe("");
    expect(element.style.cssText).not.toMatch(/display\s*:\s*inline-grid/);
    expect(element.style.cssText).not.toMatch(/display\s*:/);

    // apply() should NEVER have been called with "display" for an alignment click
    const displayCalls = applyFn.mock.calls.filter(([prop]) => prop === "display");
    expect(displayCalls, "apply('display', …) should not be called when clicking AlignBox cell").toEqual([]);

    // apply() should have been called with the flex alignment properties
    const props = applyFn.mock.calls.map(([prop, value]) => `${prop}=${value}`);
    expect(props).toContain("justify-content=flex-end");
    expect(props).toContain("align-items=flex-end");

    // And the element should now reflect those styles inline (with !important)
    expect(element.style.justifyContent).toBe("flex-end");
    expect(element.style.alignItems).toBe("flex-end");

    // Computed display still resolves to "flex" — unchanged
    expect(getComputedStyle(element).display).toBe("flex");
  });

  it("clicking every 3×3 cell on a stylesheet-driven flex container never touches display", async () => {
    const { element, cleanup } = makeStylesheetFlexElement();
    stylesheetCleanup = cleanup;
    const { ctx, applyFn } = makeFlexCtx(element);
    await renderLayoutSection(ctx, "flex", /*isFlex*/ true, /*isGrid*/ false, /*isBlockContainer*/ true);

    const rows = ["top", "middle", "bottom"];
    const cols = ["left", "center", "right"];
    for (const row of rows) {
      for (const col of cols) {
        const label = `Align ${row}-${col}`;
        const cell = container.querySelector<HTMLElement>(`[aria-label="${label}"]`);
        expect(cell, `cell ${label} should exist`).toBeTruthy();
        act(() => { userClick(cell!); });

        // After every click: display untouched
        expect(element.style.display, `after click on ${label}, inline display must be empty`).toBe("");
        expect(element.style.cssText).not.toMatch(/display\s*:/);
      }
    }

    // No display writes across the entire 3×3 sweep
    const displayCalls = applyFn.mock.calls.filter(([prop]) => prop === "display");
    expect(displayCalls).toEqual([]);
  });
});
