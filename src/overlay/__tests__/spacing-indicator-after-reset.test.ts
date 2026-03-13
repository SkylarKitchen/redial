// @vitest-environment happy-dom
/**
 * spacing-indicator-after-reset.test.ts
 *
 * Reproduces bug: after alt+click resetting a spacing property, the value
 * cell stays blue ("modified") and the section dot persists — even though
 * the value is back at its original computed value.
 *
 * Root cause: getIndicatorType checks inline style PRESENCE
 * (el.style.getPropertyValue(prop) !== ""), but after a reset the onChange
 * callback re-applies the original value via applyInlineStyle — which sets
 * the inline style again. isDirty correctly returns false (initial === current),
 * but getIndicatorType ignores isDirty and reports "modified".
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  applyInlineStyle,
  isDirty,
  resetAll,
  resetProp,
} from "../apply";
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

    // BUG: getIndicatorType returns "modified" because the inline style is
    // physically present — even though isDirty is false.
    expect(getIndicatorType(el, "padding-left")).toBe("none");
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

    // Both indicators should be "none"
    expect(getIndicatorType(el, "padding-left")).toBe("none");
    expect(getIndicatorType(el, "padding-right")).toBe("none");

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

  it("indicator shows 'none' for property not tracked by apply.ts", () => {
    const el = makeEl();

    // Property set by external code (e.g. the page's own styles), NOT via panel
    el.style.setProperty("padding-left", "20px");

    // Not tracked in overrides → isDirty is false
    expect(isDirty(el, "padding-left")).toBe(false);

    // Should NOT show as modified — it's the page's own style, not a user edit
    expect(getIndicatorType(el, "padding-left")).toBe("none");
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
    expect(getIndicatorType(el, "padding-left")).toBe("none");
  });
});
