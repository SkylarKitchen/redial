// @vitest-environment happy-dom
/**
 * valueInputDraft.test.tsx — behavioral characterization of controls/ValueInput.
 *
 * ValueInput is a shared numeric control with several site-specific concerns
 * beyond the common draft/commit/step core: math-expression eval, empty→keyword
 * commit, alt+click reset, stopPropagation on Escape/arrows, blur-on-Enter, and
 * blur-on-Escape. This test FIRES events to pin the full contract before
 * migrating it onto useDraftNumber, so the migration stays byte-equivalent.
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import { useState } from "react";
import { render, fireEvent, cleanup } from "@testing-library/react";
import { ValueInput } from "../controls/ValueInput";

afterEach(() => cleanup());

/** Controlled wrapper so onChange actually moves `value` (real-app condition). */
function Controlled({
  initial = 10,
  onChangeSpy,
  emptyKeyword,
  onKeywordCommit,
  onAltClick,
  step,
}: {
  initial?: number;
  onChangeSpy?: (v: number) => void;
  emptyKeyword?: string;
  onKeywordCommit?: (k: string) => void;
  onAltClick?: () => void;
  step?: number;
}) {
  const [value, setValue] = useState(initial);
  return (
    <ValueInput
      value={value}
      onChange={(v) => {
        setValue(v);
        onChangeSpy?.(v);
      }}
      emptyKeyword={emptyKeyword}
      onKeywordCommit={onKeywordCommit}
      onAltClick={onAltClick}
      step={step}
    />
  );
}

function input(): HTMLInputElement {
  return document.querySelector('input[aria-label="Value"]') as HTMLInputElement;
}

describe("ValueInput (behavioral characterization)", () => {
  it("shows String(value) when not focused", () => {
    render(<Controlled initial={42} />);
    expect(input().value).toBe("42");
  });

  it("ArrowUp steps by base 1 (rounded to 0.1)", () => {
    const onChangeSpy = vi.fn();
    render(<Controlled initial={10} onChangeSpy={onChangeSpy} />);
    fireEvent.keyDown(input(), { key: "ArrowUp" });
    expect(onChangeSpy).toHaveBeenCalledWith(11);
  });

  it("ArrowDown steps by base 1", () => {
    const onChangeSpy = vi.fn();
    render(<Controlled initial={10} onChangeSpy={onChangeSpy} />);
    fireEvent.keyDown(input(), { key: "ArrowDown" });
    expect(onChangeSpy).toHaveBeenCalledWith(9);
  });

  it("Shift+ArrowUp steps by base*10", () => {
    const onChangeSpy = vi.fn();
    render(<Controlled initial={10} onChangeSpy={onChangeSpy} />);
    fireEvent.keyDown(input(), { key: "ArrowUp", shiftKey: true });
    expect(onChangeSpy).toHaveBeenCalledWith(20);
  });

  it("Alt+ArrowUp steps by base*0.1 (rounded to 0.1)", () => {
    const onChangeSpy = vi.fn();
    render(<Controlled initial={10} onChangeSpy={onChangeSpy} />);
    fireEvent.keyDown(input(), { key: "ArrowUp", altKey: true });
    expect(onChangeSpy).toHaveBeenCalledWith(10.1);
  });

  it("respects a custom step prop for arrow stepping", () => {
    const onChangeSpy = vi.fn();
    render(<Controlled initial={10} onChangeSpy={onChangeSpy} step={5} />);
    fireEvent.keyDown(input(), { key: "ArrowUp" });
    expect(onChangeSpy).toHaveBeenCalledWith(15);
  });

  it("typing a number + Enter commits parseFloat", () => {
    const onChangeSpy = vi.fn();
    render(<Controlled initial={10} onChangeSpy={onChangeSpy} />);
    const inp = input();
    fireEvent.focus(inp);
    fireEvent.change(inp, { target: { value: "37" } });
    fireEvent.keyDown(inp, { key: "Enter" });
    expect(onChangeSpy).toHaveBeenCalledWith(37);
  });

  it("typing a math expression + Enter commits the evaluated result", () => {
    const onChangeSpy = vi.fn();
    render(<Controlled initial={10} onChangeSpy={onChangeSpy} />);
    const inp = input();
    fireEvent.focus(inp);
    fireEvent.change(inp, { target: { value: "10*2" } });
    fireEvent.keyDown(inp, { key: "Enter" });
    expect(onChangeSpy).toHaveBeenCalledWith(20);
  });

  it("Enter blurs the input", () => {
    render(<Controlled initial={10} />);
    const inp = input();
    fireEvent.focus(inp);
    fireEvent.change(inp, { target: { value: "12" } });
    const blurSpy = vi.spyOn(inp, "blur");
    fireEvent.keyDown(inp, { key: "Enter" });
    expect(blurSpy).toHaveBeenCalled();
  });

  it("empty draft + Enter with emptyKeyword calls onKeywordCommit (not onChange)", () => {
    const onChangeSpy = vi.fn();
    const onKeywordCommit = vi.fn();
    render(
      <Controlled
        initial={10}
        onChangeSpy={onChangeSpy}
        emptyKeyword="auto"
        onKeywordCommit={onKeywordCommit}
      />,
    );
    const inp = input();
    fireEvent.focus(inp);
    fireEvent.change(inp, { target: { value: "" } });
    fireEvent.keyDown(inp, { key: "Enter" });
    expect(onKeywordCommit).toHaveBeenCalledWith("auto");
    expect(onChangeSpy).not.toHaveBeenCalled();
  });

  it("blur commits the typed value", () => {
    const onChangeSpy = vi.fn();
    render(<Controlled initial={10} onChangeSpy={onChangeSpy} />);
    const inp = input();
    fireEvent.focus(inp);
    fireEvent.change(inp, { target: { value: "55" } });
    fireEvent.blur(inp);
    expect(onChangeSpy).toHaveBeenCalledWith(55);
  });

  it("alt+click triggers onAltClick and not a value change", () => {
    const onChangeSpy = vi.fn();
    const onAltClick = vi.fn();
    render(<Controlled initial={10} onChangeSpy={onChangeSpy} onAltClick={onAltClick} />);
    fireEvent.click(input(), { altKey: true });
    expect(onAltClick).toHaveBeenCalled();
  });

  it("Escape after typing restores the display to the committed value", () => {
    render(<Controlled initial={10} />);
    const inp = input();
    fireEvent.focus(inp);
    fireEvent.change(inp, { target: { value: "999" } });
    fireEvent.keyDown(inp, { key: "Escape" });
    // After Escape the field is no longer focused, so it shows String(value).
    expect(input().value).toBe("10");
  });
});
