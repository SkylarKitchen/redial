/**
 * spacingZoneColors.test.ts — Verify spacing zone color design tokens.
 *
 * Spec: margin = warm (orange), padding = cool (green), content = solid dark.
 * Both zones should have a visible tint at rest, not transparent.
 */

import { describe, it, expect } from "vitest";
import { spacingZone } from "../theme";

/** Extract RGB channels from an rgba() string */
function parseRgba(s: string): { r: number; g: number; b: number; a: number } | null {
  const m = s.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+))?\s*\)/);
  if (!m) return null;
  return { r: +m[1], g: +m[2], b: +m[3], a: m[4] != null ? +m[4] : 1 };
}

describe("spacing zone colors", () => {
  it("marginBase should have a visible warm tint (not transparent)", () => {
    expect(spacingZone.marginBase).not.toBe("transparent");
    const c = parseRgba(spacingZone.marginBase);
    expect(c).not.toBeNull();
    if (c) {
      // Warm = R channel dominant (R > G and R > B)
      expect(c.r).toBeGreaterThan(c.b);
      expect(c.a).toBeGreaterThan(0);
    }
  });

  it("paddingBase should have a visible cool tint (not transparent)", () => {
    expect(spacingZone.paddingBase).not.toBe("transparent");
    const c = parseRgba(spacingZone.paddingBase);
    expect(c).not.toBeNull();
    if (c) {
      // Cool = G channel dominant (green)
      expect(c.g).toBeGreaterThan(c.r);
      expect(c.a).toBeGreaterThan(0);
    }
  });

  it("marginHover should be a warm (orange/amber) tone", () => {
    const c = parseRgba(spacingZone.marginHover);
    expect(c).not.toBeNull();
    if (c) {
      // Warm = R channel clearly dominant
      expect(c.r).toBeGreaterThan(c.b);
      expect(c.a).toBeGreaterThanOrEqual(0.15);
    }
  });

  it("paddingHover should be a cool (green) tone", () => {
    const c = parseRgba(spacingZone.paddingHover);
    expect(c).not.toBeNull();
    if (c) {
      // Cool = G channel dominant
      expect(c.g).toBeGreaterThan(c.r);
      expect(c.a).toBeGreaterThanOrEqual(0.15);
    }
  });

  it("hover alpha should be noticeably stronger than base alpha", () => {
    const mBase = parseRgba(spacingZone.marginBase);
    const mHover = parseRgba(spacingZone.marginHover);
    const pBase = parseRgba(spacingZone.paddingBase);
    const pHover = parseRgba(spacingZone.paddingHover);
    expect(mBase).not.toBeNull();
    expect(mHover).not.toBeNull();
    expect(pBase).not.toBeNull();
    expect(pHover).not.toBeNull();
    if (mBase && mHover) expect(mHover.a).toBeGreaterThan(mBase.a * 2);
    if (pBase && pHover) expect(pHover.a).toBeGreaterThan(pBase.a * 2);
  });

  it("content should be a solid darker fill", () => {
    const c = parseRgba(spacingZone.content);
    expect(c).not.toBeNull();
    if (c) {
      // Should be black-alpha at ≥10% (noticeably darker than 5%)
      expect(c.a).toBeGreaterThanOrEqual(0.1);
    }
  });

  it("margin and padding base colors should be visually distinct", () => {
    const m = parseRgba(spacingZone.marginBase);
    const p = parseRgba(spacingZone.paddingBase);
    expect(m).not.toBeNull();
    expect(p).not.toBeNull();
    if (m && p) {
      // They should differ in hue — margin warm (R>G) vs padding cool (G>R)
      const marginWarm = m.r > m.g;
      const paddingCool = p.g > p.r;
      expect(marginWarm).toBe(true);
      expect(paddingCool).toBe(true);
    }
  });
});
