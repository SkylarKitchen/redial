// @vitest-environment happy-dom
/**
 * transition-phantom-dirty.test.ts
 *
 * Bug: The Effects section shows a blue "modified" dot even when the user
 * hasn't meaningfully changed the transition property.
 *
 * Root cause (two parts):
 *
 * 1. parseTransitions reads getComputedStyle().transitionProperty which
 *    returns "all" for every element (browser default). It creates a
 *    phantom entry { property: "all", duration: 0, ... } that appears
 *    in the UI even though no transition was explicitly set.
 *
 * 2. When the user removes that phantom entry, transitionsToCSS([])
 *    returns "none". apply("transition", "none") records initial="all"
 *    current="none". isDirty("transition") returns true because
 *    "all" !== "none", even though both mean "no visible transition".
 */

import { describe, it, expect, beforeEach } from "vitest";
import { parseTransitions, transitionsToCSS } from "../cssParsers";
import {
  applyInlineStyle,
  isDirty,
  resetAll,
} from "../apply";

function makeEl(): HTMLElement {
  const el = document.createElement("div");
  document.body.appendChild(el);
  return el;
}

beforeEach(() => {
  resetAll();
  document.body.innerHTML = "";
});

describe("Phantom transition dirty indicator", () => {
  it("parseTransitions returns [] for default browser transition (all 0s)", () => {
    const el = makeEl();
    const cs = getComputedStyle(el);
    // Browser default: transitionProperty="all", transitionDuration="0s"
    // This should NOT produce a transition entry since duration=0 means no transition
    const transitions = parseTransitions(cs);
    expect(
      transitions,
      "Default 'all 0s ease 0s' should be treated as no transitions",
    ).toEqual([]);
  });

  it("parseTransitions returns entries for real transitions (duration > 0)", () => {
    // happy-dom doesn't propagate transition to getComputedStyle, so mock it
    const mockCs = {
      transitionProperty: "opacity",
      transitionDuration: "0.3s",
      transitionTimingFunction: "ease",
      transitionDelay: "0s",
    } as unknown as CSSStyleDeclaration;
    const transitions = parseTransitions(mockCs);
    expect(transitions.length).toBeGreaterThan(0);
    expect(transitions[0].property).toBe("opacity");
    expect(transitions[0].duration).toBe(300);
  });

  it("isDirty returns false when transition goes from 'all' to 'none' (both mean no transition)", () => {
    const el = makeEl();
    // Simulate: initial="all" captured by getComputedStyle, then user sets "none"
    applyInlineStyle(el, "transition", "none");
    expect(
      isDirty(el, "transition"),
      "'all' → 'none' are semantically equivalent (no transition) and should not be dirty",
    ).toBe(false);
  });

  it("isDirty returns false for 'all 0s ease 0s' vs 'none'", () => {
    const el = makeEl();
    // Some browsers return the full shorthand
    el.style.transition = "all 0s ease 0s";
    applyInlineStyle(el, "transition", "none");
    expect(isDirty(el, "transition")).toBe(false);
  });
});
