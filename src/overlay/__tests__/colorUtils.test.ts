import { describe, it, expect } from "vitest";
import {
  cssColorToHex,
  rgbToHex,
  hexToRgb,
  isValidHex,
  hexToRgba,
  relativeLuminance,
  contrastRatio,
  wcagAssessment,
} from "../colorUtils";

describe("cssColorToHex", () => {
  it("converts rgb() to hex", () => {
    expect(cssColorToHex("rgb(255, 0, 0)")).toBe("#ff0000");
  });

  it("converts rgba() to hex (ignoring alpha)", () => {
    expect(cssColorToHex("rgba(0, 128, 255, 0.5)")).toBe("#0080ff");
  });

  it("returns 'transparent' for rgba(0,0,0,0)", () => {
    expect(cssColorToHex("rgba(0, 0, 0, 0)")).toBe("transparent");
  });

  it("returns 'transparent' for the transparent keyword", () => {
    expect(cssColorToHex("transparent")).toBe("transparent");
  });

  it("returns input unchanged for non-rgb strings", () => {
    expect(cssColorToHex("#ff0000")).toBe("#ff0000");
    expect(cssColorToHex("red")).toBe("red");
  });

  it("converts black", () => {
    expect(cssColorToHex("rgb(0, 0, 0)")).toBe("#000000");
  });

  it("converts white", () => {
    expect(cssColorToHex("rgb(255, 255, 255)")).toBe("#ffffff");
  });
});

describe("rgbToHex", () => {
  it("converts pure red", () => {
    expect(rgbToHex(255, 0, 0)).toBe("#ff0000");
  });

  it("converts black", () => {
    expect(rgbToHex(0, 0, 0)).toBe("#000000");
  });

  it("converts white", () => {
    expect(rgbToHex(255, 255, 255)).toBe("#ffffff");
  });

  it("clamps values above 255", () => {
    expect(rgbToHex(300, 0, 0)).toBe("#ff0000");
  });

  it("clamps values below 0", () => {
    expect(rgbToHex(-10, 0, 0)).toBe("#000000");
  });

  it("rounds fractional values", () => {
    expect(rgbToHex(127.6, 0, 0)).toBe("#800000");
  });
});

describe("hexToRgb", () => {
  it("parses pure red", () => {
    expect(hexToRgb("#ff0000")).toEqual({ r: 255, g: 0, b: 0 });
  });

  it("parses black", () => {
    expect(hexToRgb("#000000")).toEqual({ r: 0, g: 0, b: 0 });
  });

  it("parses white", () => {
    expect(hexToRgb("#ffffff")).toEqual({ r: 255, g: 255, b: 255 });
  });

  it("strips leading #", () => {
    expect(hexToRgb("ff0000")).toEqual({ r: 255, g: 0, b: 0 });
  });

  it("parses mid-range color", () => {
    expect(hexToRgb("#0080ff")).toEqual({ r: 0, g: 128, b: 255 });
  });
});

describe("isValidHex", () => {
  it("accepts valid 6-digit hex with #", () => {
    expect(isValidHex("#ff0000")).toBe(true);
    expect(isValidHex("#AABBCC")).toBe(true);
  });

  it("rejects without # prefix", () => {
    expect(isValidHex("ff0000")).toBe(false);
  });

  it("rejects 3-digit shorthand", () => {
    expect(isValidHex("#f00")).toBe(false);
  });

  it("rejects invalid hex chars", () => {
    expect(isValidHex("#gggggg")).toBe(false);
  });

  it("rejects 8-digit hex (with alpha)", () => {
    expect(isValidHex("#ff0000ff")).toBe(false);
  });
});

describe("hexToRgba", () => {
  it("converts hex + full opacity", () => {
    expect(hexToRgba("#ff0000", 1)).toBe("rgba(255, 0, 0, 1)");
  });

  it("converts hex + partial opacity", () => {
    expect(hexToRgba("#ff0000", 0.5)).toBe("rgba(255, 0, 0, 0.5)");
  });

  it("converts hex + zero opacity", () => {
    expect(hexToRgba("#000000", 0)).toBe("rgba(0, 0, 0, 0)");
  });
});

describe("relativeLuminance", () => {
  it("white is 1", () => {
    expect(relativeLuminance({ r: 255, g: 255, b: 255 })).toBeCloseTo(1, 5);
  });

  it("black is 0", () => {
    expect(relativeLuminance({ r: 0, g: 0, b: 0 })).toBeCloseTo(0, 5);
  });

  it("mid gray (#808080) is ~0.216", () => {
    expect(relativeLuminance({ r: 128, g: 128, b: 128 })).toBeCloseTo(0.216, 2);
  });

  it("weights green above red above blue", () => {
    const green = relativeLuminance({ r: 0, g: 255, b: 0 });
    const red = relativeLuminance({ r: 255, g: 0, b: 0 });
    const blue = relativeLuminance({ r: 0, g: 0, b: 255 });
    expect(green).toBeGreaterThan(red);
    expect(red).toBeGreaterThan(blue);
  });
});

describe("contrastRatio", () => {
  it("black on white is 21:1", () => {
    expect(
      contrastRatio({ r: 0, g: 0, b: 0 }, { r: 255, g: 255, b: 255 }),
    ).toBeCloseTo(21, 5);
  });

  it("is symmetric (order independent)", () => {
    const a = { r: 0, g: 0, b: 0 };
    const b = { r: 255, g: 255, b: 255 };
    expect(contrastRatio(a, b)).toBeCloseTo(contrastRatio(b, a), 5);
  });

  it("identical colors are 1:1", () => {
    expect(
      contrastRatio({ r: 18, g: 52, b: 86 }, { r: 18, g: 52, b: 86 }),
    ).toBeCloseTo(1, 5);
  });

  it("mid-gray #777 on white is ~4.48 (just above AA normal)", () => {
    expect(
      contrastRatio({ r: 119, g: 119, b: 119 }, { r: 255, g: 255, b: 255 }),
    ).toBeCloseTo(4.48, 1);
  });
});

describe("wcagAssessment", () => {
  it("normal text: 4.5 → AA, 7 → AAA, below 4.5 → fail", () => {
    expect(wcagAssessment(4.5, false)).toBe("AA");
    expect(wcagAssessment(7, false)).toBe("AAA");
    expect(wcagAssessment(4.49, false)).toBe("fail");
  });

  it("large text relaxes thresholds: 3 → AA, 4.5 → AAA, below 3 → fail", () => {
    expect(wcagAssessment(3, true)).toBe("AA");
    expect(wcagAssessment(4.5, true)).toBe("AAA");
    expect(wcagAssessment(2.99, true)).toBe("fail");
  });
});

describe("roundtrip hex → rgb → hex", () => {
  it("preserves #e8764b", () => {
    const { r, g, b } = hexToRgb("#e8764b");
    expect(rgbToHex(r, g, b)).toBe("#e8764b");
  });

  it("preserves #1a2b3c", () => {
    const { r, g, b } = hexToRgb("#1a2b3c");
    expect(rgbToHex(r, g, b)).toBe("#1a2b3c");
  });
});
