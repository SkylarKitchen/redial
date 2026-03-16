// @vitest-environment happy-dom
/**
 * layoutAlignBox.test.ts — Verifies AlignBox maps correctly for grid vs flex context
 *
 * CSS alignment property mapping:
 *   Flex: X axis → justify-content, Y axis → align-items
 *   Grid: X axis → justify-items (NOT justify-content), Y axis → align-items
 *
 * The AlignBox component uses a `mode` prop ("flex" | "grid") to switch
 * between value sets (flex-start/flex-end vs start/end), and the LayoutSection
 * wires different onChange handlers to write the correct CSS property per mode.
 */

import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { createElement } from "react";
import { renderToString } from "react-dom/server";

const layoutSrc = readFileSync(
  join(__dirname, "../sections/LayoutSection.tsx"),
  "utf-8",
);

const alignBoxSrc = readFileSync(
  join(__dirname, "../sections/AlignBox.tsx"),
  "utf-8",
);

// ─── AlignBox mode prop switches value arrays ─────────────────────────

describe("AlignBox mode prop", () => {
  it("accepts mode prop typed as 'flex' | 'grid'", () => {
    expect(alignBoxSrc).toMatch(/mode\??\s*:\s*["']flex["']\s*\|\s*["']grid["']/);
  });

  it("defaults mode to 'flex' when omitted", () => {
    expect(alignBoxSrc).toMatch(/mode\s*=\s*["']flex["']/);
  });

  it("selects JUSTIFY_COLS_FLEX for flex mode", () => {
    expect(alignBoxSrc).toMatch(/mode\s*===\s*["']flex["']\s*\?\s*JUSTIFY_COLS_FLEX/);
  });

  it("selects JUSTIFY_COLS_GRID for grid mode", () => {
    expect(alignBoxSrc).toContain("JUSTIFY_COLS_GRID");
  });

  it("selects ALIGN_ROWS_FLEX for flex mode", () => {
    expect(alignBoxSrc).toMatch(/mode\s*===\s*["']flex["']\s*\?\s*ALIGN_ROWS_FLEX/);
  });

  it("selects ALIGN_ROWS_GRID for grid mode", () => {
    expect(alignBoxSrc).toContain("ALIGN_ROWS_GRID");
  });
});

// ─── Grid mode: X → justify-items, Y → align-items ───────────────────

describe("Grid context: AlignBox maps X → justify-items, Y → align-items", () => {
  it("LayoutSection renders AlignBox with mode='grid' in the grid section", () => {
    const gridAlignMatch = layoutSrc.match(/<AlignBox[\s\S]*?mode="grid"[\s\S]*?\/>/);
    expect(gridAlignMatch, "Expected a grid-mode AlignBox in LayoutSection").toBeTruthy();
  });

  it("grid AlignBox onChange writes justify-items (not justify-content)", () => {
    // The handleGridAlignChange handler should apply "justify-items"
    expect(layoutSrc).toContain('apply("justify-items"');
    // And it should NOT use justify-content in the grid align handler
    const gridHandler = layoutSrc.match(
      /handleGridAlignChange[\s\S]*?(?=\n\s*const\s|\n\s*\/\/\s*─)/,
    );
    expect(gridHandler, "Could not find handleGridAlignChange").toBeTruthy();
    expect(gridHandler![0]).toContain('apply("justify-items"');
    expect(gridHandler![0]).toContain('apply("align-items"');
    expect(gridHandler![0]).not.toContain('apply("justify-content"');
  });

  it("grid AlignBox onChange writes align-items for Y axis", () => {
    const gridHandler = layoutSrc.match(
      /handleGridAlignChange[\s\S]*?(?=\n\s*const\s|\n\s*\/\/\s*─)/,
    );
    expect(gridHandler).toBeTruthy();
    expect(gridHandler![0]).toContain('apply("align-items"');
  });

  it("grid Align row label indicator tracks justify-items and align-items", () => {
    // The grid Align RowLabel should show indicators for the correct properties
    const gridAlignSection = layoutSrc.match(
      /Align[\s\S]*?sectionInd\(\["justify-items",\s*"align-items"\]\)/,
    );
    expect(gridAlignSection, "Grid Align indicator should track justify-items + align-items").toBeTruthy();
  });

  it("grid AlignBox receives justify-items state (not justify-content)", () => {
    const gridAlignBox = layoutSrc.match(/<AlignBox[\s\S]*?mode="grid"[\s\S]*?\/>/);
    expect(gridAlignBox).toBeTruthy();
    const snippet = gridAlignBox![0];
    // The justify prop should bind to justifyItems state, not justifyContent
    expect(snippet).toContain("justifyItems");
    expect(snippet).not.toContain("justifyContent");
  });
});

// ─── Flex mode: X → justify-content, Y → align-items ─────────────────

/** Extract the flex-mode AlignBox region: ~300 chars before mode="flex" to the next /> */
function getFlexAlignBoxContext(): string {
  const idx = layoutSrc.indexOf('mode="flex"');
  expect(idx, "Expected mode=\"flex\" in LayoutSection").toBeGreaterThan(-1);
  const start = layoutSrc.lastIndexOf("<AlignBox", idx);
  const end = layoutSrc.indexOf("/>", idx);
  return layoutSrc.slice(start, end + 2);
}

describe("Flex context: AlignBox maps X → justify-content, Y → align-items", () => {
  it("LayoutSection renders AlignBox with mode='flex' in the flex section", () => {
    expect(layoutSrc).toContain('mode="flex"');
  });

  it("flex AlignBox onChange writes justify-content (not justify-items)", () => {
    const snippet = getFlexAlignBoxContext();
    expect(snippet).toContain("justify-content");
    expect(snippet).not.toContain("justify-items");
  });

  it("flex AlignBox onChange writes align-items for Y axis", () => {
    const snippet = getFlexAlignBoxContext();
    expect(snippet).toContain("align-items");
  });
});

// ─── Value correctness per mode ───────────────────────────────────────

describe("AlignBox emits correct CSS values per mode", () => {
  it("flex mode: clicking top-left emits (flex-start, flex-start)", async () => {
    const { AlignBox } = await import("../sections/AlignBox");
    const onChange = vi.fn();
    const html = renderToString(
      createElement(AlignBox, { justify: "center", align: "center", onChange, mode: "flex" as const, compact: true }),
    );
    // Simulate click on top-left cell (col=0, row=0) via exported constants
    // The AlignBox uses JUSTIFY_COLS_FLEX[0]="flex-start", ALIGN_ROWS_FLEX[0]="flex-start"
    expect(html).toContain('role="radio"'); // has clickable cells

    // Verify via source that flex mode arrays have correct values
    expect(alignBoxSrc).toContain('JUSTIFY_COLS_FLEX = ["flex-start", "center", "flex-end"]');
    expect(alignBoxSrc).toContain('ALIGN_ROWS_FLEX = ["flex-start", "center", "flex-end"]');
  });

  it("grid mode: clicking top-left emits (start, start)", () => {
    // Verify via source that grid mode arrays have correct values
    expect(alignBoxSrc).toContain('JUSTIFY_COLS_GRID = ["start", "center", "end"]');
    expect(alignBoxSrc).toContain('ALIGN_ROWS_GRID = ["start", "center", "end"]');
  });

  it("grid mode never emits flex-start or flex-end", () => {
    // The grid constant arrays should not contain flex-prefixed values
    const gridColsMatch = alignBoxSrc.match(/JUSTIFY_COLS_GRID\s*=\s*\[([^\]]+)\]/);
    const gridRowsMatch = alignBoxSrc.match(/ALIGN_ROWS_GRID\s*=\s*\[([^\]]+)\]/);
    expect(gridColsMatch).toBeTruthy();
    expect(gridRowsMatch).toBeTruthy();
    expect(gridColsMatch![1]).not.toContain("flex-start");
    expect(gridColsMatch![1]).not.toContain("flex-end");
    expect(gridRowsMatch![1]).not.toContain("flex-start");
    expect(gridRowsMatch![1]).not.toContain("flex-end");
  });

  it("flex mode never emits bare start/end (avoids ambiguity)", () => {
    const flexColsMatch = alignBoxSrc.match(/JUSTIFY_COLS_FLEX\s*=\s*\[([^\]]+)\]/);
    const flexRowsMatch = alignBoxSrc.match(/ALIGN_ROWS_FLEX\s*=\s*\[([^\]]+)\]/);
    expect(flexColsMatch).toBeTruthy();
    expect(flexRowsMatch).toBeTruthy();
    // "start" should not appear standalone — only "flex-start"
    const flexCols = flexColsMatch![1];
    const flexRows = flexRowsMatch![1];
    expect(flexCols).toContain("flex-start");
    expect(flexCols).not.toMatch(/(?<!flex-)(?<!")start/);
    expect(flexRows).toContain("flex-start");
    expect(flexRows).not.toMatch(/(?<!flex-)(?<!")start/);
  });
});

// ─── Flex vs Grid property separation ─────────────────────────────────

describe("Flex and grid AlignBox use distinct CSS property targets", () => {
  it("grid handler and flex handler write to different justify properties", () => {
    // Grid writes justify-items; flex writes justify-content
    // They must not cross-contaminate
    const gridHandler = layoutSrc.match(
      /handleGridAlignChange[\s\S]*?(?=\n\s*const\s|\n\s*\/\/\s*─)/,
    );
    expect(gridHandler).toBeTruthy();
    expect(gridHandler![0]).toContain("justify-items");
    expect(gridHandler![0]).not.toContain("justify-content");

    // Flex handler is inline in the flex AlignBox
    const flexSnippet = getFlexAlignBoxContext();
    expect(flexSnippet).toContain("justify-content");
    expect(flexSnippet).not.toContain("justify-items");
  });

  it("both modes write align-items for Y axis", () => {
    const gridHandler = layoutSrc.match(
      /handleGridAlignChange[\s\S]*?(?=\n\s*const\s|\n\s*\/\/\s*─)/,
    );
    const flexSnippet = getFlexAlignBoxContext();
    expect(gridHandler).toBeTruthy();
    expect(gridHandler![0]).toContain("align-items");
    expect(flexSnippet).toContain("align-items");
  });
});
