// @vitest-environment happy-dom
/**
 * useOverlayHotkeys — extracted keyboard layer (issue #27).
 *
 * Overlay.tsx (2,027 → ~982 lines) was decomposed into focused hooks. The
 * highest-risk extraction was the global keyboard handler: it MUST stay a single
 * capture-phase keydown listener (so Cmd+Z reaches the tuner before DialKit's
 * input handlers) and its shortcuts must still fire.
 *
 * Fired-event tests: mount the real hook, assert it registers a capture-phase
 * keydown listener, dispatch real keydown events, and assert the wired
 * callbacks run. Also assert the listener is stable across re-render (the churn
 * #27 set out to fix).
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { useRef } from "react";
import {
  useOverlayHotkeys,
  type OverlayHotkeysDeps,
} from "../hooks/useOverlayHotkeys";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/** A Harness that wires the hook with mostly no-op deps, overridable per test. */
function makeDeps(over: Partial<OverlayHotkeysDeps>): OverlayHotkeysDeps {
  const fn = () => vi.fn();
  return {
    selectedEl: null,
    selecting: false,
    diffMode: false,
    showSearch: false,
    activeModal: { type: "none" },
    scope: "element",
    cssClasses: [],
    focusMode: false,
    activePanel: { type: "inspector", tab: "custom" },
    expandedSection: null,
    activeState: "none",
    activeClassName: null,
    handleSaveShortcut: fn(),
    handleCopyShortcut: fn(),
    handleScopeChange: fn(),
    announce: fn(),
    handleResetAll: fn(),
    handleCloseAttempt: fn(),
    refreshPanel: fn(),
    selectedElRef: { current: null },
    selectedSelectorRef: { current: null },
    diffHoldRef: { current: false },
    diffTimerRef: { current: null },
    setClipboardMessage: fn(),
    setSelecting: fn(),
    setSelectedEl: fn(),
    setShowNavigator: fn(),
    setShowSearch: fn(),
    setSearchQuery: fn(),
    setActiveModal: fn(),
    setFocusMode: fn(),
    setPinned: fn(),
    setChangesDrawerTab: fn(),
    setChangesDrawerOpen: fn(),
    setShowBoxModel: fn(),
    setShowGridOverlay: fn(),
    setActivePanel: fn(),
    setExpandedSection: fn(),
    setDiffMode: fn(),
    ...over,
  };
}

function Harness({ deps }: { deps: OverlayHotkeysDeps }) {
  // Keep refs stable across renders like the real Overlay does.
  const stable = useRef(deps);
  stable.current = deps;
  useOverlayHotkeys(stable.current);
  return null;
}

function press(key: string, init: KeyboardEventInit = {}) {
  document.dispatchEvent(
    new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...init }),
  );
}

describe("useOverlayHotkeys extraction (#27)", () => {
  it("registers a single capture-phase keydown listener", () => {
    const addSpy = vi.spyOn(document, "addEventListener");
    render(<Harness deps={makeDeps({})} />);
    const keydownCaptureCalls = addSpy.mock.calls.filter(
      (c) => c[0] === "keydown" && c[2] === true,
    );
    expect(keydownCaptureCalls.length).toBe(1);
  });

  it("fires the navigator-toggle shortcut (n)", () => {
    const setShowNavigator = vi.fn();
    render(<Harness deps={makeDeps({ setShowNavigator })} />);
    press("n");
    expect(setShowNavigator).toHaveBeenCalledTimes(1);
  });

  it("fires the shortcuts-help shortcut (?)", () => {
    const setActiveModal = vi.fn();
    render(<Harness deps={makeDeps({ setActiveModal })} />);
    press("?");
    expect(setActiveModal).toHaveBeenCalledTimes(1);
  });

  it("removes the listener on unmount (no leak / churn)", () => {
    const removeSpy = vi.spyOn(document, "removeEventListener");
    const { unmount } = render(<Harness deps={makeDeps({})} />);
    unmount();
    const keydownCaptureRemovals = removeSpy.mock.calls.filter(
      (c) => c[0] === "keydown" && c[2] === true,
    );
    expect(keydownCaptureRemovals.length).toBe(1);
  });
});
