// @vitest-environment happy-dom
/**
 * alignItemsDesync.test.tsx — Issue #77: `align-items` has two independent
 * controls that desync.
 *
 * The Size section's "Children" dropdown (fill/fit/fixed → align-items) and
 * the Layout section's AlignBox + Y MiniDropdown both write `align-items`,
 * but each renders from its own local useState snapshot. Changing one must
 * update the other — both controls must reflect the applied value.
 *
 * These tests mount BOTH sections against the same element/ctx (with the
 * real applyInlineStyle engine so change notifications fire) and assert
 * that an edit through one control is reflected by the other.
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import { fireEvent } from "@testing-library/react";
import { LayoutSection } from "../sections/LayoutSection";
import { SizeSection } from "../sections/SizeSection";
import { applyInlineStyle } from "../core/apply";
import type { SectionCtx } from "../panelUtils";
import type { UnitConversionContext } from "../unitConversion";

// Enable React's act() environment so state updates flush deterministically.
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// ── Helpers ──────────────────────────────────────────────────────────

/** A flex/grid container ctx wired to the REAL apply engine (so
 *  subscribeChanges notifications fire, like in the live panel). */
function makeCtx(display: string, alignItems: string): SectionCtx {
  const element = document.createElement("div");
  element.style.display = display;
  element.style.alignItems = alignItems;
  document.body.appendChild(element);
  const cs = getComputedStyle(element);
  return {
    element,
    apply: (prop: string, value: string) => applyInlineStyle(element, prop, value),
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
    ctxMenu: () => () => {},
    isTailwind: false,
  };
}

interface Mounted {
  layoutContainer: HTMLDivElement;
  sizeContainer: HTMLDivElement;
  roots: Root[];
}

const mounted: Mounted[] = [];

/** Mount LayoutSection and SizeSection side by side on the same ctx. */
function renderBoth(ctx: SectionCtx, display: string): Mounted {
  const layoutContainer = document.createElement("div");
  const sizeContainer = document.createElement("div");
  document.body.appendChild(layoutContainer);
  document.body.appendChild(sizeContainer);
  const layoutRoot = createRoot(layoutContainer);
  const sizeRoot = createRoot(sizeContainer);
  const isFlex = display === "flex";
  const isGrid = display === "grid";
  act(() => {
    layoutRoot.render(
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
        parentIsFlex: false,
        parentIsGrid: false,
        forceOpen: true,
      }),
    );
    sizeRoot.render(
      createElement(SizeSection, { ctx, display, isMedia: false, forceOpen: true }),
    );
  });
  const m = { layoutContainer, sizeContainer, roots: [layoutRoot, sizeRoot] };
  mounted.push(m);
  return m;
}

afterEach(() => {
  for (const m of mounted.splice(0)) {
    act(() => { m.roots.forEach((r) => r.unmount()); });
    m.layoutContainer.remove();
    m.sizeContainer.remove();
  }
  document.body.innerHTML = "";
});

/** The Size section's Children mode <select> (options fill/fit/fixed). */
function childrenSelect(sizeContainer: HTMLElement): HTMLSelectElement {
  const selects = Array.from(sizeContainer.querySelectorAll("select"));
  const sel = selects.find((s) =>
    Array.from(s.options).some((o) => o.value === "fill"),
  );
  if (!sel) throw new Error("Children mode select not found in SizeSection");
  return sel as HTMLSelectElement;
}

/** The Layout section's Y-axis MiniDropdown trigger (align-items). */
function yDropdownTrigger(layoutContainer: HTMLElement): HTMLElement {
  const ySpan = Array.from(layoutContainer.querySelectorAll("span")).find(
    (s) => s.textContent === "Y",
  );
  if (!ySpan) throw new Error("Y axis label not found in LayoutSection");
  const trigger = ySpan.parentElement!.querySelector('[role="combobox"]');
  if (!trigger) throw new Error("Y MiniDropdown trigger not found");
  return trigger as HTMLElement;
}

