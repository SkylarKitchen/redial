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
