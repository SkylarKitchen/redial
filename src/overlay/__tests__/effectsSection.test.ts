/**
 * effectsSection.test.ts — Verify the Effects section's key sub-editors
 *
 * Covers:
 * - Opacity slider displays as 0%–100% (not raw 0–1)
 * - Box shadow editor supports inset toggle
 * - Multiple shadows with X/Y/blur/spread/color controls
 * - Transform editor includes translate (X,Y,Z), scale (X,Y), rotate (X,Y,Z), skew (X,Y)
 * - Filter sliders cover all 8 filter types
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const effectsSrc = readFileSync(
  join(__dirname, "../sections/EffectsSection.tsx"),
  "utf-8",
);
const shadowSrc = readFileSync(
  join(__dirname, "../sections/ShadowEditor.tsx"),
  "utf-8",
);
const transformSrc = readFileSync(
  join(__dirname, "../sections/TransformEditor.tsx"),
  "utf-8",
);
const filterSrc = readFileSync(
  join(__dirname, "../sections/FilterSliders.tsx"),
  "utf-8",
);

// ─── Opacity: displayed as 0%–100% ──────────────────────────────────

describe("Opacity slider displays as 0%–100%", () => {
  it("multiplies opacity by 100 for display value", () => {
    // The SliderRow should receive `Math.round(opacity * 100)` as value
    expect(effectsSrc).toMatch(/Math\.round\(opacity\s*\*\s*100\)/);
  });

  it("sets min=0 and max=100 on opacity slider", () => {
    // Look for the SliderRow with label="Opacity" having min={0} max={100}
    const opacitySliderMatch = effectsSrc.match(
      /SliderRow[^>]*label="Opacity"[^>]*/,
    );
    expect(opacitySliderMatch, "Could not find Opacity SliderRow").toBeTruthy();
    const sliderStr = opacitySliderMatch![0];
    expect(sliderStr).toMatch(/min=\{0\}/);
    expect(sliderStr).toMatch(/max=\{100\}/);
  });

  it("displays % unit on opacity slider", () => {
    const opacitySliderMatch = effectsSrc.match(
      /SliderRow[^>]*label="Opacity"[^>]*/,
    );
    expect(opacitySliderMatch).toBeTruthy();
    expect(opacitySliderMatch![0]).toMatch(/unit="%"/);
  });

  it("divides slider value by 100 before applying (handleOpacitySliderChange)", () => {
    // The handler should divide by 100: `v / 100`
    expect(effectsSrc).toMatch(/handleOpacityChange\(v\s*\/\s*100\)/);
  });
});

// ─── Box shadow editor: inset toggle ─────────────────────────────────

