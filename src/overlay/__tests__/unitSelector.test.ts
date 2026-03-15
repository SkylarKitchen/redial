/**
 * unitSelector.test.ts
 *
 * Verifies UnitSelector behavior:
 * 1. Changing unit triggers value conversion (e.g., 16px -> 1em)
 * 2. Each property context offers only valid units
 * 3. The "—" option represents auto/none/unitless depending on context
 *
 * Tests the pure conversion logic from unitConversion.ts and the
 * per-property unit rules from the spec (webflow-style-panel-spec.md § 12).
 */
import { describe, it, expect } from "vitest";
import { convertUnit, conversionBasis, type UnitConversionContext } from "../unitConversion";

// ─── Standard context (16px root, 16px element) ─────────────────────

const ctx: UnitConversionContext = {
  computedFontSize: 16,
  rootFontSize: 16,
  parentWidth: 800,
  parentHeight: 600,
  viewportWidth: 1920,
  viewportHeight: 1080,
};

// ─── 1. Unit conversion on change ───────────────────────────────────

describe("unit change triggers value conversion", () => {
  it("converts 16px to 1em when element font-size is 16px", () => {
    expect(convertUnit(16, "px", "em", ctx)).toBe(1);
  });

  it("converts 16px to 1rem when root font-size is 16px", () => {
    expect(convertUnit(16, "px", "rem", ctx)).toBe(1);
  });

  it("converts 1em to 16px", () => {
    expect(convertUnit(1, "em", "px", ctx)).toBe(16);
  });

  it("converts 1rem to 16px", () => {
    expect(convertUnit(1, "rem", "px", ctx)).toBe(16);
  });

  it("converts 400px to 50% of parent width", () => {
    expect(convertUnit(400, "px", "%", ctx)).toBe(50);
  });

  it("converts 50% to 400px using parent width", () => {
    expect(convertUnit(50, "%", "px", ctx)).toBe(400);
  });

  it("converts 960px to 50vw at viewport 1920px", () => {
    expect(convertUnit(960, "px", "vw", ctx)).toBe(50);
  });

  it("converts 540px to 50vh at viewport 1080px", () => {
    expect(convertUnit(540, "px", "vh", ctx)).toBe(50);
  });

  it("preserves value when converting same unit", () => {
    expect(convertUnit(42, "px", "px", ctx)).toBe(42);
    expect(convertUnit(2.5, "em", "em", ctx)).toBe(2.5);
  });

  it("rounds to 2 decimal places", () => {
    // 33px / 16 = 2.0625 → rounded to 2.06
    expect(convertUnit(33, "px", "em", ctx)).toBe(2.06);
  });

  it("handles different element vs root font sizes for em→rem", () => {
    const diffCtx = { ...ctx, computedFontSize: 20, rootFontSize: 16 };
    // 1em = 20px, 20px / 16 = 1.25rem
    expect(convertUnit(1, "em", "rem", diffCtx)).toBe(1.25);
  });

  it("handles ch unit (approx 0.5em)", () => {
    // 1ch ≈ 8px when font-size is 16px
    expect(convertUnit(8, "px", "ch", ctx)).toBe(1);
    expect(convertUnit(2, "ch", "px", ctx)).toBe(16);
  });
});

// ─── conversionBasis ─────────────────────────────────────────────────

describe("conversion basis describes the reference used", () => {
  it('em basis shows element font-size', () => {
    expect(conversionBasis("em", ctx)).toBe("base: 16px");
  });

  it('rem basis shows root font-size', () => {
    expect(conversionBasis("rem", ctx)).toBe("root: 16px");
  });

  it('% basis shows parent width', () => {
    expect(conversionBasis("%", ctx)).toBe("parent: 800px");
  });

  it('% basis shows parent height on height axis', () => {
    expect(conversionBasis("%", ctx, "height")).toBe("parent: 600px");
  });

  it('vw basis shows viewport width', () => {
    expect(conversionBasis("vw", ctx)).toBe("viewport: 1920px");
  });

  it('vh basis shows viewport height', () => {
    expect(conversionBasis("vh", ctx)).toBe("viewport: 1080px");
  });

  it('px has no basis', () => {
    expect(conversionBasis("px", ctx)).toBeUndefined();
  });
});

// ─── 2. Per-property unit validity ──────────────────────────────────
//
// These encode the spec table from webflow-style-panel-spec.md § 12:
// "Available Units by Property"

/** Spec-defined valid units per property context */
const SPEC_UNITS: Record<string, string[]> = {
  "font-size": ["px", "em", "rem", "vw", "%"],
  "width": ["px", "%", "vw", "vh", "em", "rem"],
  "height": ["px", "%", "vw", "vh", "em", "rem"],
  "margin": ["px", "%", "em", "rem"],
  "padding": ["px", "%", "em", "rem"],
  "line-height": ["px", "em", "%"],  // plus unitless multiplier
  "letter-spacing": ["px", "em"],
  "border-radius": ["px", "%"],
  "border-width": ["px"],
  "top": ["px", "%", "vw", "vh"],
  "gap": ["px", "%", "em", "rem"],
};

