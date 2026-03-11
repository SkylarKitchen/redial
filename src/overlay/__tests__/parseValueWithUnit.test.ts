import { describe, it, expect } from "vitest";
import { parseValueWithUnit } from "../parseValueWithUnit";

const SIZE_UNITS = ["px", "%", "vw", "em", "rem", "ch"];

describe("parseValueWithUnit", () => {
  it("parses a plain number with no unit", () => {
    expect(parseValueWithUnit("68", SIZE_UNITS)).toEqual({ value: 68, unit: null });
  });

  it("parses number + unit with no space", () => {
    expect(parseValueWithUnit("68em", SIZE_UNITS)).toEqual({ value: 68, unit: "em" });
  });

  it("parses number + unit with space", () => {
    expect(parseValueWithUnit("68 em", SIZE_UNITS)).toEqual({ value: 68, unit: "em" });
  });

  it("parses percentage", () => {
    expect(parseValueWithUnit("50%", SIZE_UNITS)).toEqual({ value: 50, unit: "%" });
  });

  it("parses rem", () => {
    expect(parseValueWithUnit("1.5rem", SIZE_UNITS)).toEqual({ value: 1.5, unit: "rem" });
  });

  it("parses px", () => {
    expect(parseValueWithUnit("200px", SIZE_UNITS)).toEqual({ value: 200, unit: "px" });
  });

  it("parses vw", () => {
    expect(parseValueWithUnit("100vw", SIZE_UNITS)).toEqual({ value: 100, unit: "vw" });
  });

  it("parses decimal without leading digit", () => {
    expect(parseValueWithUnit(".5em", SIZE_UNITS)).toEqual({ value: 0.5, unit: "em" });
  });

  it("parses negative values", () => {
    expect(parseValueWithUnit("-10px", SIZE_UNITS)).toEqual({ value: -10, unit: "px" });
  });

  it("handles unit not in allowed list but known CSS unit", () => {
    expect(parseValueWithUnit("50vh", SIZE_UNITS)).toEqual({ value: 50, unit: "vh" });
  });

  it("returns NaN for empty string", () => {
    expect(parseValueWithUnit("", SIZE_UNITS)).toEqual({ value: NaN, unit: null });
  });

  it("returns NaN for garbage input", () => {
    expect(parseValueWithUnit("abc", SIZE_UNITS)).toEqual({ value: NaN, unit: null });
  });

  it("is case insensitive for units", () => {
    expect(parseValueWithUnit("16PX", SIZE_UNITS)).toEqual({ value: 16, unit: "px" });
    expect(parseValueWithUnit("2EM", SIZE_UNITS)).toEqual({ value: 2, unit: "em" });
  });

  it("handles whitespace around input", () => {
    expect(parseValueWithUnit("  68em  ", SIZE_UNITS)).toEqual({ value: 68, unit: "em" });
  });
});
