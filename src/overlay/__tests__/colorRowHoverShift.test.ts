// @vitest-environment happy-dom
/**
 * Test: ColorRow actions must not cause layout shift on hover.
 *
 * Bug: When hovering a color variable row, the duplicate/trash action buttons
 * appear in the normal flow between the label and the swatch. This pushes the
 * color swatch and hex value to the right — an unexpected layout shift that
 * makes it hard to click the swatch to open the color picker.
 *
 * Fix: Action buttons must be positioned absolutely (or overlaid) so they don't
 * shift the swatch or hex value.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const CONTROLS_SRC = readFileSync(join(__dirname, "..", "controls.tsx"), "utf-8");

describe("ColorRow hover actions must not shift layout", () => {
  it("actions container in ColorRow must use absolute or overlay positioning", () => {
    // Find the ColorRow function and locate where {actions} is rendered.
    // The actions container must use position:absolute (or similar overlay)
    // so it doesn't push sibling elements (swatch, hex label) to the right.

    // Extract the ColorRow component source
    const colorRowStart = CONTROLS_SRC.indexOf("export function ColorRow(");
    expect(colorRowStart).toBeGreaterThan(-1);

    // Find the next export function (end of ColorRow)
    const afterStart = CONTROLS_SRC.indexOf("\nexport ", colorRowStart + 1);
    const colorRowSrc = CONTROLS_SRC.slice(colorRowStart, afterStart > -1 ? afterStart : undefined);

    // The {actions} JSX must be wrapped in a container with position: "absolute"
    // to prevent layout shift. Find the block that contains {actions} rendering
    // and verify it uses absolute positioning.
    const hasActions = colorRowSrc.includes("{actions}");
    expect(hasActions, "ColorRow must render {actions}").toBe(true);

    // The actions rendering block should include position: "absolute" nearby.
    // Look for the pattern: a div/container with position:"absolute" that contains {actions}
    const actionsBlockPattern = /position:\s*["']absolute["'][\s\S]{0,400}\{actions\}/;
    const usesAbsolutePositioning = actionsBlockPattern.test(colorRowSrc);

    expect(
      usesAbsolutePositioning,
      "ColorRow: {actions} is rendered in normal flow, causing layout shift on hover. " +
      "Wrap actions in a position:absolute container so the swatch and hex value don't move."
    ).toBe(true);
  });
});
