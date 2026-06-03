// @vitest-environment happy-dom
/**
 * axisSliderRow.test.ts — Verify AxisSliderRow internal component.
 *
 * AxisSliderRow was migrated from a hand-rolled draft/commit/step
 * implementation onto the shared useDraftNumber hook. The original assertions
 * here were SOURCE-STRING matches against the bespoke internals; those internals
 * now live in the hook, so the structure-only checks are kept and the
 * behavioral checks fire real events through the exported TransformEditor
 * (which renders AxisSliderRow inside the expanded transform editor).
 *
 * Covers:
 * - Renders label, Slider, input, and unit span
 * - Slider onValueChange fires onChange directly (source check — unchanged)
 * - Input blur commits value clamped to [min, max]
 * - Input Enter key commits and blurs
 * - ArrowUp increments by step / Shift+ArrowUp by step*10 / ArrowDown decrements
 * - ArrowUp/ArrowDown clamp to range.max / range.min
 * - ArrowUp calls preventDefault
 * - commit skips onChange if parsed is NaN
 * - External value change syncs draft when not focused, not when focused
 * - input typing updates the draft
 * - committing exits focus (shows committed value afterward)
 */

import { describe, it, expect, beforeAll, afterEach, vi } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { createElement, useState } from "react";
import { render, fireEvent, cleanup } from "@testing-library/react";
import {
  TransformEditor,
  type TransformValue,
} from "../sections/TransformEditor";

const src = readFileSync(
  join(__dirname, "../sections/TransformEditor.tsx"),
  "utf-8",
);

// Extract the AxisSliderRow function source for the structure-only assertions
// that survive the migration.
const axisMatch = src.match(/function AxisSliderRow\([\s\S]*?\n}\n/m);

beforeAll(() => {
  // happy-dom doesn't implement pointer capture — useDragReorder & Radix Slider
  // call it in their pointer handlers, so polyfill as no-ops to prevent throws.
  const proto = Element.prototype as unknown as Record<string, unknown>;
  if (!proto.setPointerCapture) proto.setPointerCapture = () => {};
  if (!proto.releasePointerCapture) proto.releasePointerCapture = () => {};
  if (!proto.hasPointerCapture) proto.hasPointerCapture = () => false;
});

afterEach(() => cleanup());

const TRANSLATE: TransformValue = { type: "translate", x: 0, y: 0, z: 0 };

/** Controlled TransformEditor wrapper; onAxisSpy receives updated transforms. */
function setup(
  initial: TransformValue = { ...TRANSLATE, x: 10 },
  onAxisSpy?: (t: TransformValue[]) => void,
) {
  function Controlled() {
    const [transforms, setTransforms] = useState<TransformValue[]>([initial]);
    return createElement(TransformEditor, {
      transforms,
      onChange: (t: TransformValue[]) => {
        setTransforms(t);
        onAxisSpy?.(t);
      },
      origin: "50% 50%",
      onOriginChange: () => {},
      backfaceVisibility: "visible",
      onBackfaceChange: () => {},
      selfPerspective: 0,
      onSelfPerspectiveChange: () => {},
      childrenPerspective: 0,
      onChildrenPerspectiveChange: () => {},
      perspectiveOrigin: "50% 50%",
      onPerspectiveOriginChange: () => {},
      settingsOpen: false,
    });
  }
  const utils = render(createElement(Controlled));
  // Expand the pill so AxisSliderRows render.
  const pill = document.querySelector(
    'div[style*="cursor: pointer"]',
  ) as HTMLElement;
  fireEvent.click(pill);
  return utils;
}

function axisInputs(): HTMLInputElement[] {
  return (
    Array.from(document.querySelectorAll("input")) as HTMLInputElement[]
  ).filter((i) => i.type !== "range");
}
const xInput = () => axisInputs()[0];
const yInput = () => axisInputs()[1];

// ─── Structure (source-string — survives migration) ──────────────

