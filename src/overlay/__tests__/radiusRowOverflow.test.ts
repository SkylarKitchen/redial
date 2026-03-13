import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

/**
 * radiusRowOverflow.test.ts
 *
 * The Radius row in BordersSection contains:
 *   label (64px) + mode-icons (~37px) + Slider (flex-1) + composite (ValueInput + UnitSelector)
 *
 * Bug: The composite container (wrapping ValueInput + UnitSelector) has
 * `flexShrink: 0` but no explicit width. The Slider uses `className="flex-1"`
 * but the Slider component's root already has `w-full` (width: 100%).
 * The Slider should use `style={{ flex: 1 }}` (inline) like the working
 * SliderRow in controls.tsx, and the composite needs `minWidth: 0` so
 * flex layout can constrain it.
 *
 * Without these, the row overflows the 300px panel.
 */

const BORDERS_PATH = join(__dirname, "..", "BordersSection.tsx");

describe("Radius row must not overflow the panel", () => {
  it("Slider uses inline style flex:1 (not className flex-1) to avoid conflict with w-full", () => {
    const source = readFileSync(BORDERS_PATH, "utf-8");

    // Find the Radius row Slider (between "Radius row" comment and the composite div).
    // It must use style={{ flex: 1 }} like the working SliderRow, not className="flex-1"
    // which conflicts with the Slider component's built-in w-full class.
    const sliderMatch = source.match(/<Slider[\s\S]*?onPointerUp=\{[^}]*\}\s*\/>/);
    expect(sliderMatch).not.toBeNull();

    const sliderJsx = sliderMatch![0];

    // Must have inline flex: 1 style
    expect(sliderJsx).toMatch(/style\s*=\s*\{\{[^}]*flex\s*:\s*1/);

    // Must NOT use className flex-1 (conflicts with w-full in Slider component)
    expect(sliderJsx).not.toMatch(/className\s*=\s*["'][^"']*flex-1/);
  });

  it("composite input group container has minWidth: 0 to allow flex shrinking", () => {
    const source = readFileSync(BORDERS_PATH, "utf-8");

    // The div wrapping ValueInput + UnitSelector in the Radius row
    // needs minWidth: 0 so the flex algorithm can constrain it properly.
    // Find the composite container (the div right after the Slider).
    const radiusSection = source.match(/Radius row[\s\S]*?Expanded corner/);
    expect(radiusSection).not.toBeNull();

    const section = radiusSection![0];

    // The composite container should not overflow — it needs minWidth: 0
    // to override the default min-width: auto on flex items.
    expect(section).toMatch(/minWidth\s*:\s*0/);
  });
});
