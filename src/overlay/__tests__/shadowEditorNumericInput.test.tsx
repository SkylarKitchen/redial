// @vitest-environment happy-dom
/**
 * shadowEditorNumericInput.test.tsx — behavioral characterization of the
 * ShadowEditor X/Y/Blur/Spread numeric cells.
 *
 * These cells were previously covered only by source-string assertions, so a
 * refactor could silently break commit/step/escape. This test fires real
 * events to pin the contract before extracting it onto useDraftNumber:
 *   - click the value → enter edit mode
 *   - ArrowUp/ArrowDown step by 1 (Shift = 10) and emit onChange
 *   - typing + Enter commits the parsed value
 *   - Escape reverts without committing
 *   - blur commits
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { ShadowEditor, type ShadowValue } from "../sections/ShadowEditor";

afterEach(() => cleanup());

const SHADOW: ShadowValue = {
  x: 1,
  y: 2,
  blur: 3,
  spread: 4,
  color: "#000000",
  inset: false,
  visible: true,
};

/** Render with a single shadow; return the onChange spy. */
function setup() {
  const onChange = vi.fn();
  const utils = render(<ShadowEditor shadows={[SHADOW]} onChange={onChange} />);
  return { onChange, ...utils };
}

/** Click the value span for X (text "1") to enter edit mode, return the input. */
function editX(): HTMLInputElement {
  fireEvent.click(screen.getByText("1"));
  return document.querySelector("input") as HTMLInputElement;
}

describe("ShadowEditor NumericInput (behavioral)", () => {
  it("clicking the value enters edit mode (shows an input)", () => {
    setup();
    expect(document.querySelector("input")).toBeNull();
    editX();
    expect(document.querySelector("input")).not.toBeNull();
  });

  it("ArrowUp steps X by 1 and emits the updated shadow", () => {
    const { onChange } = setup();
    const inp = editX();
    fireEvent.keyDown(inp, { key: "ArrowUp" });
    expect(onChange).toHaveBeenCalledWith([expect.objectContaining({ x: 2 })]);
  });

  it("ArrowDown steps X by 1", () => {
    const { onChange } = setup();
    fireEvent.keyDown(editX(), { key: "ArrowDown" });
    expect(onChange).toHaveBeenCalledWith([expect.objectContaining({ x: 0 })]);
  });

  it("Shift+ArrowUp steps X by 10", () => {
    const { onChange } = setup();
    fireEvent.keyDown(editX(), { key: "ArrowUp", shiftKey: true });
    expect(onChange).toHaveBeenCalledWith([expect.objectContaining({ x: 11 })]);
  });

  it("typing a value and pressing Enter commits the parsed number", () => {
    const { onChange } = setup();
    const inp = editX();
    fireEvent.change(inp, { target: { value: "50" } });
    fireEvent.keyDown(inp, { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith([expect.objectContaining({ x: 50 })]);
  });

  it("Escape reverts the draft and does not commit", () => {
    const { onChange } = setup();
    const inp = editX();
    fireEvent.change(inp, { target: { value: "99" } });
    fireEvent.keyDown(inp, { key: "Escape" });
    // edit mode exits (input gone), value restored, no commit of 99
    expect(onChange).not.toHaveBeenCalledWith([expect.objectContaining({ x: 99 })]);
    expect(screen.getByText("1")).toBeTruthy();
  });

  it("blur commits the typed value", () => {
    const { onChange } = setup();
    const inp = editX();
    fireEvent.change(inp, { target: { value: "7" } });
    fireEvent.blur(inp);
    expect(onChange).toHaveBeenCalledWith([expect.objectContaining({ x: 7 })]);
  });

  it("does not commit when the value is unchanged", () => {
    const { onChange } = setup();
    const inp = editX();
    fireEvent.keyDown(inp, { key: "Enter" }); // draft still "1" === value
    expect(onChange).not.toHaveBeenCalled();
  });
});

// ─── Text-shadow variant (issue #61) ──────────────────────────────────

describe("ShadowEditor text variant", () => {
  it("hides the Spread cell and Inset toggle for text shadows", () => {
    // text-shadow's grammar has no spread length and no inset keyword, so
    // the controls would edit fields the serializer must never emit.
    render(<ShadowEditor variant="text" shadows={[SHADOW]} onChange={vi.fn()} />);
    expect(screen.queryByText("Spread")).toBeNull();
    expect(screen.queryByText("Inset")).toBeNull();
    // X/Y/Blur remain editable.
    expect(screen.getByText("X")).toBeTruthy();
    expect(screen.getByText("Y")).toBeTruthy();
    expect(screen.getByText("Blur")).toBeTruthy();
  });

  it("shows Spread and Inset by default (box variant)", () => {
    render(<ShadowEditor shadows={[SHADOW]} onChange={vi.fn()} />);
    expect(screen.getByText("Spread")).toBeTruthy();
    expect(screen.getByText("Inset")).toBeTruthy();
  });

  it("previews the text variant without a spread length", () => {
    render(<ShadowEditor variant="text" shadows={[SHADOW]} onChange={vi.fn()} />);
    const swatch = screen.getByTitle("1px 2px 3px #000000");
    expect(swatch).toBeTruthy();
  });
});
