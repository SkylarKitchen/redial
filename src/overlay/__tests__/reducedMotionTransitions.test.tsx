// @vitest-environment happy-dom
/**
 * reducedMotionTransitions.test.tsx — prefers-reduced-motion must disable
 * every panel transition.
 *
 * timing.ts implements reduced motion by making ms()/cssTransition() emit
 * "0ms" durations (Overlay.tsx flips the module flag from the media query,
 * item 59). That contract only holds if every transition duration goes
 * through the tokens — a hardcoded "80ms" keeps animating for users who
 * asked for no motion.
 *
 * QA loop iteration 9 (animation-smoothness spot-check) found three
 * hardcoded-duration sites, all press/hover scale micro-interactions:
 * PresetChips chips, VariableLinkDot's dot, and the Footer clipboard
 * dropdown's items. These tests mount each with reduced motion active and
 * assert no rendered element carries a non-zero transition duration.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { setReducedMotion } from "../timing";
import { PresetChips } from "../controls/helpers";
import { VariableLinkDot } from "../controls/VariableLinkDot";
import { Footer } from "../shell/Footer";
import { applyInlineStyle, resetAll } from "../core/apply";

/**
 * Every element under document.body whose inline transition still declares a
 * non-zero duration. Durations inside cubic-bezier() don't match — the regex
 * requires an ms/s unit suffix.
 */
function timedTransitions(): string[] {
  const offenders: string[] = [];
  for (const el of document.body.querySelectorAll<HTMLElement>("*")) {
    const t = el.style?.transition;
    if (!t) continue;
    const durations = t.match(/(\d*\.?\d+)(ms|s)\b/g) ?? [];
    if (durations.some((d) => parseFloat(d) > 0)) {
      offenders.push(`<${el.tagName.toLowerCase()}> transition: ${t}`);
    }
  }
  return offenders;
}

beforeEach(() => {
  document.body.innerHTML = "";
  setReducedMotion(true);
});

afterEach(() => {
  setReducedMotion(false);
  cleanup();
  resetAll();
});

describe("reduced motion disables all transitions", () => {
  it("sanity: with reduced motion OFF, the sweep does detect timed transitions", () => {
    setReducedMotion(false);
    render(<PresetChips property="gap" onSelect={() => {}} />);
    expect(
      timedTransitions().length,
      "the offender sweep must be able to see normal-mode durations at all"
    ).toBeGreaterThan(0);
  });

  it("PresetChips renders no timed transition under reduced motion", () => {
    render(<PresetChips property="gap" onSelect={() => {}} />);
    expect(screen.getAllByRole("button").length).toBeGreaterThan(0);
    expect(timedTransitions(), "press-scale must be 0ms under reduced motion").toEqual([]);
  });

  it("VariableLinkDot renders no timed transition under reduced motion", () => {
    render(<VariableLinkDot rowHovered={true} onSelect={() => {}} />);
    expect(screen.getByRole("button")).toBeTruthy();
    expect(timedTransitions(), "hover-scale must be 0ms under reduced motion").toEqual([]);
  });

  it("Footer clipboard dropdown items render no timed transition under reduced motion", () => {
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      configurable: true,
    });
    const el = document.createElement("div");
    document.body.appendChild(el);
    applyInlineStyle(el, "color", "red"); // enable the copy items
    render(<Footer element={el} onReset={() => {}} />);
    fireEvent.click(screen.getByTitle("Copy CSS (⌘C)"));
    expect(screen.getAllByRole("menuitem").length).toBeGreaterThanOrEqual(4);
    expect(timedTransitions(), "menu-item press-scale must be 0ms under reduced motion").toEqual([]);
  });
});
