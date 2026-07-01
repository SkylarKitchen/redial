// @vitest-environment happy-dom
/**
 * hotkeyBreakpointTargeting.test.tsx — review round 2, Issues 1 + 2:
 * **Bug C is still alive on the HOTKEY paste/import paths.**
 *
 * useOverlayHotkeys owns the capture-phase keydown handler. Two of its
 * branches enumerate the scope dimensions by hand and forgot the breakpoint
 * one:
 *  - Cmd+Alt+V calls `pasteStyles(selectedEl)` with no breakpoint argument —
 *    pasting at ≥768px clobbers the base inline style.
 *  - Cmd+Shift+V (CSS import) builds `resolveTarget(el, { scope,
 *    activeClassName, activeState })` — the hand-enumerated triple, omitting
 *    `activeBreakpoint` (which isn't even in OverlayHotkeysDeps).
 *
 * The fix threads Overlay's ONE memoized `scopeCtx` into OverlayHotkeysDeps so
 * the hotkeys module stops enumerating dimensions entirely (spec point 3).
 *
 * Deps carry BOTH the consolidated `scopeCtx` (post-fix shape) and the legacy
 * flat fields (pre-fix shape) so the assertions — not the deps plumbing — are
 * what flips this red/green.
 *
 * RED before the fix: the pasted/imported diff entries carry no `breakpoint`
 * tag and the base inline style gets clobbered.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useOverlayHotkeys } from "../hooks/useOverlayHotkeys";
import { styleEngine } from "../core/engine";
import { copyStyles } from "../core/apply";
import { resetAllModeOverrides } from "../core/modeOverrides";

function makeEl(): HTMLElement {
  const el = document.createElement("div");
  document.body.appendChild(el);
  return el;
}

async function flushMicrotasks() {
  for (let i = 0; i < 6; i++) await Promise.resolve();
}

/** Full OverlayHotkeysDeps stub for a selected element at a breakpoint. */
function makeHotkeyDeps(el: HTMLElement, activeBreakpoint: string) {
  return {
    selectedEl: el,
    selecting: false,
    diffMode: false,
    showSearch: false,
    activeModal: { type: "none" },
    cssClasses: [],
    focusMode: false,
    activePanel: { type: "inspector", tab: "custom" },
    expandedSection: null,
    // Post-fix shape: the ONE scoping bundle.
    scopeCtx: {
      scope: "element",
      activeClassName: null,
      activeState: "none",
      activeBreakpoint,
    },
    // Legacy flat fields (what the pre-fix hook reads; harmless extras after):
    scope: "element",
    activeState: "none",
    activeClassName: null,
    handleSaveShortcut: vi.fn(),
    handleCopyShortcut: vi.fn(),
    handleScopeChange: vi.fn(),
    announce: vi.fn(),
    handleResetAll: vi.fn(),
    handleCloseAttempt: vi.fn(),
    refreshPanel: vi.fn(),
    selectedElRef: { current: el },
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
  } as any;
}

function pressKey(init: KeyboardEventInit) {
  document.dispatchEvent(
    new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init }),
  );
}

beforeEach(() => {
  styleEngine.resetAll();
  resetAllModeOverrides();
  document.body.innerHTML = "";
});

afterEach(() => {
  styleEngine.resetAll();
  resetAllModeOverrides();
});

describe("Cmd+Alt+V paste hotkey targets the active breakpoint (Issue 1)", () => {
  it("pastes onto the 768 layer, not base, when a breakpoint is active", () => {
    const source = makeEl();
    styleEngine.apply({ scope: "element", el: source }, "color", "red");
    expect(copyStyles(source)).toBe(1);

    const target = makeEl();
    renderHook(() => useOverlayHotkeys(makeHotkeyDeps(target, "768")));

    pressKey({ key: "v", metaKey: true, altKey: true });

    const entry = styleEngine.diffElement(target).find((c) => c.prop === "color");
    expect(entry, "pasted edit must be tracked").toBeDefined();
    // THE BUG: pre-fix this is undefined — the hotkey paste landed at base.
    expect(entry!.breakpoint, "hotkey paste must respect the active breakpoint").toBe("768");
    expect(target.style.getPropertyValue("color")).toBe("");
  });

  it("pastes to base when the base breakpoint is active (backward compatible)", () => {
    const source = makeEl();
    styleEngine.apply({ scope: "element", el: source }, "color", "red");
    copyStyles(source);

    const target = makeEl();
    renderHook(() => useOverlayHotkeys(makeHotkeyDeps(target, "base")));

    pressKey({ key: "v", metaKey: true, altKey: true });

    const entry = styleEngine.diffElement(target).find((c) => c.prop === "color");
    expect(entry).toBeDefined();
    expect(entry!.breakpoint).toBeUndefined();
    expect(target.style.getPropertyValue("color")).toBe("red");
  });
});

describe("Cmd+Shift+V CSS import hotkey targets the active breakpoint (Issue 2)", () => {
  it("imports onto the 768 layer, not base, when a breakpoint is active", async () => {
    const el = makeEl();
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { readText: vi.fn().mockResolvedValue("color: blue;") },
    });

    renderHook(() => useOverlayHotkeys(makeHotkeyDeps(el, "768")));

    pressKey({ key: "v", metaKey: true, shiftKey: true });
    await flushMicrotasks();

    const entry = styleEngine.diffElement(el).find((c) => c.prop === "color");
    expect(entry, "imported edit must be tracked").toBeDefined();
    expect(entry!.to).toBe("blue");
    // THE BUG: pre-fix this is undefined — the import landed at base.
    expect(entry!.breakpoint, "hotkey import must respect the active breakpoint").toBe("768");
    expect(el.style.getPropertyValue("color")).toBe("");
  });

  it("the hotkeys module no longer enumerates scope dimensions by hand", async () => {
    const { readFileSync } = await import("fs");
    const { join } = await import("path");
    const src = readFileSync(join(__dirname, "..", "hooks", "useOverlayHotkeys.ts"), "utf-8");

    // resolveTarget must consume the whole scopeCtx — a hand-built
    // `{ scope, activeClassName, activeState }` triple is exactly how the
    // breakpoint dimension got dropped (spec point 3).
    expect(src).not.toMatch(/resolveTarget\([^)]*\{\s*scope/);
    expect(src).toContain("scopeCtx");
  });
});