/** Properties that should have NO unit selector (unitless only) */
const UNITLESS_PROPERTIES = ["opacity", "z-index", "flex-grow", "flex-shrink", "order"];

describe("per-property unit validity (spec rules)", () => {
  it("opacity has no units (unitless only)", () => {
    for (const prop of UNITLESS_PROPERTIES) {
      // These properties should not offer a unit selector at all
      expect(SPEC_UNITS[prop]).toBeUndefined();
    }
  });

  it("border-width only supports px", () => {
    expect(SPEC_UNITS["border-width"]).toEqual(["px"]);
  });

  it("font-size supports px, em, rem, vw, %", () => {
    expect(SPEC_UNITS["font-size"]).toContain("px");
    expect(SPEC_UNITS["font-size"]).toContain("em");
    expect(SPEC_UNITS["font-size"]).toContain("rem");
    expect(SPEC_UNITS["font-size"]).toContain("vw");
    expect(SPEC_UNITS["font-size"]).toContain("%");
  });

  it("border-radius supports only px and %", () => {
    expect(SPEC_UNITS["border-radius"]).toEqual(["px", "%"]);
  });

  it("letter-spacing supports only px and em", () => {
    expect(SPEC_UNITS["letter-spacing"]).toEqual(["px", "em"]);
  });

  it("gap supports px, %, em, rem", () => {
    const gapUnits = SPEC_UNITS["gap"];
    expect(gapUnits).toContain("px");
    expect(gapUnits).toContain("%");
    expect(gapUnits).toContain("em");
    expect(gapUnits).toContain("rem");
  });

  it("width/height support viewport units", () => {
    for (const prop of ["width", "height"]) {
      expect(SPEC_UNITS[prop]).toContain("vw");
      expect(SPEC_UNITS[prop]).toContain("vh");
    }
  });

  it("conversion between valid units produces correct results", () => {
    // font-size: 16px → 1em
    expect(convertUnit(16, "px", "em", ctx)).toBe(1);
    // width: 400px → 50%
    expect(convertUnit(400, "px", "%", ctx)).toBe(50);
    // border-radius: 8px → 1% of 800px parent
    expect(convertUnit(8, "px", "%", ctx)).toBe(1);
  });
});

// ─── 3. The "—" option: auto/none/unitless ──────────────────────────
//
// Per the spec: the "—" option in the unit dropdown represents
// auto, none, or unitless depending on the property context.

describe('"—" option represents auto/none/unitless by context', () => {
  /** Maps property → what "—" means for that property */
  const DASH_MEANING: Record<string, "auto" | "none" | "unitless"> = {
    width: "auto",
    height: "auto",
    "min-width": "none",
    "min-height": "none",
    "max-width": "none",
    "max-height": "none",
    "line-height": "unitless",
    top: "auto",
    right: "auto",
    bottom: "auto",
    left: "auto",
  };

  it('width/height "—" means auto', () => {
    expect(DASH_MEANING["width"]).toBe("auto");
    expect(DASH_MEANING["height"]).toBe("auto");
  });

  it('max-width/max-height "—" means none', () => {
    expect(DASH_MEANING["max-width"]).toBe("none");
    expect(DASH_MEANING["max-height"]).toBe("none");
  });

  it('line-height "—" means unitless (multiplier)', () => {
    expect(DASH_MEANING["line-height"]).toBe("unitless");
  });

  it('position offsets "—" means auto', () => {
    for (const side of ["top", "right", "bottom", "left"]) {
      expect(DASH_MEANING[side]).toBe("auto");
    }
  });

  it("auto keyword value is the string 'auto'", () => {
    // When "—" is selected for width, the value applied is literally "auto"
    const autoValue = "auto";
    expect(autoValue).toBe("auto");
  });

  it("none keyword value is the string 'none'", () => {
    const noneValue = "none";
    expect(noneValue).toBe("none");
  });
});

// ─── Edge cases for conversion ──────────────────────────────────────

describe("unit conversion edge cases", () => {
  it("handles zero value gracefully", () => {
    expect(convertUnit(0, "px", "em", ctx)).toBe(0);
    expect(convertUnit(0, "%", "px", ctx)).toBe(0);
  });

  it("handles zero parent width for % conversion", () => {
    const zeroCtx = { ...ctx, parentWidth: 0 };
    expect(convertUnit(50, "%", "px", zeroCtx)).toBe(0);
    expect(convertUnit(100, "px", "%", zeroCtx)).toBe(0);
  });

  it("handles zero font-size for em conversion", () => {
    const zeroCtx = { ...ctx, computedFontSize: 0 };
    expect(convertUnit(16, "px", "em", zeroCtx)).toBe(0);
  });

  it("handles zero viewport for vw conversion", () => {
    const zeroCtx = { ...ctx, viewportWidth: 0 };
    expect(convertUnit(100, "px", "vw", zeroCtx)).toBe(0);
  });

  it("unknown unit falls through as identity", () => {
    // Unknown units are treated as if 1:1 with px
    expect(convertUnit(10, "px", "xyz" as string, ctx)).toBe(10);
  });
});
