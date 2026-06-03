// @vitest-environment happy-dom
/**
 * sizeInputCellDraft.test.tsx — behavioral characterization of the numeric
 * input inside SizeInputCell (click-to-edit value cell).
 *
 * SizeInputCell renders a click-to-edit value: a <span> showing the committed
 * value that, on click, swaps to an <input> bound to a local `draft`. It carries
 * several site-specific concerns beyond the common draft/commit/step core:
 *   - UNIT-AWARE commit (parseValueWithUnit) + math-expression eval
 *   - empty draft -> contextual keyword (auto/none) commit
 *   - dedup (only onValueChange when parsed !== value)
 *   - Arrow stepping: base=step (default 1), Shift=10 (absolute), Alt=0.1
 *     (absolute), rounded to 0.1, clamped to [min,max], writes BOTH draft + value
 *   - Enter commits (no blur); Escape reverts draft + exits edit mode
 *   - draft resyncs to value only when NOT editing
 *
 * This FIRES real events to pin the contract before migrating onto
 * useDraftNumber, keeping the migration byte-equivalent.
 */
import { describe, it, expect, beforeAll, afterEach, vi } from "vitest";
import { useState } from "react";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { SizeInputCell, type SizeInputCellProps } from "../sections/SizeInputCell";

beforeAll(() => {
  // happy-dom doesn't implement pointer capture — LabelScrub (rendered by the
  // value label) calls it in its drag handlers; polyfill as no-ops.
  const proto = Element.prototype as unknown as Record<string, unknown>;
  if (!proto.setPointerCapture) proto.setPointerCapture = () => {};
  if (!proto.releasePointerCapture) proto.releasePointerCapture = () => {};
  if (!proto.hasPointerCapture) proto.hasPointerCapture = () => false;
});

afterEach(() => cleanup());

/** Controlled wrapper so onValueChange actually moves `value` (real-app cond). */
function Controlled({
  initial = 100,
  onValueChangeSpy,
  onUnitChangeSpy,
  onKeywordChangeSpy,
  ...rest
}: {
  initial?: number;
  onValueChangeSpy?: (v: number) => void;
  onUnitChangeSpy?: (u: string) => void;
  onKeywordChangeSpy?: (k: "auto" | "none" | null) => void;
} & Partial<SizeInputCellProps>) {
  const [value, setValue] = useState(initial);
  const [unit, setUnit] = useState(rest.unit ?? "px");
  return (
    <SizeInputCell
      label="Width"
      value={value}
      unit={unit}
      units={["px", "%", "em", "rem"]}
      isModified={false}
      onValueChange={(v) => {
        setValue(v);
        onValueChangeSpy?.(v);
      }}
      onUnitChange={(u) => {
        setUnit(u);
        onUnitChangeSpy?.(u);
      }}
      onKeywordChange={onKeywordChangeSpy}
      {...rest}
    />
  );
}

/** The current value text is shown in a span; click it to enter edit mode. */
function enterEdit(value: number | string): HTMLInputElement {
  fireEvent.click(screen.getByText(String(value)));
  return document.querySelector("input") as HTMLInputElement;
}

