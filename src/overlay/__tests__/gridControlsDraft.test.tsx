// @vitest-environment happy-dom
/**
 * gridControlsDraft.test.tsx — behavioral characterization of the
 * GridControls TrackCountInput (the grid column/row count cell).
 *
 * Reached through the exported GridTrackRow. These cells were previously
 * covered only indirectly, so this test fires real events to pin the
 * commit/step/escape/resync contract BEFORE migrating the bespoke draft
 * logic onto useDraftNumber.
 *
 * Behavioral axes pinned:
 *   - click-to-edit: span -> input
 *   - ArrowUp/ArrowDown step by 1 (INTEGER)
 *   - Shift+ArrowUp steps by 1 (NO shift branch — same as plain)  <-- key
 *   - ArrowDown clamps at min 1
 *   - typing + Enter commits parseInt'd value, dedup (only-if-changed, >=1)
 *   - Escape reverts draft + exits edit mode, no commit
 *   - blur commits
 *   - resync: displayed value follows committed value only when !editing
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { GridTrackRow } from "../sections/GridControls";

afterEach(() => cleanup());

/** Render a GridTrackRow with columns=2, rows=5; return the spies. */
function setup(overrides?: Partial<React.ComponentProps<typeof GridTrackRow>>) {
  const onColumnsChange = vi.fn();
  const onRowsChange = vi.fn();
  const onLinkedChange = vi.fn();
  const utils = render(
    <GridTrackRow
      columns={2}
      rows={5}
      onColumnsChange={onColumnsChange}
      onRowsChange={onRowsChange}
      linked={false}
      onLinkedChange={onLinkedChange}
      {...overrides}
    />,
  );
  return { onColumnsChange, onRowsChange, onLinkedChange, ...utils };
}

/** Click the Columns value span (text "2") to enter edit mode, return the input. */
function editColumns(): HTMLInputElement {
  fireEvent.click(screen.getByText("2"));
  return document.querySelector("input") as HTMLInputElement;
}

describe("GridControls TrackCountInput (behavioral)", () => {
  it("clicking the value enters edit mode (shows an input)", () => {
    setup();
    expect(document.querySelector("input")).toBeNull();
    editColumns();
    expect(document.querySelector("input")).not.toBeNull();
  });

  it("ArrowUp steps the column count by 1", () => {
    const { onColumnsChange } = setup();
    fireEvent.keyDown(editColumns(), { key: "ArrowUp" });
    expect(onColumnsChange).toHaveBeenCalledWith(3);
  });

  it("ArrowDown steps the column count by 1", () => {
    const { onColumnsChange } = setup();
    fireEvent.keyDown(editColumns(), { key: "ArrowDown" });
    expect(onColumnsChange).toHaveBeenCalledWith(1);
  });

  it("Shift+ArrowUp steps by 1 (no Shift branch — same as plain)", () => {
    const { onColumnsChange } = setup();
    fireEvent.keyDown(editColumns(), { key: "ArrowUp", shiftKey: true });
    expect(onColumnsChange).toHaveBeenCalledWith(3);
    expect(onColumnsChange).not.toHaveBeenCalledWith(12);
  });

  it("Alt+ArrowUp steps by 1 (no Alt branch — same as plain)", () => {
    const { onColumnsChange } = setup();
    fireEvent.keyDown(editColumns(), { key: "ArrowUp", altKey: true });
    expect(onColumnsChange).toHaveBeenCalledWith(3);
  });

  it("ArrowDown clamps at the minimum of 1", () => {
    const onColumnsChange = vi.fn();
    render(
      <GridTrackRow
        columns={1}
        rows={5}
        onColumnsChange={onColumnsChange}
        onRowsChange={vi.fn()}
        linked={false}
        onLinkedChange={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByText("1"));
    const inp = document.querySelector("input") as HTMLInputElement;
    fireEvent.keyDown(inp, { key: "ArrowDown" });
    expect(onColumnsChange).toHaveBeenCalledWith(1);
  });

  it("typing a value and pressing Enter commits the parseInt'd count", () => {
    const { onColumnsChange } = setup();
    const inp = editColumns();
    fireEvent.change(inp, { target: { value: "7" } });
    fireEvent.keyDown(inp, { key: "Enter" });
    expect(onColumnsChange).toHaveBeenCalledWith(7);
  });

  it("Enter parses with parseInt (truncates decimals / trailing text)", () => {
    const { onColumnsChange } = setup();
    const inp = editColumns();
    fireEvent.change(inp, { target: { value: "4px" } });
    fireEvent.keyDown(inp, { key: "Enter" });
    expect(onColumnsChange).toHaveBeenCalledWith(4);
  });

  it("does not commit when the value is unchanged", () => {
    const { onColumnsChange } = setup();
    const inp = editColumns(); // draft "2" === value 2
    fireEvent.keyDown(inp, { key: "Enter" });
    expect(onColumnsChange).not.toHaveBeenCalled();
  });

  it("does not commit a value below 1", () => {
    const { onColumnsChange } = setup();
    const inp = editColumns();
    fireEvent.change(inp, { target: { value: "0" } });
    fireEvent.keyDown(inp, { key: "Enter" });
    expect(onColumnsChange).not.toHaveBeenCalled();
  });

  it("does not commit a non-numeric value", () => {
    const { onColumnsChange } = setup();
    const inp = editColumns();
    fireEvent.change(inp, { target: { value: "abc" } });
    fireEvent.keyDown(inp, { key: "Enter" });
    expect(onColumnsChange).not.toHaveBeenCalled();
  });

  it("Escape reverts the draft and exits edit mode without committing", () => {
    const { onColumnsChange } = setup();
    const inp = editColumns();
    fireEvent.change(inp, { target: { value: "99" } });
    fireEvent.keyDown(inp, { key: "Escape" });
    expect(onColumnsChange).not.toHaveBeenCalled();
    // edit mode exits (input gone), value span restored
    expect(document.querySelector("input")).toBeNull();
    expect(screen.getByText("2")).toBeTruthy();
  });

  it("blur commits the typed value", () => {
    const { onColumnsChange } = setup();
    const inp = editColumns();
    fireEvent.change(inp, { target: { value: "9" } });
    fireEvent.blur(inp);
    expect(onColumnsChange).toHaveBeenCalledWith(9);
  });

  it("resync: while editing, draft does not follow external value changes", () => {
    const { onColumnsChange, rerender } = setup();
    const inp = editColumns();
    fireEvent.change(inp, { target: { value: "8" } });
    // external value bump while editing
    rerender(
      <GridTrackRow
        columns={42}
        rows={5}
        onColumnsChange={onColumnsChange}
        onRowsChange={vi.fn()}
        linked={false}
        onLinkedChange={vi.fn()}
      />,
    );
    const after = document.querySelector("input") as HTMLInputElement;
    expect(after.value).toBe("8");
  });

  it("linked: editing columns also drives rows", () => {
    const onColumnsChange = vi.fn();
    const onRowsChange = vi.fn();
    render(
      <GridTrackRow
        columns={2}
        rows={5}
        onColumnsChange={onColumnsChange}
        onRowsChange={onRowsChange}
        linked={true}
        onLinkedChange={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByText("2"));
    const inp = document.querySelector("input") as HTMLInputElement;
    fireEvent.keyDown(inp, { key: "ArrowUp" });
    expect(onColumnsChange).toHaveBeenCalledWith(3);
    expect(onRowsChange).toHaveBeenCalledWith(3);
  });
});
