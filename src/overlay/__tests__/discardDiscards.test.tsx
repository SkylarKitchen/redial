// @vitest-environment happy-dom
/**
 * "Discard doesn't discard" — the unsaved-changes bar's Discard button only
 * closed the panel; it never reverted the applied overrides. The inline
 * !important edits stayed on the page, stayed in the override store, and
 * resurrected on the next load via localStorage session restore.
 *
 * FIRED-BEHAVIOUR tests: mount the REAL CloseWarningBar (the Discard surface
 * rendered at the panel's footer edge) and click its Discard button, then
 * assert on engine state, the live DOM, and persistence:
 *
 *   1. element overrides cleared from the engine AND reverted on the element
 *   2. global CSS-variable mode overrides cleared
 *   3. the persisted localStorage session is gone
 *   4. reload simulation (vi.resetModules() + a fresh apply.ts import against
 *      the SAME localStorage — the resetPersistenceGap.test.ts pattern):
 *      nothing resurrects.
 *
 * RED pre-fix: the button's handler is `onDiscard` only (Overlay wires it to
 * handleClose), so every one of these assertions fails.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CloseWarningBar } from "../shell/CloseWarningBar";
import { styleEngine } from "../core/engine";
import { overrideCount, resetAll } from "../core/apply";
import {
  applyModeOverride,
  getModeOverrideCount,
  resetAllModeOverrides,
} from "../core/modeOverrides";

const KEY = "__tuner_session:" + location.pathname;

function makeEl(id: string): HTMLElement {
  const el = document.createElement("div");
  el.id = id;
  document.body.appendChild(el);
  return el;
}

/** Flush apply.ts's 150ms schedulePersist debounce. */
function flushPersist(): void {
  vi.advanceTimersByTime(300);
}

/** Simulate a page reload: fresh apply.ts module state, same localStorage. */
async function reloadModule() {
  vi.resetModules();
  return await import("../core/apply");
}

beforeEach(() => {
  // Only fake setTimeout (the persist debounce) — motion/react needs real rAF.
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  resetAll();
  resetAllModeOverrides();
  document.body.innerHTML = "";
  localStorage.clear();
});

afterEach(() => {
  resetAll();
  resetAllModeOverrides();
  localStorage.clear();
  vi.useRealTimers();
});

function mountBarAndClickDiscard(el: Element): ReturnType<typeof vi.fn> {
  const onDiscard = vi.fn();
  render(
    <CloseWarningBar
      open
      selectedElRef={{ current: el }}
      onDiscard={onDiscard}
      onKeepEditing={() => {}}
    />,
  );
  fireEvent.click(screen.getByText("Discard"));
  return onDiscard;
}

describe("unsaved-changes bar — discard actually discards", () => {
  it("discard reverts element AND mode overrides, clears persistence, and nothing resurrects on reload", async () => {
    const el = makeEl("discard-target");

    // One element edit + one global mode override (both unsaved).
    styleEngine.apply({ scope: "element", el }, "color", "red");
    applyModeOverride('[data-theme="dark"]', "--brand", "hotpink");
    expect(el.style.getPropertyValue("color")).toBe("red"); // precondition
    expect(getModeOverrideCount()).toBe(1); // precondition

    // Let the session persist (this is what resurrects edits on reload).
    flushPersist();
    expect(localStorage.getItem(KEY)).toContain('"color"'); // precondition

    const onDiscard = mountBarAndClickDiscard(el);

    // Still closes the panel (the host callback must keep firing).
    expect(onDiscard).toHaveBeenCalledTimes(1);

    // 1. Engine cleared + live DOM reverted to authored styles.
    expect(overrideCount(el)).toBe(0);
    expect(el.style.getPropertyValue("color")).toBe("");

    // 2. Mode/breakpoint dimension cleared too.
    expect(getModeOverrideCount()).toBe(0);

    // 3. Persistence cleared.
    flushPersist();
    expect(localStorage.getItem(KEY)).toBeNull();

    // 4. Reload the page — fresh module state, same localStorage.
    const fresh = await reloadModule();
    expect(fresh.restoreSession()).toBe(0);
    expect(fresh.overrideCount(el)).toBe(0);
    expect(el.style.getPropertyValue("color")).toBe("");
  });

  it("discard beats a still-pending persist debounce (edit → discard within 150ms cannot resurrect)", async () => {
    const el = makeEl("discard-pending-persist");

    styleEngine.apply({ scope: "element", el }, "margin-top", "32px");
    // Do NOT flush — the persist timer is still pending when Discard is clicked.

    mountBarAndClickDiscard(el);

    expect(overrideCount(el)).toBe(0);
    expect(el.style.getPropertyValue("margin-top")).toBe("");

    // Now let any straggler timer fire; it must not write the dead edit back.
    flushPersist();
    expect(localStorage.getItem(KEY)).toBeNull();

    const fresh = await reloadModule();
    expect(fresh.restoreSession()).toBe(0);
    expect(el.style.getPropertyValue("margin-top")).toBe("");
  });

  it("keep editing does NOT discard anything", () => {
    const el = makeEl("keep-editing-target");
    styleEngine.apply({ scope: "element", el }, "color", "blue");

    const onKeepEditing = vi.fn();
    render(
      <CloseWarningBar
        open
        selectedElRef={{ current: el }}
        onDiscard={() => {}}
        onKeepEditing={onKeepEditing}
      />,
    );
    fireEvent.click(screen.getByText("Keep Editing"));

    expect(onKeepEditing).toHaveBeenCalledTimes(1);
    expect(overrideCount(el)).toBe(1);
    expect(el.style.getPropertyValue("color")).toBe("blue");
  });
});