/** The AlignBox root (the element that carries data-stretch-x/y). */
function alignBoxRoot(layoutContainer: HTMLElement): HTMLElement {
  const inner = layoutContainer.querySelector("[data-mode]");
  if (!inner) throw new Error("AlignBox not found in LayoutSection");
  return inner.parentElement as HTMLElement;
}

// ── Tests ─────────────────────────────────────────────────────────────

describe("issue #77: align-items controls stay in sync across sections", () => {
  it("Layout AlignBox click updates the Size Children dropdown (flex)", () => {
    const ctx = makeCtx("flex", "stretch");
    const { layoutContainer, sizeContainer } = renderBoth(ctx, "flex");

    // align-items: stretch → Children shows "fill"
    expect(childrenSelect(sizeContainer).value).toBe("fill");

    // Click the AlignBox top-left cell → apply justify-content/align-items: flex-start
    const cell = layoutContainer.querySelector('[aria-label="Align top-left"]') as HTMLElement;
    expect(cell, "AlignBox top-left cell should render").toBeTruthy();
    act(() => { cell.click(); });

    // The edit really landed on the element…
    expect((ctx.element as HTMLElement).style.getPropertyValue("align-items")).toBe("flex-start");
    // …and the Size section's Children control reflects it (flex-start → "fit")
    expect(childrenSelect(sizeContainer).value).toBe("fit");
  });

  it("Size Children change updates the Layout Y dropdown and AlignBox (flex)", () => {
    const ctx = makeCtx("flex", "center");
    const { layoutContainer, sizeContainer } = renderBoth(ctx, "flex");

    // align-items: center → Y dropdown shows "Center", AlignBox not stretched
    expect(yDropdownTrigger(layoutContainer).textContent).toContain("Center");
    expect(alignBoxRoot(layoutContainer).hasAttribute("data-stretch-y")).toBe(false);

    // Children → "Fill" applies align-items: stretch
    act(() => {
      fireEvent.change(childrenSelect(sizeContainer), { target: { value: "fill" } });
    });

    expect((ctx.element as HTMLElement).style.getPropertyValue("align-items")).toBe("stretch");
    // Layout section's controls reflect the new value
    expect(yDropdownTrigger(layoutContainer).textContent).toContain("Stretch");
    expect(alignBoxRoot(layoutContainer).hasAttribute("data-stretch-y")).toBe(true);
  });

  it("Size Children change updates the Layout grid Y dropdown (grid)", () => {
    const ctx = makeCtx("grid", "start");
    const { layoutContainer, sizeContainer } = renderBoth(ctx, "grid");

    // align-items: start → Children shows "fit", grid Y dropdown shows "Start"
    expect(childrenSelect(sizeContainer).value).toBe("fit");
    expect(yDropdownTrigger(layoutContainer).textContent).toContain("Start");

    // Children → "Fill" applies align-items: stretch
    act(() => {
      fireEvent.change(childrenSelect(sizeContainer), { target: { value: "fill" } });
    });

    expect((ctx.element as HTMLElement).style.getPropertyValue("align-items")).toBe("stretch");
    expect(yDropdownTrigger(layoutContainer).textContent).toContain("Stretch");
  });

  it("keeps the Children dropdown on 'fixed' when nothing is applied (no-op path)", () => {
    const ctx = makeCtx("flex", "stretch");
    const { sizeContainer } = renderBoth(ctx, "flex");

    // Selecting "fixed" applies nothing (children keep explicit sizes) and
    // must not snap back — no change notification means no resync.
    act(() => {
      fireEvent.change(childrenSelect(sizeContainer), { target: { value: "fixed" } });
    });
    expect(childrenSelect(sizeContainer).value).toBe("fixed");
    // No apply happened — the element still has its original inline value
    expect((ctx.element as HTMLElement).style.getPropertyValue("align-items")).toBe("stretch");
  });
});
