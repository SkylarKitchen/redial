// @vitest-environment happy-dom
/**
 * styleIndicators.test.ts
 *
 * Locks the cascade-provenance indicator model adopted in ADR-0007
 * (webflow-style-panel-spec.md §11). `getIndicatorType` now classifies
 * WHERE a value comes from, not just whether it changed this session:
 *
 *   - "element-inline" (pink)   — value set via the element's inline style attr
 *   - "authored-here"  (blue)   — value set on a CSS rule matching this element
 *   - "inherited"      (orange) — CSS-inherited prop cascaded from an ancestor
 *   - "state"          (green)  — pseudo-state-specific session edit
 *   - "modified"       (amber)  — changed THIS SESSION (orthogonal cue, preserved)
 *   - "none"                    — browser default / unset
 *
 * Priority (ADR-0007 open sub-question resolution): a session edit wins over
 * provenance, so the "I edited this" cue is never lost and the reset
 * affordances (gated on "modified") keep working. Provenance therefore
 * surfaces only on properties that have NOT been edited this session.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getIndicatorType } from "../panelUtils";
import { applyInlineStyle, isDirty, resetAll, stateKey } from "../core/apply";
import { indicatorColor, labelIndicator, color, type IndicatorType } from "../theme";

// ─── Setup ───────────────────────────────────────────────────────────

const injectedSheets: HTMLStyleElement[] = [];

beforeEach(() => {
  resetAll();
  document.body.innerHTML = "";
});

afterEach(() => {
  injectedSheets.splice(0).forEach((s) => s.remove());
});

function makeEl(tag = "div"): HTMLElement {
  const el = document.createElement(tag);
  document.body.appendChild(el);
  return el;
}

/** Inject a real stylesheet rule so getAuthoredValue can resolve it via document.styleSheets. */
function injectRule(css: string): void {
  const style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);
  injectedSheets.push(style);
}

// ─── No override → no indicator ──────────────────────────────────────

describe("no override shows no indicator", () => {
  it('returns "none" for a property that has never been touched', () => {
    const el = makeEl();
    const cs = getComputedStyle(el);
    expect(getIndicatorType(el, "color", cs)).toBe("none");
  });

  it('returns "none" for multiple untouched properties (default values are not "inherited")', () => {
    const el = makeEl();
    const cs = getComputedStyle(el);
    const parentCs = el.parentElement ? getComputedStyle(el.parentElement) : null;
    for (const prop of ["font-size", "color", "display", "opacity"]) {
      expect(getIndicatorType(el, prop, cs, parentCs)).toBe("none");
    }
  });
});

// ─── Element-scope inline attr → pink ("element-inline") ─────────────

describe("element-scope inline override → element-inline (pink)", () => {
  it('returns "element-inline" for a value set via the inline style attribute', () => {
    const el = makeEl();
    el.style.setProperty("color", "red"); // real inline attr, NOT a session edit
    const cs = getComputedStyle(el);
    expect(isDirty(el, "color")).toBe(false);
    expect(getIndicatorType(el, "color", cs)).toBe("element-inline");
  });
});

// ─── Class-rule authoring → blue ("authored-here") ───────────────────

describe("value authored on a matching rule → authored-here (blue)", () => {
  it('returns "authored-here" for a value set on a CSS rule matching the element', () => {
    injectRule(".prov-card { background-color: rgb(240, 240, 240); }");
    const el = makeEl();
    el.className = "prov-card";
    const cs = getComputedStyle(el);
    expect(getIndicatorType(el, "background-color", cs)).toBe("authored-here");
  });
});

// ─── Inherited from an ancestor → orange ("inherited") ───────────────

