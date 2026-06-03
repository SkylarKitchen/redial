// @vitest-environment happy-dom
/**
 * spacingValuePopoverDraft.test.tsx — behavioral characterization of the
 * always-on numeric value input inside SpacingValuePopover.
 *
 * Pins the contract BEFORE migrating the hand-rolled draft/commit/step/resync
 * logic onto useDraftNumber. Fires real events through the EXPORTED
 * SpacingValuePopover component and reaches the inner text input (the slider is
 * type="range", so the value box is the only non-range input).
 *
 * Behavioral axes pinned:
 *   - base / shift / alt arrow-step amounts (base = 4 when Tailwind, else 1;
 *     shift = base*10, alt = base*0.1; arrows round to 1 decimal)
 *   - ArrowUp does NOT clamp; ArrowDown clamps to min 0 only for padding
 *     (non-margin), margin is unclamped
 *   - resync: draft follows committed value UNCONDITIONALLY (even while focused)
 *   - Enter commits via parseFloat (clamp: padding min 0, margin unclamped),
 *     no blur-on-enter, no dedup
 *   - blur commits the same way
 *   - Escape is handled by a SEPARATE GLOBAL listener that CLOSES the popover
 *     (it does NOT revert the draft); the input itself has no Escape handler
 *   - always-on input shows the draft string
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, fireEvent, cleanup, act } from "@testing-library/react";
import { SpacingValuePopover, type SpacingValuePopoverProps } from "../sections/SpacingValuePopover";

afterEach(() => {
  cleanup();
  // Portal renders to document.body — scrub any leftover popover divs.
  document.body.querySelectorAll("[data-tuner-portal]").forEach((el) => el.remove());
});

function setup(overrides: Partial<SpacingValuePopoverProps> = {}) {
  const onChange = vi.fn();
  const onClose = vi.fn();
  const anchorRect = new DOMRect(100, 100, 50, 24);
  const props: SpacingValuePopoverProps = {
    value: 10,
    onChange,
    unit: "px",
    units: ["px", "%", "em"],
    onUnitChange: vi.fn(),
    property: "margin-top",
    isMargin: true,
    anchorRect,
    onClose,
    ...overrides,
  };
  const utils = render(<SpacingValuePopover {...props} />);
  return { onChange, onClose, ...utils };
}

/** The value text input is the only input that is NOT type="range". */
function getInput(): HTMLInputElement {
  const inputs = document.querySelectorAll('[data-tuner-portal] input:not([type="range"])');
  return inputs[0] as HTMLInputElement;
}

