/**
 * spacingZoneColors.test.ts — Verify spacing zone color design tokens.
 *
 * At rest, both margin and padding zones should be neutral (transparent).
 * Color only appears on hover/interaction — orange for margin, blue for padding.
 * This matches Webflow's actual behavior.
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
    // Margin zone at rest = no visible color (transparent)
    expect(spacingZone.marginBase).toBe("transparent");
  });

  it("paddingBase should be transparent at rest", () => {
    // Padding zone at rest = no visible color (transparent)
    expect(spacingZone.paddingBase).toBe("transparent");
  });

  it("marginHover should be a warm orange tone", () => {
    const c = parseRgba(spacingZone.marginHover);
    expect(c).not.toBeNull();
    if (c) {
      // Orange: high red, low blue
      expect(c.r).toBeGreaterThan(200);
      expect(c.b).toBeLessThan(50);
    }
  });

  it("paddingHover should be a cool blue tone", () => {
    const c = parseRgba(spacingZone.paddingHover);
    expect(c).not.toBeNull();
    if (c) {
      // Blue-ish: primary color with some blue channel
      expect(c.b).toBeGreaterThan(100);
    }
  });
});
