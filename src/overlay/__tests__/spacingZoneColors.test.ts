/**
 * spacingZoneColors.test.ts — Verify spacing zone color design tokens.
 *
 * The spacing zone fills must be HUED (Webflow / DevTools box-model style),
 * not grey: margin = warm/orange, padding = green, content = blue. This
 * mirrors the sibling BoxModelOverlay (marginWarmAlpha / greenAlpha /
 * primaryAlpha). Tests verify hue, visibility, distinctness, and that hover
 * states are stronger than base states.
 */

import { describe, it, expect } from "vitest";
import { spacingZone } from "../theme";

/** Extract RGB channels from an rgba() string */
function parseRgba(s: string): { r: number; g: number; b: number; a: number } | null {
  const m = s.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+))?\s*\)/);
  if (!m) return null;
  return { r: +m[1], g: +m[2], b: +m[3], a: m[4] != null ? +m[4] : 1 };
}

const isGrey = (c: { r: number; g: number; b: number }) => c.r === c.g && c.g === c.b;

describe("spacing zone colors", () => {
  it("marginBase should be warm-hued (orange), not grey", () => {
    const c = parseRgba(spacingZone.marginBase);
    expect(c).not.toBeNull();
    if (c) {
      expect(isGrey(c)).toBe(false);
      // Warm/orange: red dominant, blue lowest.
      expect(c.r).toBeGreaterThan(c.g);
      expect(c.g).toBeGreaterThan(c.b);
      expect(c.a).toBeGreaterThan(0);
    }
  });

  it("paddingBase should be green-hued, not grey", () => {
    const c = parseRgba(spacingZone.paddingBase);
    expect(c).not.toBeNull();
    if (c) {
      expect(isGrey(c)).toBe(false);
      // Green: green channel dominant.
      expect(c.g).toBeGreaterThan(c.r);
      expect(c.g).toBeGreaterThan(c.b);
      expect(c.a).toBeGreaterThan(0);
    }
  });

  it("content should be blue-hued, not grey", () => {
    const c = parseRgba(spacingZone.content);
    expect(c).not.toBeNull();
    if (c) {
      expect(isGrey(c)).toBe(false);
      // Blue: blue channel dominant.
      expect(c.b).toBeGreaterThan(c.r);
      expect(c.b).toBeGreaterThan(c.g);
      expect(c.a).toBeGreaterThanOrEqual(0.05);
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

  it("margin and padding base colors should be distinct HUES (not just alpha)", () => {
    const m = parseRgba(spacingZone.marginBase);
    const p = parseRgba(spacingZone.paddingBase);
    expect(m).not.toBeNull();
    expect(p).not.toBeNull();
    if (m && p) {
      // Must differ in actual color channels — distinguishing by alpha alone
      // (the old grey-on-grey behavior) is not enough.
      const channelsDiffer = m.r !== p.r || m.g !== p.g || m.b !== p.b;
      expect(channelsDiffer).toBe(true);
    }
  });
});