describe("AxisSliderRow structure", () => {
  it("AxisSliderRow function exists", () => {
    expect(axisMatch, "Could not find AxisSliderRow").toBeTruthy();
  });

  it("P3-1: renders label span, Slider, input, and unit span", () => {
    setup();
    // Label "X", the Slider (Radix renders a role="slider" thumb), the text
    // input, and the unit.
    expect(xInput()).toBeTruthy();
    expect(document.querySelector('[role="slider"]')).toBeTruthy();
    // Unit "PX" for translate is rendered.
    expect(document.body.textContent).toContain("PX");
    // The X axis label span.
    expect(document.body.textContent).toContain("X");
  });

  it("P3-2: Slider onValueChange fires onChange directly", () => {
    // Structure-only: AxisSliderRow wires the Slider straight to onChange.
    expect(axisMatch![0]).toMatch(
      /onValueChange=\{\(\[v\]\)\s*=>\s*onChange\(v\)\}/,
    );
  });
});

// ─── Commit behavior (behavioral) ────────────────────────────────

describe("AxisSliderRow commit behavior", () => {
  it("P3-3: input blur commits the value clamped to [min, max]", () => {
    const onAxisSpy = vi.fn();
    setup({ ...TRANSLATE, x: 0 }, onAxisSpy);
    const inp = xInput();
    fireEvent.focus(inp);
    fireEvent.change(inp, { target: { value: "9999" } });
    fireEvent.blur(inp);
    // translate max is 500.
    expect(onAxisSpy).toHaveBeenLastCalledWith([
      expect.objectContaining({ x: 500 }),
    ]);
  });

  it("P3-4: Enter key commits and blurs the input", () => {
    const onAxisSpy = vi.fn();
    setup({ ...TRANSLATE, x: 0 }, onAxisSpy);
    const inp = xInput();
    fireEvent.focus(inp);
    fireEvent.change(inp, { target: { value: "42" } });
    const blurSpy = vi.spyOn(inp, "blur");
    fireEvent.keyDown(inp, { key: "Enter" });
    expect(onAxisSpy).toHaveBeenLastCalledWith([
      expect.objectContaining({ x: 42 }),
    ]);
    expect(blurSpy).toHaveBeenCalled();
  });
});

// ─── Arrow key behavior (behavioral) ─────────────────────────────

describe("AxisSliderRow arrow key behavior", () => {
  it("P3-5: ArrowUp increments by step (translate step=1)", () => {
    const onAxisSpy = vi.fn();
    setup({ ...TRANSLATE, x: 10 }, onAxisSpy);
    fireEvent.keyDown(xInput(), { key: "ArrowUp" });
    expect(onAxisSpy).toHaveBeenLastCalledWith([
      expect.objectContaining({ x: 11 }),
    ]);
  });

  it("P3-6: Shift+ArrowUp increments by step*10", () => {
    const onAxisSpy = vi.fn();
    setup({ ...TRANSLATE, x: 10 }, onAxisSpy);
    fireEvent.keyDown(xInput(), { key: "ArrowUp", shiftKey: true });
    expect(onAxisSpy).toHaveBeenLastCalledWith([
      expect.objectContaining({ x: 20 }),
    ]);
  });

  it("P3-7: ArrowDown decrements by step", () => {
    const onAxisSpy = vi.fn();
    setup({ ...TRANSLATE, x: 10 }, onAxisSpy);
    fireEvent.keyDown(xInput(), { key: "ArrowDown" });
    expect(onAxisSpy).toHaveBeenLastCalledWith([
      expect.objectContaining({ x: 9 }),
    ]);
  });

  it("P3-5+: ArrowUp clamps to range.max", () => {
    const onAxisSpy = vi.fn();
    setup({ ...TRANSLATE, x: 500 }, onAxisSpy);
    fireEvent.keyDown(xInput(), { key: "ArrowUp" });
    expect(onAxisSpy).toHaveBeenLastCalledWith([
      expect.objectContaining({ x: 500 }),
    ]);
  });

  it("P3-7+: ArrowDown clamps to range.min", () => {
    const onAxisSpy = vi.fn();
    setup({ ...TRANSLATE, x: -500 }, onAxisSpy);
    fireEvent.keyDown(xInput(), { key: "ArrowDown" });
    expect(onAxisSpy).toHaveBeenLastCalledWith([
      expect.objectContaining({ x: -500 }),
    ]);
  });

  it("P3-5+: ArrowUp calls e.preventDefault()", () => {
    setup({ ...TRANSLATE, x: 10 });
    const ev = new KeyboardEvent("keydown", {
      key: "ArrowUp",
      bubbles: true,
      cancelable: true,
    });
    xInput().dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(true);
  });

  it("fractional-step axis rounds stepped value to 3 decimals (scale step=0.01)", () => {
    const onAxisSpy = vi.fn();
    setup(
      { type: "scale", x: 1, y: 1, z: 1, scaleLocked: false },
      onAxisSpy,
    );
    fireEvent.keyDown(xInput(), { key: "ArrowUp" });
    expect(onAxisSpy).toHaveBeenLastCalledWith([
      expect.objectContaining({ x: 1.01 }),
    ]);
  });
});

