/**
 * lineHeightMultiplier.test.ts — Pattern-C bug: `line-height: normal` shows 0.
 *
 * Sweep finding (adversarially verified): TypographySection derives the
 * line-height multiplier as parseNum(cs.lineHeight)/parseNum(cs.fontSize) at
 * three sites. getComputedStyle().lineHeight returns the literal string
 * "normal" for the (overwhelmingly common) default — NOT a px value — so
 * parseNum("normal") = 0 and the field shows 0 (implying collapsed lines) while
 * the browser actually renders ~1.2. The 1.4 fallback only fires when fs===0,
 * which never happens for a real element, so it is dead code.
 *
 * The fix extracts one shared helper that special-cases "normal" (and any
 * non-finite ratio) to the CSS-`normal` approximation instead of 0. These tests
 * pin that contract.
 */
import { describe, it, expect } from "vitest";
import { lineHeightToMultiplier } from "../cssParsers";

describe("lineHeightToMultiplier", () => {
  it("returns a sensible non-zero default for `normal` (the bug: it was 0)", () => {
    expect(lineHeightToMultiplier("normal", "16px")).toBe(1.2);
  });

  it("computes the real ratio for resolved px line-heights", () => {
    expect(lineHeightToMultiplier("24px", "16px")).toBe(1.5);
    expect(lineHeightToMultiplier("21px", "14px")).toBe(1.5);
    expect(lineHeightToMultiplier("32px", "16px")).toBe(2);
  });

  it("rounds to 2 decimals like the original derivation", () => {
    expect(lineHeightToMultiplier("26px", "16px")).toBe(1.63);
  });

  it("falls back to the `normal` default when font-size is unusable (no /0)", () => {
    expect(lineHeightToMultiplier("24px", "0px")).toBe(1.2);
    expect(lineHeightToMultiplier("normal", "0px")).toBe(1.2);
  });
});
