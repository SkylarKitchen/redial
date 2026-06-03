// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from "vitest";
import { styleEngine } from "../core/engine";
import {
  applyModeOverride,
  beginModeCoalesce,
  endModeCoalesce,
  getModeOverrideCount,
  getModeOverrides,
  resetAllModeOverrides,
} from "../core/modeOverrides";
import { isDirty } from "../core/apply";

function makeEl(): HTMLElement {
  const el = document.createElement("div");
  document.body.appendChild(el);
  return el;
}

beforeEach(() => {
  styleEngine.resetAll();
  resetAllModeOverrides();
  document.body.innerHTML = "";
});

describe("unified temporal undo (RFC #14 Increment 4a)", () => {
  it("undo reverses interleaved inline + mode edits in reverse-time order", () => {
    const el = makeEl();
    styleEngine.apply({ scope: "element", el }, "color", "red"); // t0 inline
    applyModeOverride(".dark", "--bg", "#111"); // t1 mode
    styleEngine.apply({ scope: "element", el }, "margin", "8px"); // t2 inline

    expect(isDirty(el, "color")).toBe(true);
    expect(isDirty(el, "margin")).toBe(true);
    expect(getModeOverrideCount()).toBe(1);

    // Reverse temporal: margin (t2) → --bg (t1) → color (t0)
    styleEngine.undo();
    expect(isDirty(el, "margin")).toBe(false);
    expect(getModeOverrideCount()).toBe(1); // mode still present

    styleEngine.undo();
    expect(getModeOverrideCount()).toBe(0); // mode reverted SECOND, not last
    expect(isDirty(el, "color")).toBe(true); // color still present

    styleEngine.undo();
    expect(isDirty(el, "color")).toBe(false);
  });

  it("redo restores interleaved edits in forward-time order", () => {
    const el = makeEl();
    styleEngine.apply({ scope: "element", el }, "color", "red");
    applyModeOverride(".dark", "--bg", "#111");
    styleEngine.undo(); // revert mode
    styleEngine.undo(); // revert color
    expect(isDirty(el, "color")).toBe(false);
    expect(getModeOverrideCount()).toBe(0);

    styleEngine.redo(); // re-color
    expect(isDirty(el, "color")).toBe(true);
    expect(getModeOverrideCount()).toBe(0);

    styleEngine.redo(); // re-mode
    expect(getModeOverrideCount()).toBe(1);
    expect(getModeOverrides(".dark")).toEqual({ "--bg": "#111" });
  });

  it("a coalesced mode drag collapses to ONE undo step", () => {
    beginModeCoalesce();
    applyModeOverride(".dark", "--bg", "#100");
    applyModeOverride(".dark", "--bg", "#200");
    applyModeOverride(".dark", "--bg", "#300");
    endModeCoalesce();
    expect(getModeOverrides(".dark")).toEqual({ "--bg": "#300" });

    styleEngine.undo(); // ONE step reverts the whole drag
    expect(getModeOverrideCount()).toBe(0);
  });

  it("a mode undo returns the body sentinel (not null) so history-scrub keeps stepping", () => {
    applyModeOverride(".dark", "--bg", "#111");
    const r = styleEngine.undo();
    expect(r).not.toBeNull();
    expect(r?.el).toBe(document.body);
    expect(getModeOverrideCount()).toBe(0);
  });

  it("ADR-0004: a session-wide style resetAll leaves mode overrides intact", () => {
    const el = makeEl();
    styleEngine.apply({ scope: "element", el }, "color", "red");
    applyModeOverride(".dark", "--bg", "#111");

    styleEngine.resetAll();
    expect(isDirty(el, "color")).toBe(false);
    expect(getModeOverrideCount()).toBe(1); // mode survives the style reset
  });

  it("getModeOverrideCount tracks across unified undo/redo (drives useSyncExternalStore)", () => {
    applyModeOverride(".dark", "--bg", "#111");
    expect(getModeOverrideCount()).toBe(1);
    styleEngine.undo();
    expect(getModeOverrideCount()).toBe(0);
    styleEngine.redo();
    expect(getModeOverrideCount()).toBe(1);
  });
});
