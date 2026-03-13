// @vitest-environment happy-dom
/**
 * AlignBox grid highlight tests
 *
 * Bug: When X (justify) is set to a spacing value like "space-between",
 * the 3x3 alignment grid shows zero visual feedback. Same for Y = "stretch".
 * The toIndex() function returns -1 and the isSpacingActive guard blanks
 * the entire grid for spacing values.
 *
 * Expected behaviour:
 * | X value     | Y value     | Highlighted cells |
 * |-------------|-------------|-------------------|
 * | positional  | positional  | 1 cell            |
 * | spacing     | positional  | 3 cells (full row)|
 * | positional  | stretch     | 3 cells (full col)|
 * | spacing     | stretch     | 9 cells (all)     |
 * | any         | baseline    | 0 cells           |
 */
import { describe, it, expect, vi } from "vitest";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { AlignBox, toColIndices, toRowIndices } from "../AlignBox";
import { color } from "../theme";

// ─── Helpers ──────────────────────────────────────────────────────────

function render(justify: string, align: string) {
  return renderToString(
    createElement(AlignBox, { justify, align, onChange: vi.fn(), compact: true })
  );
}

/** Count how many times the primary colour appears as an active highlight */
function countActive(html: string): number {
  // The primary colour is applied as `color:<hex>` on arrow cells
  // and as `background:<hex>` on the center dot.
  const re = new RegExp(color.primary.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
  return (html.match(re) || []).length;
}

// ─── Unit: toColIndices ───────────────────────────────────────────────

describe("toColIndices", () => {
  it("flex-start → [0]", () => expect(toColIndices("flex-start")).toEqual([0]));
  it("start → [0]", () => expect(toColIndices("start")).toEqual([0]));
  it("center → [1]", () => expect(toColIndices("center")).toEqual([1]));
  it("flex-end → [2]", () => expect(toColIndices("flex-end")).toEqual([2]));
  it("end → [2]", () => expect(toColIndices("end")).toEqual([2]));
  it("space-between → [0,1,2]", () => expect(toColIndices("space-between")).toEqual([0, 1, 2]));
  it("space-around → [0,1,2]", () => expect(toColIndices("space-around")).toEqual([0, 1, 2]));
  it("space-evenly → [0,1,2]", () => expect(toColIndices("space-evenly")).toEqual([0, 1, 2]));
  it("unknown → []", () => expect(toColIndices("banana")).toEqual([]));
});

// ─── Unit: toRowIndices ───────────────────────────────────────────────

describe("toRowIndices", () => {
  it("flex-start → [0]", () => expect(toRowIndices("flex-start")).toEqual([0]));
  it("start → [0]", () => expect(toRowIndices("start")).toEqual([0]));
  it("center → [1]", () => expect(toRowIndices("center")).toEqual([1]));
  it("flex-end → [2]", () => expect(toRowIndices("flex-end")).toEqual([2]));
  it("end → [2]", () => expect(toRowIndices("end")).toEqual([2]));
  it("stretch → [0,1,2]", () => expect(toRowIndices("stretch")).toEqual([0, 1, 2]));
  it("baseline → []", () => expect(toRowIndices("baseline")).toEqual([]));
  it("unknown → []", () => expect(toRowIndices("banana")).toEqual([]));
});

// ─── Component: Grid highlights ───────────────────────────────────────

describe("AlignBox grid highlights", () => {
  it("positional × positional → 1 active cell", () => {
    const html = render("flex-start", "flex-start");
    // 1 arrow + possibly the center dot if it matches, but only 1 arrow should be primary
    // The top-left arrow gets primary color. Center dot also gets primary if (0,0) intersects center (1,1) — it doesn't.
    // So exactly 1 occurrence of primary on the arrow.
    expect(countActive(html)).toBe(1);
  });

  it("center × center → center dot is primary", () => {
    const html = render("center", "center");
    // The center cell (1,1) renders a dot with background: primary
    expect(html).toContain(color.primary);
  });

  it("BUG REPRO: space-between × center → 3 active cells (full row)", () => {
    const html = render("space-between", "center");
    expect(countActive(html)).toBe(3);
  });

  it("space-around × flex-start → 3 active cells (full row)", () => {
    const html = render("space-around", "flex-start");
    expect(countActive(html)).toBe(3);
  });

  it("space-evenly × flex-end → 3 active cells (full row)", () => {
    const html = render("space-evenly", "flex-end");
    expect(countActive(html)).toBe(3);
  });

  it("flex-start × stretch → 3 active cells (full column)", () => {
    const html = render("flex-start", "stretch");
    expect(countActive(html)).toBe(3);
  });

  it("center × stretch → 3 active cells (full column)", () => {
    const html = render("center", "stretch");
    expect(countActive(html)).toBe(3);
  });

  it("space-between × stretch → 9 active cells (entire grid)", () => {
    const html = render("space-between", "stretch");
    expect(countActive(html)).toBe(9);
  });

  it("center × baseline → 0 active cells", () => {
    const html = render("center", "baseline");
    // baseline has no grid representation — nothing should be primary
    expect(countActive(html)).toBe(0);
  });

  it("space-between × baseline → 0 active cells", () => {
    const html = render("space-between", "baseline");
    expect(countActive(html)).toBe(0);
  });
});
