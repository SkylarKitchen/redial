// @vitest-environment happy-dom
/**
 * AlignBox grid highlight tests
 *
 * Bug: When X (justify) is set to a spacing value like "space-between",
 * the 3x3 alignment grid shows zero visual feedback. Same for Y = "stretch".
 * The toIndex() function returns -1 and the isSpacingActive guard blanks
 * the entire grid for spacing values.
 *
 * Expected behaviour (grid arrows only, not counting center indicator):
 * | X value     | Y value     | Active arrows |
 * |-------------|-------------|---------------|
 * | positional  | positional  | 1 cell        |
 * | spacing     | positional  | 3 cells (row) |
 * | positional  | stretch     | 3 cells (col) |
 * | spacing     | stretch     | 9 cells (all) |
 * | any         | baseline    | 0 cells       |
 *
 * Note: The center cell renders a stretch bar (color.primary) when
 * align="stretch", adding +1 to the raw primary-color count.
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
function countPrimary(html: string): number {
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
    // flex-start × flex-start: only top-left arrow is primary
    expect(countPrimary(render("flex-start", "flex-start"))).toBe(1);
  });

  it("center × center → center dot is primary (1 cell)", () => {
    // Center cell renders dot with primary background when active
    expect(countPrimary(render("center", "center"))).toBe(1);
  });

  it("BUG REPRO: space-between × center → 3 active cells (full row)", () => {
    // activeCols=[0,1,2], activeRows=[1] → left arrow + center dot + right arrow
    expect(countPrimary(render("space-between", "center"))).toBe(3);
  });

  it("space-around × flex-start → 3 active cells (top row)", () => {
    // activeCols=[0,1,2], activeRows=[0] → 3 arrows in top row
    expect(countPrimary(render("space-around", "flex-start"))).toBe(3);
  });

  it("space-evenly × flex-end → 3 active cells (bottom row)", () => {
    expect(countPrimary(render("space-evenly", "flex-end"))).toBe(3);
  });

  it("flex-start × stretch → 3 arrows + 1 stretch bar = 4 primary occurrences", () => {
    // activeCols=[0], activeRows=[0,1,2] → 3 arrows in left column
    // + center renders stretch bar (color.primary) regardless of isActive
    expect(countPrimary(render("flex-start", "stretch"))).toBe(4);
  });

  it("center × stretch → 2 arrows + 1 stretch bar = 3 primary occurrences", () => {
    // activeCols=[1], activeRows=[0,1,2] → top-center & bottom-center arrows
    // Center cell is handled as stretch bar, not arrow
    expect(countPrimary(render("center", "stretch"))).toBe(3);
  });

  it("space-between × stretch → 8 arrows + 1 stretch bar = 9 primary occurrences", () => {
    // activeCols=[0,1,2], activeRows=[0,1,2] → all 8 non-center arrows active
    // + center stretch bar
    expect(countPrimary(render("space-between", "stretch"))).toBe(9);
  });

  it("center × baseline → 0 active cells (no grid representation)", () => {
    expect(countPrimary(render("center", "baseline"))).toBe(0);
  });

  it("space-between × baseline → 0 active cells", () => {
    expect(countPrimary(render("space-between", "baseline"))).toBe(0);
  });
});
