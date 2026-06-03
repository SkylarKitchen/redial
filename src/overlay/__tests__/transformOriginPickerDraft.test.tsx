// @vitest-environment happy-dom
/**
 * transformOriginPickerDraft.test.tsx — behavioral characterization of the
 * OriginInput numeric cell inside TransformOriginPicker (showInputs mode).
 *
 * OriginInput is an always-on text input with a "%" suffix. It pins:
 *   - ArrowUp/ArrowDown step by 1 (no Shift/Alt multiplier), clamped to [0,100]
 *   - rounding: the displayed value is String(Math.round(value))
 *   - typing a number + Enter commits parseFloat → Math.round → clamp [0,100]
 *   - blur commits the typed value (same parse/round/clamp)
 *   - NaN draft on commit reverts to the rounded committed value (no onChange)
 *   - Escape does NOT revert / is not specially handled
 *   - external value change resyncs the draft (ungated)
 *
 * The picker emits onChange("v% topPct%") for the Left input and
 * onChange("leftPct% v%") for the Top input. A Controlled wrapper keeps the
 * value string flowing so resync is observable.
 *
 * This MUST pass against the un-migrated code before the migration onto
 * useDraftNumber, and stay green after.
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import { useState } from "react";
import { render, fireEvent, cleanup } from "@testing-library/react";
import { TransformOriginPicker } from "../sections/TransformOriginPicker";

afterEach(() => cleanup());

/** Controlled wrapper so onChange moves the origin string (real-app condition). */
function Controlled({
  initial = "50% 50%",
  onChangeSpy,
}: {
  initial?: string;
  onChangeSpy?: (v: string) => void;
}) {
  const [value, setValue] = useState(initial);
  return (
    <TransformOriginPicker
      value={value}
      onChange={(v) => {
        setValue(v);
        onChangeSpy?.(v);
      }}
      showInputs
    />
  );
}

/** The two OriginInputs are the only <input> elements: [0]=Left, [1]=Top. */
function inputs(): HTMLInputElement[] {
  return Array.from(document.querySelectorAll("input")) as HTMLInputElement[];
}
function leftInput(): HTMLInputElement {
  return inputs()[0];
}
function topInput(): HTMLInputElement {
  return inputs()[1];
}

