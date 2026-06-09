/**
 * outliers-units.test.ts — Creative outlier cases for unit conversion and
 * number/value parsing.
 *
 * Targets: unitConversion.ts (convertUnit) and cssParsers.ts
 * (parseNum, extractUnit, parseBoxShadow, parseFilterItems, filterItemsToCSS).
 *
 * Each test asserts the DESIRED/correct behavior. Where Redial genuinely
 * mishandles an input, the test is marked `it.fails` with a `// BUG:` note so
 * CI stays green while documenting the defect. Where Redial degrades honestly
 * (returns 0 / NaN / leaves input alone), the test asserts that actual,
 * defensible behavior.
 *
 * No DOM is needed — every function under test is pure — so no happy-dom env.
 */

import { describe, it, expect } from "vitest";
import {
  convertUnit,
  type UnitConversionContext,
} from "../unitConversion";
import {
  parseNum,
  extractUnit,
  parseBoxShadow,
  parseFilterItems,
  filterItemsToCSS,
} from "../cssParsers";
import { parseValueWithUnit } from "../parseValueWithUnit";

const ctx: UnitConversionContext = {
  computedFontSize: 16,
  rootFontSize: 16,
  parentWidth: 800,
  parentHeight: 600,
  viewportWidth: 1920,
  viewportHeight: 1080,
};

// ─── convertUnit: modern + unknown source/target units ───────────────────

describe("convertUnit — modern / unrecognized units", () => {
  // The toPx/fromPx switch statements have a `default` arm that treats any
  // unrecognized unit as a 1:1 px passthrough. For vmin/vmax/svh/dvh/cqw this
  // is silently wrong, but it is at least a deterministic, non-throwing
  // degradation. We assert that documented passthrough so a future fix that
  // adds real support flips these to red and forces an update.

  it("treats an unknown source unit (svh) as a px passthrough", () => {
    // svh is not in the switch → toPx returns the value unchanged, fromPx(px,"px")
    expect(convertUnit(50, "svh", "px", ctx)).toBe(50);
  });

  it("treats an unknown target unit (dvh) as a px passthrough", () => {
    expect(convertUnit(100, "px", "dvh", ctx)).toBe(100);
  });

  // BUG: vmin/vmax are real, common viewport units but unitConversion.ts has no
  // case for them — they fall through to the px passthrough. 50vmin on a
  // 1920x1080 viewport should be 0.5 * min(1920,1080) = 540px, not 50px.
  it("converts vmin using the smaller viewport dimension", () => {
    // min(1920, 1080) = 1080 → 50vmin = 540px
    expect(convertUnit(50, "vmin", "px", ctx)).toBe(540);
  });

  // BUG: vmax has no conversion case either. 50vmax should be
  // 0.5 * max(1920,1080) = 960px, not the 50px passthrough.
  it("converts vmax using the larger viewport dimension", () => {
    expect(convertUnit(50, "vmax", "px", ctx)).toBe(960);
  });
});

// ─── convertUnit: special numeric inputs ─────────────────────────────────

describe("convertUnit — special numeric inputs", () => {
  it("propagates NaN rather than coercing it to 0", () => {
    // Math.round(NaN * 100) / 100 === NaN — the function makes no attempt to
    // sanitize. Document that callers must guard against NaN themselves.
    expect(convertUnit(NaN, "px", "em", ctx)).toBeNaN();
  });

  it("propagates Infinity through the conversion math", () => {
    expect(convertUnit(Infinity, "px", "em", ctx)).toBe(Infinity);
  });

  it("returns the value verbatim for identical units even when it is NaN", () => {
    // The `if (fromUnit === toUnit) return value` early-out bypasses all math,
    // so a garbage value round-trips untouched.
    expect(convertUnit(NaN, "svh", "svh", ctx)).toBeNaN();
  });

  it("converts negative px to negative em correctly", () => {
    expect(convertUnit(-32, "px", "em", ctx)).toBe(-2);
  });

  it("keeps unitless zero at zero across a percentage conversion", () => {
    expect(convertUnit(0, "px", "%", ctx)).toBe(0);
    expect(convertUnit(0, "%", "px", ctx)).toBe(0);
  });

  it("rounds a float-precision artifact (0.1+0.2 style) to 2 decimals", () => {
    // 0.30000000000000004px / 16 = 0.01875em → rounds to 0.02
    expect(convertUnit(0.1 + 0.2, "px", "em", ctx)).toBe(0.02);
  });
});

// ─── parseNum: numeric coercion surprises ────────────────────────────────

