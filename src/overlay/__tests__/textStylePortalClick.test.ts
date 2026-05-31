// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import { isInsideTunerUI } from "../util";

/**
 * Bug: Typography Style dropdown items cannot be clicked.
 *
 * Root cause: TextStyleRow renders its dropdown via a React portal to
 * document.body with `data-textstyle-portal`. The capture-phase page-click
 * handler in usePageInteractions treats any target NOT recognised as
 * redial-owned as a fresh page selection and stops the event — swallowing
 * the click before cmdk's onSelect can fire.
 *
 * Fix: the text-style portal must count as redial-owned UI so the page-click
 * handler ignores it. That ownership test lives in isInsideTunerUI(), and both
 * guard sites in usePageInteractions (target.closest + elementFromPoint) route
 * through it — so covering the predicate covers both checks.
 */
describe("TextStyleRow portal click-through", () => {
  it("treats elements inside a text-style portal as redial-owned UI", () => {
    const portal = document.createElement("div");
    portal.setAttribute("data-textstyle-portal", "");
    const item = document.createElement("div");
    portal.appendChild(item);
    document.body.appendChild(portal);

    expect(isInsideTunerUI(item)).toBe(true);
    expect(isInsideTunerUI(portal)).toBe(true);

    document.body.removeChild(portal);
  });

  it("also recognises the panel root and tuner/radix portals", () => {
    for (const sel of ["__tuner-root", "__tuner-selected-outline"]) {
      const el = document.createElement("div");
      el.className = sel;
      expect(isInsideTunerUI(el)).toBe(true);
    }
    for (const attr of ["data-tuner-portal", "data-radix-portal"]) {
      const el = document.createElement("div");
      el.setAttribute(attr, "");
      expect(isInsideTunerUI(el)).toBe(true);
    }
  });

  it("does not treat ordinary page elements as redial-owned", () => {
    const pageEl = document.createElement("button");
    document.body.appendChild(pageEl);
    expect(isInsideTunerUI(pageEl)).toBe(false);
    expect(isInsideTunerUI(null)).toBe(false);
    document.body.removeChild(pageEl);
  });
});