describe("SpacingValuePopover value input (characterization)", () => {
  it("renders showing the committed value as the draft", () => {
    setup({ value: 10 });
    expect(getInput().value).toBe("10");
  });

  it("typing updates the draft (always-on display)", () => {
    setup({ value: 10 });
    const inp = getInput();
    fireEvent.change(inp, { target: { value: "42" } });
    expect(inp.value).toBe("42");
  });

  it("Enter commits the parsed (parseFloat) value via onChange", () => {
    const { onChange } = setup({ value: 10, isMargin: true });
    const inp = getInput();
    fireEvent.change(inp, { target: { value: "42" } });
    fireEvent.keyDown(inp, { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith(42);
  });

  it("Enter on padding clamps the committed value to min 0", () => {
    const { onChange } = setup({ value: 10, isMargin: false, property: "padding-top" });
    const inp = getInput();
    fireEvent.change(inp, { target: { value: "-5" } });
    fireEvent.keyDown(inp, { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith(0);
  });

  it("Enter on margin does NOT clamp (negative allowed)", () => {
    const { onChange } = setup({ value: 10, isMargin: true });
    const inp = getInput();
    fireEvent.change(inp, { target: { value: "-5" } });
    fireEvent.keyDown(inp, { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith(-5);
  });

  it("Enter with a non-numeric draft does not call onChange", () => {
    const { onChange } = setup({ value: 10 });
    const inp = getInput();
    fireEvent.change(inp, { target: { value: "abc" } });
    fireEvent.keyDown(inp, { key: "Enter" });
    expect(onChange).not.toHaveBeenCalled();
  });

  it("blur commits the typed value (parseFloat)", () => {
    const { onChange } = setup({ value: 10, isMargin: true });
    const inp = getInput();
    fireEvent.change(inp, { target: { value: "33" } });
    fireEvent.blur(inp);
    expect(onChange).toHaveBeenCalledWith(33);
  });

  it("blur on padding clamps to min 0", () => {
    const { onChange } = setup({ value: 10, isMargin: false, property: "padding-left" });
    const inp = getInput();
    fireEvent.change(inp, { target: { value: "-12" } });
    fireEvent.blur(inp);
    expect(onChange).toHaveBeenCalledWith(0);
  });

  it("ArrowUp steps by base 1 (non-Tailwind) from value", () => {
    const { onChange } = setup({ value: 10, isTailwind: false });
    const inp = getInput();
    fireEvent.keyDown(inp, { key: "ArrowUp" });
    expect(onChange).toHaveBeenCalledWith(11);
  });

  it("ArrowDown steps by base 1 (non-Tailwind) from value", () => {
    const { onChange } = setup({ value: 10, isTailwind: false, isMargin: true });
    const inp = getInput();
    fireEvent.keyDown(inp, { key: "ArrowDown" });
    expect(onChange).toHaveBeenCalledWith(9);
  });

  it("ArrowUp base step is 4 when Tailwind", () => {
    const { onChange } = setup({ value: 10, isTailwind: true });
    const inp = getInput();
    fireEvent.keyDown(inp, { key: "ArrowUp" });
    expect(onChange).toHaveBeenCalledWith(14);
  });

  it("Shift+ArrowUp steps by base*10 (10 when non-Tailwind)", () => {
    const { onChange } = setup({ value: 10, isTailwind: false });
    const inp = getInput();
    fireEvent.keyDown(inp, { key: "ArrowUp", shiftKey: true });
    expect(onChange).toHaveBeenCalledWith(20);
  });

  it("Alt+ArrowUp steps by base*0.1 (0.1 when non-Tailwind) and rounds to 1 decimal", () => {
    const { onChange } = setup({ value: 10, isTailwind: false });
    const inp = getInput();
    fireEvent.keyDown(inp, { key: "ArrowUp", altKey: true });
    expect(onChange).toHaveBeenCalledWith(10.1);
  });

  it("Alt+ArrowDown steps by base*0.1 and rounds to 1 decimal", () => {
    const { onChange } = setup({ value: 10, isTailwind: false, isMargin: true });
    const inp = getInput();
    fireEvent.keyDown(inp, { key: "ArrowDown", altKey: true });
    expect(onChange).toHaveBeenCalledWith(9.9);
  });

  it("ArrowDown does NOT clamp for margin (negative allowed)", () => {
    const { onChange } = setup({ value: 0, isMargin: true, isTailwind: false });
    const inp = getInput();
    fireEvent.keyDown(inp, { key: "ArrowDown" });
    expect(onChange).toHaveBeenCalledWith(-1);
  });

  it("ArrowDown clamps to 0 for padding (non-margin)", () => {
    const { onChange } = setup({ value: 0, isMargin: false, property: "padding-top", isTailwind: false });
    const inp = getInput();
    fireEvent.keyDown(inp, { key: "ArrowDown" });
    expect(onChange).toHaveBeenCalledWith(0);
  });

  it("ArrowUp does NOT clamp on the upper end (no max)", () => {
    const { onChange } = setup({ value: 1000, isMargin: false, property: "padding-top", isTailwind: false });
    const inp = getInput();
    fireEvent.keyDown(inp, { key: "ArrowUp" });
    expect(onChange).toHaveBeenCalledWith(1001);
  });

  it("ArrowUp steps relative to the committed value, not the typed draft", () => {
    const { onChange } = setup({ value: 10, isTailwind: false });
    const inp = getInput();
    // Type a different draft, then arrow — step is from `value` (10), not draft.
    fireEvent.change(inp, { target: { value: "500" } });
    fireEvent.keyDown(inp, { key: "ArrowUp" });
    expect(onChange).toHaveBeenCalledWith(11);
  });

  it("draft resyncs to a new committed value unconditionally (even while focused)", () => {
    const { rerender } = setup({ value: 10 });
    const inp = getInput();
    fireEvent.focus(inp);
    fireEvent.change(inp, { target: { value: "999" } });
    expect(getInput().value).toBe("999");
    // External value change while focused — draft follows it (ungated resync).
    act(() => {
      rerender(
        <SpacingValuePopover
          value={50}
          onChange={vi.fn()}
          unit="px"
          units={["px", "%", "em"]}
          onUnitChange={vi.fn()}
          property="margin-top"
          isMargin={true}
          anchorRect={new DOMRect(100, 100, 50, 24)}
          onClose={vi.fn()}
        />,
      );
    });
    expect(getInput().value).toBe("50");
  });

  it("Escape closes the popover via the global listener (does NOT revert draft, does NOT commit)", () => {
    const { onChange, onClose } = setup({ value: 10 });
    const inp = getInput();
    fireEvent.change(inp, { target: { value: "777" } });
    // Escape goes through the global capture-phase document listener.
    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    expect(onClose).toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
    // Draft is NOT reverted by Escape (popover just closes).
    expect(getInput().value).toBe("777");
  });
});
