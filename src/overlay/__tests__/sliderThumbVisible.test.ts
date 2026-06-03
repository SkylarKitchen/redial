/**
 * sliderThumbVisible.test.ts — Ensure the slider thumb (knob) is visible.
 *
 * Bug (historical): the Radix Slider Thumb had `bg-transparent border-transparent`,
 * making the draggable knob invisible — track shows but nothing to grab.
 *
 * As of the shadcn migration (2026-06-03) the panel's sliders are native
 * `<input type="range">` (controls/Slider.tsx) and the thumb is styled globally
 * in shell/OverlayStyles.tsx via the `::-webkit-slider-thumb` / `::-moz-range-thumb`
 * pseudo-elements. So the "knob must be visible" guard now reads OverlayStyles and
 * asserts the thumb has a real (non-transparent) background, a visible border, and
 * a non-zero size.
 */

import { readFileSync } from "fs";
import { join } from "path";
import { describe, it, expect } from "vitest";

const overlayStylesPath = join(__dirname, "../shell/OverlayStyles.tsx");
const content = readFileSync(overlayStylesPath, "utf-8");

/**
 * Capture the base (non-:hover/:active) thumb rule body for a given pseudo.
 * Slices from the selector to the next rule — a regex `\{([^}]*)\}` would stop
 * at the `}` inside a `${token}` template interpolation, truncating the body.
 */
function thumbBody(pseudo: "-webkit-slider-thumb" | "-moz-range-thumb"): string {
  const selector = `::${pseudo} {`;
  const start = content.indexOf(selector);
  expect(start, `Could not find base ::${pseudo} rule in OverlayStyles.tsx`).toBeGreaterThanOrEqual(0);
  const next = content.indexOf(".__tuner-root", start + selector.length);
  return content.slice(start + selector.length, next === -1 ? undefined : next);
}

describe("slider thumb visibility", () => {
  it("webkit thumb has a visible (non-transparent) background", () => {
    const body = thumbBody("-webkit-slider-thumb");
    expect(body).toMatch(/background:/);
    expect(body).not.toMatch(/background:\s*(transparent|none)/);
    // The default fill is the primary token, not a transparent value.
    expect(body).toContain("color.primary");
  });

  it("webkit thumb has a visible border", () => {
    const body = thumbBody("-webkit-slider-thumb");
    expect(body).toMatch(/border:/);
    expect(body).not.toMatch(/border:[^;]*transparent/);
  });

  it("webkit thumb has a non-zero size", () => {
    const body = thumbBody("-webkit-slider-thumb");
    expect(body).toMatch(/width:\s*\d/);
    expect(body).toMatch(/height:\s*\d/);
  });

  it("firefox thumb is also styled visibly (cross-browser parity)", () => {
    const body = thumbBody("-moz-range-thumb");
    expect(body).toContain("color.primary");
    expect(body).not.toMatch(/background:\s*(transparent|none)/);
    expect(body).toMatch(/width:\s*\d/);
  });
});
