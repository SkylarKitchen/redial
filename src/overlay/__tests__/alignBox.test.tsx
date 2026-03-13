// @vitest-environment happy-dom
/**
 * AlignBox visual mode tests
 *
 * The AlignBox renders in one of three visual modes:
 *   - dot-grid: 3×3 dots with active position(s) as filled squares
 *   - bar: rounded rectangle spanning the stretch axis
 *   - crosshair: 4 arrows when both axes are stretch
 *
 * Tests use data-mode and data-active attributes for structural assertions
 * instead of counting color hex occurrences.
 */
import { describe, it, expect, vi } from "vitest";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { AlignBox, toColIndices, toRowIndices } from "../AlignBox";

// ─── Helpers ──────────────────────────────────────────────────────────

function render(justify: string, align: string) {
  return renderToString(
    createElement(AlignBox, { justify, align, onChange: vi.fn(), compact: true })
  );
}

/** Count data-active attributes in the rendered HTML */
function countActive(html: string): number {
  return (html.match(/data-active/g) || []).length;
}

/** Extract the data-mode value from rendered HTML */
function getMode(html: string): string | null {
  const match = html.match(/data-mode="([^"]+)"/);
  return match ? match[1] : null;
}

/** Count data-bar attributes (vertical or horizontal bars) */
function countBars(html: string): number {
  return (html.match(/data-bar/g) || []).length;
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

// ─── Component: Visual modes ──────────────────────────────────────────

describe("AlignBox visual modes", () => {
  it("positional × positional → dot-grid with 1 active cell", () => {
    const html = render("flex-start", "flex-start");
    expect(getMode(html)).toBe("dot-grid");
    expect(countActive(html)).toBe(1);
  });

  it("center × center → dot-grid with 1 active cell", () => {
    const html = render("center", "center");
    expect(getMode(html)).toBe("dot-grid");
    expect(countActive(html)).toBe(1);
  });

  it("space-between × center → dot-grid with 3 active cells (full row)", () => {
    const html = render("space-between", "center");
    expect(getMode(html)).toBe("dot-grid");
    expect(countActive(html)).toBe(3);
  });

  it("space-around × flex-start → dot-grid with 3 active cells (top row)", () => {
    const html = render("space-around", "flex-start");
    expect(getMode(html)).toBe("dot-grid");
    expect(countActive(html)).toBe(3);
  });

  it("space-evenly × flex-end → dot-grid with 3 active cells (bottom row)", () => {
    const html = render("space-evenly", "flex-end");
    expect(getMode(html)).toBe("dot-grid");
    expect(countActive(html)).toBe(3);
  });

  it("flex-start × stretch → bar mode with 1 vertical bar", () => {
    const html = render("flex-start", "stretch");
    expect(getMode(html)).toBe("bar");
    expect(countBars(html)).toBe(1);
    expect(html).toContain('data-bar="vertical"');
  });

  it("center × stretch → bar mode with 1 vertical bar", () => {
    const html = render("center", "stretch");
    expect(getMode(html)).toBe("bar");
    expect(countBars(html)).toBe(1);
    expect(html).toContain('data-bar="vertical"');
  });

  it("space-between × stretch → bar mode with 3 vertical bars", () => {
    const html = render("space-between", "stretch");
    expect(getMode(html)).toBe("bar");
    expect(countBars(html)).toBe(3);
  });

  it("center × baseline → dot-grid with 0 active cells", () => {
    const html = render("center", "baseline");
    expect(getMode(html)).toBe("dot-grid");
    expect(countActive(html)).toBe(0);
  });

  it("space-between × baseline → dot-grid with 0 active cells", () => {
    const html = render("space-between", "baseline");
    expect(getMode(html)).toBe("dot-grid");
    expect(countActive(html)).toBe(0);
  });
});