describe("SizeInputCell numeric input (behavioral characterization)", () => {
  it("clicking the value enters edit mode (shows an input)", () => {
    render(<Controlled initial={100} />);
    expect(document.querySelector("input")).toBeNull();
    enterEdit(100);
    expect(document.querySelector("input")).not.toBeNull();
  });

  it("displays the committed value (not the draft) when not editing", () => {
    render(<Controlled initial={42} />);
    expect(screen.getByText("42")).toBeTruthy();
  });

  it("ArrowUp steps by base step 1 and emits onValueChange", () => {
    const onValueChangeSpy = vi.fn();
    render(<Controlled initial={100} onValueChangeSpy={onValueChangeSpy} />);
    fireEvent.keyDown(enterEdit(100), { key: "ArrowUp" });
    expect(onValueChangeSpy).toHaveBeenCalledWith(101);
  });

  it("ArrowDown steps by base step 1", () => {
    const onValueChangeSpy = vi.fn();
    render(<Controlled initial={100} onValueChangeSpy={onValueChangeSpy} />);
    fireEvent.keyDown(enterEdit(100), { key: "ArrowDown" });
    expect(onValueChangeSpy).toHaveBeenCalledWith(99);
  });

  it("respects a custom step prop for base stepping", () => {
    const onValueChangeSpy = vi.fn();
    render(<Controlled initial={100} step={5} onValueChangeSpy={onValueChangeSpy} />);
    fireEvent.keyDown(enterEdit(100), { key: "ArrowUp" });
    expect(onValueChangeSpy).toHaveBeenCalledWith(105);
  });

  it("Shift+ArrowUp steps by 10 (absolute, independent of step prop)", () => {
    const onValueChangeSpy = vi.fn();
    render(<Controlled initial={100} step={5} onValueChangeSpy={onValueChangeSpy} />);
    fireEvent.keyDown(enterEdit(100), { key: "ArrowUp", shiftKey: true });
    expect(onValueChangeSpy).toHaveBeenCalledWith(110);
  });

  it("Alt+ArrowUp steps by 0.1 (rounded to 0.1)", () => {
    const onValueChangeSpy = vi.fn();
    render(<Controlled initial={100} onValueChangeSpy={onValueChangeSpy} />);
    fireEvent.keyDown(enterEdit(100), { key: "ArrowUp", altKey: true });
    expect(onValueChangeSpy).toHaveBeenCalledWith(100.1);
  });

  it("Arrow step clamps to max", () => {
    const onValueChangeSpy = vi.fn();
    render(<Controlled initial={100} max={100} onValueChangeSpy={onValueChangeSpy} />);
    fireEvent.keyDown(enterEdit(100), { key: "ArrowUp" });
    expect(onValueChangeSpy).toHaveBeenCalledWith(100);
  });

  it("Arrow step clamps to min", () => {
    const onValueChangeSpy = vi.fn();
    render(<Controlled initial={0} min={0} onValueChangeSpy={onValueChangeSpy} />);
    fireEvent.keyDown(enterEdit(0), { key: "ArrowDown" });
    expect(onValueChangeSpy).toHaveBeenCalledWith(0);
  });

  it("Arrow step also writes the stepped value into the draft (input value)", () => {
    render(<Controlled initial={100} />);
    const inp = enterEdit(100);
    fireEvent.keyDown(inp, { key: "ArrowUp" });
    // Editing stays true and the draft now reflects the stepped value.
    const after = document.querySelector("input") as HTMLInputElement;
    expect(after.value).toBe("101");
  });

  it("typing a number + Enter commits the parsed value", () => {
    const onValueChangeSpy = vi.fn();
    render(<Controlled initial={100} onValueChangeSpy={onValueChangeSpy} />);
    const inp = enterEdit(100);
    fireEvent.change(inp, { target: { value: "250" } });
    fireEvent.keyDown(inp, { key: "Enter" });
    expect(onValueChangeSpy).toHaveBeenCalledWith(250);
  });

  it("typing a math expression + Enter commits the evaluated result", () => {
    const onValueChangeSpy = vi.fn();
    render(<Controlled initial={100} onValueChangeSpy={onValueChangeSpy} />);
    const inp = enterEdit(100);
    fireEvent.change(inp, { target: { value: "*2" } });
    fireEvent.keyDown(inp, { key: "Enter" });
    expect(onValueChangeSpy).toHaveBeenCalledWith(200);
  });

  it("typing a value with a different unit suffix switches unit and value", () => {
    const onValueChangeSpy = vi.fn();
    const onUnitChangeSpy = vi.fn();
    render(
      <Controlled
        initial={100}
        onValueChangeSpy={onValueChangeSpy}
        onUnitChangeSpy={onUnitChangeSpy}
      />,
    );
    const inp = enterEdit(100);
    fireEvent.change(inp, { target: { value: "68em" } });
    fireEvent.keyDown(inp, { key: "Enter" });
    expect(onUnitChangeSpy).toHaveBeenCalledWith("em");
    expect(onValueChangeSpy).toHaveBeenCalledWith(68);
  });

  it("empty draft + Enter commits the contextual keyword (auto) when supported", () => {
    const onKeywordChangeSpy = vi.fn();
    const onValueChangeSpy = vi.fn();
    render(
      <Controlled
        initial={100}
        supportsAuto
        onKeywordChangeSpy={onKeywordChangeSpy}
        onValueChangeSpy={onValueChangeSpy}
      />,
    );
    const inp = enterEdit(100);
    fireEvent.change(inp, { target: { value: "" } });
    fireEvent.keyDown(inp, { key: "Enter" });
    expect(onKeywordChangeSpy).toHaveBeenCalledWith("auto");
    expect(onValueChangeSpy).not.toHaveBeenCalled();
  });

  it("empty draft + Enter commits 'none' when supportsNone (and not auto)", () => {
    const onKeywordChangeSpy = vi.fn();
    render(
      <Controlled
        initial={100}
        supportsNone
        onKeywordChangeSpy={onKeywordChangeSpy}
      />,
    );
    const inp = enterEdit(100);
    fireEvent.change(inp, { target: { value: "" } });
    fireEvent.keyDown(inp, { key: "Enter" });
    expect(onKeywordChangeSpy).toHaveBeenCalledWith("none");
  });

  it("does not commit when the parsed value is unchanged (dedup)", () => {
    const onValueChangeSpy = vi.fn();
    render(<Controlled initial={100} onValueChangeSpy={onValueChangeSpy} />);
    const inp = enterEdit(100);
    fireEvent.keyDown(inp, { key: "Enter" }); // draft "100" === value
    expect(onValueChangeSpy).not.toHaveBeenCalled();
  });

  it("blur commits the typed value", () => {
    const onValueChangeSpy = vi.fn();
    render(<Controlled initial={100} onValueChangeSpy={onValueChangeSpy} />);
    const inp = enterEdit(100);
    fireEvent.change(inp, { target: { value: "77" } });
    fireEvent.blur(inp);
    expect(onValueChangeSpy).toHaveBeenCalledWith(77);
  });

  it("Enter exits edit mode (input -> span)", () => {
    render(<Controlled initial={100} />);
    const inp = enterEdit(100);
    fireEvent.change(inp, { target: { value: "250" } });
    fireEvent.keyDown(inp, { key: "Enter" });
    // After commit, editing flips off and the value text reappears.
    expect(screen.getByText("250")).toBeTruthy();
    expect(document.querySelector("input")).toBeNull();
  });

  it("Escape reverts the draft, exits edit mode, and does not commit", () => {
    const onValueChangeSpy = vi.fn();
    render(<Controlled initial={100} onValueChangeSpy={onValueChangeSpy} />);
    const inp = enterEdit(100);
    fireEvent.change(inp, { target: { value: "999" } });
    fireEvent.keyDown(inp, { key: "Escape" });
    expect(onValueChangeSpy).not.toHaveBeenCalledWith(999);
    // edit mode exited; original committed value still displayed
    expect(document.querySelector("input")).toBeNull();
    expect(screen.getByText("100")).toBeTruthy();
  });

  it("draft resyncs to the committed value when not editing", () => {
    function Harness() {
      const [v, setV] = useState(100);
      return (
        <>
          <button onClick={() => setV(300)}>bump</button>
          <SizeInputCell
            label="Width"
            value={v}
            unit="px"
            units={["px", "%"]}
            isModified={false}
            onValueChange={setV}
            onUnitChange={() => {}}
          />
        </>
      );
    }
    render(<Harness />);
    // Not editing: bumping value updates the displayed span.
    fireEvent.click(screen.getByText("bump"));
    expect(screen.getByText("300")).toBeTruthy();
  });
});
