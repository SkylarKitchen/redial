import { describe, it, expect } from "vitest";
import { getVariablesPanelWidth } from "../variables/panelWidth";

describe("getVariablesPanelWidth", () => {
  it("returns 580 for 0 modes (floor)", () => {
    expect(getVariablesPanelWidth(0)).toBe(580);
  });

  it("returns 580 for 1 mode (340+110=450, clamped to floor)", () => {
    expect(getVariablesPanelWidth(1)).toBe(580);
  });

  it("returns 580 for 2 modes (340+220=560, clamped to floor)", () => {
    expect(getVariablesPanelWidth(2)).toBe(580);
  });

  it("returns 670 for 3 modes", () => {
    expect(getVariablesPanelWidth(3)).toBe(670);
  });

  it("caps at 80% viewport width", () => {
    // 10 modes → 340 + 10*110 = 1440, but 80% of 1440 = 1152
    expect(getVariablesPanelWidth(10, 1440)).toBe(1152);
  });

  it("returns exact computed for 7 modes when under cap", () => {
    // 7 modes → 340 + 7*110 = 1110
    expect(getVariablesPanelWidth(7)).toBe(1110);
  });
});
