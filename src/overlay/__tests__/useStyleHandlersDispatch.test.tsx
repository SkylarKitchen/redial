// @vitest-environment happy-dom
/**
 * useStyleHandlersDispatch.test.tsx — RFC #14, crux #1 (dispatch consolidation)
 *
 * `useStyleHandlers` historically re-implemented the scope-routing dispatch
 * (element / class / state) and the session-wide reset INLINE, separately from
 * the canonical `styleEngine.apply` / `styleEngine.resetAll`. Three copies of
 * one routing rule is exactly the drift RFC #14 exists to kill — and they HAD
 * drifted: the hook's state branch wrote the live `<style>` preview but never
 * mirrored the edit into apply.ts's override map under the composite state key,
 * so a pseudo-state spacing edit made in the box model was invisible to
 * `diff()` / `undo()` — i.e. silently lost on save and not undoable.
 *
 * These are FIRED-BEHAVIOUR tests (assert on real DOM + engine state, not on
 * source strings), so they survive the refactor that routes the hook through
 * `styleEngine` and would catch a real regression either way.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useStyleHandlers, type StyleHandlersDeps } from "../hooks/useStyleHandlers";
import { styleEngine } from "../core/engine";
import { resetAllModeOverrides } from "../core/modeOverrides";

function makeEl(tag = "div"): HTMLElement {
  const el = document.createElement(tag);
  document.body.appendChild(el);
  return el;
}

function classStyleText(): string {
  return (
    document.querySelector('style[data-tuner-scope="class"]')?.textContent ?? ""
  );
}

/** Build a StyleHandlersDeps with test-friendly defaults; override per case. */
function makeDeps(overrides: Partial<StyleHandlersDeps> = {}): StyleHandlersDeps {
  return {
    selectedEl: null,
    scope: "element",
    activeClassName: null,
    activeState: "none",
    diffMode: false,
    historyEntries: [],
    setInferResult: vi.fn(),
    refreshPanel: vi.fn(),
    setClipboardMessage: vi.fn(),
    setHistoryEntries: vi.fn(),
    ...overrides,
  };
}

beforeEach(() => {
  styleEngine.resetAll();
  resetAllModeOverrides();
  document.body.innerHTML = "";
});

describe("handleSpacingChange dispatch", () => {
  it("element scope: applies inline AND tracks the edit in the engine diff", () => {
    const el = makeEl();
    const { result } = renderHook(() =>
      useStyleHandlers(makeDeps({ selectedEl: el, scope: "element" })),
    );

    act(() => result.current.handleSpacingChange("margin-top", 10, "px"));

    expect(el.style.getPropertyValue("margin-top")).toBe("10px");
    const change = styleEngine
      .diff()
      .elements.find((e) => e.el === el)
      ?.changes.find((c) => c.prop === "margin-top");
    expect(change?.to).toBe("10px");
    expect(change?.state).toBeUndefined();
  });

  it("state scope: tracks a pseudo-state spacing edit in the engine diff so it can be saved/undone", () => {
    // THE BUG: before consolidation the hook's state branch only wrote the
    // <style> preview, so this edit never reached the override map and was lost
    // on save / un-undoable.
    const el = makeEl();
    const { result } = renderHook(() =>
      useStyleHandlers(makeDeps({ selectedEl: el, activeState: "hover" })),
    );

    act(() => result.current.handleSpacingChange("margin-top", 10, "px"));

    const entry = styleEngine.diff().elements.find((e) => e.el === el);
    expect(entry, "hover spacing edit must be tracked for save/undo").toBeDefined();
    const change = entry!.changes.find((c) => c.prop === "margin-top");
    expect(change).toBeDefined();
    expect(change!.state).toBe("hover");
    // State-keyed props are NOT written inline (the live <style> preview path
    // is exercised by statePreview.test.ts).
    expect(el.style.getPropertyValue("margin-top")).toBe("");
  });

  it("state scope: the pseudo-state spacing edit is undoable", () => {
    const el = makeEl();
    const { result } = renderHook(() =>
      useStyleHandlers(makeDeps({ selectedEl: el, activeState: "hover" })),
    );

    act(() => result.current.handleSpacingChange("margin-top", 10, "px"));
    expect(styleEngine.diff().elements.some((e) => e.el === el)).toBe(true);

    styleEngine.undo();
    expect(styleEngine.diff().elements.some((e) => e.el === el)).toBe(false);
  });

  it("class scope: writes the class rule AND the inline preview", () => {
    const el = makeEl();
    const { result } = renderHook(() =>
      useStyleHandlers(
        makeDeps({ selectedEl: el, scope: "class", activeClassName: "box" }),
      ),
    );

    act(() => result.current.handleSpacingChange("margin-left", 5, "px"));

    expect(classStyleText()).toContain(".box");
    expect(classStyleText()).toContain("margin-left: 5px");
    expect(el.style.getPropertyValue("margin-left")).toBe("5px");
  });
});

describe("handleResetAll dispatch", () => {
  it("clears inline, class, and state overrides (behaviour-preserving)", () => {
    const el = makeEl();
    styleEngine.apply({ scope: "element", el }, "color", "red");
    styleEngine.apply({ scope: "class", el, className: "box" }, "margin", "8px");
    styleEngine.apply({ scope: "state", el, state: "hover" }, "color", "blue");
    expect(styleEngine.diff().elements.length).toBeGreaterThan(0);

    const { result } = renderHook(() =>
      useStyleHandlers(makeDeps({ selectedEl: el })),
    );
    act(() => result.current.handleResetAll());

    expect(styleEngine.diff().elements).toHaveLength(0);
    expect(classStyleText()).toBe("");
  });
});
