import { describe, it, expect } from "vitest";
import {
  parseTransform,
  transformToCSS,
  parseSelfPerspective,
  transformToCSSWithPerspective,
} from "../cssParsers";

// ─── parseTransform — additional coverage ─────────────────────────────

describe("parseTransform (extended)", () => {
  it("preserves order: translate before scale, rotate accumulated at end", () => {
    const result = parseTransform("translate(10px, 20px) rotate(45deg) scale(2, 2)");
    expect(result).toHaveLength(3);
    expect(result[0].type).toBe("translate");
    expect(result[1].type).toBe("scale");
    expect(result[2].type).toBe("rotate");
  });

  it("rotate(45deg) maps to z-axis {x:0, y:0, z:45}", () => {
    const result = parseTransform("rotate(45deg)");
    expect(result[0]).toEqual({ type: "rotate", x: 0, y: 0, z: 45 });
  });

  it("scale(2) single arg maps to {x:2, y:2}", () => {
    const result = parseTransform("scale(2)");
    expect(result[0]).toEqual({ type: "scale", x: 2, y: 2 });
  });

  it("merges rotateX/Z across interleaved translate", () => {
    const result = parseTransform("rotateX(10deg) translate(5px, 10px) rotateZ(20deg)");
    expect(result).toHaveLength(2); // translate + merged rotate
    expect(result[0]).toMatchObject({ type: "translate", x: 5, y: 10 });
    expect(result[1]).toMatchObject({ type: "rotate", x: 10, z: 20 });
  });
});

// ─── transformToCSS — additional coverage ─────────────────────────────

describe("transformToCSS (extended)", () => {
  it("rotate all zeros serializes as rotateX(0deg)", () => {
    expect(transformToCSS([{ type: "rotate", x: 0, y: 0, z: 0 }])).toBe("rotateX(0deg)");
  });

  it("joins multiple transforms with space", () => {
    const css = transformToCSS([
      { type: "translate", x: 10, y: 20 },
      { type: "scale", x: 2, y: 2 },
      { type: "rotate", x: 0, y: 0, z: 45 },
    ]);
    expect(css).toBe("translate(10px, 20px) scale(2, 2) rotateZ(45deg)");
  });
});

// ─── transformToCSSWithPerspective — additional coverage ──────────────

describe("transformToCSSWithPerspective (extended)", () => {
  it("empty transforms + perspective=500 returns perspective prefix with none", () => {
    expect(transformToCSSWithPerspective([], 500)).toBe("perspective(500px) none");
  });
});

// ─── Round-trip ───────────────────────────────────────────────────────

describe("transform round-trip", () => {
  it("parse -> serialize -> parse produces equivalent values", () => {
    const original = "translate(10px, 20px) scale(1.5, 2) rotateZ(45deg) skew(5deg, 10deg)";
    const parsed = parseTransform(original);
    const serialized = transformToCSS(parsed);
    const reparsed = parseTransform(serialized);

    expect(reparsed).toHaveLength(parsed.length);
    // Rotate is accumulated to end during parsing, so order may differ
    for (const t of parsed) {
      const match = reparsed.find((r) => r.type === t.type);
      expect(match).toBeDefined();
      expect(match!.x).toBeCloseTo(t.x, 5);
      expect(match!.y).toBeCloseTo(t.y, 5);
    }
  });
});
