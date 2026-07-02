// @vitest-environment happy-dom
/**
 * hotkeyPageHijacking.test.tsx — audit issue 10: Cmd+Z / Cmd+F / Cmd+K / Cmd+C
 * are swallowed PAGE-WIDE while an element is selected.
 *
 * The modifier branches in useOverlayHotkeys ran before any focus-context
 * check, on a capture-phase document listener with unconditional
 * preventDefault. Result: browser find (Cmd+F) never opens, host command
 * palettes (Cmd+K) are blocked, copy (Cmd+C) is stolen inside text controls
 * (where window.getSelection() reads empty), and Cmd+Z inside a host input
 * reverts a Redial style edit instead of the user's text.
 *
 * Expected matrix (fix):
 *  - Cmd+F / Cmd+K   claimed ONLY when focus is inside the tuner UI
 *                    (.__tuner-root or [data-tuner-portal]); pass through on
 *                    the page and in host editing surfaces.
 *  - Cmd+Z / Cmd+⇧Z  claimed inside the tuner UI; pass through in host
 *                    editing surfaces; on the page, claimed only when the
 *                    engine actually has an overlay step to revert/replay.
 *  - Cmd+C           pass through when the page has a text selection, when a
 *                    text control holds a range selection, or when focus is
 *                    in a host editing surface; otherwise claimed (copy CSS).
 *  - Cmd+S           unchanged — claimed globally while the panel is open
 *                    (the save-scoped fix must not regress).
 *
 * These are fired-event tests against the REAL hook and the REAL style
 * engine: dispatch keydown on page/host/panel targets, assert
 * `defaultPrevented` and handler side effects.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, cleanup } from "@testing-library/react";
import {
  useOverlayHotkeys,
  type OverlayHotkeysDeps,
} from "../hooks/useOverlayHotkeys";
import { styleEngine } from "../core/engine";
import { resetAllModeOverrides } from "../core/modeOverrides";

// ─── Harness ─────────────────────────────────────────────────────────

function makeDeps(over: Partial<OverlayHotkeysDeps>): OverlayHotkeysDeps {
  return {
    selectedEl: null,
    selecting: false,
    diffMode: false,
    showSearch: false,
    activeModal: { type: "none" },
    scopeCtx: {
      scope: "element",
      activeClassName: null,
      activeState: "none",
      activeBreakpoint: "base",
    },
    cssClasses: [],
    focusMode: false,
    activePanel: { type: "inspector", tab: "custom" },
    expandedSection: null,
    handleSaveShortcut: vi.fn(),
    handleCopyShortcut: vi.fn(),
    handleScopeChange: vi.fn(),
    announce: vi.fn(),
    handleResetAll: vi.fn(),
    handleCloseAttempt: vi.fn(),
    refreshPanel: vi.fn(),
    selectedElRef: { current: null },
    selectedSelectorRef: { current: null },
    diffHoldRef: { current: false },
    diffTimerRef: { current: null },
    setClipboardMessage: vi.fn(),
    setSelecting: vi.fn(),
    setSelectedEl: vi.fn(),
    setShowNavigator: vi.fn(),
    setShowSearch: vi.fn(),
    setSearchQuery: vi.fn(),
    setActiveModal: vi.fn(),
    setFocusMode: vi.fn(),
    setPinned: vi.fn(),
    setChangesDrawerTab: vi.fn(),
    setChangesDrawerOpen: vi.fn(),
    setShowBoxModel: vi.fn(),
    setShowGridOverlay: vi.fn(),
    setActivePanel: vi.fn(),
    setExpandedSection: vi.fn(),
    setDiffMode: vi.fn(),
    ...over,
  } as OverlayHotkeysDeps;
}

/** Mount the real hook with a selected page element; returns the deps. */
function mountHotkeys(selectedEl: HTMLElement, over: Partial<OverlayHotkeysDeps> = {}) {
  const deps = makeDeps({
    selectedEl,
    selectedElRef: { current: selectedEl },
    ...over,
  });
  renderHook(() => useOverlayHotkeys(deps));
  return deps;
}

/** Dispatch a cancelable keydown on `target`, return the event for inspection. */
function press(target: EventTarget, init: KeyboardEventInit): KeyboardEvent {
  const e = new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init });
  target.dispatchEvent(e);
  return e;
}

/** The page element being tuned. */
function makePageEl(): HTMLElement {
  const el = document.createElement("div");
  el.id = "tuned-el";
  document.body.appendChild(el);
  return el;
}

/** A text input that belongs to the HOST PAGE (not the tuner). */
function makeHostInput(): HTMLInputElement {
  const input = document.createElement("input");
  input.type = "text";
  input.value = "hello world";
  document.body.appendChild(input);
  return input;
}

/** An input inside the tuner panel (.__tuner-root). */
function makePanelInput(): HTMLInputElement {
  const root = document.createElement("div");
  root.className = "__tuner-root";
  document.body.appendChild(root);
  const input = document.createElement("input");
  input.type = "text";
  root.appendChild(input);
  return input;
}

