import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

/**
 * radiusRowOverflow.test.ts
 *
 * The Radius row in BordersSection contains:
 *   label (64px) + mode-icons (~37px) + Slider (flex-1) + composite (ValueInput + UnitSelector)
 *
 * Bug: The composite container has no explicit width — its size is determined by
 * the <input> element's intrinsic preferred width (~150-200px per the HTML spec
 * default `size` attribute). This squeezes the Slider to near-zero and makes the
 * input visually overflow the row.
 *
 * Fix: The ValueInput inside the composite must have `width: 0` (or equivalent)
 * so that `flex: 1` + `minWidth: 40` controls its sizing, rather than the browser's
 * intrinsic input width. This ensures the composite stays ~72px, leaving room for
 * the Slider.
 */

const CONTROLS_PATH = join(__dirname, "..", "controls.tsx");

describe("ValueInput must not rely on intrinsic input width in flex containers", () => {
  it("ValueInput <input> sets width: 0 to prevent intrinsic sizing from dominating flex layout", () => {
    const source = readFileSync(CONTROLS_PATH, "utf-8");

    // Find the ValueInput's <input> style block.
    // The style object must include `width: 0` to override the input element's
    // default intrinsic width (~150-200px) which otherwise causes the parent
    // flex container to bloat when auto-sized.
    const inputStyleMatch = source.match(
      /function ValueInput[\s\S]*?<input[\s\S]*?style\s*=\s*\{\{([\s\S]*?)\}\}/
    );

    expect(inputStyleMatch).not.toBeNull();
    const styleContent = inputStyleMatch![1];

    // The input must have `width: 0` to collapse its intrinsic size
    // so that `flex: 1` + `minWidth: 40` control the actual width.
    expect(styleContent).toMatch(/\bwidth\s*:\s*0\b/);
  });
});
