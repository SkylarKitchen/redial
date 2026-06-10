// @vitest-environment happy-dom
/**
 * styleEngine.test.ts — Phase-1 facade (RFC #14)
 *
 * Verifies that `styleEngine` faithfully delegates to the underlying
 * subsystems: that `apply(target, …)` routes each scope exactly as
 * WebflowPanel does today, and that undo/diff/reset/subscribe behave as a
 * thin sum of the existing modules. These are delegation tests — the real
 * behaviour is still owned by apply.ts / scope.ts / statePreview.ts /
 * modeOverrides.ts, which have their own deeper suites.
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
  styleEngine,
  resolveTarget,
  type OverrideTarget,
  type ScopeContext,
} from "../core/engine";
import { isDirty, totalOverrideCount } from "../core/apply";
import {
  getModeOverrideCount,
  resetAllModeOverrides,
  isModeOverrideDirty,
} from "../core/modeOverrides";
import { getClassScopeCss } from "../core/scope";

function makeEl(tag = "div"): HTMLElement {
  const el = document.createElement(tag);
  document.body.appendChild(el);
  return el;
}

function classStyleText(): string {
  return getClassScopeCss() ?? "";
}

beforeEach(() => {
  styleEngine.resetAll();
  resetAllModeOverrides();
  document.body.innerHTML = "";
});

describe("resolveTarget()", () => {
  // The single source of truth for the (scope, activeClassName, activeState)
  // → OverrideTarget mapping. Every caller (spacing box model, CSS import,
  // CSS-import hotkey, WebflowPanel) builds its target through this so the
  // routing rule lives in exactly one place (RFC #14, crux #1).
  it("maps a plain element edit to an element target", () => {
    const el = makeEl();
    expect(
      resolveTarget(el, { scope: "element", activeClassName: null, activeState: "none" }),
    ).toEqual({ scope: "element", el });
  });

  it("maps a class scope with an active class name to a class target", () => {
    const el = makeEl();
    expect(
      resolveTarget(el, { scope: "class", activeClassName: "box", activeState: "none" }),
    ).toEqual({ scope: "class", el, className: "box" });
  });

  it("falls back to element when class scope has no active class name", () => {
    const el = makeEl();
    expect(
      resolveTarget(el, { scope: "class", activeClassName: null, activeState: "none" }),
    ).toEqual({ scope: "element", el });
  });

  it("maps a pseudo-state edit to a state target", () => {
    const el = makeEl();
    expect(
      resolveTarget(el, { scope: "element", activeClassName: null, activeState: "hover" }),
    ).toEqual({ scope: "state", el, state: "hover" });
  });

  it("state takes precedence over class (a pseudo-state edit on a class is a state edit)", () => {
    const el = makeEl();
    expect(
      resolveTarget(el, { scope: "class", activeClassName: "box", activeState: "focus" }),
    ).toEqual({ scope: "state", el, state: "focus" });
  });
});

describe("apply() dispatch", () => {
  it("element scope writes an inline override", () => {
    const el = makeEl();
    styleEngine.apply({ scope: "element", el }, "color", "red");

    expect(el.style.getPropertyValue("color")).toBe("red");
    expect(isDirty(el, "color")).toBe(true);
  });

  it("class scope writes the class rule AND an inline preview", () => {
    const el = makeEl();
    styleEngine.apply({ scope: "class", el, className: "box" }, "color", "red");

    // Persisted form: the managed class <style> tag carries the rule
    const css = classStyleText();
    expect(css).toContain(".box");
    expect(css).toContain("color: red");
    // Live preview: inline style mirrors it
    expect(el.style.getPropertyValue("color")).toBe("red");
  });

  it("state scope is tracked under a composite key so diff/undo see it", () => {
    const el = makeEl();
    styleEngine.apply({ scope: "state", el, state: "hover" }, "color", "red");

    const entry = styleEngine.diff().elements.find((e) => e.el === el);
    expect(entry).toBeDefined();
    const change = entry!.changes.find((c) => c.prop === "color");
    expect(change).toBeDefined();
    expect(change!.state).toBe("hover");
    // State-keyed props are applied via the <style> tag, NOT inline
    expect(el.style.getPropertyValue("color")).toBe("");
  });

  it("mode scope writes a CSS-variable override (prop arg ignored)", () => {
    const target: OverrideTarget = {
      scope: "mode",
      selector: ":root",
      varName: "--brand",
    };
    styleEngine.apply(target, "ignored", "#f00");

    expect(getModeOverrideCount()).toBe(1);
    expect(isModeOverrideDirty(":root", "--brand")).toBe(true);
    expect(styleEngine.diff().modes).toContain("--brand: #f00");
  });
});

describe("diff()", () => {
  it("combines element diffs and serialized modes", () => {
    const el = makeEl();
    styleEngine.apply({ scope: "element", el }, "color", "red");
    styleEngine.apply(
      { scope: "mode", selector: ":root", varName: "--brand" },
      "",
      "#f00",
    );

    const d = styleEngine.diff();
    expect(d.elements.some((e) => e.el === el)).toBe(true);
    expect(d.modes).toContain(":root");
    expect(d.modes).toContain("--brand: #f00");
  });
});

describe("undo() / redo()", () => {
  it("reverts an inline edit and returns the affected element", () => {
    const el = makeEl();
    styleEngine.apply({ scope: "element", el }, "color", "red");
    expect(isDirty(el, "color")).toBe(true);

    const result = styleEngine.undo();
    expect(result?.el).toBe(el);
    expect(result?.prop).toBe("color");
    expect(isDirty(el, "color")).toBe(false);

    styleEngine.redo();
    expect(isDirty(el, "color")).toBe(true);
  });

  it("reverts a mode-only edit via the unified stack (returns the body sentinel)", () => {
    styleEngine.apply(
      { scope: "mode", selector: ":root", varName: "--brand" },
      "",
      "#f00",
    );
    expect(getModeOverrideCount()).toBe(1);

    // Mode rides apply.ts's foreign-op seam (RFC #14 4a): undo() reverts it and
    // returns the document.body sentinel (not null), so a history scrub keeps stepping.
    const result = styleEngine.undo();
    expect(result?.el).toBe(document.body);
    expect(getModeOverrideCount()).toBe(0);
  });
});

describe("dirtyCount()", () => {
  it("sums inline overrides and mode overrides", () => {
    const el = makeEl();
    styleEngine.apply({ scope: "element", el }, "color", "red");
    styleEngine.apply({ scope: "element", el }, "display", "flex");
    styleEngine.apply(
      { scope: "mode", selector: ":root", varName: "--brand" },
      "",
      "#f00",
    );

    expect(styleEngine.dirtyCount()).toBe(totalOverrideCount() + getModeOverrideCount());
    expect(styleEngine.dirtyCount()).toBe(3);
  });
});

describe("resetAll()", () => {
  it("clears inline, class, and state overrides", () => {
    const el = makeEl();
    styleEngine.apply({ scope: "element", el }, "color", "red");
    styleEngine.apply({ scope: "class", el, className: "box" }, "margin", "8px");
    styleEngine.apply({ scope: "state", el, state: "hover" }, "color", "blue");

    styleEngine.resetAll();

    expect(totalOverrideCount()).toBe(0);
    expect(classStyleText()).toBe("");
    expect(styleEngine.diff().elements).toHaveLength(0);
  });
});

// ─── Phase 3: per-element / per-state surface (the Footer "wall") ──────────────

describe("per-element / per-state surface (Footer, RFC #14 Phase 3)", () => {
  it("overrideCount(el) counts tracked keys for one element", () => {
    const el = makeEl();
    expect(styleEngine.overrideCount(el)).toBe(0);
    styleEngine.apply({ scope: "element", el }, "color", "red");
    styleEngine.apply({ scope: "element", el }, "display", "flex");
    expect(styleEngine.overrideCount(el)).toBe(2);
  });

  it("diffElement(el) returns that element's changed properties", () => {
    const el = makeEl();
    styleEngine.apply({ scope: "element", el }, "color", "red");
    const changes = styleEngine.diffElement(el);
    expect(changes.find((c) => c.prop === "color")?.to).toBe("red");
  });

  it("diffState(el, state) returns only that state's overrides", () => {
    const el = makeEl();
    styleEngine.apply({ scope: "element", el }, "color", "red"); // base
    styleEngine.apply({ scope: "state", el, state: "hover" }, "color", "blue");
    const changes = styleEngine.diffState(el, "hover");
    expect(changes).toHaveLength(1);
    expect(changes[0].prop).toBe("color");
    expect(changes[0].to).toBe("blue");
  });
});

describe("resetScope() — scoped reset (RFC #14 Phase 3)", () => {
  const ctx = (over: Partial<ScopeContext> = {}): ScopeContext => ({
    scope: "element",
    activeClassName: null,
    activeState: "none",
    ...over,
  });

  it("element scope clears the element's inline overrides", () => {
    const el = makeEl();
    styleEngine.apply({ scope: "element", el }, "color", "red");
    styleEngine.resetScope(el, ctx());
    expect(styleEngine.overrideCount(el)).toBe(0);
    expect(el.style.getPropertyValue("color")).toBe("");
  });

  it("class scope clears element inline AND the class rule", () => {
    const el = makeEl();
    styleEngine.apply({ scope: "class", el, className: "box" }, "color", "red");
    expect(classStyleText()).toContain(".box");
    styleEngine.resetScope(el, ctx({ scope: "class", activeClassName: "box" }));
    expect(styleEngine.overrideCount(el)).toBe(0);
    expect(classStyleText()).not.toContain(".box");
  });

  it("state scope clears only that state — base survives", () => {
    const el = makeEl();
    styleEngine.apply({ scope: "element", el }, "color", "red"); // base
    styleEngine.apply({ scope: "state", el, state: "hover" }, "color", "blue");
    styleEngine.resetScope(el, ctx({ activeState: "hover" }));
    expect(styleEngine.diffState(el, "hover")).toHaveLength(0);
    expect(el.style.getPropertyValue("color")).toBe("red");
  });

  it("does NOT clear global mode overrides (over-clear fix)", () => {
    const el = makeEl();
    styleEngine.apply({ scope: "element", el }, "color", "red");
    styleEngine.apply(
      { scope: "mode", selector: ".dark", varName: "--brand" },
      "",
      "#000",
    );
    expect(getModeOverrideCount()).toBe(1);

    styleEngine.resetScope(el, ctx());

    expect(styleEngine.overrideCount(el)).toBe(0);
    expect(getModeOverrideCount()).toBe(1);
    expect(isModeOverrideDirty(".dark", "--brand")).toBe(true);
  });
});

describe("undo() reaches every override dimension (RFC #14)", () => {
  it("reverts in reverse-time order — inline (applied last) first, then mode", () => {
    const el = makeEl();
    styleEngine.apply(
      { scope: "mode", selector: ".dark", varName: "--brand" },
      "",
      "#000",
    ); // applied FIRST
    styleEngine.apply({ scope: "element", el }, "color", "red"); // applied LAST
    expect(getModeOverrideCount()).toBe(1);
    expect(isDirty(el, "color")).toBe(true);

    const r1 = styleEngine.undo();
    expect(r1?.el).toBe(el);
    expect(isDirty(el, "color")).toBe(false);
    expect(getModeOverrideCount()).toBe(1); // mode untouched — it was applied earlier

    const r2 = styleEngine.undo();
    expect(r2?.el).toBe(document.body); // mode step returns the body sentinel
    expect(getModeOverrideCount()).toBe(0); // mode cleared via the unified stack
  });
});

describe("subscribe() / getSnapshot()", () => {
  it("fires on change and advances the combined snapshot", () => {
    const el = makeEl();
    let calls = 0;
    const unsubscribe = styleEngine.subscribe(() => {
      calls++;
    });

    const before = styleEngine.getSnapshot();
    styleEngine.apply({ scope: "element", el }, "color", "red");
    expect(calls).toBeGreaterThan(0);
    expect(styleEngine.getSnapshot()).not.toBe(before);

    const afterInline = styleEngine.getSnapshot();
    styleEngine.apply(
      { scope: "mode", selector: ":root", varName: "--brand" },
      "",
      "#f00",
    );
    expect(styleEngine.getSnapshot()).not.toBe(afterInline);

    unsubscribe();
  });
});
