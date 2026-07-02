// @vitest-environment happy-dom
/**
 * displayDirectionAlignment.test.ts — Ensure Display and Direction rows
 * use consistent padding so their labels and controls align horizontally.
 *
 * Bug: The DisplayTabs row and FlexDirectionRow used layout.rowPadding
 * ("2px 8px") but sibling rows (Align, Gap) use ROW from panelStyles
 * (paddingLeft: 12). The 8px vs 12px mismatch made Display/Direction labels
 * sit 4px further left than the rest of the panel.
 *
 * CONVERTED (issue #105): was a source-text test (extracting function bodies
 * from DisplayTabs.tsx/DirectionControls.tsx and grepping for
 * "layout.rowPadding" / paddingLeft literals). Now renders the real
 * LayoutSection (flex) and measures the rendered row containers.
 * Invariant mapping:
 *  - "no layout.rowPadding (8px)" + "matching horizontal padding" → the
 *    rendered Display row and Direction row have IDENTICAL inline padding,
 *    equal to the shared ROW contract from panelStyles (12px left) — so any
 *    regression to a different padding mechanism misaligns and fails.
 */

import { describe, it, expect, afterEach } from "vitest";
import { createElement } from "react";
import { render, cleanup, screen } from "@testing-library/react";
import { LayoutSection } from "../sections/LayoutSection";
import { ROW } from "../panelStyles";
import { resetAll } from "../core/apply";
import type { SectionCtx } from "../panelUtils";
import type { UnitConversionContext } from "../unitConversion";

afterEach(() => {
  cleanup();
  resetAll();
  document.body.innerHTML = "";
});

function makeCtx(): SectionCtx {
  const element = document.createElement("div");
  element.style.display = "flex";
  document.body.appendChild(element);
  const cs = getComputedStyle(element);
  return {
    element,
    apply: () => {},
    reset: () => {},
    resetRead: () => 0,
    resetReadStr: () => "",
    ind: () => "none" as const,
    sectionInd: () => "none" as const,
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
    ctxMenu: () => () => {},
    isTailwind: false,
  };
}

function renderLayoutFlex() {
  return render(
    createElement(LayoutSection, {
      ctx: makeCtx(),
      display: "flex",
      onDisplayChange: () => {},
      columnGap: 0,
      columnGapUnit: "px",
      onColumnGapChange: () => {},
      onColumnGapUnitChange: () => {},
      isFlex: true,
      isGrid: false,
      parentIsFlex: false,
      parentIsGrid: false,
      forceOpen: true,
    }),
  );
}

/** Walk up from a label to the row container that carries horizontal padding. */
function rowContainerOf(labelText: string): HTMLElement {
  let node: HTMLElement | null = screen.getByText(labelText) as HTMLElement;
  while (node && !node.style.paddingLeft) {
    node = node.parentElement;
  }
  expect(node, `row container with padding for "${labelText}" should exist`).toBeTruthy();
  return node as HTMLElement;
}

describe("Display and Direction row alignment", () => {
  it("Display and Direction rows render with identical horizontal padding (the shared ROW contract)", () => {
    renderLayoutFlex();

    const displayRow = rowContainerOf("Display");
    const directionRow = rowContainerOf("Direction");

    // Identical left AND right padding — no 8px vs 12px drift
    expect(displayRow.style.paddingLeft).toBe(directionRow.style.paddingLeft);
    expect(displayRow.style.paddingRight).toBe(directionRow.style.paddingRight);

    // And both match the shared ROW panel style (12px), not the old
    // layout.rowPadding 8px
    expect(displayRow.style.paddingLeft).toBe(`${ROW.paddingLeft}px`);
    expect(directionRow.style.paddingLeft).toBe(`${ROW.paddingLeft}px`);
    expect(displayRow.style.paddingLeft).not.toBe("8px");
  });
});
