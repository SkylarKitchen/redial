/**
 * spacingZoneColors.test.ts — Verify spacing zone color design tokens.
 *
 * Margin zones use warm orange tones, padding zones use cool blue tones.
 * This matches the Webflow convention and our design spec.
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
  it("marginBase should be a warm orange tone", () => {
    const c = parseRgba(spacingZone.marginBase);
    expect(c).not.toBeNull();
    if (c) {
      // Orange: high red, moderate green, low blue
      expect(c.r).toBeGreaterThan(200);
      expect(c.b).toBeLessThan(50);
    }
  });

  it("paddingBase should be a cool blue tone", () => {
    const c = parseRgba(spacingZone.paddingBase);
    expect(c).not.toBeNull();
    if (c) {
      // Blue: high blue channel
      expect(c.b).toBeGreaterThan(200);
    }
  });

  it("margin and padding zones should be visually distinct", () => {
    const margin = parseRgba(spacingZone.marginBase);
    const padding = parseRgba(spacingZone.paddingBase);
    expect(margin).not.toBeNull();
    expect(padding).not.toBeNull();
    if (margin && padding) {
      // They should have different dominant channels
      expect(margin.r).not.toBe(padding.r);
    }
  });
});
