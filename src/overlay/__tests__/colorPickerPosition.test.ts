// @vitest-environment happy-dom
/**
 * Test: ColorPickerEnhanced must render outside the panel DOM tree via a portal.
 *
 * Bug history:
 * 1. Picker used static top:"100%" — went off-screen near bottom of viewport.
 * 2. Picker used position:fixed inside the panel — but the panel has
 *    `backdropFilter: "blur(20px)"` and Motion transforms which create a
 *    new containing block. This makes position:fixed behave like position:absolute
 *    relative to the panel, and the panel's `overflow: hidden` clips the picker.
 *
 * Fix: ColorRow must use createPortal to render the picker outside the panel,
 * directly into document.body, so it escapes the containing block + overflow clip.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import {
  computeColorPickerPosition,
  PICKER_WIDTH,
  PICKER_HEIGHT,
  PICKER_GAP,
} from "../controls/colorPickerPosition";

describe("ColorPicker viewport positioning", () => {
  const controlsSrc = readFileSync(
    join(__dirname, "..", "controls", "ColorRow.tsx"),
    "utf-8"
  );

  it("ColorRow picker wrapper must NOT use static top:'100%' positioning", () => {
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
    const usesSwatchRect =
      controlsSrc.includes("getBoundingClientRect") &&
      controlsSrc.includes("innerHeight");

    expect(
      usesSwatchRect,
      "ColorRow must use getBoundingClientRect + window.innerHeight to position the picker within the viewport"
    ).toBe(true);
  });

  it("ColorRow must use createPortal to escape the panel's overflow:hidden + backdropFilter containing block", () => {
    // The panel container has backdropFilter and Motion transforms which create
    // a new containing block for position:fixed elements. Combined with
    // overflow:hidden, any fixed-position picker rendered inside the panel DOM
    // tree will be clipped. The fix is to portal the picker out to document.body.
    const usesPortal = controlsSrc.includes("createPortal");

    expect(
      usesPortal,
      "ColorRow must use createPortal to render the picker outside the panel DOM — " +
      "backdropFilter + overflow:hidden on the panel clips position:fixed children"
    ).toBe(true);
  });
});

/**
 * Behavioral guard for the containment invariant. Regression: on short viewports
 * the picker used a hardcoded 300px height estimate to clamp `top`, but its real
 * height is ~416px — so a low swatch's flip-above popover escaped the viewport
 * top/bottom (intermittently, depending on scroll). The fix caps the picker to
 * the viewport and clamps with that capped height. These assert the popover is
 * fully on screen for ANY swatch position, on tall and short viewports alike.
 */
describe("computeColorPickerPosition — viewport containment", () => {
  const VIEWPORTS = [
    { width: 1440, height: 900 },
    { width: 1280, height: 600 },
    { width: 1024, height: 560 },
    { width: 1024, height: 430 }, // shorter than the picker's intrinsic height
    { width: 320, height: 800 }, // narrow
  ];
  const gap = PICKER_GAP;

  for (const vp of VIEWPORTS) {
    // Sweep swatch positions across the full height (incl. the bottom edge where
    // flip-above fires) — these were the configurations that escaped.
    const swatchTops = [0, 100, 250, vp.height - 250, vp.height - 60, vp.height - 20];
    for (const swTop of swatchTops) {
      const rect = { top: swTop, bottom: swTop + 20, left: vp.width - 100 };
      it(`stays within ${vp.width}×${vp.height} for swatch.top=${swTop}`, () => {
        const { top, left, maxHeight } = computeColorPickerPosition(rect, vp);
        // Never escapes top or bottom.
        expect(top).toBeGreaterThanOrEqual(gap);
        expect(top + maxHeight).toBeLessThanOrEqual(vp.height - gap + 0.5);
        // Never escapes the left edge.
        expect(left).toBeGreaterThanOrEqual(gap);
        // Height is capped to the viewport (so it can't exceed even when short).
        expect(maxHeight).toBeLessThanOrEqual(vp.height - gap * 2);
        expect(maxHeight).toBeLessThanOrEqual(PICKER_HEIGHT);
      });
    }
  }

  it("opens below the swatch when there is room", () => {
    const rect = { top: 100, bottom: 120, left: 500 };
    const { top } = computeColorPickerPosition(rect, { width: 1440, height: 900 });
    expect(top).toBe(120 + gap); // directly below
  });

  it("flips above when there is no room below", () => {
    const vp = { width: 1440, height: 900 };
    const rect = { top: 800, bottom: 820, left: 500 };
    const { top, maxHeight } = computeColorPickerPosition(rect, vp);
    expect(top + maxHeight).toBeLessThanOrEqual(vp.height - gap + 0.5);
    expect(top).toBeLessThan(rect.top); // placed above the swatch
  });

  it("never positions the picker wider than its clamp leaves room for", () => {
    // On a viewport narrower than the picker, left pins to gap (best effort).
    const { left } = computeColorPickerPosition(
      { top: 10, bottom: 30, left: 50 },
      { width: PICKER_WIDTH - 50, height: 800 }
    );
    expect(left).toBe(gap);
  });
});
