/**
 * spacingZoneColors.test.ts — Verify spacing zone color design tokens.
 *
 * The spacing zone tokens use blackAlpha at varying opacities to distinguish
 * margin, padding, and content zones. Tests verify tokens exist, have
 * reasonable alpha values, and hover states are stronger than base states.
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
  it("marginBase should be a visible fill (not transparent)", () => {
    expect(spacingZone.marginBase).not.toBe("transparent");
    const c = parseRgba(spacingZone.marginBase);
    expect(c).not.toBeNull();
    if (c) {
      expect(c.a).toBeGreaterThan(0);
    }
  });

  it("paddingBase should be a visible fill (not transparent)", () => {
    expect(spacingZone.paddingBase).not.toBe("transparent");
    const c = parseRgba(spacingZone.paddingBase);
    expect(c).not.toBeNull();
    if (c) {
      expect(c.a).toBeGreaterThan(0);
    }
  });

  it("marginHover should have a stronger alpha than marginBase", () => {
    const base = parseRgba(spacingZone.marginBase);
    const hover = parseRgba(spacingZone.marginHover);
    expect(base).not.toBeNull();
    expect(hover).not.toBeNull();
    if (base && hover) {
      expect(hover.a).toBeGreaterThan(base.a);
    }
  });

  it("paddingHover should have a stronger alpha than paddingBase", () => {
    const base = parseRgba(spacingZone.paddingBase);
    const hover = parseRgba(spacingZone.paddingHover);
    expect(base).not.toBeNull();
    expect(hover).not.toBeNull();
    if (base && hover) {
      expect(hover.a).toBeGreaterThan(base.a);
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
    // Hover should be at least 1.5x the base alpha
    if (mBase && mHover) expect(mHover.a).toBeGreaterThanOrEqual(mBase.a * 1.5);
    if (pBase && pHover) expect(pHover.a).toBeGreaterThanOrEqual(pBase.a * 1.5);
  });

  it("content should be a visible darker fill", () => {
    const c = parseRgba(spacingZone.content);
    expect(c).not.toBeNull();
    if (c) {
      // Should have a meaningful alpha (at least 5%)
      expect(c.a).toBeGreaterThanOrEqual(0.05);
    }
  });

  it("margin and padding base colors should be visually distinct", () => {
    const m = parseRgba(spacingZone.marginBase);
    const p = parseRgba(spacingZone.paddingBase);
    expect(m).not.toBeNull();
    expect(p).not.toBeNull();
    if (m && p) {
      // They should differ — either in hue channels or alpha
      const channelsDiffer = m.r !== p.r || m.g !== p.g || m.b !== p.b;
      const alphaDiffers = m.a !== p.a;
      expect(channelsDiffer || alphaDiffers).toBe(true);
    }
  });
});
