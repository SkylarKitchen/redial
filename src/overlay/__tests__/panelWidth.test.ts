import { describe, it, expect } from "vitest";
import { getVariablesPanelWidth } from "../variables/panelWidth";

describe("getVariablesPanelWidth", () => {
  it("returns 520 for 0 modes (floor)", () => {
    expect(getVariablesPanelWidth(0)).toBe(520);
  });

  it("returns 520 for 1 mode (380+140=520, matches floor)", () => {
    expect(getVariablesPanelWidth(1)).toBe(520);
  });

  it("returns 660 for 2 modes", () => {
    expect(getVariablesPanelWidth(2)).toBe(660);
  });

  it("returns 800 for 3 modes", () => {
    expect(getVariablesPanelWidth(3)).toBe(800);
  });

  it("caps at 80% viewport width", () => {
    // 7 modes → 380 + 7*140 = 1360, but 80% of 1440 = 1152
    expect(getVariablesPanelWidth(7, 1440)).toBe(1152);
  });

  it("falls back to 1440 when window is undefined", () => {
    // 7 modes → 380 + 7*140 = 1360, capped at 80% of 1440 = 1152
    const result = getVariablesPanelWidth(7);
    expect(result).toBe(1152);
  });
});