describe("TransformOriginPicker OriginInput (behavioral characterization)", () => {
  it("renders Left and Top inputs showing the rounded committed value", () => {
    render(<Controlled initial="50% 50%" />);
    expect(leftInput().value).toBe("50");
    expect(topInput().value).toBe("50");
  });

  it("rounds the displayed value (e.g. 33.4 → 33)", () => {
    render(<Controlled initial="33.4% 66.6%" />);
    expect(leftInput().value).toBe("33");
    expect(topInput().value).toBe("67");
  });

  it("ArrowUp on Left steps by 1 and emits 'v% topPct%'", () => {
    const onChangeSpy = vi.fn();
    render(<Controlled initial="50% 50%" onChangeSpy={onChangeSpy} />);
    fireEvent.keyDown(leftInput(), { key: "ArrowUp" });
    expect(onChangeSpy).toHaveBeenCalledWith("51% 50%");
  });

  it("ArrowDown on Left steps by 1 and emits 'v% topPct%'", () => {
    const onChangeSpy = vi.fn();
    render(<Controlled initial="50% 50%" onChangeSpy={onChangeSpy} />);
    fireEvent.keyDown(leftInput(), { key: "ArrowDown" });
    expect(onChangeSpy).toHaveBeenCalledWith("49% 50%");
  });

  it("ArrowUp on Top steps by 1 and emits 'leftPct% v%'", () => {
    const onChangeSpy = vi.fn();
    render(<Controlled initial="40% 60%" onChangeSpy={onChangeSpy} />);
    fireEvent.keyDown(topInput(), { key: "ArrowUp" });
    expect(onChangeSpy).toHaveBeenCalledWith("40% 61%");
  });

  it("Shift+ArrowUp still steps by 1 (no Shift multiplier)", () => {
    const onChangeSpy = vi.fn();
    render(<Controlled initial="50% 50%" onChangeSpy={onChangeSpy} />);
    fireEvent.keyDown(leftInput(), { key: "ArrowUp", shiftKey: true });
    expect(onChangeSpy).toHaveBeenCalledWith("51% 50%");
  });

  it("Alt+ArrowUp still steps by 1 (no Alt multiplier)", () => {
    const onChangeSpy = vi.fn();
    render(<Controlled initial="50% 50%" onChangeSpy={onChangeSpy} />);
    fireEvent.keyDown(leftInput(), { key: "ArrowUp", altKey: true });
    expect(onChangeSpy).toHaveBeenCalledWith("51% 50%");
  });

  it("ArrowUp clamps to 100", () => {
    const onChangeSpy = vi.fn();
    render(<Controlled initial="100% 50%" onChangeSpy={onChangeSpy} />);
    fireEvent.keyDown(leftInput(), { key: "ArrowUp" });
    expect(onChangeSpy).toHaveBeenCalledWith("100% 50%");
  });

  it("ArrowDown clamps to 0", () => {
    const onChangeSpy = vi.fn();
    render(<Controlled initial="0% 50%" onChangeSpy={onChangeSpy} />);
    fireEvent.keyDown(leftInput(), { key: "ArrowDown" });
    expect(onChangeSpy).toHaveBeenCalledWith("0% 50%");
  });

  it("typing a number + Enter commits parseFloat→round→clamp and emits percent", () => {
    const onChangeSpy = vi.fn();
    render(<Controlled initial="50% 50%" onChangeSpy={onChangeSpy} />);
    const inp = leftInput();
    fireEvent.change(inp, { target: { value: "37.6" } });
    fireEvent.keyDown(inp, { key: "Enter" });
    expect(onChangeSpy).toHaveBeenCalledWith("38% 50%");
  });

  it("Enter with out-of-range value clamps to 100", () => {
    const onChangeSpy = vi.fn();
    render(<Controlled initial="50% 50%" onChangeSpy={onChangeSpy} />);
    const inp = leftInput();
    fireEvent.change(inp, { target: { value: "250" } });
    fireEvent.keyDown(inp, { key: "Enter" });
    expect(onChangeSpy).toHaveBeenCalledWith("100% 50%");
  });

  it("blur commits the typed value", () => {
    const onChangeSpy = vi.fn();
    render(<Controlled initial="50% 50%" onChangeSpy={onChangeSpy} />);
    const inp = leftInput();
    fireEvent.change(inp, { target: { value: "20" } });
    fireEvent.blur(inp);
    expect(onChangeSpy).toHaveBeenCalledWith("20% 50%");
  });

  it("NaN draft on commit reverts to rounded committed value and does not call onChange", () => {
    const onChangeSpy = vi.fn();
    render(<Controlled initial="50% 50%" onChangeSpy={onChangeSpy} />);
    const inp = leftInput();
    fireEvent.change(inp, { target: { value: "abc" } });
    fireEvent.blur(inp);
    expect(onChangeSpy).not.toHaveBeenCalled();
    expect(leftInput().value).toBe("50");
  });

  it("Escape does not revert the draft (not specially handled)", () => {
    render(<Controlled initial="50% 50%" />);
    const inp = leftInput();
    fireEvent.change(inp, { target: { value: "12" } });
    fireEvent.keyDown(inp, { key: "Escape" });
    // Escape is a no-op: the typed draft is preserved (no resync, no commit).
    expect(leftInput().value).toBe("12");
  });

  it("external value change resyncs the displayed draft (ungated)", () => {
    const onChangeSpy = vi.fn();
    render(<Controlled initial="50% 50%" onChangeSpy={onChangeSpy} />);
    // Step Top up — that changes the value string, which resyncs Left's draft.
    fireEvent.keyDown(topInput(), { key: "ArrowUp" });
    expect(onChangeSpy).toHaveBeenCalledWith("50% 51%");
    // Left should still display 50 (resynced from the new "50% 51%").
    expect(leftInput().value).toBe("50");
  });
});
