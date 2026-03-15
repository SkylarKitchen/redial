// @vitest-environment happy-dom
/**
 * Test: Color mode toggle must not cause precision drift.
 *
 * Bug: Switching from hex mode triggers applyHexInput on blur, which
 * round-trips HSB → integer RGB → HSB, losing fractional precision.
 * Repeated hex→HSB→hex cycles accumulate drift in the internal state,
 * shifting the canvas handle and emitting slightly different onChange values.
 *
 * Root cause: applyHexInput always reconverts even when the hex hasn't
 * been user-edited — the blur fires just from clicking the mode toggle.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

// ── Duplicate the picker-local conversion functions for direct testing ──

function rgbToHsb(
  r: number,
  g: number,
  b: number,
): { h: number; s: number; b: number } {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d + 6) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  const s = max === 0 ? 0 : d / max;
  return { h, s, b: max };
}

function hsbToRgb(
  h: number,
  s: number,
  brightness: number,
): { r: number; g: number; b: number } {
  const c = brightness * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = brightness - c;
  let r = 0,
    g = 0,
    bl = 0;
  if (h < 60) {
    r = c;
    g = x;
  } else if (h < 120) {
    r = x;
    g = c;
  } else if (h < 180) {
    g = c;
    bl = x;
  } else if (h < 240) {
    g = x;
    bl = c;
  } else if (h < 300) {
    r = x;
    bl = c;
  } else {
    r = c;
    bl = x;
  }
  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((bl + m) * 255),
  };
}

function rgbToHex(r: number, g: number, b: number): string {
  return (
    "#" +
    [r, g, b]
      .map((c) =>
        Math.round(Math.max(0, Math.min(255, c)))
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
  );
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace("#", "");
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

// ── Tests ──

describe("Color mode drift", () => {
  const pickerSrc = readFileSync(
    join(__dirname, "..", "controls", "ColorPickerEnhanced.tsx"),
    "utf-8",
  );

  it("HSB → hex → HSB round-trip introduces measurable drift", () => {
    // This test documents the precision loss from round-tripping
    // through integer RGB. Not a "bug" by itself, but it's the
    // mechanism that makes the applyHexInput guard necessary.
    const testColors = [
      { h: 143, s: 0.47, b: 0.73 },
      { h: 210, s: 0.85, b: 0.90 },
      { h: 37, s: 0.62, b: 0.95 },
      { h: 275, s: 0.33, b: 0.88 },
    ];

    for (const hsb of testColors) {
      const rgb = hsbToRgb(hsb.h, hsb.s, hsb.b);
      const hex = rgbToHex(rgb.r, rgb.g, rgb.b);
      const rgb2 = hexToRgb(hex);
      const hsb2 = rgbToHsb(rgb2.r, rgb2.g, rgb2.b);

      // At least one of these colors should show measurable drift
      // (not all will — some HSB values happen to round-trip cleanly)
      const hDrift = Math.abs(hsb.h - hsb2.h);
      const sDrift = Math.abs(hsb.s - hsb2.s);
      const bDrift = Math.abs(hsb.b - hsb2.b);

      // Each individual drift should be small (< 1 unit in display terms)
      // but the point is it's NOT zero for most colors
      expect(hDrift).toBeLessThan(1); // < 1 degree
      expect(sDrift).toBeLessThan(0.01); // < 1% saturation
      expect(bDrift).toBeLessThan(0.01); // < 1% brightness
    }

    // Verify that drift exists (at least one color drifts)
    let anyDrift = false;
    for (const hsb of testColors) {
      const rgb = hsbToRgb(hsb.h, hsb.s, hsb.b);
      const hex = rgbToHex(rgb.r, rgb.g, rgb.b);
      const rgb2 = hexToRgb(hex);
      const hsb2 = rgbToHsb(rgb2.r, rgb2.g, rgb2.b);
      if (
        Math.abs(hsb.h - hsb2.h) > 1e-10 ||
        Math.abs(hsb.s - hsb2.s) > 1e-10 ||
        Math.abs(hsb.b - hsb2.b) > 1e-10
      ) {
        anyDrift = true;
        break;
      }
    }
    expect(
      anyDrift,
      "At least one HSB→hex→HSB round-trip should show floating-point drift",
    ).toBe(true);
  });

  it("applyHexInput must guard against unchanged hex to prevent mode-switch drift", () => {
    // When the user clicks the mode toggle while in hex mode, the hex
    // input blurs first, calling applyHexInput. If the hex value hasn't
    // been edited (still equals currentHex), applyHexInput should bail
    // out early to avoid the lossy hex→RGB→HSB reconversion.
    //
    // The guard should compare the input value to currentHex and return
    // early if they match.
    const hasUnchangedGuard =
      // Pattern: check hexInput against currentHex before converting
      /applyHexInput[\s\S]*?(?:val|hexInput|input)[\s\S]{0,200}===[\s\S]{0,100}currentHex[\s\S]{0,50}return/.test(
        pickerSrc,
      ) ||
      /applyHexInput[\s\S]*?currentHex[\s\S]{0,200}===[\s\S]{0,100}(?:val|hexInput)[\s\S]{0,50}return/.test(
        pickerSrc,
      );

    expect(
      hasUnchangedGuard,
      "applyHexInput must compare input hex to currentHex and return early " +
        "if unchanged — blurring without editing should not reconvert HSB→hex→HSB",
    ).toBe(true);
  });

  it("multiple hex round-trips must not accumulate visible drift in displayed values", () => {
    // Simulate 10 hex→HSB→hex cycles and verify the displayed integer
    // values (H 0-360, S 0-100, B 0-100) don't drift visibly.
    const start = { h: 217.3, s: 0.6789, b: 0.8412 };

    let h = start.h,
      s = start.s,
      b = start.b;
    const displayedH0 = Math.round(h);
    const displayedS0 = Math.round(s * 100);
    const displayedB0 = Math.round(b * 100);

    for (let i = 0; i < 10; i++) {
      const rgb = hsbToRgb(h, s, b);
      const hex = rgbToHex(rgb.r, rgb.g, rgb.b);
      const rgb2 = hexToRgb(hex);
      const hsb2 = rgbToHsb(rgb2.r, rgb2.g, rgb2.b);
      h = hsb2.h;
      s = hsb2.s;
      b = hsb2.b;
    }

    expect(Math.round(h)).toBe(displayedH0);
    expect(Math.round(s * 100)).toBe(displayedS0);
    expect(Math.round(b * 100)).toBe(displayedB0);
  });
});
