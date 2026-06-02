// @vitest-environment happy-dom
/**
 * spacingValuePopoverFlip.test.ts — the unit dropdown inside SpacingValuePopover
 * opened downward unconditionally and could spill past the popover/viewport
 * bottom. It now flips upward when opening below would overflow the viewport.
 * The decision is a pure function so it's testable (jsdom can't exercise the
 * real getBoundingClientRect geometry).
 */
import { describe, it, expect } from "vitest";
import { unitMenuOpensUpward } from "../sections/SpacingValuePopover";

describe("unitMenuOpensUpward", () => {
  it("opens downward when there's room below", () => {
    // button bottom at 100, menu 130 tall, viewport 800 → 230 < 800
    expect(unitMenuOpensUpward(100, 130, 800)).toBe(false);
  });

  it("opens upward when opening below would overflow the viewport bottom", () => {
    // button bottom at 720, menu 130 tall, viewport 800 → 850 > 800
    expect(unitMenuOpensUpward(720, 130, 800)).toBe(true);
  });

  it("opens downward exactly at the boundary (no overflow)", () => {
    expect(unitMenuOpensUpward(670, 130, 800)).toBe(false);
  });
});
