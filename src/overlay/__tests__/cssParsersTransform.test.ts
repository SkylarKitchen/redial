/**
 * cssParsersTransform.test.ts — Extended transform CSS parser tests.
 *
 * Supplements cssParsers.test.ts with additional coverage for edge cases
 * in parseTransform, transformToCSS, and round-trip serialization.
 */

import { describe, it, expect } from "vitest";
import {
  parseTransform,
  transformToCSS,
  parseSelfPerspective,
  transformToCSSWithPerspective,
} from "../cssParsers";

// ─── parseTransform — additional coverage ─────────────────────────────

describe("parseTransform (extended)", () => {
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

  it("scale(1) single arg maps to {x:1, y:1}", () => {
    const result = parseTransform("scale(1)");
    expect(result[0]).toEqual({ type: "scale", x: 1, y: 1 });
  });

  it("translate with single arg defaults y to 0", () => {
    const result = parseTransform("translate(15px)");
    expect(result[0]).toMatchObject({ type: "translate", x: 15, y: 0 });
  });

  it("skew with single arg defaults y to 0", () => {
    const result = parseTransform("skew(10deg)");
    expect(result[0]).toMatchObject({ type: "skew", x: 10, y: 0 });
  });

  it("multiple perspective functions are all skipped", () => {
    const result = parseTransform("perspective(100px) perspective(200px) scale(2)");
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ type: "scale", x: 2, y: 2 });
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

  it("serializes rotate y-only", () => {
    expect(transformToCSS([{ type: "rotate", x: 0, y: 30, z: 0 }])).toBe("rotateY(30deg)");
  });

  it("translate with z=0 uses 2D form", () => {
    expect(transformToCSS([{ type: "translate", x: 5, y: 10, z: 0 }])).toBe(
      "translate(5px, 10px)"
    );
  });
});

// ─── transformToCSSWithPerspective — additional coverage ──────────────

describe("transformToCSSWithPerspective (extended)", () => {
  it("empty transforms + perspective=500 returns perspective prefix with none", () => {
    expect(transformToCSSWithPerspective([], 500)).toBe("perspective(500px) none");
  });

  it("negative perspective is not prepended (guard: > 0)", () => {
    expect(transformToCSSWithPerspective([], -1)).toBe("none");
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
    // Rotate is accumulated to end during parsing, so match by type
    for (const t of parsed) {
      const match = reparsed.find((r) => r.type === t.type);
      expect(match).toBeDefined();
      expect(match!.x).toBeCloseTo(t.x, 5);
      expect(match!.y).toBeCloseTo(t.y, 5);
    }
  });

  it("round-trip with 3D translate preserves z", () => {
    const original = "translate3d(10px, 20px, 30px)";
    const parsed = parseTransform(original);
    const serialized = transformToCSS(parsed);
    const reparsed = parseTransform(serialized);

    expect(reparsed[0]).toMatchObject({ type: "translate", x: 10, y: 20, z: 30 });
  });

  it("round-trip with scale3d preserves z", () => {
    const original = "scale3d(1.5, 2, 0.5)";
    const parsed = parseTransform(original);
    const serialized = transformToCSS(parsed);
    const reparsed = parseTransform(serialized);

    expect(reparsed[0]).toMatchObject({ type: "scale", x: 1.5, y: 2, z: 0.5 });
  });

  it("round-trip with perspective preserves prefix", () => {
    const original = "perspective(800px) rotateY(45deg)";
    const perspective = parseSelfPerspective(original);
    const parsed = parseTransform(original);
    const serialized = transformToCSSWithPerspective(parsed, perspective);
    const rePerspective = parseSelfPerspective(serialized);
    const reparsed = parseTransform(serialized);

    expect(rePerspective).toBe(800);
    expect(reparsed[0]).toMatchObject({ type: "rotate", y: 45 });
  });
});
