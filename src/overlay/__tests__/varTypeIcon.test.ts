// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import { getVarTypeIcon } from "../variables/VarTypeIcon";

describe("getVarTypeIcon", () => {
  it("returns # for number type", () => {
    expect(getVarTypeIcon("number")).toBe("#");
  });

  it("returns ↗ for length type", () => {
    expect(getVarTypeIcon("length")).toBe("↗");
  });

  it("returns ● for color type", () => {
    expect(getVarTypeIcon("color")).toBe("●");
  });

  it("returns Ā for string type with font in name", () => {
    expect(getVarTypeIcon("string", "--font-primary-family")).toBe("Ā");
  });

  it("returns Ā for string type with font keyword", () => {
    expect(getVarTypeIcon("string", "--heading-font")).toBe("Ā");
  });

  it("returns ↗ for generic string type", () => {
    expect(getVarTypeIcon("string")).toBe("↗");
  });
});
