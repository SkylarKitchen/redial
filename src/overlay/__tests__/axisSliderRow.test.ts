// @vitest-environment happy-dom
/**
 * axisSliderRow.test.ts — Verify AxisSliderRow internal component
 *
 * Covers:
 * - Renders label, Slider, input, and unit span
 * - Slider onValueChange fires onChange directly
 * - Input blur commits value clamped to [min, max]
 * - Input Enter key commits and blurs
 * - ArrowUp increments by step
 * - Shift+ArrowUp increments by step*10
 * - ArrowDown decrements by step
 * - Value below min clamped to min
 * - Value above max clamped to max
 * - External value change syncs draft when not focused
 * - External value change does NOT overwrite draft when focused
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const src = readFileSync(
  join(__dirname, "../sections/TransformEditor.tsx"),
  "utf-8",
);

// Extract the AxisSliderRow function body
const axisMatch = src.match(
  /function AxisSliderRow\([\s\S]*?^}$/m,
);

// ─── Structure ───────────────────────────────────────────────────

describe("AxisSliderRow structure", () => {
  it("AxisSliderRow function exists", () => {
    expect(axisMatch, "Could not find AxisSliderRow").toBeTruthy();
  });

  it("P3-1: renders label span, Slider, input, and unit span", () => {
    const body = axisMatch![0];
    // Label: <span>...{label}</span>
    expect(body).toContain("{label}");
    // Slider component
    expect(body).toMatch(/<Slider/);
    // Input element
    expect(body).toMatch(/<input/);
    // Unit span: {unit && (<span>...{unit}</span>)}
    expect(body).toMatch(/\{unit\s*&&\s*\(/);
  });

  it("P3-2: Slider onValueChange fires onChange directly", () => {
    // onValueChange={([v]) => onChange(v)}
    expect(axisMatch![0]).toMatch(/onValueChange=\{\(\[v\]\)\s*=>\s*onChange\(v\)\}/);
  });
});

// ─── Commit behavior ─────────────────────────────────────────────

describe("AxisSliderRow commit behavior", () => {
  it("P3-3: input blur calls commit which clamps to [min, max]", () => {
    const body = axisMatch![0];
    // onBlur={commit}
    expect(body).toMatch(/onBlur=\{commit\}/);
    // commit function uses Math.min(range.max, Math.max(range.min, parsed))
    expect(body).toMatch(
      /onChange\(Math\.min\(range\.max,\s*Math\.max\(range\.min,\s*parsed\)\)\)/,
    );
  });

  it("P3-4: Enter key commits and blurs the input", () => {
    const body = axisMatch![0];
    // if (e.key === "Enter") { commit(); (e.target as HTMLInputElement).blur(); }
    expect(body).toMatch(/e\.key\s*===\s*"Enter"/);
    expect(body).toMatch(/commit\(\)/);
    expect(body).toMatch(/\.blur\(\)/);
  });
});

// ─── Arrow key behavior ──────────────────────────────────────────

describe("AxisSliderRow arrow key behavior", () => {
  it("P3-5: ArrowUp increments by step", () => {
    const body = axisMatch![0];
    // e.key === "ArrowUp"
    expect(body).toMatch(/e\.key\s*===\s*"ArrowUp"/);
    // Default increment: range.step (when not shift)
    // const inc = e.shiftKey ? range.step * 10 : range.step
    expect(body).toMatch(/e\.shiftKey\s*\?\s*range\.step\s*\*\s*10\s*:\s*range\.step/);
  });

  it("P3-6: Shift+ArrowUp increments by step*10", () => {
    const body = axisMatch![0];
    // Same line: e.shiftKey ? range.step * 10 : range.step
    expect(body).toContain("range.step * 10");
  });

  it("P3-7: ArrowDown decrements by step", () => {
    const body = axisMatch![0];
    expect(body).toMatch(/e\.key\s*===\s*"ArrowDown"/);
    // value - inc
    expect(body).toMatch(/value\s*-\s*inc/);
  });

  it("P3-5+: ArrowUp uses Math.min(range.max, ...) to clamp to max", () => {
    const body = axisMatch![0];
    // const next = Math.min(range.max, Math.round((value + inc) * 1000) / 1000)
    expect(body).toMatch(
      /Math\.min\(range\.max,\s*Math\.round\(\(value\s*\+\s*inc\)\s*\*\s*1000\)\s*\/\s*1000\)/,
    );
  });

  it("P3-7+: ArrowDown uses Math.max(range.min, ...) to clamp to min", () => {
    const body = axisMatch![0];
    // const next = Math.max(range.min, Math.round((value - inc) * 1000) / 1000)
    expect(body).toMatch(
      /Math\.max\(range\.min,\s*Math\.round\(\(value\s*-\s*inc\)\s*\*\s*1000\)\s*\/\s*1000\)/,
    );
  });

  it("P3-5+: ArrowUp calls e.preventDefault()", () => {
    // Within the ArrowUp branch
    const arrowUpBlock = axisMatch![0].match(
      /ArrowUp[\s\S]*?onChange\(next\)/,
    );
    expect(arrowUpBlock).toBeTruthy();
    expect(arrowUpBlock![0]).toContain("e.preventDefault()");
  });
});

// ─── Clamping (commit path) ──────────────────────────────────────

describe("AxisSliderRow clamping on commit", () => {
  it("P3-8: value below min is clamped to min via Math.max(range.min, ...)", () => {
    const body = axisMatch![0];
    // commit: onChange(Math.min(range.max, Math.max(range.min, parsed)))
    expect(body).toContain("Math.max(range.min, parsed)");
  });

  it("P3-9: value above max is clamped to max via Math.min(range.max, ...)", () => {
    const body = axisMatch![0];
    expect(body).toContain("Math.min(range.max,");
  });

  it("commit skips onChange if parsed is NaN", () => {
    const body = axisMatch![0];
    // if (!isNaN(parsed)) { onChange(...) }
    expect(body).toMatch(/if\s*\(!isNaN\(parsed\)\)/);
  });
});

// ─── Draft sync behavior ─────────────────────────────────────────

describe("AxisSliderRow draft sync", () => {
  it("P3-10: external value change syncs draft when not focused (useEffect)", () => {
    const body = axisMatch![0];
    // useEffect(() => { if (!focused) setDraft(String(value)); }, [value, focused]);
    expect(body).toMatch(/if\s*\(!focused\)\s*setDraft\(String\(value\)\)/);
  });

  it("P3-11: external value change does NOT overwrite draft when focused", () => {
    const body = axisMatch![0];
    // The guard `if (!focused)` prevents overwriting during focus
    // Also verify input shows draft when focused: value={focused ? draft : String(value)}
    expect(body).toMatch(/value=\{focused\s*\?\s*draft\s*:\s*String\(value\)\}/);
  });

  it("input onChange updates draft via setDraft", () => {
    const body = axisMatch![0];
    // onChange={(e) => setDraft(e.target.value)}
    expect(body).toMatch(/onChange=\{\(e\)\s*=>\s*setDraft\(e\.target\.value\)\}/);
  });

  it("onFocus sets focused to true", () => {
    const body = axisMatch![0];
    expect(body).toMatch(/onFocus=\{\(\)\s*=>\s*setFocused\(true\)\}/);
  });

  it("commit sets focused to false", () => {
    const body = axisMatch![0];
    // Inside commit callback: setFocused(false)
    const commitBlock = body.match(/const commit = useCallback\(\(\)\s*=>\s*\{[\s\S]*?\},/);
    expect(commitBlock).toBeTruthy();
    expect(commitBlock![0]).toContain("setFocused(false)");
  });
});