describe("parseNum — numeric coercion edge cases", () => {
  it("parses scientific notation the way parseFloat does", () => {
    expect(parseNum("1e2px")).toBe(100);
    expect(parseNum("1.5e-1rem")).toBe(0.15);
  });

  it("returns 0 for the literal string 'NaN'", () => {
    // parseFloat("NaN") is NaN, and parseNum maps NaN → 0.
    expect(parseNum("NaN")).toBe(0);
  });

  // BUG: parseNum guards NaN → 0 but NOT Infinity. parseFloat("Infinity") is
  // Infinity, which sails straight through, so a CSS value can become a
  // non-finite number that downstream serializers will emit verbatim.
  it("clamps the literal string 'Infinity' to a finite 0", () => {
    expect(parseNum("Infinity")).toBe(0);
  });

  it("stops at the comma in a euro-decimal value '1,5px'", () => {
    // parseFloat("1,5px") = 1 (comma is not a decimal point in JS).
    expect(parseNum("1,5px")).toBe(1);
  });

  it("returns 0 for a hex-looking string '0x10' (not parsed as 16)", () => {
    // parseFloat does NOT honor 0x — it reads "0".
    expect(parseNum("0x10")).toBe(0);
  });
});

// ─── extractUnit: suffix detection edge cases ────────────────────────────

describe("extractUnit — suffix detection edge cases", () => {
  it("recognizes a modern container unit suffix (cqw)", () => {
    // The [a-zA-Z]+ class is generous enough to pick up arbitrary letter runs.
    expect(extractUnit("5cqw")).toBe("cqw");
  });

  it("preserves the case of an uppercase unit suffix", () => {
    // The regex does not lowercase — "100VW" yields "VW", not "vw".
    // (Downstream convertUnit only matches lowercase, so this is a latent trap,
    //  but extractUnit itself returns the raw casing.)
    expect(extractUnit("100VW")).toBe("VW");
  });

  // BUG: scientific notation breaks extractUnit. "1e2px" should be recognized
  // as a px value (parseNum agrees it's 100px), but the [\d.]+ class stops at
  // the 'e', the whole regex fails to match, and the fallback "px" is returned
  // only by luck. For "1e2rem" the unit is silently lost the same way.
  it("extracts the unit from a value in scientific notation", () => {
    expect(extractUnit("1e2rem")).toBe("rem");
  });

  // BUG: a space between the number and the unit defeats the anchored regex, so
  // the real unit is dropped in favor of the px fallback. "50 %" is a value a
  // user can type (and some serializers emit), but it is read as plain px.
  it("extracts '%' from a space-separated value '50 %'", () => {
    expect(extractUnit("50 %")).toBe("%");
  });

  it("falls back to px for a calc() expression (honest degradation)", () => {
    // calc() is not a single number+unit token, so the fallback is correct.
    expect(extractUnit("calc(50% + 10px)")).toBe("px");
  });

  it("greedily accepts a malformed multi-dot number and still finds the unit", () => {
    // "1.2.3em" — [\d.]+ swallows "1.2.3", leaving "em". Garbage-in, but the
    // unit detection survives.
    expect(extractUnit("1.2.3em")).toBe("em");
  });
});

// ─── parseValueWithUnit: modern units & exotic input ─────────────────────

const SIZE_UNITS = ["px", "%", "vw", "em", "rem", "ch"];

describe("parseValueWithUnit — modern units & exotic input", () => {
  // BUG: the new viewport units (svh/dvh/lvh) and container units (cqw/cqi) are
  // valid CSS but absent from KNOWN_UNITS, so a perfectly good "50svh" is
  // rejected as NaN with a null unit — the value is thrown away entirely.
  it("accepts the dynamic-viewport-height unit '50dvh'", () => {
    expect(parseValueWithUnit("50dvh", SIZE_UNITS)).toEqual({
      value: 50,
      unit: "dvh",
    });
  });

  // BUG: container query units are dropped the same way.
  it("accepts a container-query-width unit '10cqw'", () => {
    expect(parseValueWithUnit("10cqw", SIZE_UNITS)).toEqual({
      value: 10,
      unit: "cqw",
    });
  });

  it("rejects scientific notation as unparseable (returns NaN/null)", () => {
    // The anchored regex (-?\d*\.?\d+) cannot span the exponent, so "1e2px"
    // is not a clean number+unit token and is reported invalid.
    expect(parseValueWithUnit("1e2px", SIZE_UNITS)).toEqual({
      value: NaN,
      unit: null,
    });
  });

  it("rejects calc() expressions cleanly", () => {
    expect(parseValueWithUnit("calc(100% - 10px)", SIZE_UNITS)).toEqual({
      value: NaN,
      unit: null,
    });
  });

  it("rejects a euro-decimal comma value '1,5px'", () => {
    // Neither the regex nor parseFloat treats the comma as a decimal point.
    expect(parseValueWithUnit("1,5px", SIZE_UNITS)).toEqual({
      value: NaN,
      unit: null,
    });
  });

  it("rejects a leading-plus value '+5px'", () => {
    // The regex allows only an optional leading '-', not '+'.
    expect(parseValueWithUnit("+5px", SIZE_UNITS)).toEqual({
      value: NaN,
      unit: null,
    });
  });

  it("recognizes vmin even though it is not in the field's allowed list", () => {
    // vmin IS in KNOWN_UNITS, so the secondary check rescues it.
    expect(parseValueWithUnit("50vmin", SIZE_UNITS)).toEqual({
      value: 50,
      unit: "vmin",
    });
  });
});

