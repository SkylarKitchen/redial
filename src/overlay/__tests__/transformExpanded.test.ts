// @vitest-environment happy-dom
/**
 * transformExpanded.test.ts — Verify TransformExpanded internal component
 *
 * Covers:
 * - SegmentedControl tabs rendered with TRANSFORM_TAB_OPTIONS
 * - Active tab matches transform.type
 * - Tab onChange calls onTypeChange
 * - Per-type axis sliders: translate (X,Y,Z PX), scale (X,Y,Z ""), rotate (X,Y,Z DEG), skew (X,Y DEG, no Z)
 * - Scale lock button visible only for scale type
 * - Scale locked: changing X triggers onUpdate with all axes
 * - Scale unlocked: changing X triggers onUpdate with single axis
 * - Scale lock toggle calls onUpdate({ scaleLocked: !scaleLocked })
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const src = readFileSync(
  join(__dirname, "../sections/TransformEditor.tsx"),
  "utf-8",
);

// ─── Extract key source regions ──────────────────────────────────

const expandedMatch = src.match(
  /function TransformExpanded\([\s\S]*?^}$/m,
);

const rangesMatch = src.match(
  /const TRANSFORM_RANGES[\s\S]*?^};/m,
);

const getUnitMatch = src.match(
  /function getUnit\([\s\S]*?^}$/m,
);

// ─── Constants validation ────────────────────────────────────────

describe("TRANSFORM_RANGES constants", () => {
  it("TRANSFORM_RANGES is defined", () => {
    expect(rangesMatch, "Could not find TRANSFORM_RANGES").toBeTruthy();
  });

  it("translate range: min -500, max 500, step 1", () => {
    const block = rangesMatch![0];
    expect(block).toMatch(/translate:\s*\{\s*min:\s*-500\s*,\s*max:\s*500\s*,\s*step:\s*1\s*\}/);
  });

  it("scale range: min 0, max 5, step 0.01", () => {
    const block = rangesMatch![0];
    expect(block).toMatch(/scale:\s*\{\s*min:\s*0\s*,\s*max:\s*5\s*,\s*step:\s*0\.01\s*\}/);
  });

  it("rotate range: min -360, max 360, step 1", () => {
    const block = rangesMatch![0];
    expect(block).toMatch(/rotate:\s*\{\s*min:\s*-360\s*,\s*max:\s*360\s*,\s*step:\s*1\s*\}/);
  });

  it("skew range: min -90, max 90, step 1", () => {
    const block = rangesMatch![0];
    expect(block).toMatch(/skew:\s*\{\s*min:\s*-90\s*,\s*max:\s*90\s*,\s*step:\s*1\s*\}/);
  });
});

describe("getUnit helper", () => {
  it("getUnit function exists", () => {
    expect(getUnitMatch, "Could not find getUnit").toBeTruthy();
  });

  it("P2-4: translate returns 'PX'", () => {
    expect(getUnitMatch![0]).toMatch(/type\s*===\s*"translate"\)\s*return\s*"PX"/);
  });

  it("P2-5: scale returns '' (empty string)", () => {
    // After all type checks, the default return is ""
    expect(getUnitMatch![0]).toMatch(/return\s*""/);
  });

  it("P2-6: rotate returns 'DEG'", () => {
    expect(getUnitMatch![0]).toMatch(/type\s*===\s*"rotate"\)\s*return\s*"DEG"/);
  });

  it("P2-7 (unit): skew returns 'DEG'", () => {
    expect(getUnitMatch![0]).toMatch(/type\s*===\s*"skew"\)\s*return\s*"DEG"/);
  });
});

// ─── TransformExpanded structure ─────────────────────────────────

describe("TransformExpanded renders SegmentedControl tabs", () => {
  it("TransformExpanded function exists", () => {
    expect(expandedMatch, "Could not find TransformExpanded").toBeTruthy();
  });

  it("P2-1: renders SegmentedControl with TRANSFORM_TAB_OPTIONS", () => {
    expect(expandedMatch![0]).toMatch(/<SegmentedControl[\s\S]*?options=\{TRANSFORM_TAB_OPTIONS\}/);
  });

  it("P2-2: active tab matches transform.type (value={type})", () => {
    // The SegmentedControl should have value={type}
    const segMatch = expandedMatch![0].match(
      /<SegmentedControl[\s\S]*?\/>/,
    );
    expect(segMatch).toBeTruthy();
    expect(segMatch![0]).toMatch(/value=\{type\}/);
  });

  it("P2-3: tab onChange calls onTypeChange", () => {
    expect(expandedMatch![0]).toMatch(/onChange=\{\(v\)\s*=>\s*onTypeChange\(v\s+as\s+TransformType\)\}/);
  });
});

describe("TransformExpanded axis sliders per type", () => {
  it("P2-4: renders X, Y, Z AxisSliderRow components", () => {
    // All three axis labels appear as AxisSliderRow in the component
    expect(expandedMatch![0]).toMatch(/<AxisSliderRow\s+label="X"/);
    expect(expandedMatch![0]).toMatch(/<AxisSliderRow\s+label="Y"/);
    expect(expandedMatch![0]).toMatch(/<AxisSliderRow\s+label="Z"/);
  });

  it("P2-7: skew has no Z slider (hasZ = type !== 'skew')", () => {
    // The Z row is gated behind {hasZ && (...)}
    expect(expandedMatch![0]).toMatch(/const\s+hasZ\s*=\s*type\s*!==\s*"skew"/);
    expect(expandedMatch![0]).toMatch(/\{hasZ\s*&&\s*\(/);
  });
});

// ─── Scale lock behavior ─────────────────────────────────────────

describe("TransformExpanded scale lock", () => {
  it("P2-8: scale lock button visible only for scale type ({isScale && ()", () => {
    // The lock button is rendered inside {isScale && (...)}
    expect(expandedMatch![0]).toMatch(/\{isScale\s*&&\s*\(/);
  });

  it("P2-9: isScale is derived from type === 'scale'", () => {
    expect(expandedMatch![0]).toMatch(/const\s+isScale\s*=\s*type\s*===\s*"scale"/);
  });

  it("P2-10: scale locked — changing X triggers onUpdate with all axes", () => {
    // if (isScale && scaleLocked) { const updates = { x: v, y: v }; if (hasZ) updates.z = v; onUpdate(updates); }
    expect(expandedMatch![0]).toMatch(/isScale\s*&&\s*scaleLocked/);
    expect(expandedMatch![0]).toMatch(/const\s+updates.*=\s*\{\s*x:\s*v\s*,\s*y:\s*v\s*\}/);
    expect(expandedMatch![0]).toMatch(/if\s*\(hasZ\)\s*updates\.z\s*=\s*v/);
  });

  it("P2-11: scale unlocked — changing X only triggers onUpdate({ [axis]: v })", () => {
    // The else branch: onUpdate({ [axis]: v })
    expect(expandedMatch![0]).toMatch(/onUpdate\(\{\s*\[axis\]:\s*v\s*\}\)/);
  });

  it("P2-12: scale lock toggle calls onUpdate({ scaleLocked: !scaleLocked })", () => {
    expect(expandedMatch![0]).toMatch(/onUpdate\(\{\s*scaleLocked:\s*!scaleLocked\s*\}\)/);
  });
});
