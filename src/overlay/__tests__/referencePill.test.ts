// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import { formatDisplayName } from "../variables/ReferencePill";

describe("formatDisplayName", () => {
  it("strips -- prefix from variable name", () => {
    expect(formatDisplayName("--gray-050")).toBe("gray-050");
  });

  it("returns name as-is if no -- prefix", () => {
    expect(formatDisplayName("gray-050")).toBe("gray-050");
  });

  it("handles empty string", () => {
    expect(formatDisplayName("")).toBe("");
  });
});