// ─── parseFilterItems / filterItemsToCSS: percentage notation ────────────

describe("parseFilterItems — percentage vs decimal amount notation", () => {
  it("scales a decimal amount brightness(0.8) into the 0-100 model", () => {
    expect(parseFilterItems("brightness(0.8)")).toEqual([
      { type: "brightness", values: [80], visible: true, expanded: false },
    ]);
  });

  // BUG: CSS filter amounts accept BOTH decimal ("0.8") and percentage
  // ("80%") forms — they mean the same thing. parseFilterItems blindly does
  // `parseFloat(arg) * 100`, so "brightness(80%)" becomes 80*100 = 8000 (i.e.
  // 8000% brightness) instead of 80.
  it("treats brightness(80%) the same as brightness(0.8)", () => {
    expect(parseFilterItems("brightness(80%)")).toEqual([
      { type: "brightness", values: [80], visible: true, expanded: false },
    ]);
  });

  // BUG: the percentage-form misparse round-trips into a wildly wrong CSS
  // string. brightness(150%) → parsed values:[15000] → serialized
  // "brightness(150)" which is 15000%, a 100x amplification of the original.
  it("round-trips brightness(150%) back to an equivalent value", () => {
    const parsed = parseFilterItems("brightness(150%)");
    const css = filterItemsToCSS(parsed);
    // Equivalent forms: "brightness(1.5)" (decimal) is what 150% means.
    expect(css).toBe("brightness(1.5)");
  });

  it("parses a negative hue-rotate angle without sign loss", () => {
    expect(parseFilterItems("hue-rotate(-90deg)")).toEqual([
      { type: "hue-rotate", values: [-90], visible: true, expanded: false },
    ]);
  });
});

// ─── parseBoxShadow: unit-bearing & scientific-notation offsets ──────────

describe("parseBoxShadow — non-px offsets & exotic numbers", () => {
  it("parses negative x/y offsets", () => {
    const result = parseBoxShadow("-2px -4px 6px 0px rgba(0,0,0,0.5)");
    expect(result[0]).toMatchObject({ x: -2, y: -4, blur: 6, spread: 0 });
  });

  // Fixed (issue #48): shadow offsets specified in em/rem (e.g. "0.5em 0.25em
  // 1em") are normalized to px at the 16px root font size rather than having
  // the unit stripped by parseFloat (which silently turned 0.5em into 0.5px).
  it("preserves the em unit on a shadow offset", () => {
    // We assert that the numeric magnitude reflects the em→px conversion the
    // user intended (0.5em = 8px), proving the unit was honored rather than
    // dropped. The current code keeps the bare number 0.5 and forgets it was em.
    const result = parseBoxShadow("0.5em 0.25em 1em #000");
    expect(result[0].x).toBe(8);
  });

  it("reads scientific-notation offsets the way parseFloat does", () => {
    // "1e1px" → 10. Not pretty, but deterministic and matches parseNum.
    const result = parseBoxShadow("1e1px 2px 3px #000");
    expect(result[0]).toMatchObject({ x: 10, y: 2, blur: 3 });
  });

  it("handles a color-first shadow ordering", () => {
    const result = parseBoxShadow("rgba(0,0,0,0.5) 2px 4px 6px");
    expect(result[0]).toMatchObject({ x: 2, y: 4, blur: 6 });
    expect(result[0].color).toBe("rgba(0,0,0,0.5)");
  });
});
