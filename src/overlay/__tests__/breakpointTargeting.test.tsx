// @vitest-environment happy-dom
/**
 * breakpointTargeting.test.tsx — Bug C of the breakpoint-export consolidation:
 * **edits made with a non-base breakpoint active write to base instead.**
 *
 * Two call sites enumerate the scope dimensions by hand and forgot the
 * breakpoint one:
 *  - `useStyleHandlers.handleSpacingChange` builds its `resolveTarget` context
 *    from (scope, activeClassName, activeState) only — so a spacing drag at
 *    ≥768px lands on the element's BASE inline style instead of the
 *    media-gated 768 layer.
 *  - `pasteStyles` (apply.ts) applies clipboard styles by bare prop name —
 *    same base-flattening with a breakpoint active.
 *
 * The fix threads Overlay's ONE memoized `scopeCtx` (which carries
 * `activeBreakpoint`) through both paths so call sites never enumerate the
 * dimensions again.
 *
 * RED before the fix: the diff entries carry no `breakpoint` tag and the base
 * inline style gets clobbered.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useStyleHandlers } from "../hooks/useStyleHandlers";
import { styleEngine } from "../core/engine";
import { copyStyles, pasteStyles } from "../core/apply";
import { resetAllModeOverrides } from "../core/modeOverrides";

function makeEl(): HTMLElement {
  const el = document.createElement("div");
  document.body.appendChild(el);
  return el;
}

/**
 * Deps for the hook. Carries BOTH the consolidated `scopeCtx` (post-fix shape)
 * and the legacy flat fields (pre-fix shape) so the assertions — not the deps
 * plumbing — are what flips this red/green.
 */
function makeDeps(el: HTMLElement, activeBreakpoint: string) {
  const scopeCtx = {
    scope: "element",
    activeClassName: null,
    activeState: "none",
    activeBreakpoint,
  };
  return {
    selectedEl: el,
    scopeCtx,
    // Legacy flat fields (what the pre-fix hook reads; harmless extras after):
    scope: "element",
    activeClassName: null,
    activeState: "none",
    diffMode: false,
    historyEntries: [],
    setInferResult: vi.fn(),
    refreshPanel: vi.fn(),
    setClipboardMessage: vi.fn(),
    setHistoryEntries: vi.fn(),
  } as any;
}

beforeEach(() => {
  styleEngine.resetAll();
  resetAllModeOverrides();
  document.body.innerHTML = "";
});

describe("spacing drags at a breakpoint target the breakpoint layer", () => {
  it("handleSpacingChange with activeBreakpoint 768 tags the diff and leaves base inline alone", () => {
    const el = makeEl();
    const { result } = renderHook(() => useStyleHandlers(makeDeps(el, "768")));

    act(() => result.current.handleSpacingChange("margin-top", 10, "px"));

    const entry = styleEngine
      .diffElement(el)
      .find((c) => c.prop === "margin-top");
    expect(entry, "spacing edit must be tracked").toBeDefined();
    // THE BUG: pre-fix this is undefined — the drag landed at base.
    expect(entry!.breakpoint, "spacing drag must be keyed to the active breakpoint").toBe("768");
    // Breakpoint edits are media-gated, NOT base inline styles.
    expect(el.style.getPropertyValue("margin-top")).toBe("");
  });

  it("handleSpacingChange at the base breakpoint is unchanged (writes inline, untagged)", () => {
    const el = makeEl();
    const { result } = renderHook(() => useStyleHandlers(makeDeps(el, "base")));

    act(() => result.current.handleSpacingChange("margin-top", 10, "px"));

    const entry = styleEngine.diffElement(el).find((c) => c.prop === "margin-top");
    expect(entry).toBeDefined();
    expect(entry!.breakpoint).toBeUndefined();
    expect(el.style.getPropertyValue("margin-top")).toBe("10px");
  });
});

describe("pasteStyles at a breakpoint targets the breakpoint layer", () => {
  it("pasteStyles(el, '768') keys the pasted props to the 768 layer, not base", () => {
    const source = makeEl();
    styleEngine.apply({ scope: "element", el: source }, "color", "red");
    expect(copyStyles(source)).toBe(1);

    const target = makeEl();
    const pasted = pasteStyles(target, "768");
    expect(pasted).toBe(1);

    const entry = styleEngine.diffElement(target).find((c) => c.prop === "color");
    expect(entry).toBeDefined();
    // THE BUG: pre-fix the paste lands at base (breakpoint undefined, inline set).
    expect(entry!.breakpoint).toBe("768");
    expect(target.style.getPropertyValue("color")).toBe("");
  });

  it("pasteStyles without a breakpoint stays base (backward compatible)", () => {
    const source = makeEl();
    styleEngine.apply({ scope: "element", el: source }, "color", "red");
    copyStyles(source);

    const target = makeEl();
    pasteStyles(target);

    const entry = styleEngine.diffElement(target).find((c) => c.prop === "color");
    expect(entry).toBeDefined();
    expect(entry!.breakpoint).toBeUndefined();
    expect(target.style.getPropertyValue("color")).toBe("red");
  });

  it("handlePasteStyles routes the active breakpoint through to the paste", () => {
    const source = makeEl();
    styleEngine.apply({ scope: "element", el: source }, "gap", "8px");
    copyStyles(source);

    const target = makeEl();
    const { result } = renderHook(() => useStyleHandlers(makeDeps(target, "1024")));

    act(() => result.current.handlePasteStyles());

    const entry = styleEngine.diffElement(target).find((c) => c.prop === "gap");
    expect(entry, "pasted edit must be tracked").toBeDefined();
    expect(entry!.breakpoint, "paste must respect the active breakpoint").toBe("1024");
    expect(target.style.getPropertyValue("gap")).toBe("");
  });
});
