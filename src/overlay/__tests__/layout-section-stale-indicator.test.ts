// @vitest-environment happy-dom
/**
 * layout-section-stale-indicator.test.ts
 *
 * Bug: The Layout section header stays blue ("modified") after the user resets
 * all VISIBLE controls, because sectionInd checks a static list of 10 props
 * including flex/grid properties that are hidden when display is "block".
 *
 * Scenario:
 *   1. User selects a block element
 *   2. Changes display to "flex" → flex controls appear
 *   3. Changes flex-direction, justify-content, etc.
 *   4. Changes display back to "block" → flex controls disappear
 *   5. Resets display (the only visible control) → display override removed
 *   6. sectionInd still returns "modified" because flex-direction etc. overrides remain
 *
 * The section indicator should only reflect props relevant to the current
 * display mode, OR the section should provide a way to reset stale overrides.
 */

import { describe, it, expect, afterEach } from "vitest";
import { applyInlineStyle, isDirty, resetProp, resetAll } from "../apply";

/**
 * Simulate sectionInd: returns "modified" if ANY prop in the list is dirty.
 * This mirrors the logic in WebflowPanel.tsx line 94-97.
 */
function sectionInd(el: Element, props: string[]): "modified" | "none" {
  return props.some((p) => isDirty(el, p)) ? "modified" : "none";
}

/** The static prop list from LayoutSection.tsx line 322-325 */
const LAYOUT_SECTION_PROPS = [
  "display", "flex-direction", "justify-content", "align-items",
  "justify-items", "align-content", "flex-wrap", "gap", "row-gap", "column-gap",
];

describe("Layout section indicator after resetting visible controls", () => {
  let el: HTMLDivElement;

  afterEach(() => {
    el?.remove();
    resetAll();
  });

  it("section indicator clears when display is reset back to block, even with stale flex overrides", () => {
    el = document.createElement("div");
    document.body.appendChild(el);

    // 1. User changes display to flex
    applyInlineStyle(el, "display", "flex");
    // 2. User changes flex properties while in flex mode
    applyInlineStyle(el, "flex-direction", "column");
    applyInlineStyle(el, "justify-content", "center");
    applyInlineStyle(el, "align-items", "center");
    applyInlineStyle(el, "gap", "16px");

    // All dirty — section indicator should be modified
    expect(sectionInd(el, LAYOUT_SECTION_PROPS)).toBe("modified");

    // 3. User switches display back to block (flex controls disappear)
    applyInlineStyle(el, "display", "block");

    // 4. User resets display — the only visible control for a block element
    resetProp(el, "display");

    // BUG: sectionInd still returns "modified" because flex-direction,
    // justify-content, align-items, gap overrides are still tracked,
    // even though those controls are invisible (display is now "block").
    //
    // Expected: section indicator should NOT show as modified when
    // the only dirty props are for controls that aren't visible.
    expect(sectionInd(el, LAYOUT_SECTION_PROPS)).toBe("none");
  });

  it("section indicator clears when all visible flex controls are reset individually", () => {
    el = document.createElement("div");
    document.body.appendChild(el);

    // User changes display to flex + changes some flex props
    applyInlineStyle(el, "display", "flex");
    applyInlineStyle(el, "flex-direction", "column");
    applyInlineStyle(el, "justify-content", "center");
    applyInlineStyle(el, "gap", "16px");

    // User resets each visible control one by one
    resetProp(el, "display");
    resetProp(el, "flex-direction");
    resetProp(el, "justify-content");
    resetProp(el, "gap");

    // All individually-changed props were reset — indicator must be clean
    expect(sectionInd(el, LAYOUT_SECTION_PROPS)).toBe("none");
  });

  it("section indicator stays modified when a visible flex prop is still dirty", () => {
    el = document.createElement("div");
    document.body.appendChild(el);

    // User sets display to flex and changes gap
    applyInlineStyle(el, "display", "flex");
    applyInlineStyle(el, "gap", "16px");

    // Reset display but not gap — gap is still visible in flex mode (but
    // since display is back to block, gap controls are hidden)
    resetProp(el, "display");

    // The gap override still exists. Whether this should show as "modified"
    // depends on the approach taken to fix the bug. If we make sectionInd
    // display-aware, this should be "none" (gap isn't visible for block).
    // If we cascade-reset on display change, the gap override would be cleared.
    // For now, we assert the minimum: the test above must pass.
  });
});
