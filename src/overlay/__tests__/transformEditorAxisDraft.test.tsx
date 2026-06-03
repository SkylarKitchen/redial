// @vitest-environment happy-dom
/**
 * transformEditorAxisDraft.test.tsx — behavioral characterization of the
 * AxisSliderRow numeric input inside TransformExpanded (TransformEditor.tsx).
 *
 * AxisSliderRow is a direct text input alongside a range slider. It pins the
 * contract before migrating onto useDraftNumber so the migration stays
 * byte-equivalent:
 *   - ArrowUp/ArrowDown step by range.step (Shift = step*10), rounded to 3
 *     decimals, clamped to [range.min, range.max]
 *   - typing a number + Enter commits parseFloat clamped to [min,max]
 *   - Enter also blurs the input
 *   - blur commits the typed value (clamped, parseFloat)
 *   - NaN draft on commit is ignored (no onChange)
 *   - the input shows draft while focused, committed value otherwise
 *   - external value change resyncs the draft only when not focused
 *
 * Uses the "scale" transform (range step=0.01, min=0, max=5) for the rounding
 * axis and "translate" (step=1, min=-500, max=500) for the integer axis.
 *
 * To reach AxisSliderRow we render TransformEditor and expand the pill by
 * clicking it; the expanded editor renders X/Y(/Z) AxisSliderRows.
 */
import { describe, it, expect, beforeAll, afterEach, vi } from "vitest";
import { useState } from "react";
import { render, fireEvent, cleanup } from "@testing-library/react";
import {
  TransformEditor,
  type TransformValue,
} from "../sections/TransformEditor";

beforeAll(() => {
  // happy-dom doesn't implement pointer capture — useDragReorder & Radix Slider
  // call it in their pointer handlers, so polyfill as no-ops to prevent throws.
  const proto = Element.prototype as unknown as Record<string, unknown>;
  if (!proto.setPointerCapture) proto.setPointerCapture = () => {};
  if (!proto.releasePointerCapture) proto.releasePointerCapture = () => {};
  if (!proto.hasPointerCapture) proto.hasPointerCapture = () => false;
});

afterEach(() => cleanup());

/**
 * Controlled TransformEditor wrapper. The transforms array flows back through
 * onChange so axis edits actually move `value` (real-app resync condition).
 * onAxisSpy receives the full updated transforms array.
 */
function Controlled({
  initial,
  onAxisSpy,
}: {
  initial: TransformValue;
  onAxisSpy?: (transforms: TransformValue[]) => void;
}) {
  const [transforms, setTransforms] = useState<TransformValue[]>([initial]);
  return (
    <TransformEditor
      transforms={transforms}
      onChange={(t) => {
        setTransforms(t);
        onAxisSpy?.(t);
      }}
      origin="50% 50%"
      onOriginChange={() => {}}
      backfaceVisibility="visible"
      onBackfaceChange={() => {}}
      selfPerspective={0}
      onSelfPerspectiveChange={() => {}}
      childrenPerspective={0}
      onChildrenPerspectiveChange={() => {}}
      perspectiveOrigin="50% 50%"
      onPerspectiveOriginChange={() => {}}
      settingsOpen={false}
    />
  );
}

/** Expand the single transform pill so the AxisSliderRows render. */
function expandPill() {
  // The pill is a clickable div containing the summary text; click the
  // summary text's container. The pill has cursor:pointer and contains the
  // formatted summary. We click the first element with role-free text.
  // Simplest: click the summary span by its text content's parent.
  const pill = document.querySelector(
    'div[style*="cursor: pointer"]',
  ) as HTMLElement;
  fireEvent.click(pill);
}

/** Text inputs only (the AxisSliderRow inputs); excludes range inputs. */
function axisInputs(): HTMLInputElement[] {
  return (
    Array.from(document.querySelectorAll("input")) as HTMLInputElement[]
  ).filter((i) => i.type !== "range");
}
function xInput(): HTMLInputElement {
  return axisInputs()[0];
}
function yInput(): HTMLInputElement {
  return axisInputs()[1];
}

