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
import { applyInlineStyle, diffAll } from "../core/apply";
import { styleEngine } from "../core/engine";
import { diffState } from "../core/statePreview";
import {
  getModeOverrideCount,
  isModeOverrideDirty,
  resetAllModeOverrides,
} from "../core/modeOverrides";

let writeText: ReturnType<typeof vi.fn>;

// Full isolation: styleEngine.resetAll() is a superset of apply.ts resetAll()
// (it also destroys class + state <style> rules); resetAllModeOverrides() clears
// the separate mode dimension so a mode override from one test can't leak.
function resetEverything() {
  styleEngine.resetAll();
  resetAllModeOverrides();
}

beforeEach(() => {
  resetEverything();
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
  resetEverything();
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

  it("delegates the reset entirely to onResetAll — it does not reset on its own", () => {
    // RFC #14 item B: the drawer must route the session-wide reset SOLELY through
    // onResetAll() (Overlay → useStyleHandlers → styleEngine.resetAll), with no
    // redundant direct apply.ts resetAll() call. With a no-op onResetAll, clicking
    // Reset All must leave the override state untouched — the drawer delegates.
    applyInlineStyle(makeEl("a"), "color", "red");
    const onResetAll = vi.fn(); // does NOT reset — it is the sole reset owner

    render(<ChangesDrawer {...baseProps} tab="pending" onResetAll={onResetAll} />);
    expect(diffAll().length).toBe(1);

    fireEvent.click(screen.getByText("Reset All"));

    expect(onResetAll).toHaveBeenCalledTimes(1);
    // The drawer mutated nothing itself; only onResetAll (a no-op here) is responsible.
    expect(diffAll().length).toBe(1);
  });

  it("Reset All (wired to the engine) clears element overrides but LEAVES mode overrides intact", () => {
    // Integrated lock mirroring production wiring (onResetAll → styleEngine.resetAll).
    // This is the inverse-of-over-clear contract (ADR-0004) at session scope: the
    // session-wide reset clears inline + class + state, but mode overrides — a
    // separate dimension created in the Variables panel — must SURVIVE.
    const el = makeEl("a");
    styleEngine.apply({ scope: "element", el }, "color", "red"); // inline
    styleEngine.apply({ scope: "class", el, className: "card" }, "display", "flex"); // class
    styleEngine.apply({ scope: "state", el, state: "hover" }, "color", "blue"); // state
    styleEngine.apply(
      { scope: "mode", selector: ".dark", varName: "--brand" },
      "",
      "#000",
    ); // unrelated global theme-mode override

    expect(diffAll().length).toBeGreaterThan(0);
    expect(getModeOverrideCount()).toBe(1);

    render(
      <ChangesDrawer
        {...baseProps}
        tab="pending"
        onResetAll={() => styleEngine.resetAll()}
      />,
    );
    fireEvent.click(screen.getByText("Reset All"));

    // Element-side overrides (inline + class mirror + state) are gone...
    expect(diffAll().length).toBe(0);
    expect(diffState(el, "hover")).toHaveLength(0);
    // ...but the global mode override SURVIVES (ADR-0004 — not-a-bug, by design).
    expect(getModeOverrideCount()).toBe(1);
    expect(isModeOverrideDirty(".dark", "--brand")).toBe(true);
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
