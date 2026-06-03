// @vitest-environment happy-dom
/**
 * cornerRadiusEditorDraft.test.tsx — behavioral characterization of the
 * CornerRadiusEditor's per-corner numeric cell (CornerCell).
 *
 * The cell is click-to-edit: a value span swaps to an autoFocus input. These
 * cells were only covered by source-string assertions, so this test fires real
 * events to pin the exact contract before migrating the bespoke
 * draft/commit/step/resync logic onto useDraftNumber:
 *   - click the value span → enter edit mode (input appears)
 *   - ArrowUp/ArrowDown step by 1, Shift = 10 (NO alt step), clamp 0..999
 *   - arrow-step writes the stepped value back into the draft AND emits onChange
 *   - typing + Enter commits parseFloat(draft), only if parsed !== value (dedup)
 *   - commit clamps the parsed value to 0..999
 *   - Escape reverts the draft and exits edit mode without committing
 *   - blur commits the typed value
 *   - resync: the displayed value follows the committed value only when not editing
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { CornerRadiusEditor } from "../sections/CornerRadiusEditor";

afterEach(() => cleanup());

/**
 * Render the editor with distinct per-corner values so each cell's value span
 * is uniquely findable by its rendered number text. Returns the onChange spy.
 */
function setup(overrides: Partial<React.ComponentProps<typeof CornerRadiusEditor>> = {}) {
  const onChange = vi.fn();
  const props = {
    topLeft: 5,
    topRight: 11,
    bottomRight: 22,
    bottomLeft: 33,
    onChange,
    unit: "px",
    units: ["px", "%", "em"],
    onUnitChange: vi.fn(),
    ...overrides,
  };
  const utils = render(<CornerRadiusEditor {...props} />);
  return { onChange, props, ...utils };
}

/** Click the value span showing `text` to enter edit mode; return the input. */
function edit(text: string): HTMLInputElement {
  fireEvent.click(screen.getByText(text));
  return document.querySelector("input") as HTMLInputElement;
}

