// @vitest-environment happy-dom
/**
 * spacing-indicator-after-reset.test.ts
 *
 * Guards the anti-regression invariant: after resetting a spacing property,
 * the cell must NOT stay amber ("modified" — the "I edited this" cue). The
 * original bug reported a non-dirty property still reading as a session edit.
 *
 * Under ADR-0007 (cascade provenance), a non-dirty value with a real inline
 * style attribute reads as "element-inline" (pink provenance) — distinct from
 * a session edit ("modified", amber). That distinction is the whole point: the
 * page's own inline styles are now shown as provenance, not mistaken for edits.
 * The hard invariant these tests lock is therefore `!== "modified"` whenever
 * isDirty is false; the precise provenance ("element-inline" for an inline
 * attribute, "none" once the inline style is actually removed) is asserted too.
 *
 * The real reset path (resetProp) removes the inline style → "none" (see the
 * resetProp test below). Tests that pre-seed an inline style via setProperty
 * keep that inline attribute, so they read as "element-inline".
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  applyInlineStyle,
  isDirty,
  resetAll,
  resetProp,
} from "../core/apply";
import { getIndicatorType } from "../panelUtils";

function makeEl(tag = "div"): HTMLElement {
  const el = document.createElement(tag);
  document.body.appendChild(el);
  return el;
}

beforeEach(() => {
  resetAll();
  document.body.innerHTML = "";
});

describe("Spacing indicator after alt+click reset", () => {
  it("getIndicatorType returns 'none' when isDirty is false (reset + re-apply scenario)", () => {
    const el = makeEl();

    // Pre-set the inline style to simulate a computed value already in place.
    // In a real browser, the element would have padding-left: 20px from a
    // stylesheet. Here we set it inline so getComputedStyle returns "20px".
    el.style.setProperty("padding-left", "20px");

    // Simulate applyInlineStyle AFTER a reset: the override's initial value
    // matches the current value because the element's computed style is "20px"
    // and we're re-applying "20px".
    applyInlineStyle(el, "padding-left", "20px");

    // isDirty should be false: initial (captured from getComputedStyle) === current
    expect(isDirty(el, "padding-left")).toBe(false);

    // Invariant: a non-dirty property must never read as a session edit.
    expect(getIndicatorType(el, "padding-left")).not.toBe("modified");
    // Provenance: a real inline style attribute reads as "element-inline" (pink).
    expect(getIndicatorType(el, "padding-left")).toBe("element-inline");
  });

  it("section indicator returns 'none' when no spacing props are dirty after reset", () => {
    const el = makeEl();

    // Same setup: pre-set inline styles to give getComputedStyle real values
    el.style.setProperty("padding-left", "20px");
    el.style.setProperty("padding-right", "20px");

    // Simulate reset + re-apply for both
    applyInlineStyle(el, "padding-left", "20px");
    applyInlineStyle(el, "padding-right", "20px");

    expect(isDirty(el, "padding-left")).toBe(false);
    expect(isDirty(el, "padding-right")).toBe(false);

    // Non-dirty inline styles read as provenance ("element-inline"), never as
    // a session edit ("modified").
    expect(getIndicatorType(el, "padding-left")).toBe("element-inline");
    expect(getIndicatorType(el, "padding-right")).toBe("element-inline");

    // Section-level: no spacing prop should show "modified"
    const spacingProps = [
      "margin-top", "margin-right", "margin-bottom", "margin-left",
      "padding-top", "padding-right", "padding-bottom", "padding-left",
    ];
    const anyModified = spacingProps.some(
      (p) => getIndicatorType(el, p) === "modified"
    );
    expect(anyModified).toBe(false);
  });

  it("indicator stays 'modified' for a genuinely dirty property", () => {
    const el = makeEl();

    // Edit padding-left to a value that differs from computed
    applyInlineStyle(el, "padding-left", "42px");

    expect(isDirty(el, "padding-left")).toBe(true);
    expect(getIndicatorType(el, "padding-left")).toBe("modified");
  });

  it("page's own inline style reads as provenance, not a session edit", () => {
    const el = makeEl();

    // Property set by external code (e.g. the page's own inline styles), NOT via panel
    el.style.setProperty("padding-left", "20px");

    // Not tracked in overrides → isDirty is false
    expect(isDirty(el, "padding-left")).toBe(false);

    // Must NOT show as a session edit — it's the page's own style.
    expect(getIndicatorType(el, "padding-left")).not.toBe("modified");
    // ADR-0007: the page's own inline style is shown as element-scope provenance.
    expect(getIndicatorType(el, "padding-left")).toBe("element-inline");
  });

  it("FIXED: reset without re-apply leaves isDirty false (component-level fix)", () => {
    const el = makeEl();

    // 1. User edits padding-left to 20px via the panel
    applyInlineStyle(el, "padding-left", "20px");
    expect(isDirty(el, "padding-left")).toBe(true);

    // 2. Alt+click: resetAndReadNum removes override + inline style
    //    The component-level fix (onReset callback) only updates parent state
    //    without calling applyInlineStyle — so no re-apply happens.
    resetProp(el, "padding-left");
    expect(isDirty(el, "padding-left")).toBe(false);
    expect(getIndicatorType(el, "padding-left")).toBe("none");
  });

  it("defense in depth: isDirty treats '0px' vs '0em' as equal", () => {
    const el = makeEl();

    // Pre-set to "0px" so getComputedStyle returns "0px" (not empty string)
    el.style.setProperty("padding-left", "0px");

    // Apply "0em" — initial captured as "0px", current is "0em"
    applyInlineStyle(el, "padding-left", "0em");

    // Both are numerically zero — isDirty should return false
    expect(isDirty(el, "padding-left")).toBe(false);
    // Non-dirty → never "modified"; the inline "0em" is element-scope provenance.
    expect(getIndicatorType(el, "padding-left")).not.toBe("modified");
    expect(getIndicatorType(el, "padding-left")).toBe("element-inline");
  });
});
