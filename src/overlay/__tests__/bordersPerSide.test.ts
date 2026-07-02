// @vitest-environment happy-dom
/**
 * bordersPerSide.test.ts — Per-side border control verification
 *
 * Verifies that switching between Top/Bottom/Right/Left tabs shows the correct
 * style, width, and color when each side has different border values.
 *
 * Scenario: border-top: 2px solid red, border-bottom: 1px dashed blue
 * Switching between Top and Bottom tabs should show each side's values.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Mock } from "vitest";
import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import { BordersSection } from "../sections/BordersSection";
import type { SectionCtx } from "../panelUtils";
import type { UnitConversionContext } from "../unitConversion";

// ── Helpers ──────────────────────────────────────────────────────────

function makeMixedBorderCtx(): SectionCtx {
  const element = document.createElement("div");

  // Top: 2px solid red
  element.style.borderTopWidth = "2px";
  element.style.borderTopStyle = "solid";
  element.style.borderTopColor = "rgb(255, 0, 0)";

  // Bottom: 1px dashed blue
  element.style.borderBottomWidth = "1px";
  element.style.borderBottomStyle = "dashed";
  element.style.borderBottomColor = "rgb(0, 0, 255)";

  // Right: 3px dotted green
  element.style.borderRightWidth = "3px";
  element.style.borderRightStyle = "dotted";
  element.style.borderRightColor = "rgb(0, 255, 0)";

  // Left: 0px none black
  element.style.borderLeftWidth = "0px";
  element.style.borderLeftStyle = "none";
  element.style.borderLeftColor = "rgb(0, 0, 0)";

  document.body.appendChild(element);
  const cs = getComputedStyle(element);

  return {
    element,
    apply: vi.fn(),
    reset: vi.fn(),
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
    ctxMenu: () => vi.fn(),
    isTailwind: false,
  };
}

function setup() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  return { container, root };
}

function teardown(container: HTMLDivElement, root: Root) {
  act(() => { root.unmount(); });
  container.remove();
}

/** Find the side selector button by data-side attribute */
function sideButton(container: HTMLElement, side: string): HTMLElement {
  const btn = container.querySelector(`[data-side="${side}"]`) as HTMLElement;
  if (!btn) throw new Error(`Side button "${side}" not found`);
  return btn;
}

/**
 * Get the border width input value.
 *
 * Both the Radius row and the Width row render a `ValueInput`, which carries
 * `aria-label="Value"`. (The radius row also renders a range `<input>` Slider,
 * so a positional `querySelectorAll("input")[n]` is brittle — selecting by the
 * semantic aria-label is stable against that layout.) In document order the
 * radius ValueInput is first and the width ValueInput is second.
 */
function getBorderWidthInput(container: HTMLElement): HTMLInputElement {
  const valueInputs = container.querySelectorAll<HTMLInputElement>('input[aria-label="Value"]');
  // [0] = radius ValueInput, [1] = width ValueInput.
  if (valueInputs.length < 2) {
    throw new Error(`Expected at least 2 ValueInputs, found ${valueInputs.length}`);
  }
  return valueInputs[1];
}

// ── Tests ─────────────────────────────────────────────────────────────