describe("Box shadow editor supports inset toggle", () => {
  it("ShadowValue interface has an inset boolean field", () => {
    expect(shadowSrc).toMatch(/inset:\s*boolean/);
  });

  it("renders an Inset toggle button", () => {
    // The ShadowEditor renders a button with text "Inset"
    expect(shadowSrc).toMatch(/>\s*Inset\s*</);
  });

  it("toggle calls updateField('inset') with negated value", () => {
    // onClick handler toggles inset: `updateField("inset")(!shadow.inset)`
    expect(shadowSrc).toMatch(/updateField\("inset"\)\(!shadow\.inset\)/);
  });

  it("inset toggle reflects current state via title attribute", () => {
    // Title shows "Inset (click to toggle)" or "Outset (click to toggle)"
    expect(shadowSrc).toMatch(/title=\{shadow\.inset\s*\?\s*"Inset/);
  });
});

// ─── Multiple shadows with X/Y/blur/spread/color ────────────────────

describe("Multiple shadows with X/Y/blur/spread/color controls", () => {
  it("shadows is an array prop (supports multiple)", () => {
    // ShadowEditorProps takes shadows: ShadowValue[]
    expect(shadowSrc).toMatch(/shadows:\s*ShadowValue\[\]/);
  });

  it("renders each shadow with x, y, blur, spread numeric inputs", () => {
    // Look for NumericInput components for each field
    expect(shadowSrc).toMatch(/label="X"/);
    expect(shadowSrc).toMatch(/label="Y"/);
    expect(shadowSrc).toMatch(/label="Blur"/);
    expect(shadowSrc).toMatch(/label="Spread"/);
  });

  it("has a color swatch button per shadow row", () => {
    // Each row has a color swatch button with title containing "Shadow color"
    expect(shadowSrc).toMatch(/Shadow color/);
  });

  it("default shadow has standard values", () => {
    // DEFAULT_SHADOW should define x, y, blur, spread, color, inset
    const defaultMatch = shadowSrc.match(
      /DEFAULT_SHADOW[^}]*\{([\s\S]*?)\}/,
    );
    expect(defaultMatch, "Could not find DEFAULT_SHADOW").toBeTruthy();
    const body = defaultMatch![1];
    expect(body).toContain("x:");
    expect(body).toContain("y:");
    expect(body).toContain("blur:");
    expect(body).toContain("spread:");
    expect(body).toContain("color:");
    expect(body).toContain("inset:");
  });

  it("has an Add shadow button for appending new shadows", () => {
    expect(shadowSrc).toMatch(/\+\s*Add shadow/);
  });

  it("has a delete button per row", () => {
    expect(shadowSrc).toMatch(/EditorRemoveButton/);
  });

  it("maps over shadows array to render multiple rows", () => {
    expect(shadowSrc).toMatch(/shadows\.map\(/);
  });
});

// ─── Transform editor types ──────────────────────────────────────────

describe("Transform editor includes translate, scale, rotate, skew", () => {
  it("supports all four transform types", () => {
    // TRANSFORM_TYPES array
    expect(transformSrc).toMatch(/"translate"/);
    expect(transformSrc).toMatch(/"scale"/);
    expect(transformSrc).toMatch(/"rotate"/);
    expect(transformSrc).toMatch(/"skew"/);
  });

  it("TransformValue type is a union of translate | scale | rotate | skew", () => {
    expect(transformSrc).toMatch(
      /type:\s*"translate"\s*\|\s*"scale"\s*\|\s*"rotate"\s*\|\s*"skew"/,
    );
  });

  it("translate supports X, Y, Z axes", () => {
    // translate default has z: 0
    const defaults = transformSrc.match(
      /translate:\s*\{([\s\S]*?)\}/,
    );
    expect(defaults).toBeTruthy();
    const body = defaults![1];
    expect(body).toContain("x:");
    expect(body).toContain("y:");
    expect(body).toContain("z:");
  });

  it("Z axis is rendered for types that support it (not skew)", () => {
    // The Z axis input is conditionally rendered: `type !== "skew"`
    expect(transformSrc).toMatch(/type\s*!==\s*"skew"/);
    // Z label and input appear in the conditional block
    expect(transformSrc).toMatch(/label="Z"/);
  });

  it("scale has X and Y axes", () => {
    const defaults = transformSrc.match(
      /scale:\s*\{[^}]*type:\s*"scale"[^}]*\}/,
    );
    expect(defaults).toBeTruthy();
    expect(defaults![0]).toMatch(/x:\s*1/);
    expect(defaults![0]).toMatch(/y:\s*1/);
  });

  it("rotate has X, Y, Z axes in degrees", () => {
    // Rotate type exists in transform types
    expect(transformSrc).toMatch(/"rotate"/);
    // Rotate default has x, y, z fields
    const defaults = transformSrc.match(
      /rotate:\s*\{[^}]*type:\s*"rotate"[^}]*\}/,
    );
    expect(defaults).toBeTruthy();
    expect(defaults![0]).toMatch(/x:\s*0/);
    expect(defaults![0]).toMatch(/y:\s*0/);
    expect(defaults![0]).toMatch(/z:\s*0/);
    // Rotate uses DEG unit via getUnit
    const unitFn = transformSrc.match(/function getUnit[\s\S]*?^}/m);
    expect(unitFn).toBeTruthy();
    expect(unitFn![0]).toContain('"rotate"');
    expect(unitFn![0]).toContain('"DEG"');
  });

  it("skew has X and Y axes in degrees", () => {
    const defaults = transformSrc.match(
      /skew:\s*\{[^}]*type:\s*"skew"[^}]*\}/,
    );
    expect(defaults).toBeTruthy();
    expect(defaults![0]).toMatch(/x:\s*0/);
    expect(defaults![0]).toMatch(/y:\s*0/);
    // skew unit is DEG via getUnit
    const unitFn = transformSrc.match(/function getUnit[\s\S]*?^}/m);
    expect(unitFn).toBeTruthy();
    expect(unitFn![0]).toContain('"skew"');
    expect(unitFn![0]).toContain('"DEG"');
  });

  it("each transform type has defined min/max/step ranges", () => {
    // TRANSFORM_RANGES should have entries for all four types
    expect(transformSrc).toMatch(/TRANSFORM_RANGES.*translate/s);
    expect(transformSrc).toMatch(/TRANSFORM_RANGES.*scale/s);
    expect(transformSrc).toMatch(/TRANSFORM_RANGES.*rotate/s);
    expect(transformSrc).toMatch(/TRANSFORM_RANGES.*skew/s);
  });
});

