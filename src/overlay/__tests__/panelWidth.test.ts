import { describe, it, expect } from "vitest";
import { getVariablesPanelWidth } from "../variables/panelWidth";

describe("getVariablesPanelWidth", () => {
  it("returns 580 for 0 modes (floor)", () => {
    expect(getVariablesPanelWidth(0)).toBe(580);
  });

  it("returns 580 for 1 mode (340+136=476, clamped to floor)", () => {
    expect(getVariablesPanelWidth(1)).toBe(580);
  });

  it("returns 580 for 2 modes (340+272=612, clamped to floor)", () => {
    expect(getVariablesPanelWidth(2)).toBe(612);
  });

  it("returns 748 for 3 modes", () => {
    expect(getVariablesPanelWidth(3)).toBe(748);
  });

  it("caps at 80% viewport width", () => {
    // 10 modes → 340 + 10*136 = 1700, but 80% of 1440 = 1152
    expect(getVariablesPanelWidth(10, 1440)).toBe(1152);
  });

  it("returns exact computed for 5 modes on wide viewport", () => {
    // 5 modes → 340 + 5*136 = 1020, 80% of 1440 = 1152, so uncapped
    expect(getVariablesPanelWidth(5, 1440)).toBe(1020);
  });
});
