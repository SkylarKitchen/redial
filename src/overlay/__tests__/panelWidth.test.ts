import { describe, it, expect } from "vitest";
import { getVariablesPanelWidth } from "../variables/panelWidth";

describe("getVariablesPanelWidth", () => {
  it("returns 580 for 0 modes (floor)", () => {
    expect(getVariablesPanelWidth(0)).toBe(580);
  });

  it("returns 580 for 1 mode (300+106=406, clamped to floor)", () => {
    expect(getVariablesPanelWidth(1)).toBe(580);
  });

  it("returns 580 for 2 modes (300+212=512, clamped to floor)", () => {
    expect(getVariablesPanelWidth(2)).toBe(580);
  });

  it("returns 618 for 3 modes", () => {
    expect(getVariablesPanelWidth(3)).toBe(618);
  });

  it("caps at 80% viewport width", () => {
    // 10 modes → 300 + 10*106 = 1360, but 80% of 1440 = 1152
    expect(getVariablesPanelWidth(10, 1440)).toBe(1152);
  });

  it("returns exact computed for 7 modes when under cap", () => {
    // 7 modes → 300 + 7*106 = 1042
    expect(getVariablesPanelWidth(7)).toBe(1042);
  });
});
