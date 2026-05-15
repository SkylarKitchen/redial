// @vitest-environment happy-dom
/**
 * alignBoxClickFlexBug.test.ts — Regression test for GH #24
 *
 * Bug: Clicking any AlignBox 3×3 cell on a `display: flex` element
 * was changing the element's inline style to `display: inline-grid !important`
 * instead of setting `justify-content` and `align-items`.
 *
 * This test mounts the real LayoutSection in happy-dom against a flex
 * container, fires a real click on the "Align bottom-right" radio cell,
 * and asserts that `apply` was called with the correct property (NOT
 * "display") and that the element's inline display is unchanged.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import type { SectionCtx } from "../panelUtils";
import type { UnitConversionContext } from "../unitConversion";
import { applyInlineStyle } from "../core/apply";

// ─── Helpers ──────────────────────────────────────────────────────────

function makeFlexCtx(): { ctx: SectionCtx; element: HTMLElement; applyFn: ReturnType<typeof vi.fn> } {
  const element = document.createElement("section");
  element.style.display = "flex";
  element.style.flexDirection = "column";
  element.style.justifyContent = "normal";
  element.style.alignItems = "normal";
  element.style.flexWrap = "nowrap";
  element.style.gap = "0px";
  element.style.rowGap = "0px";
  element.style.columnGap = "0px";
  document.body.appendChild(element);

  const cs = getComputedStyle(element);
  const applyFn = vi.fn((prop: string, value: string) => {
    // Use the REAL applyInlineStyle so we exercise the same code path as production
    applyInlineStyle(element, prop, value);
  });

  const ctx: SectionCtx = {
    element,
    apply: applyFn,
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
  return { ctx, element, applyFn };
}

describe("AlignBox click on flex container (GH #24)", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => { root.unmount(); });
    container.remove();
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
    const { ctx } = makeFlexCtx();
    await renderLayoutSection(ctx, "flex", /*isFlex*/ true, /*isGrid*/ false, /*isBlockContainer*/ true);

    const cells = container.querySelectorAll('[aria-label="Align bottom-right"]');
    expect(cells.length, "Expected exactly one 'Align bottom-right' cell on a flex container").toBe(1);
  });

  it("clicking 'Align bottom-right' on a flex container sets justify-content + align-items, NOT display", async () => {
    const { ctx, element, applyFn } = makeFlexCtx();
    await renderLayoutSection(ctx, "flex", /*isFlex*/ true, /*isGrid*/ false, /*isBlockContainer*/ true);

    const cell = container.querySelector<HTMLElement>('[aria-label="Align bottom-right"]');
    expect(cell, "AlignBox bottom-right cell should exist").toBeTruthy();

    act(() => {
      cell!.click();
    });

    // The element's inline `display` must not have changed
    expect(element.style.display).toBe("flex");
    expect(element.style.cssText).not.toMatch(/inline-grid/);

    // apply() should NEVER have been called with "display" for an alignment click
    const displayCalls = applyFn.mock.calls.filter(([prop]) => prop === "display");
    expect(displayCalls, "apply('display', …) should not be called when clicking AlignBox cell").toEqual([]);

    // apply() should have been called with the flex alignment properties
    const props = applyFn.mock.calls.map(([prop, value]) => `${prop}=${value}`);
    expect(props).toContain("justify-content=flex-end");
    expect(props).toContain("align-items=flex-end");

    // And the element should now reflect those styles inline
    expect(element.style.justifyContent).toBe("flex-end");
    expect(element.style.alignItems).toBe("flex-end");
  });
});
