// @vitest-environment happy-dom
/**
 * Escape must dismiss the unsaved-changes bar (residual from the close-flow
 * fix campaign).
 *
 * The Escape branch in useOverlayHotkeys dismisses modal → search → then calls
 * handleCloseAttempt(). But when the CloseWarningBar is ALREADY visible,
 * handleCloseAttempt just re-runs `overrideCount > 0 → setCloseWarning(true)`
 * — a no-op — so Escape could never dismiss the bar. Escape while the bar is
 * showing must behave exactly like the "Keep Editing" button: hide the bar,
 * keep the panel open, keep every unsaved override intact (NOT discard, NOT a
 * second close).
 *
 * FIRED-BEHAVIOUR tests: mount the real useOverlayHotkeys + the real
 * CloseWarningBar wired the way Overlay.tsx wires them (handleCloseAttempt /
 * handleClose reproduced verbatim from useElementSelection), dispatch real
 * capture-phase Escape keydowns, and assert on bar visibility, panel
 * open-ness, and engine override state.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { useCallback, useRef, useState } from "react";
import {
  useOverlayHotkeys,
  type OverlayHotkeysDeps,
} from "../hooks/useOverlayHotkeys";
import { CloseWarningBar } from "../shell/CloseWarningBar";
import { styleEngine } from "../core/engine";
import { overrideCount, resetAll } from "../core/apply";

beforeEach(() => {
  resetAll();
  document.body.innerHTML = "";
});

afterEach(() => {
  cleanup();
  resetAll();
  vi.restoreAllMocks();
});

function makeEl(id: string): HTMLElement {
  const el = document.createElement("div");
  el.id = id;
  document.body.appendChild(el);
  return el;
}

/**
 * Minimal Overlay stand-in: real hotkey hook + real CloseWarningBar, with the
 * close lifecycle (handleClose / handleCloseAttempt) copied from
 * useElementSelection.ts and the bar props copied from Overlay.tsx.
 */
function Harness({ el }: { el: HTMLElement }) {
  const [selectedEl, setSelectedEl] = useState<Element | null>(el);
  const [closeWarning, setCloseWarning] = useState(false);
  const selectedElRef = useRef<Element | null>(el);

  const handleClose = useCallback(() => {
    selectedElRef.current = null;
    setSelectedEl(null);
    setCloseWarning(false);
  }, []);

  // Verbatim logic from useElementSelection.handleCloseAttempt
  const handleCloseAttempt = useCallback(() => {
    if (selectedElRef.current && overrideCount(selectedElRef.current) > 0) {
      setCloseWarning(true);
    } else {
      handleClose();
    }
  }, [handleClose]);

  const noop = () => {};
  useOverlayHotkeys({
    selectedEl,
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
    handleSaveShortcut: noop,
    handleCopyShortcut: noop,
    handleScopeChange: noop,
    announce: noop,
    handleResetAll: noop,
    handleCloseAttempt,
    refreshPanel: noop,
    closeWarning,
    setCloseWarning,
    selectedElRef,
    selectedSelectorRef: useRef<string | null>(null),
    diffHoldRef: useRef(false),
    diffTimerRef: useRef<ReturnType<typeof setTimeout> | null>(null),
    setClipboardMessage: noop,
    setSelecting: noop,
    setSelectedEl,
    setShowNavigator: noop,
    setShowSearch: noop,
    setSearchQuery: noop,
    setActiveModal: noop,
    setFocusMode: noop,
    setPinned: noop,
    setChangesDrawerTab: noop,
    setChangesDrawerOpen: noop,
    setShowBoxModel: noop,
    setShowGridOverlay: noop,
    setActivePanel: noop,
    setExpandedSection: noop,
    setDiffMode: noop,
  } as OverlayHotkeysDeps);

  return (
    <div>
      {selectedEl && <div data-testid="panel-open" />}
      <div data-testid="close-warning-state">{String(closeWarning)}</div>
      {/* Wiring copied from Overlay.tsx's <CloseWarningBar …/> */}
      <CloseWarningBar
        open={closeWarning}
        selectedElRef={selectedElRef}
        onDiscard={() => {
          handleClose();
          setCloseWarning(false);
        }}
        onKeepEditing={() => setCloseWarning(false)}
      />
    </div>
  );
}

function pressEscape() {
  fireEvent.keyDown(document, { key: "Escape" });
}

const barState = () => screen.getByTestId("close-warning-state").textContent;

describe("Escape vs. the unsaved-changes bar", () => {
  it("first Escape (unsaved changes) shows the bar instead of closing", () => {
    const el = makeEl("esc-shows-bar");
    styleEngine.apply({ scope: "element", el }, "color", "red");
    render(<Harness el={el} />);

    pressEscape();

    expect(barState()).toBe("true");
    expect(screen.getByText(/unsaved change/)).toBeTruthy();
    expect(screen.queryByTestId("panel-open")).not.toBeNull();
  });

  it("Escape while the bar is visible dismisses it (keep editing): bar hidden, panel still open, overrides intact", () => {
    const el = makeEl("esc-keeps-editing");
    styleEngine.apply({ scope: "element", el }, "color", "red");
    render(<Harness el={el} />);

    pressEscape(); // attempt close → bar appears
    expect(barState()).toBe("true");

    pressEscape(); // must act as "Keep Editing"

    // Bar dismissed (open=false → CloseWarningBar renders nothing new)
    expect(barState()).toBe("false");
    // NOT a second close: the panel stays open on the same element
    expect(screen.queryByTestId("panel-open")).not.toBeNull();
    // NOT a discard: the unsaved override survives, on engine and DOM
    expect(overrideCount(el)).toBe(1);
    expect(el.style.getPropertyValue("color")).toBe("red");
  });

  it("after keep-editing via Escape, a further Escape re-opens the bar (close attempt again)", () => {
    const el = makeEl("esc-reattempt");
    styleEngine.apply({ scope: "element", el }, "color", "red");
    render(<Harness el={el} />);

    pressEscape();
    pressEscape(); // dismiss
    expect(barState()).toBe("false");

    pressEscape(); // brand-new close attempt → warn again
    expect(barState()).toBe("true");
    expect(screen.queryByTestId("panel-open")).not.toBeNull();
  });

  it("Escape with no unsaved changes closes the panel directly (no bar)", () => {
    const el = makeEl("esc-clean-close");
    render(<Harness el={el} />);

    pressEscape();

    expect(barState()).toBe("false");
    expect(screen.queryByTestId("panel-open")).toBeNull();
  });
});
