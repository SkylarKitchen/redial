/**
 * bezierEditor.test.ts — Verify the BezierEditor presets and preview animation
 *
 * Covers:
 * - Preset buttons (ease, ease-in, ease-out, ease-in-out, linear) set correct
 *   control point coordinates
 * - The preview animation functionality exists
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const src = readFileSync(
  join(__dirname, "../sections/BezierEditor.tsx"),
  "utf-8",
);

// ─── Extract PRESETS from source ────────────────────────────────────

function extractPresets(): Record<string, [number, number, number, number]> {
  const match = src.match(/const PRESETS[^{]*\{([\s\S]*?)\n\};/);
  if (!match) throw new Error("Could not find PRESETS in BezierEditor");
  const body = match[1];

  const result: Record<string, [number, number, number, number]> = {};
  // Match both quoted and unquoted keys: `"ease-in": [...]` or `linear: [...]`
  const entryRe = /(?:"([^"]+)"|(\w+)):\s*\[([^\]]+)\]/g;
  let m: RegExpExecArray | null;
  while ((m = entryRe.exec(body)) !== null) {
    const name = m[1] ?? m[2];
    const values = m[3].split(",").map((v) => parseFloat(v.trim()));
    result[name] = values as [number, number, number, number];
  }
  return result;
}

const presets = extractPresets();

// ─── Preset buttons set correct control points ──────────────────────

describe("BezierEditor preset buttons", () => {
  it("defines all 5 standard CSS timing presets", () => {
    const expectedNames = ["ease", "ease-in", "ease-out", "ease-in-out", "linear"];
    for (const name of expectedNames) {
      expect(
        presets,
        `Missing preset: "${name}"`,
      ).toHaveProperty(name);
    }
  });

  it("linear preset is [0, 0, 1, 1]", () => {
    expect(presets.linear).toEqual([0, 0, 1, 1]);
  });

  it("ease preset is [0.25, 0.1, 0.25, 1]", () => {
    expect(presets.ease).toEqual([0.25, 0.1, 0.25, 1]);
  });

  it("ease-in preset is [0.42, 0, 1, 1]", () => {
    expect(presets["ease-in"]).toEqual([0.42, 0, 1, 1]);
  });

  it("ease-out preset is [0, 0, 0.58, 1]", () => {
    expect(presets["ease-out"]).toEqual([0, 0, 0.58, 1]);
  });

  it("ease-in-out preset is [0.42, 0, 0.58, 1]", () => {
    expect(presets["ease-in-out"]).toEqual([0.42, 0, 0.58, 1]);
  });

  it("each preset has exactly 4 control point values", () => {
    for (const [name, values] of Object.entries(presets)) {
      expect(
        values,
        `Preset "${name}" should have exactly 4 values`,
      ).toHaveLength(4);
    }
  });

  it("all control point values are numbers between -0.5 and 1.5", () => {
    for (const [name, values] of Object.entries(presets)) {
      for (const v of values) {
        expect(typeof v).toBe("number");
        expect(
          v,
          `Preset "${name}" has out-of-range value ${v}`,
        ).toBeGreaterThanOrEqual(-0.5);
        expect(v).toBeLessThanOrEqual(1.5);
      }
    }
  });

  it("preset buttons render via Object.entries(PRESETS).map", () => {
    // The component maps over PRESETS to render buttons
    expect(src).toMatch(/Object\.entries\(PRESETS\)\.map/);
  });

  it("clicking a preset button calls onChange with the preset values", () => {
    // Each preset button: onClick={() => onChange(preset)}
    expect(src).toMatch(/onClick=\{.*onChange\(preset\)/s);
  });
});

// ─── Preview animation ──────────────────────────────────────────────

describe("BezierEditor preview animation", () => {
  it("defines a CSS keyframe animation for preview", () => {
    // The component injects a <style> with @keyframes tuner-bezier-preview
    expect(src).toContain("@keyframes tuner-bezier-preview");
  });

  it("preview animation moves element from left to right", () => {
    // Keyframe goes from { left: 4px } to { left: calc(100% - 20px) }
    expect(src).toContain("from { left: 4px; }");
    expect(src).toContain("to { left: calc(100% - 20px); }");
  });

  it("preview div uses the current bezier value in animation-timing-function", () => {
    // animation: `tuner-bezier-preview ... cubic-bezier(${value.join(",")}) ...`
    expect(src).toMatch(/cubic-bezier\(\$\{value\.join/);
  });

  it("preview animation restarts when value changes (animKey increments)", () => {
    // State: `const [animKey, setAnimKey] = useState(0);`
    expect(src).toMatch(/\[animKey,\s*setAnimKey\]/);
    // Effect: `setAnimKey((k) => k + 1)` triggered by value changes
    expect(src).toMatch(/setAnimKey\(\(k\)\s*=>\s*k\s*\+\s*1\)/);
  });

  it("preview element uses animKey as React key to force re-mount", () => {
    // key={animKey} forces React to re-create the div, restarting the animation
    expect(src).toMatch(/key=\{animKey\}/);
  });

  it("displays the cubic-bezier value string below the canvas", () => {
    // Shows: cubic-bezier(x1, y1, x2, y2)
    expect(src).toContain("cubic-bezier(");
    expect(src).toMatch(/value\.map\(\(v\)\s*=>\s*v\.toFixed\(2\)\)\.join/);
  });
});
