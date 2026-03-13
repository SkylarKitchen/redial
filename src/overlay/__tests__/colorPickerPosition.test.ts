// @vitest-environment happy-dom
/**
 * Test: ColorPickerEnhanced must position itself within the visible viewport.
 *
 * Bug: The ColorPickerEnhanced uses `position: fixed` but never computes
 * explicit `top`/`left` values. It relies on its "static position" inherited
 * from a wrapper (`position: absolute; top: 100%`). When the ColorRow is near
 * the bottom of the viewport, the picker (≈290px tall) renders entirely below
 * the visible area — invisible to the user.
 *
 * The wrapper in ColorRow (controls.tsx ~line 814) sets:
 *   { position: "absolute", top: "100%", left: 12, zIndex: 99999 }
 *
 * ColorPickerEnhanced (~line 446) sets:
 *   { position: "fixed" }   ← but NO top/left!
 *
 * Fix requirement: the picker must measure the swatch's viewport position and
 * compute a safe top/left, flipping above the swatch when there isn't enough
 * room below.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

describe("ColorPicker viewport positioning", () => {
  const controlsSrc = readFileSync(
    join(__dirname, "..", "controls.tsx"),
    "utf-8"
  );

  it("ColorRow picker wrapper must NOT use static top:'100%' positioning", () => {
    // The bug: the wrapper uses { top: "100%" } which doesn't account for
    // viewport bounds. When the row is near the bottom, the picker goes off-screen.
    //
    // The fix should remove the static top:"100%" and instead compute position
    // dynamically based on the swatch's getBoundingClientRect() and window.innerHeight.

    // The picker wrapper style has top:"100%" and zIndex:99999.
    // In the source these appear in either order within the same style object.
    const hasStaticTopPercent =
      /top:\s*["']100%["'][\s\S]{0,200}zIndex:\s*99999/.test(controlsSrc) ||
      /zIndex:\s*99999[\s\S]{0,200}top:\s*["']100%["']/.test(controlsSrc);

    expect(
      hasStaticTopPercent,
      'ColorRow picker wrapper should NOT use static top:"100%" — ' +
      "it must compute position dynamically to stay within the viewport"
    ).toBe(false);
  });

  it("ColorRow must use viewport-aware positioning for the picker", () => {
    // The fix should involve measuring the swatch position and computing
    // where the picker should appear. This requires getBoundingClientRect
    // on the swatch ref and checking against window.innerHeight.
    const usesSwatchRect =
      controlsSrc.includes("getBoundingClientRect") &&
      controlsSrc.includes("innerHeight");

    expect(
      usesSwatchRect,
      "ColorRow must use getBoundingClientRect + window.innerHeight to position the picker within the viewport"
    ).toBe(true);
  });
});
