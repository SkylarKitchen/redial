import { describe, it, expect } from "vitest";
import { CSS_PROPERTIES } from "../sections/cssPropertyList";

describe("cssPropertyList", () => {
  it("exports a non-empty array of strings", () => {
    expect(Array.isArray(CSS_PROPERTIES)).toBe(true);
    expect(CSS_PROPERTIES.length).toBeGreaterThan(300);
  });

  it("includes common standard properties", () => {
    const common = ["display", "color", "width", "height", "margin", "padding", "font-size", "position", "z-index", "opacity"];
    for (const prop of common) {
      expect(CSS_PROPERTIES).toContain(prop);
    }
  });

  it("includes common webkit prefixed properties", () => {
    expect(CSS_PROPERTIES).toContain("-webkit-text-fill-color");
    expect(CSS_PROPERTIES).toContain("-webkit-text-stroke-color");
  });

  it("is sorted alphabetically", () => {
    const sorted = [...CSS_PROPERTIES].sort((a, b) => a.localeCompare(b));
    expect(CSS_PROPERTIES).toEqual(sorted);
  });

  it("has no duplicates", () => {
    const unique = new Set(CSS_PROPERTIES);
    expect(unique.size).toBe(CSS_PROPERTIES.length);
  });
});