describe("CornerRadiusEditor CornerCell (behavioral)", () => {
  it("starts with no input; clicking a value span enters edit mode", () => {
    setup();
    expect(document.querySelector("input")).toBeNull();
    edit("5");
    expect(document.querySelector("input")).not.toBeNull();
  });

  it("ArrowUp steps the top-left corner by 1 and emits onChange", () => {
    const { onChange } = setup();
    const inp = edit("5");
    fireEvent.keyDown(inp, { key: "ArrowUp" });
    expect(onChange).toHaveBeenCalledWith("border-top-left-radius", 6);
  });

  it("ArrowDown steps by 1", () => {
    const { onChange } = setup();
    const inp = edit("5");
    fireEvent.keyDown(inp, { key: "ArrowDown" });
    expect(onChange).toHaveBeenCalledWith("border-top-left-radius", 4);
  });

  it("Shift+ArrowUp steps by 10", () => {
    const { onChange } = setup();
    const inp = edit("5");
    fireEvent.keyDown(inp, { key: "ArrowUp", shiftKey: true });
    expect(onChange).toHaveBeenCalledWith("border-top-left-radius", 15);
  });

  it("Shift+ArrowDown steps by 10", () => {
    const { onChange } = setup();
    const inp = edit("33"); // bottomLeft
    fireEvent.keyDown(inp, { key: "ArrowDown", shiftKey: true });
    expect(onChange).toHaveBeenCalledWith("border-bottom-left-radius", 23);
  });

  it("Alt is NOT a special step modifier (alt+ArrowUp still steps by 1)", () => {
    const { onChange } = setup();
    const inp = edit("5");
    fireEvent.keyDown(inp, { key: "ArrowUp", altKey: true });
    expect(onChange).toHaveBeenCalledWith("border-top-left-radius", 6);
  });

  it("ArrowDown clamps the stepped value at 0 (min)", () => {
    const { onChange } = setup({ topLeft: 0 });
    const inp = edit("0");
    fireEvent.keyDown(inp, { key: "ArrowDown" });
    expect(onChange).toHaveBeenCalledWith("border-top-left-radius", 0);
  });

  it("ArrowUp clamps the stepped value at 999 (max)", () => {
    const { onChange } = setup({ topLeft: 999 });
    const inp = edit("999");
    fireEvent.keyDown(inp, { key: "ArrowUp" });
    expect(onChange).toHaveBeenCalledWith("border-top-left-radius", 999);
  });

  it("arrow-step writes the stepped value back into the draft (input reflects it)", () => {
    setup();
    const inp = edit("5");
    fireEvent.keyDown(inp, { key: "ArrowUp" });
    expect(inp.value).toBe("6");
  });

  it("typing a value and pressing Enter commits the parsed number", () => {
    const { onChange } = setup();
    const inp = edit("5");
    fireEvent.change(inp, { target: { value: "50" } });
    fireEvent.keyDown(inp, { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith("border-top-left-radius", 50);
  });

  it("commit uses parseFloat (decimals preserved)", () => {
    const { onChange } = setup();
    const inp = edit("5");
    fireEvent.change(inp, { target: { value: "12.5" } });
    fireEvent.keyDown(inp, { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith("border-top-left-radius", 12.5);
  });

  it("commit clamps a parsed value above the max to 999", () => {
    const { onChange } = setup();
    const inp = edit("5");
    fireEvent.change(inp, { target: { value: "1000" } });
    fireEvent.keyDown(inp, { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith("border-top-left-radius", 999);
  });

  it("does not commit when the parsed value equals the current value (dedup)", () => {
    const { onChange } = setup();
    const inp = edit("5");
    fireEvent.keyDown(inp, { key: "Enter" }); // draft still "5" === value 5
    expect(onChange).not.toHaveBeenCalled();
  });

  it("does not commit when the draft is not a number", () => {
    const { onChange } = setup();
    const inp = edit("5");
    fireEvent.change(inp, { target: { value: "abc" } });
    fireEvent.keyDown(inp, { key: "Enter" });
    expect(onChange).not.toHaveBeenCalled();
  });

  it("Enter commit exits edit mode (input goes away, span returns)", () => {
    setup();
    const inp = edit("5");
    fireEvent.change(inp, { target: { value: "7" } });
    fireEvent.keyDown(inp, { key: "Enter" });
    expect(document.querySelector("input")).toBeNull();
  });

  it("blur commits the typed value", () => {
    const { onChange } = setup();
    const inp = edit("5");
    fireEvent.change(inp, { target: { value: "7" } });
    fireEvent.blur(inp);
    expect(onChange).toHaveBeenCalledWith("border-top-left-radius", 7);
  });

  it("Escape reverts the draft and exits edit mode without committing", () => {
    const { onChange } = setup();
    const inp = edit("5");
    fireEvent.change(inp, { target: { value: "99" } });
    fireEvent.keyDown(inp, { key: "Escape" });
    // No commit of 99
    expect(onChange).not.toHaveBeenCalledWith("border-top-left-radius", 99);
    // Edit mode exited: input gone, original value span returns
    expect(document.querySelector("input")).toBeNull();
    expect(screen.getByText("5")).toBeTruthy();
  });

  it("resync: while editing, the displayed draft does NOT follow an external value change", () => {
    const { rerender, props } = setup();
    const inp = edit("5");
    fireEvent.change(inp, { target: { value: "8" } });
    // External value change arrives while editing
    rerender(<CornerRadiusEditor {...props} topLeft={42} />);
    // Draft preserved (gated on !editing)
    expect((document.querySelector("input") as HTMLInputElement).value).toBe("8");
  });

  it("resync: when not editing, the displayed value follows the committed value", () => {
    const { rerender, props } = setup();
    expect(screen.getByText("5")).toBeTruthy();
    rerender(<CornerRadiusEditor {...props} topLeft={77} />);
    expect(screen.getByText("77")).toBeTruthy();
  });
});
