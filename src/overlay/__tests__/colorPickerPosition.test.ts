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
