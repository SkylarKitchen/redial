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
import { styleEngine, type OverrideTarget } from "../core/engine";
import { isDirty, totalOverrideCount } from "../core/apply";
import {
  getModeOverrideCount,
  resetAllModeOverrides,
  isModeOverrideDirty,
} from "../core/modeOverrides";

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

beforeEach(() => {
  styleEngine.resetAll();
  resetAllModeOverrides();
  document.body.innerHTML = "";
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

  it("falls through to the mode stack when there is no inline edit to undo", () => {
    styleEngine.apply(
      { scope: "mode", selector: ":root", varName: "--brand" },
      "",
      "#f00",
    );
    expect(getModeOverrideCount()).toBe(1);

    // No inline overrides exist, so undo() should return null and pop the mode stack
    const result = styleEngine.undo();
    expect(result).toBeNull();
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