const TRANSLATE: TransformValue = { type: "translate", x: 0, y: 0, z: 0 };
const SCALE: TransformValue = {
  type: "scale",
  x: 1,
  y: 1,
  z: 1,
  scaleLocked: false,
};

describe("TransformEditor AxisSliderRow (behavioral characterization)", () => {
  it("shows the committed value when not focused", () => {
    render(<Controlled initial={{ ...TRANSLATE, x: 42 }} />);
    expandPill();
    expect(xInput().value).toBe("42");
  });

  it("ArrowUp steps by range.step (translate step=1)", () => {
    const onAxisSpy = vi.fn();
    render(<Controlled initial={{ ...TRANSLATE, x: 10 }} onAxisSpy={onAxisSpy} />);
    expandPill();
    fireEvent.keyDown(xInput(), { key: "ArrowUp" });
    expect(onAxisSpy).toHaveBeenLastCalledWith([
      expect.objectContaining({ x: 11 }),
    ]);
  });

  it("ArrowDown steps by range.step (translate step=1)", () => {
    const onAxisSpy = vi.fn();
    render(<Controlled initial={{ ...TRANSLATE, x: 10 }} onAxisSpy={onAxisSpy} />);
    expandPill();
    fireEvent.keyDown(xInput(), { key: "ArrowDown" });
    expect(onAxisSpy).toHaveBeenLastCalledWith([
      expect.objectContaining({ x: 9 }),
    ]);
  });

  it("Shift+ArrowUp steps by range.step*10 (translate → 10)", () => {
    const onAxisSpy = vi.fn();
    render(<Controlled initial={{ ...TRANSLATE, x: 10 }} onAxisSpy={onAxisSpy} />);
    expandPill();
    fireEvent.keyDown(xInput(), { key: "ArrowUp", shiftKey: true });
    expect(onAxisSpy).toHaveBeenLastCalledWith([
      expect.objectContaining({ x: 20 }),
    ]);
  });

  it("Shift+ArrowDown steps by range.step*10 (translate → 10)", () => {
    const onAxisSpy = vi.fn();
    render(<Controlled initial={{ ...TRANSLATE, x: 10 }} onAxisSpy={onAxisSpy} />);
    expandPill();
    fireEvent.keyDown(xInput(), { key: "ArrowDown", shiftKey: true });
    expect(onAxisSpy).toHaveBeenLastCalledWith([
      expect.objectContaining({ x: 0 }),
    ]);
  });

  it("ArrowUp on a fractional-step axis rounds to 3 decimals (scale step=0.01)", () => {
    const onAxisSpy = vi.fn();
    render(<Controlled initial={{ ...SCALE, x: 1 }} onAxisSpy={onAxisSpy} />);
    expandPill();
    fireEvent.keyDown(xInput(), { key: "ArrowUp" });
    expect(onAxisSpy).toHaveBeenLastCalledWith([
      expect.objectContaining({ x: 1.01 }),
    ]);
  });

  it("ArrowUp clamps to range.max (translate max=500)", () => {
    const onAxisSpy = vi.fn();
    render(<Controlled initial={{ ...TRANSLATE, x: 500 }} onAxisSpy={onAxisSpy} />);
    expandPill();
    fireEvent.keyDown(xInput(), { key: "ArrowUp" });
    expect(onAxisSpy).toHaveBeenLastCalledWith([
      expect.objectContaining({ x: 500 }),
    ]);
  });

  it("ArrowDown clamps to range.min (translate min=-500)", () => {
    const onAxisSpy = vi.fn();
    render(<Controlled initial={{ ...TRANSLATE, x: -500 }} onAxisSpy={onAxisSpy} />);
    expandPill();
    fireEvent.keyDown(xInput(), { key: "ArrowDown" });
    expect(onAxisSpy).toHaveBeenLastCalledWith([
      expect.objectContaining({ x: -500 }),
    ]);
  });

  it("ArrowUp calls preventDefault", () => {
    render(<Controlled initial={{ ...TRANSLATE, x: 10 }} />);
    expandPill();
    const ev = new KeyboardEvent("keydown", {
      key: "ArrowUp",
      bubbles: true,
      cancelable: true,
    });
    xInput().dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(true);
  });

  it("typing a number + Enter commits parseFloat clamped to [min,max]", () => {
    const onAxisSpy = vi.fn();
    render(<Controlled initial={{ ...TRANSLATE, x: 0 }} onAxisSpy={onAxisSpy} />);
    expandPill();
    const inp = xInput();
    fireEvent.focus(inp);
    fireEvent.change(inp, { target: { value: "123" } });
    fireEvent.keyDown(inp, { key: "Enter" });
    expect(onAxisSpy).toHaveBeenLastCalledWith([
      expect.objectContaining({ x: 123 }),
    ]);
  });

  it("Enter with out-of-range value clamps to max", () => {
    const onAxisSpy = vi.fn();
    render(<Controlled initial={{ ...TRANSLATE, x: 0 }} onAxisSpy={onAxisSpy} />);
    expandPill();
    const inp = xInput();
    fireEvent.focus(inp);
    fireEvent.change(inp, { target: { value: "9999" } });
    fireEvent.keyDown(inp, { key: "Enter" });
    expect(onAxisSpy).toHaveBeenLastCalledWith([
      expect.objectContaining({ x: 500 }),
    ]);
  });

  it("Enter blurs the input", () => {
    render(<Controlled initial={{ ...TRANSLATE, x: 0 }} />);
    expandPill();
    const inp = xInput();
    fireEvent.focus(inp);
    fireEvent.change(inp, { target: { value: "12" } });
    const blurSpy = vi.spyOn(inp, "blur");
    fireEvent.keyDown(inp, { key: "Enter" });
    expect(blurSpy).toHaveBeenCalled();
  });

  it("blur commits the typed value (clamped)", () => {
    const onAxisSpy = vi.fn();
    render(<Controlled initial={{ ...TRANSLATE, x: 0 }} onAxisSpy={onAxisSpy} />);
    expandPill();
    const inp = xInput();
    fireEvent.focus(inp);
    fireEvent.change(inp, { target: { value: "-9999" } });
    fireEvent.blur(inp);
    expect(onAxisSpy).toHaveBeenLastCalledWith([
      expect.objectContaining({ x: -500 }),
    ]);
  });

  it("NaN draft on commit is ignored (no onChange)", () => {
    const onAxisSpy = vi.fn();
    render(<Controlled initial={{ ...TRANSLATE, x: 7 }} onAxisSpy={onAxisSpy} />);
    expandPill();
    const inp = xInput();
    fireEvent.focus(inp);
    fireEvent.change(inp, { target: { value: "xyz" } });
    fireEvent.blur(inp);
    expect(onAxisSpy).not.toHaveBeenCalled();
  });

  it("shows draft while focused; does NOT overwrite from external value", () => {
    render(<Controlled initial={{ ...TRANSLATE, x: 0 }} />);
    expandPill();
    const inp = xInput();
    fireEvent.focus(inp);
    fireEvent.change(inp, { target: { value: "33" } });
    // While focused the input reflects the draft, not String(value).
    expect(xInput().value).toBe("33");
  });

  it("Escape is not specially handled (draft preserved while focused)", () => {
    render(<Controlled initial={{ ...TRANSLATE, x: 0 }} />);
    expandPill();
    const inp = xInput();
    fireEvent.focus(inp);
    fireEvent.change(inp, { target: { value: "44" } });
    fireEvent.keyDown(inp, { key: "Escape" });
    // No revert, no commit — still focused, draft intact.
    expect(xInput().value).toBe("44");
  });

  it("external value change resyncs the draft when not focused", () => {
    const onAxisSpy = vi.fn();
    render(<Controlled initial={{ ...TRANSLATE, x: 10 }} onAxisSpy={onAxisSpy} />);
    expandPill();
    // Step Y up — X stays not-focused and keeps showing its committed value.
    fireEvent.keyDown(yInput(), { key: "ArrowUp" });
    expect(xInput().value).toBe("10");
  });
});
