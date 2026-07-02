// @vitest-environment happy-dom
/**
 * Issue #72 — resetStateOverrides and clearRedundantOverrides skip persistence.
 *
 * Every other reset path (reset, resetProp, resetElementBreakpoint) calls
 * schedulePersist() so localStorage reflects the post-reset state. These two
 * don't — so a cleared override survives in localStorage and RESURRECTS on the
 * next page load via restoreSession().
 *
 * Reload simulation: flush the debounced persist (fake timers), then
 * vi.resetModules() + a fresh dynamic import of apply.ts gives a pristine
 * module state (empty overrides map) that re-reads the SAME localStorage —
 * exactly what a page reload does.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  applyInlineStyle,
  resetStateOverrides,
  clearRedundantOverrides,
  resetAll,
} from "../core/apply";

const KEY = "__tuner_session:" + location.pathname;

function makeEl(id: string): HTMLElement {
  const el = document.createElement("div");
  el.id = id;
  document.body.appendChild(el);
  return el;
}

/** Flush the 150ms schedulePersist debounce. */
function flushPersist(): void {
  vi.advanceTimersByTime(300);
}

/** Simulate a page reload: fresh apply.ts module state, same localStorage. */
async function reloadModule() {
  vi.resetModules();
  return await import("../core/apply");
}

beforeEach(() => {
  vi.useFakeTimers();
  resetAll();
  document.body.innerHTML = "";
  localStorage.clear();
});

afterEach(() => {
  resetAll();
  localStorage.clear();
  vi.useRealTimers();
});

describe("resetStateOverrides persists (issue #72)", () => {
  it("a Footer-reset :hover override does not resurrect from localStorage on reload", async () => {
    const el = makeEl("state-reset-target");

    // 1. Apply a state override and let it persist
    applyInlineStyle(el, "hover::color", "red");
    flushPersist();
    expect(localStorage.getItem(KEY)).toContain("hover::color"); // precondition

    // 2. Footer reset for the hover state
    resetStateOverrides(el, "hover");
    flushPersist();

    // 3. Reload the page — the cleared override must NOT come back
    const fresh = await reloadModule();
    expect(fresh.restoreSession()).toBe(0);
    expect(fresh.overrideCount(el)).toBe(0);
  });

  it("keeps other states' overrides persisted when one state is reset", async () => {
    const el = makeEl("state-reset-partial");

    applyInlineStyle(el, "hover::color", "red");
    applyInlineStyle(el, "focus::outline-color", "blue");
    flushPersist();

    resetStateOverrides(el, "hover");
    flushPersist();

    const fresh = await reloadModule();
    expect(fresh.restoreSession()).toBe(1); // only the focus override survives
    const stored = localStorage.getItem(KEY) ?? "";
    expect(stored).not.toContain("hover::color");
    expect(stored).toContain("focus::outline-color");
  });
});

describe("clearRedundantOverrides persists (issue #72)", () => {
  it("an HMR-cleared redundant override does not resurrect as a phantom change on reload", async () => {
    const el = makeEl("hmr-clear-target");

    // 1. Apply an override and let it persist
    applyInlineStyle(el, "color", "red");
    flushPersist();
    expect(localStorage.getItem(KEY)).toContain('"color"'); // precondition

    // 2. Simulate save + HMR: real styles caught up, override now redundant
    const spy = vi.spyOn(window, "getComputedStyle").mockImplementation(() => ({
      getPropertyValue: () => "red",
    } as any));
    expect(clearRedundantOverrides()).toBe(1);
    spy.mockRestore();
    flushPersist();

    // 3. Reload — the cleared override must NOT resurrect as a "change"
    const fresh = await reloadModule();
    expect(fresh.restoreSession()).toBe(0);
    expect(el.style.getPropertyValue("color")).toBe("");
  });
});