/** A button inside a tuner portal ([data-tuner-portal]). */
function makePortalButton(): HTMLButtonElement {
  const portal = document.createElement("div");
  portal.setAttribute("data-tuner-portal", "");
  document.body.appendChild(portal);
  const btn = document.createElement("button");
  portal.appendChild(btn);
  return btn;
}

beforeEach(() => {
  styleEngine.resetAll();
  resetAllModeOverrides();
  document.body.innerHTML = "";
});

afterEach(() => {
  cleanup(); // unmount the hook — stale capture listeners contaminate later tests
  styleEngine.resetAll();
  resetAllModeOverrides();
  vi.restoreAllMocks();
});

// ─── Pass-through: focus OUTSIDE the overlay ─────────────────────────

describe("hotkey hijacking — combos pass through when focus is on the page", () => {
  it("Cmd+F on the page body is not swallowed and does not open property search", () => {
    const el = makePageEl();
    const deps = mountHotkeys(el);

    const e = press(document.body, { key: "f", metaKey: true });

    expect(e.defaultPrevented).toBe(false); // browser find must open
    expect(deps.setShowSearch).not.toHaveBeenCalled();
  });

  it("Cmd+F inside a host input passes through to browser find", () => {
    const el = makePageEl();
    const deps = mountHotkeys(el);
    const input = makeHostInput();

    const e = press(input, { key: "f", metaKey: true });

    expect(e.defaultPrevented).toBe(false);
    expect(deps.setShowSearch).not.toHaveBeenCalled();
  });

  it("Cmd+K on the page is not swallowed and does not open the command palette", () => {
    const el = makePageEl();
    const deps = mountHotkeys(el);

    const e = press(document.body, { key: "k", metaKey: true });

    expect(e.defaultPrevented).toBe(false); // host palettes keep working
    expect(deps.setActiveModal).not.toHaveBeenCalled();
  });

  it("Cmd+K inside a host input passes through", () => {
    const el = makePageEl();
    const deps = mountHotkeys(el);
    const input = makeHostInput();

    const e = press(input, { key: "k", metaKey: true });

    expect(e.defaultPrevented).toBe(false);
    expect(deps.setActiveModal).not.toHaveBeenCalled();
  });

  it("Cmd+Z inside a host input passes through (host text undo wins)", () => {
    const el = makePageEl();
    styleEngine.apply({ scope: "element", el }, "color", "red");
    const deps = mountHotkeys(el);
    const input = makeHostInput();

    const e = press(input, { key: "z", metaKey: true });

    expect(e.defaultPrevented).toBe(false);
    // The overlay edit must NOT be reverted — the user's text undo owns Cmd+Z.
    expect(el.style.getPropertyValue("color")).toBe("red");
    expect(deps.refreshPanel).not.toHaveBeenCalled();
  });

  it("Cmd+Z inside a host contenteditable passes through", () => {
    const el = makePageEl();
    styleEngine.apply({ scope: "element", el }, "color", "red");
    mountHotkeys(el);
    const editable = document.createElement("div");
    editable.contentEditable = "true";
    document.body.appendChild(editable);

    const e = press(editable, { key: "z", metaKey: true });

    expect(e.defaultPrevented).toBe(false);
    expect(el.style.getPropertyValue("color")).toBe("red");
  });

  it("Cmd+Z on the page with no overlay edits passes through (app undo not hijacked)", () => {
    const el = makePageEl();
    mountHotkeys(el);

    const e = press(document.body, { key: "z", metaKey: true });

    expect(e.defaultPrevented).toBe(false);
  });

  it("Cmd+Shift+Z inside a host input passes through", () => {
    const el = makePageEl();
    styleEngine.apply({ scope: "element", el }, "color", "red");
    styleEngine.undo(); // leaves a redoable overlay step
    mountHotkeys(el);
    const input = makeHostInput();

    const e = press(input, { key: "z", metaKey: true, shiftKey: true });

    expect(e.defaultPrevented).toBe(false);
    // The redo must NOT fire — the host input owns redo.
    expect(el.style.getPropertyValue("color")).toBe("");
  });

  it("Cmd+C with a page text selection passes through", () => {
    const el = makePageEl();
    const deps = mountHotkeys(el);
    vi.spyOn(window, "getSelection").mockReturnValue({
      toString: () => "selected page text",
    } as unknown as Selection);

    const e = press(document.body, { key: "c", metaKey: true });

    expect(e.defaultPrevented).toBe(false);
    expect(deps.handleCopyShortcut).not.toHaveBeenCalled();
  });

  it("Cmd+C in a host text control with a collapsed selection passes through", () => {
    const el = makePageEl();
    styleEngine.apply({ scope: "element", el }, "color", "red");
    const deps = mountHotkeys(el);
    const input = makeHostInput();
    input.selectionStart = 2;
    input.selectionEnd = 2; // collapsed — window.getSelection() reads empty here

    const e = press(input, { key: "c", metaKey: true });

    expect(e.defaultPrevented).toBe(false);
    expect(deps.handleCopyShortcut).not.toHaveBeenCalled();
  });

  it("Cmd+C in a host text control with a range selection passes through", () => {
    const el = makePageEl();
    styleEngine.apply({ scope: "element", el }, "color", "red");
    const deps = mountHotkeys(el);
    const input = makeHostInput();
    input.selectionStart = 0;
    input.selectionEnd = 5;

    const e = press(input, { key: "c", metaKey: true });

    expect(e.defaultPrevented).toBe(false);
    expect(deps.handleCopyShortcut).not.toHaveBeenCalled();
  });
});

