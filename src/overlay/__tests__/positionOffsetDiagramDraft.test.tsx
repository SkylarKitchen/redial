// @vitest-environment happy-dom
/**
 * positionOffsetDiagramDraft.test.tsx — behavioral characterization of the
 * EditableValue inner cell inside PositionOffsetDiagram.
 *
 * EditableValue is a click-to-edit numeric cell (span <-> input):
 *   - click the value span -> enter edit mode (shows an input)
 *   - alt+click -> onReset (no edit mode)
 *   - ArrowUp/ArrowDown step by `step` (Alt = step*0.1, Shift = step*10),
 *     rounded to 1 decimal, and emit onChange(next) unconditionally
 *   - typing + Enter commits parseFloat(draft), deduped (only if parsed !== value)
 *   - Escape reverts the draft and exits edit mode without committing
 *   - blur commits
 *   - displayed value follows the committed `value` only when NOT editing
 *
 * Fires real events to pin the contract before migrating onto useDraftNumber,
 * so the migration stays byte-equivalent. Reaches the inner cell through the
 * exported PositionOffsetDiagram.
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { PositionOffsetDiagram } from "../sections/PositionOffsetDiagram";

afterEach(() => cleanup());

const UNITS = { top: "px", right: "px", bottom: "px", left: "px" };

/** Render the diagram with given top value; return onChange/onReset spies. */
function setup(opts?: { top?: number; isTailwind?: boolean }) {
  const onChange = vi.fn();
  const onReset = vi.fn();
  const onUnitChange = vi.fn();
  const utils = render(
    <PositionOffsetDiagram
      top={opts?.top ?? 10}
      right={0}
      bottom={0}
      left={0}
      onChange={onChange}
      units={UNITS}
      availableUnits={["px", "%", "em", "rem"]}
      onUnitChange={onUnitChange}
      onReset={onReset}
      isTailwind={opts?.isTailwind ?? false}
    />,
  );
  return { onChange, onReset, onUnitChange, ...utils };
}

/** Click the top value span (text matching its number) to enter edit mode. */
function editTop(topValue: number): HTMLInputElement {
  fireEvent.click(screen.getByText(String(topValue)));
  return document.querySelector("input") as HTMLInputElement;
}

describe("PositionOffsetDiagram EditableValue (behavioral characterization)", () => {
  it("renders the value as a span (no input) until clicked", () => {
    setup({ top: 10 });
    expect(document.querySelector("input")).toBeNull();
    expect(screen.getByText("10")).toBeTruthy();
  });

  it("clicking the value enters edit mode (shows an input)", () => {
    setup({ top: 10 });
    const inp = editTop(10);
    expect(inp).not.toBeNull();
    expect(inp.value).toBe("10");
  });

  it("alt+click triggers onReset and does NOT enter edit mode", () => {
    const { onReset } = setup({ top: 10 });
    fireEvent.click(screen.getByText("10"), { altKey: true });
    expect(onReset).toHaveBeenCalledTimes(1);
    expect(document.querySelector("input")).toBeNull();
  });

  it("ArrowUp steps by base 1 and emits onChange(next)", () => {
    const { onChange } = setup({ top: 10 });
    fireEvent.keyDown(editTop(10), { key: "ArrowUp" });
    expect(onChange).toHaveBeenCalledWith("top", 11);
  });

  it("ArrowDown steps by base 1", () => {
    const { onChange } = setup({ top: 10 });
    fireEvent.keyDown(editTop(10), { key: "ArrowDown" });
    expect(onChange).toHaveBeenCalledWith("top", 9);
  });

  it("Shift+ArrowUp steps by base*10", () => {
    const { onChange } = setup({ top: 10 });
    fireEvent.keyDown(editTop(10), { key: "ArrowUp", shiftKey: true });
    expect(onChange).toHaveBeenCalledWith("top", 20);
  });

  it("Alt+ArrowUp steps by base*0.1 (rounded to 0.1)", () => {
    const { onChange } = setup({ top: 10 });
    fireEvent.keyDown(editTop(10), { key: "ArrowUp", altKey: true });
    expect(onChange).toHaveBeenCalledWith("top", 10.1);
  });

  it("uses Tailwind px step of 4 for arrow stepping", () => {
    const { onChange } = setup({ top: 10, isTailwind: true });
    fireEvent.keyDown(editTop(10), { key: "ArrowUp" });
    expect(onChange).toHaveBeenCalledWith("top", 14);
  });

  it("typing a number + Enter commits parseFloat(draft)", () => {
    const { onChange } = setup({ top: 10 });
    const inp = editTop(10);
    fireEvent.change(inp, { target: { value: "37" } });
    fireEvent.keyDown(inp, { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith("top", 37);
  });

  it("does not commit when the parsed value is unchanged", () => {
    const { onChange } = setup({ top: 10 });
    const inp = editTop(10);
    fireEvent.keyDown(inp, { key: "Enter" }); // draft still "10" === value
    expect(onChange).not.toHaveBeenCalled();
  });

  it("Enter commits and exits edit mode (input gone)", () => {
    setup({ top: 10 });
    const inp = editTop(10);
    fireEvent.change(inp, { target: { value: "37" } });
    fireEvent.keyDown(inp, { key: "Enter" });
    expect(document.querySelector("input")).toBeNull();
  });

  it("Escape reverts the draft and exits edit mode without committing", () => {
    const { onChange } = setup({ top: 10 });
    const inp = editTop(10);
    fireEvent.change(inp, { target: { value: "999" } });
    fireEvent.keyDown(inp, { key: "Escape" });
    // edit mode exits (input gone), value restored, no commit of 999
    expect(document.querySelector("input")).toBeNull();
    expect(onChange).not.toHaveBeenCalledWith("top", 999);
    expect(screen.getByText("10")).toBeTruthy();
  });

  it("blur commits the typed value", () => {
    const { onChange } = setup({ top: 10 });
    const inp = editTop(10);
    fireEvent.change(inp, { target: { value: "7" } });
    fireEvent.blur(inp);
    expect(onChange).toHaveBeenCalledWith("top", 7);
  });

  it("ArrowUp writes the stepped value back into the visible draft", () => {
    setup({ top: 10 });
    const inp = editTop(10);
    fireEvent.keyDown(inp, { key: "ArrowUp" });
    expect((document.querySelector("input") as HTMLInputElement).value).toBe("11");
  });
});
