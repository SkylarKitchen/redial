// @vitest-environment happy-dom
/**
 * breakpointDimension.test.ts — Increment C of RFC #14 (Unified Style Engine).
 *
 * A breakpoint is an ORTHOGONAL composition dimension on the override model —
 * not a 5th flat arm of OverrideTarget. An edit at breakpoint "768" must be
 * keyed, diffed, undone, and reset INDEPENDENTLY of the base breakpoint and of
 * any other breakpoint, and it must COMPOSE with pseudo-state (a `:hover` AT
 * `≥768px` is a real combination). See ADR-0005.
 *
 * Scope of C is the MODEL only: no breakpoint UI, no media-gated live preview,
 * no `@media` save path — those land with #35 (Breakpoint Studio). So a
 * non-base-breakpoint override is TRACKED (keyed/diffed/undone/reset) but is
 * NOT written to the element's base inline style (it is media-gated, not inline).
 *
 * Base-breakpoint behaviour must stay byte-identical (backward compatibility).
 */
import { describe, it, expect, beforeEach } from "vitest";
import { styleEngine, resolveTarget, type ScopeContext } from "../core/engine";
import {
  getModeOverrideCount,
  resetAllModeOverrides,
} from "../core/modeOverrides";
// Namespace import so the not-yet-implemented key helpers surface as a clean
// per-test TypeError (rather than a module-load failure that masks every test).
import * as apply from "../core/apply";

function makeEl(tag = "div"): HTMLElement {
  const el = document.createElement(tag);
  document.body.appendChild(el);
  return el;
}

const ctx = (over: Partial<ScopeContext>): ScopeContext => ({
  scope: "element",
  activeClassName: null,
  activeState: "none",
  ...over,
});

beforeEach(() => {
  styleEngine.resetAll();
  resetAllModeOverrides();
  document.body.innerHTML = "";
});

describe("compositeKey / parseKey", () => {
  it("base breakpoint with no state is the bare property (byte-identical)", () => {
    expect(apply.compositeKey("base", "none", "color")).toBe("color");
  });

  it("base breakpoint with a state equals the legacy stateKey", () => {
    expect(apply.compositeKey("base", "hover", "color")).toBe(
      apply.stateKey("hover", "color"),
    );
  });

  it("a non-base breakpoint prefixes the composite (breakpoint outer, state inner)", () => {
    expect(apply.compositeKey("768", "hover", "color")).toBe("768@@hover::color");
    expect(apply.compositeKey("768", "none", "color")).toBe("768@@color");
  });

  it("parseKey round-trips every combination", () => {
    expect(apply.parseKey("color")).toEqual({
      breakpoint: "base",
      state: "none",
      prop: "color",
    });
    expect(apply.parseKey("hover::color")).toEqual({
      breakpoint: "base",
      state: "hover",
      prop: "color",
    });
    expect(apply.parseKey("768@@color")).toEqual({
      breakpoint: "768",
      state: "none",
      prop: "color",
    });
    expect(apply.parseKey("768@@hover::color")).toEqual({
      breakpoint: "768",
      state: "hover",
      prop: "color",
    });
  });
});

describe("resolveTarget() carries the active breakpoint", () => {
  it("defaults to the base breakpoint when none is given", () => {
    const el = makeEl();
    expect(resolveTarget(el, ctx({}))).toEqual({ scope: "element", el });
  });

  it("attaches a non-base breakpoint to an element target", () => {
    const el = makeEl();
    expect(resolveTarget(el, ctx({ activeBreakpoint: "768" }))).toEqual({
      scope: "element",
      el,
      breakpoint: "768",
    });
  });

  it("attaches the breakpoint to a state target (composition)", () => {
    const el = makeEl();
    expect(
      resolveTarget(el, ctx({ activeState: "hover", activeBreakpoint: "768" })),
    ).toEqual({ scope: "state", el, state: "hover", breakpoint: "768" });
  });
});