// ─── Claimed: overlay still owns its shortcuts in the right context ──

describe("hotkey hijacking — overlay still claims its shortcuts in overlay context", () => {
  it("Cmd+Z on the page claims the shortcut when the overlay has an edit to undo", () => {
    const el = makePageEl();
    styleEngine.apply({ scope: "element", el }, "color", "red");
    const deps = mountHotkeys(el);

    const e = press(document.body, { key: "z", metaKey: true });

    expect(e.defaultPrevented).toBe(true);
    expect(el.style.getPropertyValue("color")).toBe(""); // edit reverted
    expect(deps.refreshPanel).toHaveBeenCalledWith(el);
    expect(deps.announce).toHaveBeenCalledWith("Undo");
  });

  it("Cmd+Z with focus inside a panel input performs overlay undo", () => {
    const el = makePageEl();
    styleEngine.apply({ scope: "element", el }, "color", "red");
    const deps = mountHotkeys(el);
    const panelInput = makePanelInput();

    const e = press(panelInput, { key: "z", metaKey: true });

    expect(e.defaultPrevented).toBe(true);
    expect(el.style.getPropertyValue("color")).toBe("");
    expect(deps.refreshPanel).toHaveBeenCalledWith(el);
  });

  it("Cmd+Shift+Z with focus inside a panel input performs overlay redo", () => {
    const el = makePageEl();
    styleEngine.apply({ scope: "element", el }, "color", "red");
    styleEngine.undo();
    const deps = mountHotkeys(el);
    const panelInput = makePanelInput();

    const e = press(panelInput, { key: "z", metaKey: true, shiftKey: true });

    expect(e.defaultPrevented).toBe(true);
    expect(el.style.getPropertyValue("color")).toBe("red"); // edit replayed
    expect(deps.announce).toHaveBeenCalledWith("Redo");
  });

  it("Cmd+F with focus inside the panel opens property search", () => {
    const el = makePageEl();
    const deps = mountHotkeys(el);
    const panelInput = makePanelInput();

    const e = press(panelInput, { key: "f", metaKey: true });

    expect(e.defaultPrevented).toBe(true);
    expect(deps.setShowSearch).toHaveBeenCalledTimes(1);
  });

  it("Cmd+K with focus inside the panel toggles the command palette", () => {
    const el = makePageEl();
    const deps = mountHotkeys(el);
    const panelInput = makePanelInput();

    const e = press(panelInput, { key: "k", metaKey: true });

    expect(e.defaultPrevented).toBe(true);
    expect(deps.setActiveModal).toHaveBeenCalledTimes(1);
  });

  it("Cmd+K with focus inside a tuner portal toggles the command palette", () => {
    const el = makePageEl();
    const deps = mountHotkeys(el);
    const portalBtn = makePortalButton();

    const e = press(portalBtn, { key: "k", metaKey: true });

    expect(e.defaultPrevented).toBe(true);
    expect(deps.setActiveModal).toHaveBeenCalledTimes(1);
  });

  it("Cmd+C with focus inside a panel input (no selection) still copies CSS", () => {
    const el = makePageEl();
    styleEngine.apply({ scope: "element", el }, "color", "red");
    const deps = mountHotkeys(el);
    const panelInput = makePanelInput();

    const e = press(panelInput, { key: "c", metaKey: true });

    expect(e.defaultPrevented).toBe(true);
    expect(deps.handleCopyShortcut).toHaveBeenCalledTimes(1);
  });

  it("Cmd+C on the page with no selection still copies CSS", () => {
    const el = makePageEl();
    styleEngine.apply({ scope: "element", el }, "color", "red");
    const deps = mountHotkeys(el);

    const e = press(document.body, { key: "c", metaKey: true });

    expect(e.defaultPrevented).toBe(true);
    expect(deps.handleCopyShortcut).toHaveBeenCalledTimes(1);
  });

  it("Cmd+S on the page is still claimed while the panel is open (no save regression)", () => {
    const el = makePageEl();
    styleEngine.apply({ scope: "element", el }, "color", "red");
    const deps = mountHotkeys(el);

    const e = press(document.body, { key: "s", metaKey: true });

    expect(e.defaultPrevented).toBe(true); // browser save dialog blocked
    expect(deps.handleSaveShortcut).toHaveBeenCalledTimes(1);
  });

  it("Cmd+S inside a host input is still claimed (unchanged behavior)", () => {
    const el = makePageEl();
    styleEngine.apply({ scope: "element", el }, "color", "red");
    const deps = mountHotkeys(el);
    const input = makeHostInput();

    const e = press(input, { key: "s", metaKey: true });

    expect(e.defaultPrevented).toBe(true);
    expect(deps.handleSaveShortcut).toHaveBeenCalledTimes(1);
  });
});
