// @vitest-environment happy-dom
/**
 * ChangesDrawer — Pending/History tabs, element-count label, Copy All, Reset All.
 *
 * Verified live in /demo: the Changes drawer listed "6 elements changed" with
 * Copy All / Save All / Reset All and a Pending/History tab pair. The existing
 * changesDrawerSaveAllTailwind test only covers the Save-All POST path; these
 * cover the count label, Copy All (clipboard), Reset All, and tab switching.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { ChangesDrawer, type HistoryEntry } from "../shell/ChangesDrawer";
import { applyInlineStyle, resetAll, diffAll } from "../core/apply";

let writeText: ReturnType<typeof vi.fn>;

beforeEach(() => {
  resetAll();
  document.body.innerHTML = "";
  writeText = vi.fn().mockResolvedValue(undefined);
  // happy-dom may not implement navigator.clipboard — define a spyable stub.
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText },
    configurable: true,
  });
});

afterEach(() => {
  cleanup();
  resetAll();
});

function makeEl(id: string): HTMLElement {
  const el = document.createElement("div");
  el.id = id;
  document.body.appendChild(el);
  return el;
}

const baseProps = {
  open: true as const,
  onResetAll: () => {},
  entries: [] as HistoryEntry[],
  onUndoToIndex: () => {},
  onClose: () => {},
};

// ─── Pending tab ──────────────────────────────────────────────────────

describe("ChangesDrawer — pending tab", () => {
  it("shows the number of changed elements (plural)", () => {
    applyInlineStyle(makeEl("a"), "color", "red");
    applyInlineStyle(makeEl("b"), "display", "flex");

    render(<ChangesDrawer {...baseProps} tab="pending" />);
    expect(screen.getByText("2 elements changed")).toBeTruthy();
  });

  it("uses the singular 'element' for a single changed element", () => {
    applyInlineStyle(makeEl("a"), "color", "red");

    render(<ChangesDrawer {...baseProps} tab="pending" />);
    expect(screen.getByText("1 element changed")).toBeTruthy();
  });

  it("shows an empty state when there are no changes", () => {
    render(<ChangesDrawer {...baseProps} tab="pending" />);
    expect(screen.getByText("No changes yet")).toBeTruthy();
  });

  it("Copy All writes the generated CSS to the clipboard and confirms", () => {
    applyInlineStyle(makeEl("a"), "color", "red");

    render(<ChangesDrawer {...baseProps} tab="pending" />);
    fireEvent.click(screen.getByText("Copy All"));

    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText.mock.calls[0][0]).toContain("color: red;");
    expect(screen.getByText("Copied!")).toBeTruthy();
  });

  it("Reset All clears every override and calls onResetAll", () => {
    applyInlineStyle(makeEl("a"), "color", "red");
    const onResetAll = vi.fn();

    render(<ChangesDrawer {...baseProps} tab="pending" onResetAll={onResetAll} />);
    expect(diffAll().length).toBe(1);

    fireEvent.click(screen.getByText("Reset All"));

    expect(onResetAll).toHaveBeenCalledTimes(1);
    expect(diffAll().length).toBe(0);
  });

  it("disables Copy All and Reset All when there are no changes", () => {
    render(<ChangesDrawer {...baseProps} tab="pending" />);

    const copyBtn = screen.getByText("Copy All").closest("button") as HTMLButtonElement;
    const resetBtn = screen.getByText("Reset All").closest("button") as HTMLButtonElement;
    expect(copyBtn.disabled).toBe(true);
    expect(resetBtn.disabled).toBe(true);
  });
});

// ─── Tabs ─────────────────────────────────────────────────────────────

describe("ChangesDrawer — tabs", () => {
  it("notifies onTabChange when the History tab is clicked (controlled)", () => {
    const onTabChange = vi.fn();
    render(<ChangesDrawer {...baseProps} tab="pending" onTabChange={onTabChange} />);

    fireEvent.click(screen.getByText("History"));
    expect(onTabChange).toHaveBeenCalledWith("history");
  });

  it("switches to History internally and lists entries with 'Undo to here'", () => {
    const entries: HistoryEntry[] = [
      { timestamp: Date.now(), property: "color", from: "black", to: "red", selector: ".x" },
    ];
    const onUndoToIndex = vi.fn();

    // Uncontrolled (no `tab` prop) → starts on Pending; click History pill.
    render(<ChangesDrawer {...baseProps} entries={entries} onUndoToIndex={onUndoToIndex} />);
    fireEvent.click(screen.getByText("History"));

    fireEvent.click(screen.getByText("Undo to here"));
    expect(onUndoToIndex).toHaveBeenCalledWith(0);
  });

  it("wires the Close button to onClose", () => {
    const onClose = vi.fn();
    render(<ChangesDrawer {...baseProps} onClose={onClose} />);

    fireEvent.click(screen.getByText("Close"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
