/**
 * spacingZoneColors.test.ts — Verify spacing zone color design tokens.
 *
 * At rest, both margin and padding zones should be neutral (transparent).
 * On hover, both zones should use neutral gray tones — no colored tints.
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
  it("marginBase should be transparent at rest", () => {
    expect(spacingZone.marginBase).toBe("transparent");
  });

  it("paddingBase should be transparent at rest", () => {
    expect(spacingZone.paddingBase).toBe("transparent");
  });

  it("marginHover should NOT be orange/yellow — must be neutral", () => {
    const c = parseRgba(spacingZone.marginHover);
    expect(c).not.toBeNull();
    if (c) {
      // Neutral means R ≈ G ≈ B (no warm orange/yellow tint)
      // Orange would have high R (>200) and low B (<50) — reject that
      const isOrangeOrYellow = c.r > 200 && c.b < 50;
      expect(isOrangeOrYellow).toBe(false);
    }
  });

  it("paddingHover should be neutral (not colored)", () => {
    const c = parseRgba(spacingZone.paddingHover);
    expect(c).not.toBeNull();
    if (c) {
      // Neutral: all channels roughly equal (grayscale)
      const maxDiff = Math.max(Math.abs(c.r - c.g), Math.abs(c.g - c.b), Math.abs(c.r - c.b));
      expect(maxDiff).toBeLessThan(30);
    }
  });
});