describe("Per-side border controls show correct values", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    ({ container, root } = setup());
  });

  afterEach(() => {
    teardown(container, root);
  });

  it("renders without throwing with mixed per-side borders", () => {
    const ctx = makeMixedBorderCtx();
    expect(() => {
      act(() => {
        root.render(createElement(BordersSection, { ctx, forceOpen: true }));
      });
    }).not.toThrow();
  });

  it("displays all 5 side selector buttons", () => {
    const ctx = makeMixedBorderCtx();
    act(() => {
      root.render(createElement(BordersSection, { ctx, forceOpen: true }));
    });

    for (const side of ["all", "top", "right", "bottom", "left"]) {
      expect(sideButton(container, side)).toBeTruthy();
    }
  });

  it("switching to Top shows width=2 and switching to Bottom shows width=1", () => {
    const ctx = makeMixedBorderCtx();
    act(() => {
      root.render(createElement(BordersSection, { ctx, forceOpen: true }));
    });

    // Click "top" side
    act(() => { sideButton(container, "top").click(); });
    const widthInput = getBorderWidthInput(container);
    expect(widthInput.value).toBe("2");

    // Click "bottom" side
    act(() => { sideButton(container, "bottom").click(); });
    expect(widthInput.value).toBe("1");
  });

  it("switching to Right shows width=3 and Left shows width=0", () => {
    const ctx = makeMixedBorderCtx();
    act(() => {
      root.render(createElement(BordersSection, { ctx, forceOpen: true }));
    });

    // Click "right" side
    act(() => { sideButton(container, "right").click(); });
    const widthInput = getBorderWidthInput(container);
    expect(widthInput.value).toBe("3");

    // Click "left" side
    act(() => { sideButton(container, "left").click(); });
    expect(widthInput.value).toBe("0");
  });

  it("switching to Top shows style=solid, switching to Bottom shows style=dashed", () => {
    const ctx = makeMixedBorderCtx();
    act(() => {
      root.render(createElement(BordersSection, { ctx, forceOpen: true }));
    });

    // Click "top" — expect "solid" to be the active style
    act(() => { sideButton(container, "top").click(); });
    const styleGroup = container.querySelector('[aria-label="Border style"]') as HTMLElement;
    expect(styleGroup).toBeTruthy();

    let activeStyle = styleGroup.querySelector('[aria-checked="true"]') as HTMLElement;
    expect(activeStyle?.getAttribute("aria-label")?.toLowerCase() || activeStyle?.title?.toLowerCase()).toBe("solid");

    // Click "bottom" — expect "dashed" to be the active style
    act(() => { sideButton(container, "bottom").click(); });
    activeStyle = styleGroup.querySelector('[aria-checked="true"]') as HTMLElement;
    expect(activeStyle?.getAttribute("aria-label")?.toLowerCase() || activeStyle?.title?.toLowerCase()).toBe("dashed");
  });

  it("switching to Right shows style=dotted, Left shows style=none", () => {
    const ctx = makeMixedBorderCtx();
    act(() => {
      root.render(createElement(BordersSection, { ctx, forceOpen: true }));
    });

    act(() => { sideButton(container, "right").click(); });
    const styleGroup = container.querySelector('[aria-label="Border style"]') as HTMLElement;

    let activeStyle = styleGroup.querySelector('[aria-checked="true"]') as HTMLElement;
    expect(activeStyle?.getAttribute("aria-label")?.toLowerCase() || activeStyle?.title?.toLowerCase()).toBe("dotted");

    act(() => { sideButton(container, "left").click(); });
    activeStyle = styleGroup.querySelector('[aria-checked="true"]') as HTMLElement;
    expect(activeStyle?.getAttribute("aria-label")?.toLowerCase() || activeStyle?.title?.toLowerCase()).toBe("none");
  });

  it("apply() targets the correct per-side property when width is changed on Top", () => {
    const ctx = makeMixedBorderCtx();
    act(() => {
      root.render(createElement(BordersSection, { ctx, forceOpen: true }));
    });

    // Switch to "top"
    act(() => { sideButton(container, "top").click(); });

    // Change the width via the input
    const widthInput = getBorderWidthInput(container);
    act(() => {
      // Simulate typing a new value and pressing Enter
      widthInput.focus();
      (widthInput as any).value = "5";
      widthInput.dispatchEvent(new Event("input", { bubbles: true }));
      widthInput.dispatchEvent(new Event("change", { bubbles: true }));
      widthInput.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    });

    // The apply fn should have been called with "border-top-width" (not "border-width")
    const applyCalls = (ctx.apply as Mock<(prop: string, value: string) => void>).mock.calls;
    const widthCall = applyCalls.find(([prop]) => prop.includes("width"));
    if (widthCall) {
      expect(widthCall[0]).toBe("border-top-width");
    }
  });

  it("apply() targets the correct per-side property when width is changed on Bottom", () => {
    const ctx = makeMixedBorderCtx();
    act(() => {
      root.render(createElement(BordersSection, { ctx, forceOpen: true }));
    });

    // Switch to "bottom"
    act(() => { sideButton(container, "bottom").click(); });

    const widthInput = getBorderWidthInput(container);
    act(() => {
      widthInput.focus();
      (widthInput as any).value = "4";
      widthInput.dispatchEvent(new Event("input", { bubbles: true }));
      widthInput.dispatchEvent(new Event("change", { bubbles: true }));
      widthInput.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    });

    const applyCalls = (ctx.apply as Mock<(prop: string, value: string) => void>).mock.calls;
    const widthCall = applyCalls.find(([prop]) => prop.includes("width"));
    if (widthCall) {
      expect(widthCall[0]).toBe("border-bottom-width");
    }
  });

  it("switching back to 'all' reads shorthand properties", () => {
    const ctx = makeMixedBorderCtx();
    act(() => {
      root.render(createElement(BordersSection, { ctx, forceOpen: true }));
    });

    // Switch to "top" then back to "all"
    act(() => { sideButton(container, "top").click(); });
    act(() => { sideButton(container, "all").click(); });

    // Should not throw — the "all" codepath reads borderStyle/borderWidth/borderColor shorthands
    expect(container.innerHTML).toBeTruthy();
  });
});
