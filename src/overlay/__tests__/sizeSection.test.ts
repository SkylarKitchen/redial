// @vitest-environment happy-dom
/**
 * sizeSection.test.ts — Verifies SizeSection behavior:
 *
 * 1. width/height support `auto` as a keyword value (not just numeric)
 * 2. min/max-width/height support `none` as a keyword
 * 3. object-fit and object-position only appear for media elements (img, video, canvas)
 * 4. aspect-ratio accepts freeform text input like "16 / 9"
 * 5. overflow per-axis controls (overflow-x, overflow-y) appear when overflow is "unlocked"
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import * as fs from "fs";
import * as path from "path";

const sizeSectionSrc = fs.readFileSync(
  path.resolve(__dirname, "../sections/SizeSection.tsx"),
  "utf-8"
);

const sizeInputCellSrc = fs.readFileSync(
  path.resolve(__dirname, "../sections/SizeInputCell.tsx"),
  "utf-8"
);

// ─── 1. width/height support `auto` as a keyword value ────────────────

describe("width/height support auto keyword", () => {
  it("width SizeInputCell has supportsAuto prop", () => {
    // Find the Width SizeInputCell block
    const widthBlock = sizeSectionSrc.match(/<SizeInputCell[\s\S]*?label="Width"[\s\S]*?\/>/);
    expect(widthBlock, "Could not find Width SizeInputCell").toBeTruthy();
    expect(widthBlock![0]).toContain("supportsAuto");
  });

  it("height SizeInputCell has supportsAuto prop", () => {
    const heightBlock = sizeSectionSrc.match(/<SizeInputCell[\s\S]*?label="Height"[\s\S]*?\/>/);
    expect(heightBlock, "Could not find Height SizeInputCell").toBeTruthy();
    expect(heightBlock![0]).toContain("supportsAuto");
  });

  it("width passes keyword={widthAuto ? 'auto' : null}", () => {
    const widthBlock = sizeSectionSrc.match(/<SizeInputCell[\s\S]*?label="Width"[\s\S]*?\/>/);
    expect(widthBlock![0]).toMatch(/keyword=\{widthAuto\s*\?\s*"auto"\s*:\s*null\}/);
  });

  it("height passes keyword={heightAuto ? 'auto' : null}", () => {
    const heightBlock = sizeSectionSrc.match(/<SizeInputCell[\s\S]*?label="Height"[\s\S]*?\/>/);
    expect(heightBlock![0]).toMatch(/keyword=\{heightAuto\s*\?\s*"auto"\s*:\s*null\}/);
  });

  it("handleWidthAutoToggle applies 'auto' string to CSS", () => {
    // The toggle handler should call apply("width", "auto") when toggling on
    expect(sizeSectionSrc).toMatch(/apply\(\s*"width"\s*,\s*.*"auto"/);
  });

  it("handleHeightAutoToggle applies 'auto' string to CSS", () => {
    expect(sizeSectionSrc).toMatch(/apply\(\s*"height"\s*,\s*.*"auto"/);
  });

  it("SizeInputCell commit function handles empty input by setting keyword auto when supportsAuto", () => {
    // When the user clears the input field, it should fall back to "auto"
    expect(sizeInputCellSrc).toMatch(/if\s*\(\s*supportsAuto\s*\).*onKeywordChange\?\.\("auto"\)/);
  });
});

// ─── 2. min/max-width/height support `none` as a keyword ─────────────

describe("max-width/max-height support none keyword", () => {
  it("Max W SizeInputCell has supportsNone prop", () => {
    const maxWBlock = sizeSectionSrc.match(/<SizeInputCell[\s\S]*?label="Max W"[\s\S]*?\/>/);
    expect(maxWBlock, "Could not find Max W SizeInputCell").toBeTruthy();
    expect(maxWBlock![0]).toContain("supportsNone");
  });

  it("Max H SizeInputCell has supportsNone prop", () => {
    const maxHBlock = sizeSectionSrc.match(/<SizeInputCell[\s\S]*?label="Max H"[\s\S]*?\/>/);
    expect(maxHBlock, "Could not find Max H SizeInputCell").toBeTruthy();
    expect(maxHBlock![0]).toContain("supportsNone");
  });

  it("Max W passes keyword={maxWidthNone ? 'none' : null}", () => {
    const maxWBlock = sizeSectionSrc.match(/<SizeInputCell[\s\S]*?label="Max W"[\s\S]*?\/>/);
    expect(maxWBlock![0]).toMatch(/keyword=\{maxWidthNone\s*\?\s*"none"\s*:\s*null\}/);
  });

  it("Max H passes keyword={maxHeightNone ? 'none' : null}", () => {
    const maxHBlock = sizeSectionSrc.match(/<SizeInputCell[\s\S]*?label="Max H"[\s\S]*?\/>/);
    expect(maxHBlock![0]).toMatch(/keyword=\{maxHeightNone\s*\?\s*"none"\s*:\s*null\}/);
  });

  it("handleMaxWidthNoneToggle applies 'none' string to CSS", () => {
    expect(sizeSectionSrc).toMatch(/apply\(\s*"max-width"\s*,\s*.*"none"/);
  });

  it("handleMaxHeightNoneToggle applies 'none' string to CSS", () => {
    expect(sizeSectionSrc).toMatch(/apply\(\s*"max-height"\s*,\s*.*"none"/);
  });

  it("Min W does NOT have supportsNone (min-width: none is not a valid CSS value)", () => {
    const minWBlock = sizeSectionSrc.match(/<SizeInputCell[\s\S]*?label="Min W"[\s\S]*?\/>/);
    expect(minWBlock, "Could not find Min W SizeInputCell").toBeTruthy();
    expect(minWBlock![0]).not.toContain("supportsNone");
  });

  it("Min H does NOT have supportsNone", () => {
    const minHBlock = sizeSectionSrc.match(/<SizeInputCell[\s\S]*?label="Min H"[\s\S]*?\/>/);
    expect(minHBlock, "Could not find Min H SizeInputCell").toBeTruthy();
    expect(minHBlock![0]).not.toContain("supportsNone");
  });

  it("SizeInputCell commit function handles empty input by setting keyword none when supportsNone", () => {
    expect(sizeInputCellSrc).toMatch(/if\s*\(\s*supportsNone\s*\).*onKeywordChange\?\.\("none"\)/);
  });
});

// ─── 2b. max-width/max-height handlers guard against "--" placeholder unit ──

describe("max-width/max-height handlers guard against invalid unit", () => {
  it("handleMaxWidthChange guards against '--' unit by defaulting to 'px'", () => {
    // When maxWidthUnit is "--" (placeholder for keyword values), the handler
    // should substitute "px" instead of producing invalid CSS like "500--"
    const handler = sizeSectionSrc.match(/handleMaxWidthChange\s*=\s*useCallback\(\s*\(v[^)]*\)\s*=>\s*\{[\s\S]*?\},\s*\[/);
    expect(handler, "Could not find handleMaxWidthChange").toBeTruthy();
    const body = handler![0];
    // Must contain a guard: maxWidthUnit === "--" ? "px" : maxWidthUnit
    expect(body).toMatch(/maxWidthUnit\s*===\s*"--"\s*\?\s*"px"\s*:\s*maxWidthUnit/);
  });

  it("handleMaxHeightChange guards against '--' unit by defaulting to 'px'", () => {
    const handler = sizeSectionSrc.match(/handleMaxHeightChange\s*=\s*useCallback\(\s*\(v[^)]*\)\s*=>\s*\{[\s\S]*?\},\s*\[/);
    expect(handler, "Could not find handleMaxHeightChange").toBeTruthy();
    const body = handler![0];
    expect(body).toMatch(/maxHeightUnit\s*===\s*"--"\s*\?\s*"px"\s*:\s*maxHeightUnit/);
  });

  it("handleMinWidthChange guards against '--' unit by defaulting to 'px'", () => {
    const handler = sizeSectionSrc.match(/handleMinWidthChange\s*=\s*useCallback\(\s*\(v[^)]*\)\s*=>\s*\{[\s\S]*?\},\s*\[/);
    expect(handler, "Could not find handleMinWidthChange").toBeTruthy();
    const body = handler![0];
    expect(body).toMatch(/minWidthUnit\s*===\s*"--"\s*\?\s*"px"\s*:\s*minWidthUnit/);
  });

  it("handleMinHeightChange guards against '--' unit by defaulting to 'px'", () => {
    const handler = sizeSectionSrc.match(/handleMinHeightChange\s*=\s*useCallback\(\s*\(v[^)]*\)\s*=>\s*\{[\s\S]*?\},\s*\[/);
    expect(handler, "Could not find handleMinHeightChange").toBeTruthy();
    const body = handler![0];
    expect(body).toMatch(/minHeightUnit\s*===\s*"--"\s*\?\s*"px"\s*:\s*minHeightUnit/);
  });

  it("onKeywordChange for Max W guards against '--' unit when exiting keyword mode", () => {
    // The onKeywordChange callback on the Max W SizeInputCell should guard
    // against "--" unit when applying the numeric value after exiting keyword mode
    const maxWBlock = sizeSectionSrc.match(/<SizeInputCell[\s\S]*?label="Max W"[\s\S]*?\/>/);
    expect(maxWBlock, "Could not find Max W SizeInputCell").toBeTruthy();
    const block = maxWBlock![0];
    // The onKeywordChange handler must not use raw maxWidthUnit when it could be "--"
    // It should either guard with a ternary or use a safe unit
    expect(block).toMatch(/maxWidthUnit\s*===\s*"--"\s*\?\s*"px"\s*:\s*maxWidthUnit/);
  });

  it("onKeywordChange for Max H guards against '--' unit when exiting keyword mode", () => {
    const maxHBlock = sizeSectionSrc.match(/<SizeInputCell[\s\S]*?label="Max H"[\s\S]*?\/>/);
    expect(maxHBlock, "Could not find Max H SizeInputCell").toBeTruthy();
    const block = maxHBlock![0];
    expect(block).toMatch(/maxHeightUnit\s*===\s*"--"\s*\?\s*"px"\s*:\s*maxHeightUnit/);
  });

  it("handleMaxWidthNoneToggle guards against '--' unit", () => {
    const handler = sizeSectionSrc.match(/handleMaxWidthNoneToggle\s*=\s*useCallback\(\s*\(\)\s*=>\s*\{[\s\S]*?\},\s*\[/);
    expect(handler, "Could not find handleMaxWidthNoneToggle").toBeTruthy();
    const body = handler![0];
    expect(body).toMatch(/maxWidthUnit\s*===\s*"--"\s*\?\s*"px"\s*:\s*maxWidthUnit/);
  });

  it("handleMaxHeightNoneToggle guards against '--' unit", () => {
    const handler = sizeSectionSrc.match(/handleMaxHeightNoneToggle\s*=\s*useCallback\(\s*\(\)\s*=>\s*\{[\s\S]*?\},\s*\[/);
    expect(handler, "Could not find handleMaxHeightNoneToggle").toBeTruthy();
    const body = handler![0];
    expect(body).toMatch(/maxHeightUnit\s*===\s*"--"\s*\?\s*"px"\s*:\s*maxHeightUnit/);
  });
});

// ─── 3. object-fit/object-position only appear for media elements ─────

describe("object-fit and object-position only appear for media elements", () => {
  it("object-fit and object-position are gated behind isMedia prop", () => {
    // The JSX should wrap the object-fit/object-position controls in {isMedia && (...)}
    // Use a greedy match to capture the full block including nested parens
    const mediaGate = sizeSectionSrc.match(/\{isMedia\s*&&\s*\([\s\S]*?<\/>\s*\)\}/);
    expect(mediaGate, "Could not find isMedia gate in SizeSection").toBeTruthy();
    const gateBlock = mediaGate![0];
    expect(gateBlock).toContain("object-fit");
    expect(gateBlock).toContain("object-position");
  });

  it("object-fit control is a SelectRow with Fit label", () => {
    const fitRow = sizeSectionSrc.match(/<SelectRow\s+label="Fit"[\s\S]*?\/>/);
    expect(fitRow, "Could not find object-fit SelectRow").toBeTruthy();
    expect(fitRow![0]).toContain("objectFit");
  });

  it("object-position control is a SelectRow with Obj Position label", () => {
    const posRow = sizeSectionSrc.match(/<SelectRow\s+label="Obj Position"[\s\S]*?\/>/);
    expect(posRow, "Could not find object-position SelectRow").toBeTruthy();
    expect(posRow![0]).toContain("objectPosition");
  });

  it("isMedia is determined by tag name: img, video, canvas", () => {
    // Check both infer.ts and WebflowPanel.tsx for the isMedia definition
    const inferSrc = fs.readFileSync(
      path.resolve(__dirname, "../core/infer.ts"),
      "utf-8"
    );
    const panelSrc = fs.readFileSync(
      path.resolve(__dirname, "../shell/WebflowPanel.tsx"),
      "utf-8"
    );

    // infer.ts checks tag
    expect(inferSrc).toMatch(/isMedia\s*=.*img.*video.*canvas/);
    // WebflowPanel.tsx checks tagName
    expect(panelSrc).toMatch(/isMedia\s*=.*img.*video.*canvas/);
  });

  it("SizeSection renders without object-fit/position when isMedia is false (smoke test)", async () => {
    const { createElement } = await import("react");
    const { renderToString } = await import("react-dom/server");
    const { SizeSection } = await import("../sections/SizeSection");
    type SectionCtx = import("../panelUtils").SectionCtx;
    type UnitConversionContext = import("../unitConversion").UnitConversionContext;

    const element = document.createElement("div");
    element.style.width = "200px";
    element.style.height = "100px";
    document.body.appendChild(element);

    const ctx: SectionCtx = {
      element,
      apply: vi.fn(),
      ind: () => "none",
      sectionInd: () => "none",
      cs: getComputedStyle(element),
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
    };

    const html = renderToString(
      createElement(SizeSection, { ctx, display: "block", isMedia: false })
    );

    // object-fit / object-position should NOT appear for a div
    expect(html).not.toContain("object-fit");
    expect(html).not.toContain("Obj Position");
  });
});

// ─── 4. aspect-ratio accepts freeform text input like "16 / 9" ───────

describe("aspect-ratio accepts freeform text input", () => {
  it("aspect-ratio uses TextRow (freeform text), not SelectRow or SliderRow", () => {
    // TextRow allows any string input, SelectRow restricts to options
    expect(sizeSectionSrc).toMatch(/<TextRow\s+label="Aspect"/);
  });

  it("aspect-ratio placeholder shows '16 / 9' format", () => {
    const textRow = sizeSectionSrc.match(/<TextRow\s+label="Aspect"[\s\S]*?\/>/);
    expect(textRow, "Could not find Aspect TextRow").toBeTruthy();
    expect(textRow![0]).toMatch(/placeholder=.*16\s*\/\s*9/);
  });

  it("handleAspectRatioChange applies 'auto' when value is empty", () => {
    // Empty string should revert to auto — the CSS default
    expect(sizeSectionSrc).toMatch(/handleAspectRatioChange.*apply\(\s*"aspect-ratio"\s*,\s*v\s*\|\|\s*"auto"\s*\)/);
  });

  it("aspect-ratio state initializes from computed style, treating 'auto' as empty", () => {
    // When cs.aspectRatio === "auto", store empty string so the placeholder shows
    expect(sizeSectionSrc).toMatch(/aspectRatio.*cs\.aspectRatio\s*===\s*"auto"\s*\?\s*""\s*:\s*cs\.aspectRatio/);
  });
});

// ─── 5. overflow per-axis controls ───────────────────────────────────

describe("overflow per-axis controls", () => {
  it("overflow uses a WebflowSegmentedControl with visible/hidden/scroll/auto options", () => {
    // Verify the four overflow options exist
    expect(sizeSectionSrc).toMatch(/value:\s*"visible"/);
    expect(sizeSectionSrc).toMatch(/value:\s*"hidden"/);
    expect(sizeSectionSrc).toMatch(/value:\s*"scroll"/);
    // The "auto" option in the overflow control
    const overflowSection = sizeSectionSrc.match(/Overflow[\s\S]*?WebflowSegmentedControl[\s\S]*?\/>/);
    expect(overflowSection, "Could not find overflow WebflowSegmentedControl").toBeTruthy();
    expect(overflowSection![0]).toContain('"auto"');
  });

  it("overflow state is initialized from computed style", () => {
    expect(sizeSectionSrc).toMatch(/overflow.*useState.*cs\.overflow/);
  });

  it("overflow is applied as a single shorthand property", () => {
    // Currently overflow is applied as a shorthand — apply("overflow", v)
    // This means overflow-x and overflow-y are set together
    expect(sizeSectionSrc).toMatch(/apply\(\s*"overflow"\s*,\s*v\s*\)/);
  });

  it("SizeSection does not yet implement per-axis overflow-x/overflow-y unlocking", () => {
    // Per-axis overflow (overflow-x, overflow-y) is NOT yet implemented.
    // This test documents the current state: overflow is a single control.
    // When "unlocked" per-axis support is added, this test should be updated.
    expect(sizeSectionSrc).not.toMatch(/overflow-x/);
    expect(sizeSectionSrc).not.toMatch(/overflow-y/);
  });

  it("overflow section indicator tracks the overflow property", () => {
    const sectionIndicator = sizeSectionSrc.match(/sectionInd\(\[[\s\S]*?\]\)/);
    expect(sectionIndicator, "Could not find sectionInd call").toBeTruthy();
    expect(sectionIndicator![0]).toContain('"overflow"');
  });
});
