// @vitest-environment happy-dom
/**
 * overrideProvenance.test.ts — ADR-0011: overrides record the target they
 * were applied under.
 *
 * The store used to hold only { initial, current } per (breakpoint, state,
 * prop) cell, so save targeting had to be reconstructed from the scoping
 * context AT SAVE TIME — Footer stamped the current toggle onto every diff
 * (`elementScopeSave`), Save All stamped a placeholder, and the same edit
 * could land in a different file depending on which button saved it.
 *
 * These tests lock the fix at its source: `applyInlineStyle` records the
 * class an edit was applied under (absent = element provenance), the diff
 * carries it, `resolveTarget` freezes the active class onto pseudo-state
 * targets, provenance is last-write-wins per cell, and it round-trips
 * through session persistence (legacy payloads restore as element).
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { styleEngine, resolveTarget } from "../core/engine";
import { diff, restoreSession, resetAll } from "../core/apply";

const KEY = "__tuner_session:" + location.pathname;

function makeEl(): HTMLElement {
  const el = document.createElement("div");
  el.id = "prov-target";
  document.body.appendChild(el);
  return el;
}

beforeEach(() => {
  resetAll();
  document.body.innerHTML = "";
  localStorage.clear();
});

afterEach(() => {
  resetAll();
  localStorage.clear();
});

describe("provenance recording (ADR-0011)", () => {
  it("a class-target edit records the class on its diff entry", () => {
    const el = makeEl();
    styleEngine.apply({ scope: "class", el, className: "card" }, "color", "red");
    const entry = diff(el).find((c) => c.prop === "color");
    expect(entry?.className).toBe("card");
  });

  it("an element-target edit records no class (element provenance)", () => {
    const el = makeEl();
    styleEngine.apply({ scope: "element", el }, "color", "red");
    const entry = diff(el).find((c) => c.prop === "color");
    expect(entry?.className).toBeUndefined();
  });

  it("resolveTarget freezes the active class onto a pseudo-state target", () => {
    const el = makeEl();
    const target = resolveTarget(el, {
      scope: "class",
      activeClassName: "card",
      activeState: "hover",
    });
    expect(target).toEqual({ scope: "state", el, state: "hover", className: "card" });
  });

  it("a state edit made under an active class records that class", () => {
    const el = makeEl();
    styleEngine.apply(
      resolveTarget(el, { scope: "class", activeClassName: "card", activeState: "hover" }),
      "color",
      "red",
    );
    const entry = diff(el).find((c) => c.prop === "color" && c.state === "hover");
    expect(entry?.className).toBe("card");
  });

  it("a breakpoint class edit (tracked-only path) still records the class", () => {
    const el = makeEl();
    styleEngine.apply({ scope: "class", el, className: "card", breakpoint: "768" }, "gap", "8px");
    const entry = diff(el).find((c) => c.prop === "gap" && c.breakpoint === "768");
    expect(entry?.className).toBe("card");
  });

  it("provenance is last-write-wins per cell — re-editing under element clears the class", () => {
    const el = makeEl();
    styleEngine.apply({ scope: "class", el, className: "card" }, "color", "red");
    styleEngine.apply({ scope: "element", el }, "color", "blue");
    const entry = diff(el).find((c) => c.prop === "color");
    expect(entry?.to).toBe("blue");
    expect(entry?.className).toBeUndefined();
  });

  it("…and re-editing under a class stamps it", () => {
    const el = makeEl();
    styleEngine.apply({ scope: "element", el }, "color", "blue");
    styleEngine.apply({ scope: "class", el, className: "card" }, "color", "red");
    expect(diff(el).find((c) => c.prop === "color")?.className).toBe("card");
  });
});

describe("engine.diffState — reads the override store's mirror, not the preview map", () => {
  it("returns state-stamped entries carrying provenance", () => {
    const el = makeEl();
    styleEngine.apply(
      resolveTarget(el, { scope: "class", activeClassName: "card", activeState: "hover" }),
      "color",
      "red",
    );
    const entries = styleEngine.diffState(el, "hover");
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ prop: "color", to: "red", state: "hover", className: "card" });
  });

  it("includes breakpoint▸state composite entries the preview map never held", () => {
    const el = makeEl();
    styleEngine.apply({ scope: "state", el, state: "hover", breakpoint: "768" }, "color", "red");
    const entries = styleEngine.diffState(el, "hover");
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ prop: "color", state: "hover", breakpoint: "768" });
  });

  it("excludes base (stateless) entries", () => {
    const el = makeEl();
    styleEngine.apply({ scope: "element", el }, "color", "blue");
    styleEngine.apply({ scope: "state", el, state: "hover" }, "color", "red");
    const entries = styleEngine.diffState(el, "hover");
    expect(entries).toHaveLength(1);
    expect(entries[0].state).toBe("hover");
  });
});

describe("session persistence round-trip", () => {
  it("persists provenance and restores it", async () => {
    const el = makeEl();
    styleEngine.apply({ scope: "class", el, className: "card" }, "color", "red");
    // persistToStorage is debounced 150 ms
    await new Promise((r) => setTimeout(r, 250));
    const stored = JSON.parse(localStorage.getItem(KEY) ?? "{}");
    const cell = stored["#prov-target"]?.["color"];
    expect(cell?.className).toBe("card");

    resetAll();
    localStorage.setItem(KEY, JSON.stringify(stored));
    makeEl();
    expect(restoreSession()).toBe(1);
    const entry = diff(document.getElementById("prov-target")!).find((c) => c.prop === "color");
    expect(entry?.className).toBe("card");
  });

  it("a pre-provenance session restores with element provenance (compat default)", () => {
    makeEl();
    localStorage.setItem(
      KEY,
      JSON.stringify({ "#prov-target": { color: { initial: "rgb(0, 0, 0)", current: "red" } } }),
    );
    expect(restoreSession()).toBe(1);
    const entry = diff(document.getElementById("prov-target")!).find((c) => c.prop === "color");
    expect(entry?.to).toBe("red");
    expect(entry?.className).toBeUndefined();
  });
});
