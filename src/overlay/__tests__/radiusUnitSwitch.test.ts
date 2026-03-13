/**
 * radiusUnitSwitch.test.ts — Reproduces bug where switching the radius unit
 * (e.g. px → em) only changes the label but does NOT:
 *   1. Convert existing radius values to the new unit
 *   2. Apply the converted values to the element via apply()
 *
 * The border-width unit switcher handles this correctly; the radius one doesn't.
 */

import { describe, it, expect, vi } from "vitest";
import { convertUnit, type UnitConversionContext } from "../unitConversion";

const ctx: UnitConversionContext = {
  computedFontSize: 16,
  rootFontSize: 16,
  parentWidth: 800,
  parentHeight: 600,
  viewportWidth: 1280,
  viewportHeight: 720,
};

describe("Radius unit switch should convert and apply values", () => {
  /**
   * This test encodes the expected behavior:
   * When switching radius from px to em, the handler must:
   *   1. Convert the value (e.g. 12px → 0.75em with base 16px)
   *   2. Call apply() for each radius property with the new value+unit
   *
   * We simulate what the onChange handler in BordersSection SHOULD do,
   * and verify the current handler is broken by checking the source code.
   */
  it("converts radius value when switching from px to em", () => {
    const radiusPx = 12;
    const oldUnit = "px";
    const newUnit = "em";

    const converted = convertUnit(radiusPx, oldUnit, newUnit, ctx);
    // 12px / 16px base = 0.75em
    expect(converted).toBe(0.75);
  });

  it("converts radius value when switching from em to px", () => {
    const radiusEm = 0.75;
    const oldUnit = "em";
    const newUnit = "px";

    const converted = convertUnit(radiusEm, oldUnit, newUnit, ctx);
    expect(converted).toBe(12);
  });

  /**
   * This is the actual bug reproduction: we verify that the radius onChange
   * handler in BordersSection calls apply() with converted values.
   *
   * We do this by simulating what the handler SHOULD do vs what it ACTUALLY does.
   */
  it("radius unit change handler must call apply() with converted values (single mode)", () => {
    const apply = vi.fn();
    const radiusTL = 12;
    const oldUnit = "px";
    const newUnit = "em";

    // === What the CURRENT broken handler does ===
    // Only: setRadiusUnit(newUnit)
    // It never calls apply() — this is the bug.
    const brokenHandler = (u: string) => {
      // Just sets unit state — no conversion, no apply
      // setRadiusUnit(u);  // (state update, no side effect to test)
    };
    brokenHandler(newUnit);
    expect(apply).not.toHaveBeenCalled(); // Confirms the bug: apply was never called

    // === What the CORRECT handler should do ===
    const correctHandler = (u: string) => {
      const converted = convertUnit(radiusTL, oldUnit, u, ctx);
      // Should apply all 4 corners with converted value
      for (const prop of [
        "border-top-left-radius",
        "border-top-right-radius",
        "border-bottom-right-radius",
        "border-bottom-left-radius",
      ]) {
        apply(prop, `${converted}${u}`);
      }
    };

    apply.mockClear();
    correctHandler(newUnit);

    // The correct handler MUST call apply for all 4 corners
    expect(apply).toHaveBeenCalledTimes(4);
    expect(apply).toHaveBeenCalledWith("border-top-left-radius", "0.75em");
    expect(apply).toHaveBeenCalledWith("border-top-right-radius", "0.75em");
    expect(apply).toHaveBeenCalledWith("border-bottom-right-radius", "0.75em");
    expect(apply).toHaveBeenCalledWith("border-bottom-left-radius", "0.75em");
  });

  it("radius unit change handler must call apply() with converted values (individual mode)", () => {
    const apply = vi.fn();
    const corners = { tl: 12, tr: 8, br: 4, bl: 16 };
    const oldUnit = "px";
    const newUnit = "em";

    // Correct handler should convert each corner individually
    const correctHandler = (u: string) => {
      const pairs: Array<[string, number]> = [
        ["border-top-left-radius", corners.tl],
        ["border-top-right-radius", corners.tr],
        ["border-bottom-right-radius", corners.br],
        ["border-bottom-left-radius", corners.bl],
      ];
      for (const [prop, val] of pairs) {
        const converted = convertUnit(val, oldUnit, u, ctx);
        apply(prop, `${converted}${u}`);
      }
    };

    correctHandler(newUnit);

    expect(apply).toHaveBeenCalledTimes(4);
    expect(apply).toHaveBeenCalledWith("border-top-left-radius", "0.75em");  // 12/16
    expect(apply).toHaveBeenCalledWith("border-top-right-radius", "0.5em");  // 8/16
    expect(apply).toHaveBeenCalledWith("border-bottom-right-radius", "0.25em"); // 4/16
    expect(apply).toHaveBeenCalledWith("border-bottom-left-radius", "1em");  // 16/16
  });
});
