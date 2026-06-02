// @vitest-environment happy-dom
/**
 * transitionEditorMsInput.test.tsx — Behavioral characterization of the
 * MsInput component inside TransitionEditor (used for duration and delay).
 *
 * Pins the contract before migrating MsInput to useDraftNumber:
 *   - ArrowUp/ArrowDown step by 50 (Shift = 500) and emit onChange
 *   - Typing a number + Enter commits parseInt(value) clamped to [0,5000]
 *   - Enter also blurs the input
 *   - blur commits the typed value (clamped, parseInt)
 *   - The input shows the committed value when not focused
 */
import { describe, it, expect, beforeAll, afterEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { TransitionEditor, type TransitionValue } from "../sections/TransitionEditor";

beforeAll(() => {
  // happy-dom doesn't implement pointer capture — useDragReorder calls it in
  // its drag handlers, so polyfill as no-ops to prevent throws.
  const proto = Element.prototype as unknown as Record<string, unknown>;
  if (!proto.setPointerCapture) proto.setPointerCapture = () => {};
  if (!proto.releasePointerCapture) proto.releasePointerCapture = () => {};
  if (!proto.hasPointerCapture) proto.hasPointerCapture = () => false;
});

afterEach(() => cleanup());

const TRANSITION: TransitionValue = {
  property: "opacity",
  duration: 300,
  easing: "ease",
  delay: 0,
  visible: true,
};

/** Render with a single transition; return the onChange spy. */
function setup(duration = 300) {
  const onChange = vi.fn();
  const element = document.createElement("div");
  const transitions: TransitionValue[] = [{ ...TRANSITION, duration }];
  const utils = render(
    <TransitionEditor transitions={transitions} onChange={onChange} element={element} />,
  );
  return { onChange, ...utils };
}

/**
 * Get the duration MsInput. The TransitionCard renders both a range input and
 * an MsInput for duration. The MsInput is the <input> that is NOT type="range".
 * There are two text inputs: duration and delay. Duration comes first.
 */
function getDurationInput(): HTMLInputElement {
  const inputs = Array.from(document.querySelectorAll("input")) as HTMLInputElement[];
  // Filter out range inputs — MsInputs are text-like (no type attribute set, default is "text")
  const textInputs = inputs.filter((inp) => inp.type !== "range");
  return textInputs[0];
}

describe("TransitionEditor MsInput — duration (behavioral)", () => {
  it("renders the duration MsInput with the initial value", () => {
    setup(300);
    const inp = getDurationInput();
    expect(inp).toBeTruthy();
    expect(inp.value).toBe("300");
  });

  it("ArrowUp steps duration by 50 and emits onChange with updated transition", () => {
    const { onChange } = setup(300);
    const inp = getDurationInput();
    fireEvent.keyDown(inp, { key: "ArrowUp" });
    expect(onChange).toHaveBeenCalledWith([expect.objectContaining({ duration: 350 })]);
  });

  it("ArrowDown steps duration by 50 and emits onChange", () => {
    const { onChange } = setup(300);
    const inp = getDurationInput();
    fireEvent.keyDown(inp, { key: "ArrowDown" });
    expect(onChange).toHaveBeenCalledWith([expect.objectContaining({ duration: 250 })]);
  });

  it("Shift+ArrowUp steps duration by 500", () => {
    const { onChange } = setup(300);
    const inp = getDurationInput();
    fireEvent.keyDown(inp, { key: "ArrowUp", shiftKey: true });
    expect(onChange).toHaveBeenCalledWith([expect.objectContaining({ duration: 800 })]);
  });

  it("Shift+ArrowDown steps duration by 500", () => {
    const { onChange } = setup(300);
    const inp = getDurationInput();
    fireEvent.keyDown(inp, { key: "ArrowDown", shiftKey: true });
    expect(onChange).toHaveBeenCalledWith([expect.objectContaining({ duration: 0 })]);
  });

  it("ArrowUp clamps at max 5000", () => {
    const { onChange } = setup(4990);
    const inp = getDurationInput();
    fireEvent.keyDown(inp, { key: "ArrowUp" }); // 4990+50=5040 → clamped to 5000
    expect(onChange).toHaveBeenCalledWith([expect.objectContaining({ duration: 5000 })]);
  });

  it("ArrowDown clamps at min 0", () => {
    const { onChange } = setup(30);
    const inp = getDurationInput();
    fireEvent.keyDown(inp, { key: "ArrowDown" }); // 30-50=-20 → clamped to 0
    expect(onChange).toHaveBeenCalledWith([expect.objectContaining({ duration: 0 })]);
  });

  it("typing a value and pressing Enter commits parseInt(value) clamped to [0,5000]", () => {
    const { onChange } = setup(300);
    const inp = getDurationInput();
    fireEvent.focus(inp);
    fireEvent.change(inp, { target: { value: "1200" } });
    fireEvent.keyDown(inp, { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith([expect.objectContaining({ duration: 1200 })]);
  });

  it("Enter commits a value typed as float using parseInt (truncates decimals)", () => {
    const { onChange } = setup(300);
    const inp = getDurationInput();
    fireEvent.focus(inp);
    fireEvent.change(inp, { target: { value: "450.9" } });
    fireEvent.keyDown(inp, { key: "Enter" });
    // parseInt("450.9") = 450
    expect(onChange).toHaveBeenCalledWith([expect.objectContaining({ duration: 450 })]);
  });

  it("Enter clamps typed value to max 5000", () => {
    const { onChange } = setup(300);
    const inp = getDurationInput();
    fireEvent.focus(inp);
    fireEvent.change(inp, { target: { value: "9999" } });
    fireEvent.keyDown(inp, { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith([expect.objectContaining({ duration: 5000 })]);
  });

  it("Enter clamps typed value to min 0", () => {
    const { onChange } = setup(300);
    const inp = getDurationInput();
    fireEvent.focus(inp);
    fireEvent.change(inp, { target: { value: "-100" } });
    fireEvent.keyDown(inp, { key: "Enter" });
    // parseInt("-100") = -100, clamped to 0
    expect(onChange).toHaveBeenCalledWith([expect.objectContaining({ duration: 0 })]);
  });

  it("blur commits the typed value", () => {
    const { onChange } = setup(300);
    const inp = getDurationInput();
    fireEvent.focus(inp);
    fireEvent.change(inp, { target: { value: "750" } });
    fireEvent.blur(inp);
    expect(onChange).toHaveBeenCalledWith([expect.objectContaining({ duration: 750 })]);
  });

  it("blur with unchanged value still calls onChange (commit always fires on blur)", () => {
    const { onChange } = setup(300);
    const inp = getDurationInput();
    fireEvent.focus(inp);
    // No change to draft — draft is "300", same as value
    fireEvent.blur(inp);
    // commit fires: parseInt("300") = 300, Math.max(0, Math.min(5000, 300)) = 300
    expect(onChange).toHaveBeenCalledWith([expect.objectContaining({ duration: 300 })]);
  });
});
