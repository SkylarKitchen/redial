// @vitest-environment happy-dom
/**
 * filterSlidersNumberInput.test.tsx — behavioral characterization of the
 * NumberInput inside FilterItemEditor (FilterSliders.tsx).
 *
 * This test pins the contract before migrating NumberInput to useDraftNumber:
 *   - ArrowUp/ArrowDown step by step (Shift = step*10), clamped to [min,max]
 *   - typing a number + Enter commits the parsed value (clamped)
 *   - Enter also blurs the input
 *   - blur commits the typed value (clamped)
 *   - The input shows the committed value when not focused
 *
 * Uses brightness filter (step=1, min=0, max=200, defaultValues=[100]).
 * NumberInput is always-on (no click-to-edit).
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { FilterEditor, createDefaultItem } from "../sections/FilterSliders";

afterEach(() => cleanup());

/** Render a FilterEditor with one brightness item; return the onChange spy. */
function setup() {
  const onChange = vi.fn();
  const item = createDefaultItem("brightness"); // value=100, min=0, max=200, step=1
  const utils = render(
    <FilterEditor items={[item]} onChange={onChange} type="filter" />,
  );
  return { onChange, item, ...utils };
}

/** Get the NumberInput (text input, not the range slider). */
function getNumberInput(): HTMLInputElement {
  // There are two inputs: range slider and the NumberInput text box.
  // The NumberInput has type="text" (default) and width "36px".
  // The range slider has type="range".
  const inputs = document.querySelectorAll('input:not([type="range"])');
  // brightness has one param label, so one NumberInput
  return inputs[0] as HTMLInputElement;
}

describe("FilterSliders NumberInput (behavioral characterization)", () => {
  it("renders showing the default committed value", () => {
    setup();
    const inp = getNumberInput();
    expect(inp).not.toBeNull();
    expect(inp.value).toBe("100");
  });

  it("ArrowUp steps by 1 and emits onChange with updated values", () => {
    const { onChange } = setup();
    const inp = getNumberInput();
    fireEvent.keyDown(inp, { key: "ArrowUp" });
    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({ values: [101] }),
    ]);
  });

  it("ArrowDown steps by 1 and emits onChange with updated values", () => {
    const { onChange } = setup();
    const inp = getNumberInput();
    fireEvent.keyDown(inp, { key: "ArrowDown" });
    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({ values: [99] }),
    ]);
  });

  it("Shift+ArrowUp steps by step*10 (10)", () => {
    const { onChange } = setup();
    const inp = getNumberInput();
    fireEvent.keyDown(inp, { key: "ArrowUp", shiftKey: true });
    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({ values: [110] }),
    ]);
  });

  it("Shift+ArrowDown steps by step*10 (10)", () => {
    const { onChange } = setup();
    const inp = getNumberInput();
    fireEvent.keyDown(inp, { key: "ArrowDown", shiftKey: true });
    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({ values: [90] }),
    ]);
  });

  it("ArrowUp clamps to max (200)", () => {
    const onChange = vi.fn();
    // Use a value near max to test clamping
    const item = { ...createDefaultItem("brightness"), values: [199] };
    render(<FilterEditor items={[item]} onChange={onChange} type="filter" />);
    const inp = getNumberInput();
    // Shift+ArrowUp from 199 would be 209, clamped to 200
    fireEvent.keyDown(inp, { key: "ArrowUp", shiftKey: true });
    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({ values: [200] }),
    ]);
    cleanup();
  });

  it("ArrowDown clamps to min (0)", () => {
    const onChange = vi.fn();
    const item = { ...createDefaultItem("brightness"), values: [5] };
    render(<FilterEditor items={[item]} onChange={onChange} type="filter" />);
    const inp = getNumberInput();
    // Shift+ArrowDown from 5 would be -5, clamped to 0
    fireEvent.keyDown(inp, { key: "ArrowDown", shiftKey: true });
    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({ values: [0] }),
    ]);
    cleanup();
  });

  it("typing a value + Enter commits the parsed number (clamped to [min,max])", () => {
    const { onChange } = setup();
    const inp = getNumberInput();
    fireEvent.focus(inp);
    fireEvent.change(inp, { target: { value: "150" } });
    fireEvent.keyDown(inp, { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({ values: [150] }),
    ]);
  });

  it("Enter with out-of-range value clamps to max", () => {
    const { onChange } = setup();
    const inp = getNumberInput();
    fireEvent.focus(inp);
    fireEvent.change(inp, { target: { value: "999" } });
    fireEvent.keyDown(inp, { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({ values: [200] }),
    ]);
  });

  it("Enter blurs the input", () => {
    setup();
    const inp = getNumberInput();
    fireEvent.focus(inp);
    fireEvent.change(inp, { target: { value: "120" } });
    const blurSpy = vi.spyOn(inp, "blur");
    fireEvent.keyDown(inp, { key: "Enter" });
    expect(blurSpy).toHaveBeenCalled();
  });

  it("blur commits the typed value", () => {
    const { onChange } = setup();
    const inp = getNumberInput();
    fireEvent.focus(inp);
    fireEvent.change(inp, { target: { value: "75" } });
    fireEvent.blur(inp);
    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({ values: [75] }),
    ]);
  });

  it("blur with out-of-range value clamps", () => {
    const { onChange } = setup();
    const inp = getNumberInput();
    fireEvent.focus(inp);
    fireEvent.change(inp, { target: { value: "-10" } });
    fireEvent.blur(inp);
    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({ values: [0] }),
    ]);
  });

  it("shows committed value when not focused", () => {
    setup();
    const inp = getNumberInput();
    // Not focused — should show current committed value
    expect(inp.value).toBe("100");
  });
});