describe("inherited property detection → inherited (orange)", () => {
  it('returns "inherited" for a CSS-inherited prop cascaded from an authored ancestor', () => {
    const parent = makeEl();
    parent.style.setProperty("color", "blue"); // ancestor authors color
    const child = document.createElement("span");
    parent.appendChild(child);

    const cs = getComputedStyle(child);
    const parentCs = getComputedStyle(parent);
    // child has no authored value; its computed color equals the parent's
    expect(getIndicatorType(child, "color", cs, parentCs)).toBe("inherited");
  });

  it('returns "none" for a non-inherited prop even when it matches the parent', () => {
    const parent = makeEl();
    const child = document.createElement("div");
    parent.appendChild(child);
    const cs = getComputedStyle(child);
    const parentCs = getComputedStyle(parent);
    // display is not a CSS-inherited property → never "inherited"
    expect(getIndicatorType(child, "display", cs, parentCs)).toBe("none");
  });
});

// ─── Session edit wins over provenance (preserved "modified" cue) ────

describe("session edit takes priority over provenance", () => {
  it('returns "modified" when a property is edited this session', () => {
    const el = makeEl();
    applyInlineStyle(el, "font-size", "20px");
    const cs = getComputedStyle(el);
    expect(isDirty(el, "font-size")).toBe(true);
    expect(getIndicatorType(el, "font-size", cs)).toBe("modified");
  });

  it('"modified" beats "authored-here" when an authored prop is also edited this session', () => {
    injectRule(".prov-edited { background-color: rgb(1, 2, 3); }");
    const el = makeEl();
    el.className = "prov-edited";
    applyInlineStyle(el, "background-color", "rgb(9, 9, 9)");
    const cs = getComputedStyle(el);
    expect(getIndicatorType(el, "background-color", cs)).toBe("modified");
  });

  it('class-scoped session edit still reads as "modified" (dirty cue preserved)', () => {
    const el = makeEl();
    applyInlineStyle(el, "padding", "16px", "Button_btn__a8f2k");
    expect(getIndicatorType(el, "padding", getComputedStyle(el))).toBe("modified");
  });
});

// ─── State-specific overrides → green ("state") ──────────────────────

describe("state-specific override → state (green)", () => {
  it('returns "state" when a property is overridden for an active pseudo-class', () => {
    const el = makeEl();
    applyInlineStyle(el, stateKey("hover", "color"), "red");
    const cs = getComputedStyle(el);
    expect(getIndicatorType(el, "color", cs, null, "hover")).toBe("state");
  });

  it('"state" takes priority over a base session edit', () => {
    const el = makeEl();
    applyInlineStyle(el, "color", "blue");
    applyInlineStyle(el, stateKey("hover", "color"), "red");
    const cs = getComputedStyle(el);
    expect(getIndicatorType(el, "color", cs, null, "hover")).toBe("state");
  });

  it('falls back to "modified" when viewing the base state (activeState="none")', () => {
    const el = makeEl();
    applyInlineStyle(el, "color", "blue");
    const cs = getComputedStyle(el);
    expect(getIndicatorType(el, "color", cs, null, "none")).toBe("modified");
  });
});

// ─── Indicator color + label maps cover every variant ────────────────

describe("indicator maps are exhaustive over the widened union", () => {
  const ALL: IndicatorType[] = [
    "authored-here", "inherited", "element-inline", "state", "modified", "none",
  ];

  it("indicatorColor maps every variant to a token", () => {
    expect(indicatorColor["authored-here"]).toBe(color.indicatorBlue);
    expect(indicatorColor.inherited).toBe(color.indicatorOrange);
    expect(indicatorColor["element-inline"]).toBe(color.indicatorPink);
    expect(indicatorColor.state).toBe(color.indicatorGreen);
    expect(indicatorColor.modified).toBe(color.warning); // amber — distinct from authored-here
    expect(indicatorColor.none).toBe(color.mutedForeground);
  });

  it("labelIndicator has an entry for every variant", () => {
    for (const t of ALL) {
      expect(labelIndicator[t]).toBeTruthy();
      expect(typeof labelIndicator[t].bg).toBe("string");
      expect(typeof labelIndicator[t].text).toBe("string");
    }
  });

  it("the session cue (modified) is visibly distinct from authored-here", () => {
    expect(indicatorColor.modified).not.toBe(indicatorColor["authored-here"]);
  });
});