describe("breakpoint override is keyed & diffed independently of base", () => {
  it("a base edit and a breakpoint edit on the same prop are two distinct diffs", () => {
    const el = makeEl();
    styleEngine.apply({ scope: "element", el }, "color", "red");
    styleEngine.apply({ scope: "element", el, breakpoint: "768" }, "color", "blue");

    const d = styleEngine.diffElement(el);
    expect(d).toHaveLength(2);

    const base = d.find((e) => !e.breakpoint);
    const bp = d.find((e) => e.breakpoint === "768");
    expect(base).toMatchObject({ prop: "color", to: "red" });
    expect(bp).toMatchObject({ prop: "color", to: "blue", breakpoint: "768" });
  });

  it("a breakpoint override does NOT write to the base inline style", () => {
    const el = makeEl();
    styleEngine.apply({ scope: "element", el }, "color", "red");
    styleEngine.apply({ scope: "element", el, breakpoint: "768" }, "color", "blue");

    // The media-gated edit must not clobber the base inline value.
    expect(el.style.getPropertyValue("color")).toBe("red");
  });

  it("two different breakpoints on the same prop are independent", () => {
    const el = makeEl();
    styleEngine.apply({ scope: "element", el, breakpoint: "768" }, "color", "blue");
    styleEngine.apply({ scope: "element", el, breakpoint: "1024" }, "color", "green");

    const d = styleEngine.diffElement(el);
    expect(d.find((e) => e.breakpoint === "768")).toMatchObject({ to: "blue" });
    expect(d.find((e) => e.breakpoint === "1024")).toMatchObject({ to: "green" });
    expect(d).toHaveLength(2);
  });
});

describe("breakpoint composes with pseudo-state", () => {
  it("a :hover edit AT a breakpoint is tagged with both dimensions", () => {
    const el = makeEl();
    styleEngine.apply(
      { scope: "state", el, state: "hover", breakpoint: "768" },
      "color",
      "blue",
    );

    const entry = styleEngine
      .diffElement(el)
      .find((e) => e.breakpoint === "768");
    expect(entry).toMatchObject({
      prop: "color",
      to: "blue",
      state: "hover",
      breakpoint: "768",
    });
  });
});

describe("reset semantics — surgical per breakpoint", () => {
  it("resetScope at a breakpoint clears only that breakpoint, leaving base", () => {
    const el = makeEl();
    styleEngine.apply({ scope: "element", el }, "color", "red");
    styleEngine.apply({ scope: "element", el, breakpoint: "768" }, "margin", "10px");

    styleEngine.resetScope(el, ctx({ activeBreakpoint: "768" }));

    const d = styleEngine.diffElement(el);
    expect(d.find((e) => e.breakpoint === "768")).toBeUndefined();
    expect(d.find((e) => !e.breakpoint && e.prop === "color")).toMatchObject({
      to: "red",
    });
  });

  it("resetScope at base clears base, leaving the breakpoint override", () => {
    const el = makeEl();
    styleEngine.apply({ scope: "element", el }, "color", "red");
    styleEngine.apply({ scope: "element", el, breakpoint: "768" }, "margin", "10px");

    styleEngine.resetScope(el, ctx({ activeBreakpoint: "base" }));

    const d = styleEngine.diffElement(el);
    expect(d.find((e) => !e.breakpoint)).toBeUndefined();
    expect(d.find((e) => e.breakpoint === "768")).toMatchObject({
      prop: "margin",
      to: "10px",
    });
  });

  it("session-wide resetAll spans every breakpoint", () => {
    const el = makeEl();
    styleEngine.apply({ scope: "element", el }, "color", "red");
    styleEngine.apply({ scope: "element", el, breakpoint: "768" }, "margin", "10px");
    styleEngine.apply({ scope: "element", el, breakpoint: "1024" }, "padding", "5px");

    styleEngine.resetAll();

    expect(styleEngine.diff().elements).toHaveLength(0);
  });
});

describe("ADR-0004 holds at the breakpoint dimension", () => {
  it("mode overrides survive a breakpoint resetScope AND a session-wide resetAll", () => {
    const el = makeEl();
    styleEngine.apply({ scope: "mode", selector: ":root", varName: "--bg" }, "", "#111");
    styleEngine.apply({ scope: "element", el, breakpoint: "768" }, "color", "red");

    styleEngine.resetScope(el, ctx({ activeBreakpoint: "768" }));
    expect(getModeOverrideCount()).toBe(1);

    styleEngine.resetAll();
    expect(getModeOverrideCount()).toBe(1);
  });
});