// ─── FilterEditor — Webflow-style filter list ───────────────────────

describe("FilterEditor — Webflow-style filter list", () => {
  it("exports FilterItem interface with type, values, color, visible, expanded", () => {
    expect(filterSrc).toMatch(/export interface FilterItem/);
    expect(filterSrc).toMatch(/type:\s*FilterType/);
    expect(filterSrc).toMatch(/values:\s*number\[\]/);
    expect(filterSrc).toMatch(/color\?:\s*string/);
    expect(filterSrc).toMatch(/visible:\s*boolean/);
    expect(filterSrc).toMatch(/expanded:\s*boolean/);
  });

  it("exports FilterType union with all 9 types including drop-shadow", () => {
    expect(filterSrc).toMatch(/export type FilterType/);
    expect(filterSrc).toMatch(/"blur"/);
    expect(filterSrc).toMatch(/"drop-shadow"/);
    expect(filterSrc).toMatch(/"brightness"/);
    expect(filterSrc).toMatch(/"contrast"/);
    expect(filterSrc).toMatch(/"hue-rotate"/);
    expect(filterSrc).toMatch(/"saturate"/);
    expect(filterSrc).toMatch(/"grayscale"/);
    expect(filterSrc).toMatch(/"invert"/);
    expect(filterSrc).toMatch(/"sepia"/);
  });

  it("defines FILTER_CATEGORIES with 3 groups: General, Color Adjustments, Color Effects", () => {
    expect(filterSrc).toMatch(/FILTER_CATEGORIES/);
    expect(filterSrc).toMatch(/General/);
    expect(filterSrc).toMatch(/Color Adjustments/);
    expect(filterSrc).toMatch(/Color Effects/);
  });

  it("renders collapsed summary rows with type:value format", () => {
    expect(filterSrc).toMatch(/formatFilterSummary|summaryText|summary/i);
  });

  it("uses useDragReorder for reordering filter items", () => {
    expect(filterSrc).toMatch(/useDragReorder/);
  });

  it("renders DragHandle, VisibilityToggle, and EditorRemoveButton per item", () => {
    expect(filterSrc).toMatch(/DragHandle/);
    expect(filterSrc).toMatch(/VisibilityToggle/);
    expect(filterSrc).toMatch(/EditorRemoveButton/);
  });

  it("accepts items: FilterItem[] and onChange: (items: FilterItem[]) => void", () => {
    expect(filterSrc).toMatch(/items:\s*FilterItem\[\]/);
    expect(filterSrc).toMatch(/onChange:\s*\(items:\s*FilterItem\[\]\)\s*=>\s*void/);
  });
});
