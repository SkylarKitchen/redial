/**
 * style-row-fill.test.ts — Verify the Typography "Style" row's Italicize
 * and Decoration sub-groups both use flex:1 so buttons fill the row
 * edge-to-edge, matching the Align row above it.
 *
 * Bug: The Italicize wrapper lacked flex:1, causing the buttons to shrink
 * to content width instead of filling the row — visually "indented" on
 * the left compared to other full-width button rows.
 */

import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

function readSection(filename: string): string {
  return fs.readFileSync(
    path.resolve(__dirname, `../${filename}`),
    "utf-8"
  );
}

describe("Typography Style row fill", () => {
  const src = readSection("TypographySection.tsx");

  it("both Italicize and Decoration wrappers should have flex: 1", () => {
    // Find the Style row region (between "Italicize" and "Decoration" labels)
    const italicizeIdx = src.indexOf(">Italicize<");
    const decorationIdx = src.indexOf(">Decoration<");
    expect(italicizeIdx).toBeGreaterThan(-1);
    expect(decorationIdx).toBeGreaterThan(-1);

    // Extract the region around both sub-groups (from ~200 chars before Italicize
    // to the Decoration hint)
    const regionStart = Math.max(0, italicizeIdx - 300);
    const regionEnd = decorationIdx + 50;
    const region = src.slice(regionStart, regionEnd);

    // Both wrapper divs should use flex: 1 (inline style, not className)
    // Split on the hint labels to isolate each wrapper
    const [italicizePart] = region.split(">Italicize<");
    const decorationPart = region.slice(region.indexOf(">Italicize<"));

    // Italicize wrapper must have flex: 1
    expect(
      italicizePart.includes("flex: 1") || italicizePart.includes("flex-1"),
      "Italicize wrapper should have flex: 1 for consistent fill"
    ).toBe(true);

    // Decoration wrapper must have flex: 1
    expect(
      decorationPart.includes("flex: 1") || decorationPart.includes("flex-1"),
      "Decoration wrapper should have flex: 1 for consistent fill"
    ).toBe(true);
  });

  it("Style row wrappers should not use items-center (prevents stretch)", () => {
    // items-center on a column flex parent prevents children from stretching
    // to fill width — use default stretch alignment instead
    const italicizeIdx = src.indexOf(">Italicize<");
    const regionStart = Math.max(0, italicizeIdx - 300);
    const region = src.slice(regionStart, italicizeIdx);

    // The wrapper divs should NOT have items-center className
    // (they should use default align-items: stretch so IconButtonGroup fills width)
    const wrapperDivs = region.match(/<div[^>]*>/g) || [];
    const lastWrapper = wrapperDivs[wrapperDivs.length - 1] || "";
    expect(
      lastWrapper.includes("items-center"),
      "Italicize wrapper should not use items-center — prevents buttons from filling width"
    ).toBe(false);
  });
});
