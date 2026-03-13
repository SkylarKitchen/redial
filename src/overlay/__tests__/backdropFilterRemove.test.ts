/**
 * backdropFilterRemove.test.ts
 *
 * Bug: clicking the × (remove) button on a backdrop-filter slider does not
 * actually clear the CSS property. The filter value stays in state and
 * filterToCSS produces "blur(0px)" instead of "none".
 *
 * Two sub-bugs:
 * 1. handleRemove early-returns when blur is at default (0), doing nothing.
 * 2. Even when non-default, resetting to default keeps the key in state,
 *    so filterToCSS never returns "none".
 */

import { describe, it, expect } from "vitest";
import { filterToCSS } from "../cssParsers";

describe("backdrop-filter remove via ×", () => {
  it("filterToCSS returns 'none' when all values are at their defaults", () => {
    // After removing all filters, the values object should produce "none"
    // blur default = 0, brightness default = 100, contrast default = 100
    // If a key is present but at its default, it should be omitted from output
    expect(filterToCSS({ blur: 0 })).toBe("none");
    expect(filterToCSS({ blur: 0, brightness: 100 })).toBe("none");
    expect(filterToCSS({ blur: 0, contrast: 100, saturate: 100 })).toBe("none");
  });

  it("filterToCSS includes only non-default values", () => {
    // blur=5 is non-default → include it
    expect(filterToCSS({ blur: 5 })).toBe("blur(5px)");
    // blur=0 (default) + contrast=80 (non-default) → only contrast
    expect(filterToCSS({ blur: 0, contrast: 80 })).toBe("contrast(0.8)");
  });

  it("filterToCSS still works for mixed default and non-default", () => {
    expect(filterToCSS({ blur: 3, brightness: 100 })).toBe("blur(3px)");
    expect(filterToCSS({ blur: 0, brightness: 150, contrast: 100 })).toBe(
      "brightness(1.5)"
    );
  });
});
