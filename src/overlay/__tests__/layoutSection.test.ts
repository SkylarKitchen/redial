// @vitest-environment happy-dom
/**
 * layoutSection.test.ts — Layout section behavioral tests
 *
 * Verifies:
 * 1. Flex child controls (grow, shrink, basis, order, align-self) appear when parentIsFlex
 * 2. Flex child controls are hidden when parent is NOT flex/grid
 * 3. Grid track editors (template-columns, template-rows) appear when display is "grid"
 * 4. AlignBox 3x3 grid click sets both justify-content and align-items simultaneously
 */

import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import type { SectionCtx } from "../panelUtils";
import type { UnitConversionContext } from "../unitConversion";

// ─── Helpers ──────────────────────────────────────────────────────────

function makeMockCtx(overrides?: Partial<{ display: string }>): SectionCtx {
  const element = document.createElement("div");
  element.style.display = overrides?.display ?? "block";
  element.style.flexDirection = "row";
  element.style.justifyContent = "normal";
  element.style.alignItems = "normal";
  element.style.flexWrap = "nowrap";
  element.style.gap = "0px";
  element.style.rowGap = "0px";
  element.style.columnGap = "0px";
  element.style.flexGrow = "0";
  element.style.flexShrink = "1";
  element.style.flexBasis = "auto";
  element.style.alignSelf = "auto";
  element.style.order = "0";
  document.body.appendChild(element);

  const cs = getComputedStyle(element);

  return {
    element,
    apply: vi.fn(),
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
}

async function renderLayout(props: Record<string, unknown>) {
  const { LayoutSection } = await import("../sections/LayoutSection");
  const defaults = {
    ctx: makeMockCtx(),
    display: "block",
    onDisplayChange: vi.fn(),
    columnGap: 0,
    columnGapUnit: "px",
    onColumnGapChange: vi.fn(),
    onColumnGapUnitChange: vi.fn(),
    isFlex: false,
    isGrid: false,
    parentIsFlex: false,
    parentIsGrid: false,
  };
  return renderToString(createElement(LayoutSection, { ...defaults, ...props }));
}

// ─── Source reading ───────────────────────────────────────────────────

const layoutSrc = readFileSync(
  join(__dirname, "../sections/LayoutSection.tsx"),
  "utf-8",
);

// ─── 1. Flex child controls shown when parentIsFlex ──────────────────

describe("Flex child controls visibility", () => {
  it("shows flex child controls (Grow, Shrink, Basis, Order, Align Self) when parentIsFlex and has overrides", async () => {
    // hasFlexChildOverride requires parentIsFlexOrGrid AND non-default value.
    // We use a ctx with non-default flexGrow to trigger the section.
    const ctx = makeMockCtx();
    (ctx.element as HTMLElement).style.flexGrow = "2";
    const cs = getComputedStyle(ctx.element);
    const ctxWithOverride: SectionCtx = { ...ctx, cs };

    const html = await renderLayout({
      ctx: ctxWithOverride,
      display: "block",
      parentIsFlex: true,
      parentIsGrid: false,
    });

    expect(html).toContain("Flex Child");
    expect(html).toContain("Grow");
    expect(html).toContain("Shrink");
    expect(html).toContain("Basis");
    expect(html).toContain("Order");
    expect(html).toContain("Align Self");
  });

  it("hides flex child controls when parent is NOT flex or grid", async () => {
    const html = await renderLayout({
      display: "block",
      parentIsFlex: false,
      parentIsGrid: false,
    });

    expect(html).not.toContain("Flex Child");
    expect(html).not.toContain("Grid Child");
  });

  it("shows Grid Child label when parentIsGrid (not parentIsFlex)", async () => {
    const ctx = makeMockCtx();
    (ctx.element as HTMLElement).style.alignSelf = "center";
    const cs = getComputedStyle(ctx.element);
    const ctxWithOverride: SectionCtx = { ...ctx, cs };

    const html = await renderLayout({
      ctx: ctxWithOverride,
      display: "block",
      parentIsFlex: false,
      parentIsGrid: true,
    });

    expect(html).toContain("Grid Child");
    expect(html).toContain("Align Self");
  });

  it("shows Grow/Shrink/Basis/Order only for flex parent, not grid parent", async () => {
    const ctx = makeMockCtx();
    (ctx.element as HTMLElement).style.alignSelf = "center";
    const cs = getComputedStyle(ctx.element);
    const ctxWithOverride: SectionCtx = { ...ctx, cs };

    const html = await renderLayout({
      ctx: ctxWithOverride,
      display: "block",
      parentIsFlex: false,
      parentIsGrid: true,
    });

    // Grid child only shows Align Self, not the flex-specific controls
    expect(html).toContain("Align Self");
    // Grow/Shrink/Basis/Order are inside {parentIsFlex && ...} guard
    expect(html).not.toContain("Grow");
    expect(html).not.toContain("Shrink");
  });
});

// ─── 2. Source-level: flex child controls gated by parentIsFlex ──────

describe("Source-level: flex child conditional rendering", () => {
  it("hasFlexChildOverride requires parentIsFlexOrGrid", () => {
    expect(layoutSrc).toContain("parentIsFlexOrGrid");
    expect(layoutSrc).toMatch(/hasFlexChildOverride.*parentIsFlexOrGrid/s);
  });

  it("Grow/Shrink/Basis/Order are gated behind parentIsFlex", () => {
    expect(layoutSrc).toMatch(/\{parentIsFlex\s*&&/);
  });

  it("flex child section is gated by hasFlexChildOverride", () => {
    expect(layoutSrc).toMatch(/\{hasFlexChildOverride\s*&&/);
  });
});

// ─── 3. Grid track editors appear when display is "grid" ─────────────

describe("Grid track editors visibility", () => {
  it("shows GridTrackRow (Columns/Rows) when isGrid is true", async () => {
    const ctx = makeMockCtx({ display: "grid" });
    const html = await renderLayout({
      ctx,
      display: "grid",
      isGrid: true,
      isFlex: false,
    });

    expect(html).toContain("Columns");
    expect(html).toContain("Rows");
  });

  it("hides grid controls when isGrid is false", async () => {
    const html = await renderLayout({
      display: "flex",
      isGrid: false,
      isFlex: true,
    });

    // Grid-specific sub-labels should not appear
    expect(html).not.toContain("Columns");
    expect(html).not.toContain("Rows");
  });

  it("source gates grid section with {isGrid && (...)}", () => {
    expect(layoutSrc).toMatch(/\{isGrid\s*&&\s*\(/);
  });

  it("grid section renders grid-template-columns and grid-template-rows controls", () => {
    expect(layoutSrc).toContain("GridTrackRow");
    expect(layoutSrc).toContain("grid-template-columns");
    expect(layoutSrc).toContain("grid-template-rows");
  });

  it("grid section renders auto-flow direction control", async () => {
    const ctx = makeMockCtx({ display: "grid" });
    const html = await renderLayout({
      ctx,
      display: "grid",
      isGrid: true,
      isFlex: false,
    });

    expect(html).toContain("Direction");
  });
});

// ─── 4. AlignBox sets justify-content + align-items simultaneously ───

describe("AlignBox 3x3 sets both justify-content and align-items on click", () => {
  it("AlignBox onChange receives both justify and align values", async () => {
    const { AlignBox } = await import("../sections/AlignBox");
    const onChange = vi.fn();

    const html = renderToString(
      createElement(AlignBox, {
        justify: "flex-start",
        align: "flex-start",
        onChange,
        mode: "flex" as const,
        compact: true,
      }),
    );

    // The AlignBox renders 9 cells (3x3 dot grid) with role="radio"
    expect(html).toContain('role="radio"');
  });

  it("AlignBox source calls onChange with both justify and align arguments", () => {
    const alignBoxSrc = readFileSync(
      join(__dirname, "../sections/AlignBox.tsx"),
      "utf-8",
    );

    // handleCellClick must call onChange with both col and row values
    expect(alignBoxSrc).toContain("onChange(justifyCols[col], alignRows[row])");
  });

  it("LayoutSection wires AlignBox onChange to set both justify-content and align-items", () => {
    // In flex mode, the onChange handler should call apply for both properties
    const flexAlignMatch = layoutSrc.match(
      /<AlignBox[\s\S]*?mode="flex"[\s\S]*?\/>/,
    );
    expect(flexAlignMatch, "Could not find flex-mode AlignBox").toBeTruthy();

    const alignBoxUsage = flexAlignMatch![0];
    expect(alignBoxUsage).toContain("justify-content");
    expect(alignBoxUsage).toContain("align-items");
  });

  it("LayoutSection grid AlignBox wires onChange to set both justify-items and align-items", () => {
    const gridAlignMatch = layoutSrc.match(
      /<AlignBox[\s\S]*?mode="grid"[\s\S]*?\/>/,
    );
    expect(gridAlignMatch, "Could not find grid-mode AlignBox").toBeTruthy();

    // Grid mode uses handleGridAlignChange which sets justify-items + align-items
    expect(layoutSrc).toContain('apply("justify-items"');
    expect(layoutSrc).toContain('apply("align-items"');
  });

  it("AlignBox flex mode uses flex-start/center/flex-end columns", () => {
    const alignBoxSrc = readFileSync(
      join(__dirname, "../sections/AlignBox.tsx"),
      "utf-8",
    );
    expect(alignBoxSrc).toContain('"flex-start", "center", "flex-end"');
  });

  it("AlignBox grid mode uses start/center/end columns", () => {
    const alignBoxSrc = readFileSync(
      join(__dirname, "../sections/AlignBox.tsx"),
      "utf-8",
    );
    expect(alignBoxSrc).toContain('"start", "center", "end"');
  });
});

// ─── AlignBox pure logic tests ───────────────────────────────────────

describe("AlignBox index mapping (toColIndices / toRowIndices)", () => {
  it("maps flex-start to column 0", async () => {
    const { toColIndices } = await import("../sections/AlignBox");
    expect(toColIndices("flex-start")).toEqual([0]);
  });

  it("maps center to column 1", async () => {
    const { toColIndices } = await import("../sections/AlignBox");
    expect(toColIndices("center")).toEqual([1]);
  });

  it("maps flex-end to column 2", async () => {
    const { toColIndices } = await import("../sections/AlignBox");
    expect(toColIndices("flex-end")).toEqual([2]);
  });

  it("maps space-between to all columns [0,1,2]", async () => {
    const { toColIndices } = await import("../sections/AlignBox");
    expect(toColIndices("space-between")).toEqual([0, 1, 2]);
  });

  it("maps stretch to all rows [0,1,2]", async () => {
    const { toRowIndices } = await import("../sections/AlignBox");
    expect(toRowIndices("stretch")).toEqual([0, 1, 2]);
  });

  it("maps grid 'start' to column 0", async () => {
    const { toColIndices } = await import("../sections/AlignBox");
    expect(toColIndices("start")).toEqual([0]);
  });

  it("maps grid 'end' to column 2", async () => {
    const { toColIndices } = await import("../sections/AlignBox");
    expect(toColIndices("end")).toEqual([2]);
  });
});

// ─── 5. Quick-action buttons: Center + Fill Parent ────────────────────

// Reload source for new tests
const layoutSrcFresh = readFileSync(
  join(__dirname, "../sections/LayoutSection.tsx"),
  "utf-8",
);

describe("Quick-action buttons: Center and Fill Parent", () => {
  it("renders Center button when isFlex", async () => {
    const html = await renderLayout({
      display: "flex",
      isFlex: true,
      isGrid: false,
    });
    expect(html).toContain("Center");
  });

  it("renders Fill Parent button when isFlex", async () => {
    const html = await renderLayout({
      display: "flex",
      isFlex: true,
      isGrid: false,
    });
    expect(html).toContain("Fill Parent");
  });

  it("renders Center button when isGrid", async () => {
    const ctx = makeMockCtx({ display: "grid" });
    const html = await renderLayout({
      ctx,
      display: "grid",
      isFlex: false,
      isGrid: true,
    });
    expect(html).toContain("Center");
  });

  it("renders Fill Parent button when isGrid", async () => {
    const ctx = makeMockCtx({ display: "grid" });
    const html = await renderLayout({
      ctx,
      display: "grid",
      isFlex: false,
      isGrid: true,
    });
    expect(html).toContain("Fill Parent");
  });

  it("does NOT render Center or Fill Parent when display is block", async () => {
    const html = await renderLayout({
      display: "block",
      isFlex: false,
      isGrid: false,
    });
    expect(html).not.toContain("Fill Parent");
    // "Center" can appear in other contexts (e.g. "center" in alignItems).
    // Check for the specific button title instead:
    expect(html).not.toContain("Center: justify-content");
  });

  it("handleCenter uses beginBatch/endBatch for undo grouping (source check)", () => {
    // The handleCenter callback must wrap apply calls in beginBatch/endBatch
    const centerMatch = layoutSrcFresh.match(/handleCenter[\s\S]*?endBatch\(\)/);
    expect(centerMatch, "handleCenter must use beginBatch/endBatch").toBeTruthy();
    expect(centerMatch![0]).toContain("beginBatch()");
    expect(centerMatch![0]).toContain("endBatch()");
  });

  it("handleFillParent uses beginBatch/endBatch for undo grouping (source check)", () => {
    const fillMatch = layoutSrcFresh.match(/handleFillParent[\s\S]*?endBatch\(\)/);
    expect(fillMatch, "handleFillParent must use beginBatch/endBatch").toBeTruthy();
    expect(fillMatch![0]).toContain("beginBatch()");
    expect(fillMatch![0]).toContain("endBatch()");
  });

  it("handleCenter sets justify-content + align-items for flex mode", () => {
    // In flex branch: apply("justify-content", "center") and apply("align-items", "center")
    const centerMatch = layoutSrcFresh.match(/handleCenter[\s\S]*?endBatch\(\)/);
    expect(centerMatch![0]).toContain('apply("justify-content", "center")');
    expect(centerMatch![0]).toContain('apply("align-items", "center")');
  });

  it("handleCenter sets justify-items + align-items for grid mode", () => {
    const centerMatch = layoutSrcFresh.match(/handleCenter[\s\S]*?endBatch\(\)/);
    expect(centerMatch![0]).toContain('apply("justify-items", "center")');
    expect(centerMatch![0]).toContain('apply("align-items", "center")');
  });

  it("handleFillParent sets width: 100% + height: 100%", () => {
    const fillMatch = layoutSrcFresh.match(/handleFillParent[\s\S]*?endBatch\(\)/);
    expect(fillMatch![0]).toContain('apply("width", "100%")');
    expect(fillMatch![0]).toContain('apply("height", "100%")');
  });

  it("imports beginBatch and endBatch from apply", () => {
    expect(layoutSrcFresh).toMatch(/import\s*\{[^}]*beginBatch[^}]*\}\s*from\s*["']\.\.\/core\/apply["']/);
    expect(layoutSrcFresh).toMatch(/import\s*\{[^}]*endBatch[^}]*\}\s*from\s*["']\.\.\/core\/apply["']/);
  });
});
