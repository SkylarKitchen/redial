import { describe, it, expect } from "vitest";
import { sectionMatchesQuery, SECTION_PROPERTIES } from "../shell/PropertySearch";

describe("Custom properties in PropertySearch", () => {
  it("SECTION_PROPERTIES includes Custom properties key", () => {
    expect(SECTION_PROPERTIES).toHaveProperty("Custom properties");
  });

  it("matches search for 'custom'", () => {
    expect(sectionMatchesQuery("Custom properties", "custom")).toBe(true);
  });

  it("matches search for 'cursor'", () => {
    expect(sectionMatchesQuery("Custom properties", "cursor")).toBe(true);
  });

  it("does not match unrelated searches", () => {
    expect(sectionMatchesQuery("Custom properties", "font-family")).toBe(false);
  });
});
