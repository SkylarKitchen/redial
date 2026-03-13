// @vitest-environment happy-dom
/**
 * spacing-indicator-after-reset.test.ts
 *
 * Reproduces bug: after alt+click resetting a spacing property, the value
 * cell stays blue ("modified") and the section dot persists — even though
 * the value is back at its original computed value.
 *
 * Root cause: resetAndReadNum removes the override, then onChange re-applies
 * the same computed value via applyInlineStyle. The indicator function
 * (getIndicatorType) checks inline style presence rather than isDirty,
 * so it incorrectly reports "modified".
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  applyInlineStyle,
  resetProp,
  resetAndReadNum,
  isDirty,
  resetAll,
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
  it("getIndicatorType returns 'none' after reset + re-apply of same value", () => {
    const el = makeEl();

    // 1. User edits padding-left to "20px"
    applyInlineStyle(el, "padding-left", "20px");
    expect(isDirty(el, "padding-left")).toBe(true);
    expect(getIndicatorType(el, "padding-left")).toBe("modified");

    // 2. User alt+clicks to reset — this is what SpacingBoxModel does:
    //    const newValue = resetAndReadNum(element, prop);
    //    onChange(prop, newValue, unit);
    const newValue = resetAndReadNum(el, "padding-left");

    // 3. onChange callback propagates to handleSpacingChange, which calls
    //    applyInlineStyle with the computed value
    applyInlineStyle(el, "padding-left", `${newValue}px`);

    // 4. The value should NOT be dirty (initial === current)
    expect(isDirty(el, "padding-left")).toBe(false);

    // 5. BUG: getIndicatorType still returns "modified" because the inline
    //    style is physically set, even though isDirty is false
    expect(getIndicatorType(el, "padding-left")).toBe("none");
  });

  it("section indicator returns 'none' when no spacing props are dirty", () => {
    const el = makeEl();

    // Edit both padding sides
    applyInlineStyle(el, "padding-left", "20px");
    applyInlineStyle(el, "padding-right", "20px");

    // Reset both via the alt+click flow
    const leftVal = resetAndReadNum(el, "padding-left");
    applyInlineStyle(el, "padding-left", `${leftVal}px`);

    const rightVal = resetAndReadNum(el, "padding-right");
    applyInlineStyle(el, "padding-right", `${rightVal}px`);

    // Neither should report as modified
    expect(getIndicatorType(el, "padding-left")).toBe("none");
    expect(getIndicatorType(el, "padding-right")).toBe("none");

    // Section-level: check that sectionInd would return "none"
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

    // Edit padding-left to a non-default value
    applyInlineStyle(el, "padding-left", "42px");

    expect(isDirty(el, "padding-left")).toBe(true);
    expect(getIndicatorType(el, "padding-left")).toBe("modified");
  });
});
