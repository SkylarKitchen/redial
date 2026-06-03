// @vitest-environment happy-dom
/**
 * layoutMiscTypoValueDraft.test.tsx — behavioral characterization of the
 * TypoValueCell numeric cell (exported from sections/layoutMisc.tsx).
 *
 * TypoValueCell is a click-to-edit numeric cell: a span showing the value
 * flips to an <input> on click. This test fires real events to pin the
 * commit / arrow-step / escape / resync contract BEFORE the draft logic is
 * extracted onto useDraftNumber:
 *   - click the value span → enter edit mode (input appears)
 *   - ArrowUp/ArrowDown step by `step` (Shift = 10, Alt = 0.1) and emit onChange
 *   - stepped values round to 2 decimals
 *   - typing + Enter commits (math-expr first, then parseFloat; dedup if unchanged)
 *   - Escape reverts + exits edit mode without committing
 *   - blur commits
 *   - committed value resyncs into the next edit's draft (only when not editing)
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { TypoValueCell } from "../sections/layoutMisc";

afterEach(() => cleanup());

/** Render a TypoValueCell; return the onChange spy and render utils. */
function setup(props: Partial<React.ComponentProps<typeof TypoValueCell>> = {}) {
  const onChange = vi.fn();
  const utils = render(
    <TypoValueCell value={16} onChange={onChange} unit="px" {...props} />,
  );
  return { onChange, ...utils };
}

/** Click the value span (default value 16) to enter edit mode; return the input. */
function edit(valueText = "16"): HTMLInputElement {
  fireEvent.click(screen.getByText(valueText));
  return document.querySelector("input") as HTMLInputElement;
}

describe("TypoValueCell (behavioral)", () => {
  it("clicking the value enters edit mode (shows an input)", () => {
    setup();
    expect(document.querySelector("input")).toBeNull();
    edit();
    expect(document.querySelector("input")).not.toBeNull();
  });

  it("ArrowUp steps by step (default 1) and emits onChange", () => {
    const { onChange } = setup();
    fireEvent.keyDown(edit(), { key: "ArrowUp" });
    expect(onChange).toHaveBeenCalledWith(17);
  });

  it("ArrowDown steps by step (default 1)", () => {
    const { onChange } = setup();
    fireEvent.keyDown(edit(), { key: "ArrowDown" });
    expect(onChange).toHaveBeenCalledWith(15);
  });

  it("Shift+ArrowUp steps by 10", () => {
    const { onChange } = setup();
    fireEvent.keyDown(edit(), { key: "ArrowUp", shiftKey: true });
    expect(onChange).toHaveBeenCalledWith(26);
  });

  it("Alt+ArrowUp steps by 0.1 (rounded to 2 decimals)", () => {
    const { onChange } = setup();
    fireEvent.keyDown(edit(), { key: "ArrowUp", altKey: true });
    expect(onChange).toHaveBeenCalledWith(16.1);
  });

  it("Alt+ArrowDown steps by 0.1", () => {
    const { onChange } = setup();
    fireEvent.keyDown(edit(), { key: "ArrowDown", altKey: true });
    expect(onChange).toHaveBeenCalledWith(15.9);
  });

  it("uses the custom step prop for arrow stepping", () => {
    const { onChange } = setup({ step: 4 });
    fireEvent.keyDown(edit(), { key: "ArrowUp" });
    expect(onChange).toHaveBeenCalledWith(20);
  });

  it("rounds stepped values to 2 decimals", () => {
    // value 0.05 + Alt step 0.1 = 0.15000000000000002 → rounds to 0.15
    const { onChange } = setup({ value: 0.05 });
    fireEvent.keyDown(edit("0.05"), { key: "ArrowUp", altKey: true });
    expect(onChange).toHaveBeenCalledWith(0.15);
  });

  it("arrow-step writes the stepped value into the draft", () => {
    setup();
    const inp = edit();
    fireEvent.keyDown(inp, { key: "ArrowUp" });
    expect(inp.value).toBe("17");
  });

  it("typing a value and pressing Enter commits the parsed number", () => {
    const { onChange } = setup();
    const inp = edit();
    fireEvent.change(inp, { target: { value: "24" } });
    fireEvent.keyDown(inp, { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith(24);
  });

  it("Enter commits a math expression (evaluated against current value)", () => {
    const { onChange } = setup();
    const inp = edit();
    fireEvent.change(inp, { target: { value: "*2" } });
    fireEvent.keyDown(inp, { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith(32);
  });

  it("does not commit when the parsed value is unchanged", () => {
    const { onChange } = setup();
    const inp = edit();
    fireEvent.keyDown(inp, { key: "Enter" }); // draft still "16" === value
    expect(onChange).not.toHaveBeenCalled();
  });

  it("Enter exits edit mode (input goes away, value span returns)", () => {
    setup();
    const inp = edit();
    fireEvent.change(inp, { target: { value: "24" } });
    fireEvent.keyDown(inp, { key: "Enter" });
    expect(document.querySelector("input")).toBeNull();
  });

  it("Escape reverts the draft and exits edit mode without committing", () => {
    const { onChange } = setup();
    const inp = edit();
    fireEvent.change(inp, { target: { value: "99" } });
    fireEvent.keyDown(inp, { key: "Escape" });
    expect(onChange).not.toHaveBeenCalled();
    expect(document.querySelector("input")).toBeNull();
    expect(screen.getByText("16")).toBeTruthy();
  });

  it("blur commits the typed value", () => {
    const { onChange } = setup();
    const inp = edit();
    fireEvent.change(inp, { target: { value: "7" } });
    fireEvent.blur(inp);
    expect(onChange).toHaveBeenCalledWith(7);
  });

  it("displays the committed value (not draft) when not editing", () => {
    const { rerender, onChange } = setup();
    // committed value updates externally while not editing → span reflects it
    rerender(<TypoValueCell value={20} onChange={onChange} unit="px" />);
    expect(screen.getByText("20")).toBeTruthy();
  });

  it("resyncs draft to the committed value for the next edit", () => {
    const { rerender, onChange } = setup();
    // not editing; value changes externally
    rerender(<TypoValueCell value={20} onChange={onChange} unit="px" />);
    const inp = edit("20");
    expect(inp.value).toBe("20");
  });
});
