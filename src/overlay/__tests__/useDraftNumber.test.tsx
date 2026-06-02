// @vitest-environment happy-dom
/**
 * useDraftNumber.test.tsx — contract for the shared draft-number input hook.
 *
 * The hook owns the genuinely-duplicated core of ~14 hand-rolled numeric
 * inputs: draft state, value→draft resync (gated), Enter/Escape/Arrow key
 * routing, and the modifier→step math (Shift/Alt multipliers, clamp, round).
 * Site-specific parsing/clamping lives in the caller's onCommit/onStep.
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import { useState } from "react";
import { render, fireEvent, cleanup, act } from "@testing-library/react";
import { useDraftNumber, type UseDraftNumberOptions } from "../hooks/useDraftNumber";

afterEach(() => cleanup());

type HarnessProps = Partial<UseDraftNumberOptions> & {
  value: number;
  onCommit?: (draft: string) => void;
  onStep?: (next: number) => void;
  onEscape?: () => void;
};

/** Renders an input wired to the hook; exposes the live draft via a sibling. */
function Harness(props: HarnessProps) {
  const { value, onCommit, onStep, onEscape, ...rest } = props;
  const { draft, inputProps } = useDraftNumber({
    value,
    resync: true,
    onCommit: onCommit ?? (() => {}),
    onStep: onStep ?? (() => {}),
    onEscape,
    ...rest,
  });
  return <input data-testid="inp" value={draft} {...inputProps} />;
}

function getInput() {
  return document.querySelector('[data-testid="inp"]') as HTMLInputElement;
}

describe("useDraftNumber", () => {
  it("initializes draft to String(value)", () => {
    render(<Harness value={42} />);
    expect(getInput().value).toBe("42");
  });

  it("typing updates the draft", () => {
    render(<Harness value={1} />);
    fireEvent.change(getInput(), { target: { value: "37" } });
    expect(getInput().value).toBe("37");
  });

  it("resyncs draft to the new value when resync=true", () => {
    function Wrap() {
      const [v, setV] = useState(1);
      return (
        <>
          <Harness value={v} />
          <button onClick={() => setV(9)}>bump</button>
        </>
      );
    }
    render(<Wrap />);
    expect(getInput().value).toBe("1");
    fireEvent.click(document.querySelector("button")!);
    expect(getInput().value).toBe("9");
  });

  it("does NOT resync while resync=false (e.g. focused/editing)", () => {
    function Wrap() {
      const [v, setV] = useState(1);
      const { draft, inputProps } = useDraftNumber({
        value: v,
        resync: false,
        onCommit: () => {},
        onStep: () => {},
      });
      return (
        <>
          <input data-testid="inp" value={draft} {...inputProps} />
          <button onClick={() => setV(9)}>bump</button>
        </>
      );
    }
    render(<Wrap />);
    fireEvent.click(document.querySelector("button")!);
    expect(getInput().value).toBe("1"); // frozen
  });

  it("Enter commits the current draft", () => {
    const onCommit = vi.fn();
    render(<Harness value={1} onCommit={onCommit} />);
    fireEvent.change(getInput(), { target: { value: "5" } });
    fireEvent.keyDown(getInput(), { key: "Enter" });
    expect(onCommit).toHaveBeenCalledWith("5");
  });

  it("blur commits the current draft", () => {
    const onCommit = vi.fn();
    render(<Harness value={1} onCommit={onCommit} />);
    fireEvent.change(getInput(), { target: { value: "8" } });
    fireEvent.blur(getInput());
    expect(onCommit).toHaveBeenCalledWith("8");
  });

  it("blurOnEnter blurs the input after committing", () => {
    render(<Harness value={1} blurOnEnter />);
    const inp = getInput();
    act(() => inp.focus());
    expect(document.activeElement).toBe(inp);
    fireEvent.keyDown(inp, { key: "Enter" });
    expect(document.activeElement).not.toBe(inp);
  });

  it("Escape reverts the draft and calls onEscape when revertOnEscape is set", () => {
    const onEscape = vi.fn();
    render(<Harness value={3} revertOnEscape onEscape={onEscape} />);
    fireEvent.change(getInput(), { target: { value: "99" } });
    expect(getInput().value).toBe("99");
    fireEvent.keyDown(getInput(), { key: "Escape" });
    expect(getInput().value).toBe("3"); // reverted
    expect(onEscape).toHaveBeenCalled();
  });

  it("Escape is a no-op when neither revertOnEscape nor onEscape is set", () => {
    render(<Harness value={3} />);
    fireEvent.change(getInput(), { target: { value: "99" } });
    fireEvent.keyDown(getInput(), { key: "Escape" });
    expect(getInput().value).toBe("99"); // not reverted
  });

  it("ArrowUp/ArrowDown step by `step` (default 1) from value", () => {
    const onStep = vi.fn();
    render(<Harness value={10} step={1} onStep={onStep} />);
    fireEvent.keyDown(getInput(), { key: "ArrowUp" });
    expect(onStep).toHaveBeenLastCalledWith(11);
    fireEvent.keyDown(getInput(), { key: "ArrowDown" });
    expect(onStep).toHaveBeenLastCalledWith(9);
  });

  it("Shift multiplies the step (default shiftStep = step*10)", () => {
    const onStep = vi.fn();
    render(<Harness value={100} step={1} onStep={onStep} />);
    fireEvent.keyDown(getInput(), { key: "ArrowUp", shiftKey: true });
    expect(onStep).toHaveBeenLastCalledWith(110);
  });

  it("Alt uses altStep when provided, otherwise is ignored", () => {
    const onStep = vi.fn();
    render(<Harness value={1} step={1} altStep={0.1} onStep={onStep} />);
    fireEvent.keyDown(getInput(), { key: "ArrowUp", altKey: true });
    expect(onStep).toHaveBeenLastCalledWith(1.1);
  });

  it("clamps the stepped value to [min,max]", () => {
    const onStep = vi.fn();
    render(<Harness value={5000} step={50} min={0} max={5000} onStep={onStep} />);
    fireEvent.keyDown(getInput(), { key: "ArrowUp" });
    expect(onStep).toHaveBeenLastCalledWith(5000); // clamped at max
  });

  it("rounds the stepped value to `round` decimals", () => {
    const onStep = vi.fn();
    render(<Harness value={1.1} step={0.1} round={3} altStep={0.1} onStep={onStep} />);
    fireEvent.keyDown(getInput(), { key: "ArrowUp" });
    // 1.1 + 0.1 = 1.2000000000000002 → rounded to 1.2
    expect(onStep).toHaveBeenLastCalledWith(1.2);
  });

  it("stepUpdatesDraft writes the stepped value back into the draft", () => {
    render(<Harness value={10} step={1} stepUpdatesDraft />);
    fireEvent.keyDown(getInput(), { key: "ArrowUp" });
    expect(getInput().value).toBe("11");
  });

  it("does NOT update the draft on step when stepUpdatesDraft is false", () => {
    // draft stays at the (resync=false) frozen value; only onStep fires
    function Wrap() {
      const { draft, inputProps } = useDraftNumber({
        value: 10,
        resync: false,
        step: 1,
        onCommit: () => {},
        onStep: () => {},
      });
      return <input data-testid="inp" value={draft} {...inputProps} />;
    }
    render(<Wrap />);
    fireEvent.keyDown(getInput(), { key: "ArrowUp" });
    expect(getInput().value).toBe("10");
  });
});
