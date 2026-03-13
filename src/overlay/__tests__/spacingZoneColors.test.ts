/**
 * spacingZoneColors.test.ts — Verify margin/padding zone colors are NOT orange.
 *
 * Bug: spacingZone.marginBase/marginHover used rgba(255,149,0,...) — an orange
 * tint that clashes with the blue-themed UI and doesn't match the preview overlay.
 * Both margin and padding zones should use cool/neutral tones.
 */

import { describe, it, expect } from "vitest";
import { spacingZone } from "../theme";

/** Extract RGB channels from an rgba() string */
function parseRgba(s: string): { r: number; g: number; b: number; a: number } | null {
  const m = s.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+))?\s*\)/);
  if (!m) return null;
  return { r: +m[1], g: +m[2], b: +m[3], a: m[4] != null ? +m[4] : 1 };
}

/** Returns true if the color is warm/orange (red channel dominates green by >40, blue is low) */
function isOrange(rgba: string): boolean {
  const c = parseRgba(rgba);
  if (!c) return false;
  return c.r > 200 && c.g > 100 && c.g < 200 && c.b < 50;
}

describe("spacing zone colors", () => {
  it("marginBase should not be orange", () => {
    expect(isOrange(spacingZone.marginBase)).toBe(false);
  });

  it("marginHover should not be orange", () => {
    expect(isOrange(spacingZone.marginHover)).toBe(false);
  });

  it("margin and padding zones should use consistent cool tones", () => {
    // Both zones should use cool-spectrum colors (blue/gray), not warm (orange/yellow)
    const marginBase = parseRgba(spacingZone.marginBase);
    const paddingBase = parseRgba(spacingZone.paddingBase);
    expect(marginBase).not.toBeNull();
    expect(paddingBase).not.toBeNull();
    // Red channel should not dominate — ensures no warm tints
    if (marginBase) {
      expect(marginBase.r).toBeLessThanOrEqual(marginBase.b + 80);
    }
  });
});
