import { describe, it, expect } from "vitest";
import { cssColorToHex, rgbToHex, hexToRgb, isValidHex, hexToRgba } from "../colorUtils";

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