// ─── Clamping / NaN (behavioral) ─────────────────────────────────

describe("AxisSliderRow clamping on commit", () => {
  it("P3-8: value below min is clamped to min", () => {
    const onAxisSpy = vi.fn();
    setup({ ...TRANSLATE, x: 0 }, onAxisSpy);
    const inp = xInput();
    fireEvent.focus(inp);
    fireEvent.change(inp, { target: { value: "-9999" } });
    fireEvent.blur(inp);
    expect(onAxisSpy).toHaveBeenLastCalledWith([
      expect.objectContaining({ x: -500 }),
    ]);
  });

  it("P3-9: value above max is clamped to max", () => {
    const onAxisSpy = vi.fn();
    setup({ ...TRANSLATE, x: 0 }, onAxisSpy);
    const inp = xInput();
    fireEvent.focus(inp);
    fireEvent.change(inp, { target: { value: "9999" } });
    fireEvent.blur(inp);
    expect(onAxisSpy).toHaveBeenLastCalledWith([
      expect.objectContaining({ x: 500 }),
    ]);
  });

  it("commit skips onChange if parsed is NaN", () => {
    const onAxisSpy = vi.fn();
    setup({ ...TRANSLATE, x: 7 }, onAxisSpy);
    const inp = xInput();
    fireEvent.focus(inp);
    fireEvent.change(inp, { target: { value: "nope" } });
    fireEvent.blur(inp);
    expect(onAxisSpy).not.toHaveBeenCalled();
  });
});

// ─── Draft sync behavior (behavioral) ────────────────────────────

describe("AxisSliderRow draft sync", () => {
  it("P3-10: external value change syncs draft when not focused", () => {
    setup({ ...TRANSLATE, x: 10 });
    // Step Y up — X stays not focused and reflects its committed value.
    fireEvent.keyDown(yInput(), { key: "ArrowUp" });
    expect(xInput().value).toBe("10");
  });

  it("P3-11: external value change does NOT overwrite draft when focused", () => {
    setup({ ...TRANSLATE, x: 10 });
    const inp = xInput();
    fireEvent.focus(inp);
    fireEvent.change(inp, { target: { value: "33" } });
    // Bump Y while X is focused — X must keep showing the typed draft.
    fireEvent.keyDown(yInput(), { key: "ArrowUp" });
    expect(xInput().value).toBe("33");
  });

  it("input typing updates the draft", () => {
    setup({ ...TRANSLATE, x: 0 });
    const inp = xInput();
    fireEvent.focus(inp);
    fireEvent.change(inp, { target: { value: "88" } });
    expect(xInput().value).toBe("88");
  });

  it("onFocus shows the draft (not String(value)) while focused", () => {
    setup({ ...TRANSLATE, x: 5 });
    const inp = xInput();
    fireEvent.focus(inp);
    fireEvent.change(inp, { target: { value: "12" } });
    expect(xInput().value).toBe("12");
  });

  it("commit exits focus (shows committed value afterward)", () => {
    setup({ ...TRANSLATE, x: 0 });
    const inp = xInput();
    fireEvent.focus(inp);
    fireEvent.change(inp, { target: { value: "200" } });
    fireEvent.blur(inp);
    // After blur the committed value (200) is shown, not-focused.
    expect(xInput().value).toBe("200");
  });
});
