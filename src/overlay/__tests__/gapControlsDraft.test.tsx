// @vitest-environment happy-dom
/**
 * gapControlsDraft.test.tsx — behavioral characterization of the GapInput
 * numeric cell inside the exported GapRow.
 *
 * GapInput is a click-to-edit numeric cell (span <-> input) with a bespoke
 * draft/commit/step/resync implementation. These axes were previously
 * uncovered, so this test FIRES real events to pin the contract before
 * migrating GapInput onto useDraftNumber, keeping the migration
 * byte-for-byte equivalent:
 *   - click the value span -> enter edit mode (input appears)
 *   - ArrowUp/ArrowDown step by 1 (Shift = 10) and emit onChange
 *   - ArrowDown clamps at a minimum of 0
 *   - typing + Enter commits parseFloat (and math expressions via evaluateMathExpr)
 *   - Enter does NOT commit when the parsed value is unchanged
 *   - Escape reverts the draft and exits edit mode without committing
 *   - blur commits the typed value
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import { useState } from "react";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { GapRow } from "../sections/GapControls";

afterEach(() => cleanup());

/**
 * Controlled wrapper so onColumnChange actually moves the column gap value
 * (the real-app condition). Renders GapRow unlinked so the column input is
 * isolated. Returns the column-change spy.
 */
function Controlled({
  initial = 5,
  onColumnChangeSpy,
}: {
  initial?: number;
  onColumnChangeSpy?: (v: number) => void;
}) {
  const [columnGap, setColumnGap] = useState(initial);
  // Distinct non-colliding rowGap so getByText(columnGap) is unambiguous,
  // even when the column gap is 0.
  const [rowGap, setRowGap] = useState(123);
  return (
    <GapRow
      columnGap={columnGap}
      rowGap={rowGap}
      columnUnit="px"
      rowUnit="px"
      onColumnChange={(v) => {
        setColumnGap(v);
        onColumnChangeSpy?.(v);
      }}
      onRowChange={setRowGap}
      onColumnUnitChange={() => {}}
      onRowUnitChange={() => {}}
      linked={false}
      onLinkedChange={() => {}}
    />
  );
}

/** Click the column-gap value span (its text == the column gap) to edit. */
function editColumn(value: number): HTMLInputElement {
  fireEvent.click(screen.getByText(String(value)));
  return document.querySelector("input") as HTMLInputElement;
}

describe("GapInput (behavioral characterization)", () => {
  it("clicking the value enters edit mode (shows an input)", () => {
    render(<Controlled initial={5} />);
    expect(document.querySelector("input")).toBeNull();
    editColumn(5);
    expect(document.querySelector("input")).not.toBeNull();
  });

  it("the input starts with the current value as its draft", () => {
    render(<Controlled initial={5} />);
    const inp = editColumn(5);
    expect(inp.value).toBe("5");
  });

  it("seeds the edit draft with the value rounded to 2 decimals", () => {
    // Original behavior: the resynced draft is String(Math.round(value*100)/100).
    // The display span still shows the raw value, but the editable draft rounds.
    render(<Controlled initial={5.125} />);
    fireEvent.click(screen.getByText("5.125"));
    const inp = document.querySelector("input") as HTMLInputElement;
    expect(inp.value).toBe("5.13");
  });

  it("ArrowUp steps by 1", () => {
    const onColumnChangeSpy = vi.fn();
    render(<Controlled initial={5} onColumnChangeSpy={onColumnChangeSpy} />);
    fireEvent.keyDown(editColumn(5), { key: "ArrowUp" });
    expect(onColumnChangeSpy).toHaveBeenCalledWith(6);
  });

  it("ArrowDown steps by 1", () => {
    const onColumnChangeSpy = vi.fn();
    render(<Controlled initial={5} onColumnChangeSpy={onColumnChangeSpy} />);
    fireEvent.keyDown(editColumn(5), { key: "ArrowDown" });
    expect(onColumnChangeSpy).toHaveBeenCalledWith(4);
  });

  it("Shift+ArrowUp steps by 10", () => {
    const onColumnChangeSpy = vi.fn();
    render(<Controlled initial={5} onColumnChangeSpy={onColumnChangeSpy} />);
    fireEvent.keyDown(editColumn(5), { key: "ArrowUp", shiftKey: true });
    expect(onColumnChangeSpy).toHaveBeenCalledWith(15);
  });

  it("Shift+ArrowDown steps by 10", () => {
    const onColumnChangeSpy = vi.fn();
    render(<Controlled initial={20} onColumnChangeSpy={onColumnChangeSpy} />);
    fireEvent.keyDown(editColumn(20), { key: "ArrowDown", shiftKey: true });
    expect(onColumnChangeSpy).toHaveBeenCalledWith(10);
  });

  it("ArrowDown clamps at a minimum of 0", () => {
    const onColumnChangeSpy = vi.fn();
    render(<Controlled initial={0} onColumnChangeSpy={onColumnChangeSpy} />);
    fireEvent.keyDown(editColumn(0), { key: "ArrowDown" });
    expect(onColumnChangeSpy).toHaveBeenCalledWith(0);
  });

  it("typing a number + Enter commits parseFloat", () => {
    const onColumnChangeSpy = vi.fn();
    render(<Controlled initial={5} onColumnChangeSpy={onColumnChangeSpy} />);
    const inp = editColumn(5);
    fireEvent.change(inp, { target: { value: "37" } });
    fireEvent.keyDown(inp, { key: "Enter" });
    expect(onColumnChangeSpy).toHaveBeenCalledWith(37);
  });

  it("typing a math expression + Enter commits the evaluated result", () => {
    const onColumnChangeSpy = vi.fn();
    render(<Controlled initial={10} onColumnChangeSpy={onColumnChangeSpy} />);
    const inp = editColumn(10);
    fireEvent.change(inp, { target: { value: "10*2" } });
    fireEvent.keyDown(inp, { key: "Enter" });
    expect(onColumnChangeSpy).toHaveBeenCalledWith(20);
  });

  it("Enter does not commit when the parsed value is unchanged", () => {
    const onColumnChangeSpy = vi.fn();
    render(<Controlled initial={5} onColumnChangeSpy={onColumnChangeSpy} />);
    const inp = editColumn(5);
    fireEvent.keyDown(inp, { key: "Enter" }); // draft "5" === value 5
    expect(onColumnChangeSpy).not.toHaveBeenCalled();
  });

  it("Escape reverts the draft and exits edit mode without committing", () => {
    const onColumnChangeSpy = vi.fn();
    render(<Controlled initial={5} onColumnChangeSpy={onColumnChangeSpy} />);
    const inp = editColumn(5);
    fireEvent.change(inp, { target: { value: "99" } });
    fireEvent.keyDown(inp, { key: "Escape" });
    // edit mode exits (input gone), value restored to span, no commit of 99
    expect(onColumnChangeSpy).not.toHaveBeenCalledWith(99);
    expect(screen.getByText("5")).toBeTruthy();
  });

  it("blur commits the typed value", () => {
    const onColumnChangeSpy = vi.fn();
    render(<Controlled initial={5} onColumnChangeSpy={onColumnChangeSpy} />);
    const inp = editColumn(5);
    fireEvent.change(inp, { target: { value: "7" } });
    fireEvent.blur(inp);
    expect(onColumnChangeSpy).toHaveBeenCalledWith(7);
  });
});
