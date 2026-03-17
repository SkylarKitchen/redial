import { describe, it, expect } from "vitest";

describe("CustomPropertiesSection", () => {
  it("module exports CustomPropertiesSection component", async () => {
    const mod = await import("../sections/CustomPropertiesSection");
    expect(mod.CustomPropertiesSection).toBeDefined();
    // React.memo wraps in an object with $$typeof and a .type function
    expect(typeof mod.CustomPropertiesSection).toBe("object");
    expect(typeof (mod.CustomPropertiesSection as any).type).toBe("function");
  });
});

describe("getCustomOverrides", () => {
  it("filters out properties covered by structured sections", async () => {
    const { getCustomOverrides } = await import("../sections/CustomPropertiesSection");
    const diffs = [
      { prop: "display", from: "block", to: "flex" },        // Layout — filtered
      { prop: "orphans", from: "2", to: "3" },                // not in any section
      { prop: "color", from: "black", to: "red" },            // Typography — filtered
      { prop: "tab-size", from: "8", to: "4" },               // not in any section
    ];
    const result = getCustomOverrides(diffs);
    expect(result).toHaveLength(2);
    expect(result[0].property).toBe("orphans");
    expect(result[1].property).toBe("tab-size");
  });

  it("excludes state-specific overrides", async () => {
    const { getCustomOverrides } = await import("../sections/CustomPropertiesSection");
    const diffs = [
      { prop: "orphans", from: "2", to: "3", state: "hover" },
      { prop: "tab-size", from: "8", to: "4" },
    ];
    const result = getCustomOverrides(diffs);
    expect(result).toHaveLength(1);
    expect(result[0].property).toBe("tab-size");
  });

  it("returns empty array for empty diffs", async () => {
    const { getCustomOverrides } = await import("../sections/CustomPropertiesSection");
    expect(getCustomOverrides([])).toEqual([]);
  });
});

describe("property filtering", () => {
  it("filters CSS_PROPERTIES by substring match", async () => {
    const { filterProperties } = await import("../sections/CustomPropertiesSection");
    const results = filterProperties("flex");
    expect(results).toContain("flex");
    expect(results).toContain("flex-direction");
    expect(results).not.toContain("color");
  });

  it("returns top 12 results max", async () => {
    const { filterProperties } = await import("../sections/CustomPropertiesSection");
    const results = filterProperties("b");
    expect(results.length).toBeLessThanOrEqual(12);
  });

  it("returns empty array for empty query", async () => {
    const { filterProperties } = await import("../sections/CustomPropertiesSection");
    expect(filterProperties("")).toEqual([]);
  });

  it("prioritizes startsWith over includes", async () => {
    const { filterProperties } = await import("../sections/CustomPropertiesSection");
    const results = filterProperties("border");
    // "border" itself and "border-*" should come before substring matches
    expect(results[0]).toBe("border");
  });

  it("is case-insensitive", async () => {
    const { filterProperties } = await import("../sections/CustomPropertiesSection");
    const lower = filterProperties("flex");
    const upper = filterProperties("FLEX");
    expect(lower).toEqual(upper);
  });
});

describe("isValidProperty", () => {
  it("accepts known CSS properties", async () => {
    const { isValidProperty } = await import("../sections/CustomPropertiesSection");
    expect(isValidProperty("display")).toBe(true);
    expect(isValidProperty("cursor")).toBe(true);
    expect(isValidProperty("flex-direction")).toBe(true);
  });

  it("accepts custom properties (--*)", async () => {
    const { isValidProperty } = await import("../sections/CustomPropertiesSection");
    expect(isValidProperty("--my-color")).toBe(true);
    expect(isValidProperty("--spacing-lg")).toBe(true);
  });

  it("rejects unknown property names", async () => {
    const { isValidProperty } = await import("../sections/CustomPropertiesSection");
    expect(isValidProperty("not-a-real-property")).toBe(false);
    expect(isValidProperty("foo")).toBe(false);
    expect(isValidProperty("asdf")).toBe(false);
  });

  it("treats empty string as neutral (not invalid)", async () => {
    const { isValidProperty } = await import("../sections/CustomPropertiesSection");
    expect(isValidProperty("")).toBe(true);
  });
});
