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
import { act } from "react";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
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

// ─── Save All — breakpoint file-save partition (#53) ─────────────────

describe("ChangesDrawer Save All — breakpoint file-save partition (#53)", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ written: ["Button.module.scss"], failed: [] }),
    });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  /** CSS-module-classed element: getModuleClassInfo → className "btn",
   *  source derivation → "Button.module.scss" — the enrichment binds its
   *  breakpoint edits to a file (#53), same fixture as breakpointFileSave. */
  function makeModuleEl(): HTMLElement {
    const el = document.createElement("div");
    el.className = "Button_btn__a1b2c";
    document.body.appendChild(el);
    return el;
  }

  /** Let handleSaveAll's async chain (fetch → json → clipboard) settle. */
  async function flushSave() {
    await act(async () => {
      for (let i = 0; i < 8; i++) await Promise.resolve();
    });
  }

  it("a class-backed breakpoint edit saves to file — no '(not saved to file)' caveat, no redundant clipboard copy", async () => {
    const el = makeModuleEl();
    styleEngine.apply({ scope: "element", el, breakpoint: "768" }, "color", "blue");

    render(<ChangesDrawer {...baseProps} tab="pending" />);
    fireEvent.click(screen.getByText("Save All"));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.changes).toHaveLength(1);
    expect(body.changes[0]).toMatchObject({
      prop: "color",
      to: "blue",
      className: "btn",
      breakpoint: { id: "768", minWidth: 768 },
    });

    await flushSave();
    // File-bound → NOT double-copied to the clipboard as @media …
    const mediaWrite = writeText.mock.calls.find(([t]) => String(t).includes("@media"));
    expect(mediaWrite, "file-bound breakpoint edit must not double-copy as @media").toBeUndefined();
    // … and no stale clipboard-only caveat — the save message stands.
    expect(screen.queryByText(/not saved to file/)).toBeNull();
    expect(screen.getByText("Saved 1 change")).toBeTruthy();
  });

  it("a classless breakpoint edit keeps the clipboard side-channel and its caveat", async () => {
    const el = makeEl("plain"); // classless → enrichment can't bind it to a file
    styleEngine.apply({ scope: "element", el, breakpoint: "768" }, "color", "blue");

    render(<ChangesDrawer {...baseProps} tab="pending" />);
    fireEvent.click(screen.getByText("Save All"));
    await flushSave();

    // Nothing file-bound → no POST at all; the edit rides the clipboard as @media.
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByText("1 breakpoint edit copied (not saved to file)")).toBeTruthy();
    const clipboard = writeText.mock.calls.map(([t]) => String(t)).join("\n");
    expect(clipboard).toContain("@media (min-width: 768px)");
    expect(clipboard).toContain("color: blue;");
  });

  it("mixed save partitions PER ELEMENT — same prop+breakpoint on a class-backed and a classless element", async () => {
    const fileEl = makeModuleEl();
    const clipEl = makeEl("plain");
    styleEngine.apply({ scope: "element", el: fileEl, breakpoint: "768" }, "color", "blue");
    styleEngine.apply({ scope: "element", el: clipEl, breakpoint: "768" }, "color", "blue");

    render(<ChangesDrawer {...baseProps} tab="pending" />);
    fireEvent.click(screen.getByText("Save All"));
    await flushSave();

    // Only the class-backed edit reaches the POST …
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.changes).toHaveLength(1);
    expect(body.changes[0].className).toBe("btn");
    // … and only the classless one reaches the clipboard. (A GLOBAL
    // fileBound set keyed by bp+state+prop would wrongly swallow it —
    // both edits share the "768@@::color" key — hence per-element.)
    // getSelector: classless div → "div"; the module element → ".btn".
    expect(screen.getByText("1 breakpoint edit copied (not saved to file)")).toBeTruthy();
    const clipboard = writeText.mock.calls.map(([t]) => String(t)).join("\n");
    expect(clipboard).toContain("div {");
    expect(clipboard).not.toContain(".btn");
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
