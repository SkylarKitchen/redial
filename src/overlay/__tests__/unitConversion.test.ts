import { describe, it, expect } from "vitest";
import { convertUnit, type UnitConversionContext } from "../unitConversion";

const ctx: UnitConversionContext = {
  computedFontSize: 16,
  rootFontSize: 16,
  parentWidth: 800,
  parentHeight: 600,
  viewportWidth: 1920,
  viewportHeight: 1080,
};

describe("convertUnit", () => {
  it("returns same value for identical units", () => {
    expect(convertUnit(42, "px", "px", ctx)).toBe(42);
  });

  it("converts px to em", () => {
    expect(convertUnit(32, "px", "em", ctx)).toBe(2);
  });

  it("converts em to px", () => {
    expect(convertUnit(2, "em", "px", ctx)).toBe(32);
  });

  it("converts px to rem", () => {
    expect(convertUnit(24, "px", "rem", ctx)).toBe(1.5);
  });

  it("converts rem to px", () => {
    expect(convertUnit(1.5, "rem", "px", ctx)).toBe(24);
  });

  it("converts px to % using parent width", () => {
    expect(convertUnit(400, "px", "%", ctx)).toBe(50);
  });

  it("converts px to % using parent height for height axis", () => {
    expect(convertUnit(300, "px", "%", ctx, "height")).toBe(50);
  });

  it("converts % to px on width axis", () => {
    expect(convertUnit(50, "%", "px", ctx)).toBe(400);
  });

  it("converts % to px on height axis", () => {
    expect(convertUnit(50, "%", "px", ctx, "height")).toBe(300);
  });

  it("converts px to vw", () => {
    expect(convertUnit(960, "px", "vw", ctx)).toBe(50);
  });

  it("converts vw to px", () => {
    expect(convertUnit(50, "vw", "px", ctx)).toBe(960);
  });

  it("converts px to vh", () => {
    expect(convertUnit(540, "px", "vh", ctx)).toBe(50);
  });

  it("converts vh to px", () => {
    expect(convertUnit(50, "vh", "px", ctx)).toBe(540);
  });

  it("converts em to rem (pivot through px)", () => {
    // Same base font size so 1em = 1rem
    expect(convertUnit(1, "em", "rem", ctx)).toBe(1);
  });

  it("handles zero parent width for % conversion", () => {
    const zeroCtx = { ...ctx, parentWidth: 0 };
    expect(convertUnit(50, "%", "px", zeroCtx)).toBe(0);
  });

  it("handles zero parent height for % conversion", () => {
    const zeroCtx = { ...ctx, parentHeight: 0 };
    expect(convertUnit(50, "%", "px", zeroCtx, "height")).toBe(0);
  });

  it("handles zero font size for em conversion", () => {
    const zeroCtx = { ...ctx, computedFontSize: 0 };
    expect(convertUnit(100, "px", "em", zeroCtx)).toBe(0);
  });

  it("handles zero viewport width for vw conversion", () => {
    const zeroCtx = { ...ctx, viewportWidth: 0 };
    expect(convertUnit(100, "px", "vw", zeroCtx)).toBe(0);
  });

  it("rounds to 2 decimal places", () => {
    expect(convertUnit(33, "px", "em", ctx)).toBe(2.06);
  });

  it("converts px to ch (approximate 0.5em)", () => {
    // ch ≈ 0.5em, so 1ch ≈ 8px when font-size is 16px
    expect(convertUnit(8, "px", "ch", ctx)).toBe(1);
  });

  it("converts ch to px", () => {
    expect(convertUnit(2, "ch", "px", ctx)).toBe(16);
  });

  it("different font sizes for em vs rem", () => {
    const diffCtx = { ...ctx, computedFontSize: 20, rootFontSize: 16 };
    expect(convertUnit(1, "em", "rem", diffCtx)).toBe(1.25);
  });
});
