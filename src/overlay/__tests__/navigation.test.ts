/**
 * Tests for panel navigation history and overflow prevention.
 *
 * Bug 1: Clicking a breadcrumb ancestor then clicking close should
 *         go back to the previously selected element, not close entirely.
 *
 * Bug 2: Panel maxHeight should account for its vertical position
 *         so it never extends below the viewport.
 */
import { describe, it, expect } from "vitest";
import { NavigationHistory, computePanelMaxHeight } from "../core/navigationHistory";

// ── Bug 1: Breadcrumb "back" navigation ────────────────────────────

describe("NavigationHistory", () => {
  it("starts with no history", () => {
    const nav = new NavigationHistory();
    expect(nav.canGoBack()).toBe(false);
    expect(nav.goBack()).toBeNull();
  });

  it("push records the element and allows going back", () => {
    const nav = new NavigationHistory();
    const elA = {} as Element; // mock
    const elB = {} as Element;

    nav.push(elA);
    expect(nav.canGoBack()).toBe(true);

    nav.push(elB);
    expect(nav.canGoBack()).toBe(true);

    // going back should return elB (most recent push), then elA
    expect(nav.goBack()).toBe(elB);
    expect(nav.goBack()).toBe(elA);
    expect(nav.canGoBack()).toBe(false);
  });

  it("clear empties the history", () => {
    const nav = new NavigationHistory();
    nav.push({} as Element);
    nav.push({} as Element);
    nav.clear();
    expect(nav.canGoBack()).toBe(false);
  });

  it("does not push duplicate consecutive elements", () => {
    const nav = new NavigationHistory();
    const el = {} as Element;
    nav.push(el);
    nav.push(el); // same element, should not double-push
    expect(nav.goBack()).toBe(el);
    expect(nav.goBack()).toBeNull(); // only one entry
  });
});

// ── Bug 2: Panel max height calculation ────────────────────────────

describe("computePanelMaxHeight", () => {
  it("limits panel to viewport minus position and margin", () => {
    // viewport 1080px, panel at y=16, margin=16
    const max = computePanelMaxHeight(16, 1080);
    expect(max).toBe(1080 - 16 - 16); // 1048
  });

  it("never exceeds viewport height", () => {
    const max = computePanelMaxHeight(0, 800);
    expect(max).toBeLessThanOrEqual(800);
  });

  it("shrinks when panel is positioned lower", () => {
    const atTop = computePanelMaxHeight(16, 1080);
    const atMiddle = computePanelMaxHeight(400, 1080);
    expect(atMiddle).toBeLessThan(atTop);
  });

  it("enforces a reasonable minimum", () => {
    // Even if positioned very low, should still allow some height
    const max = computePanelMaxHeight(1000, 1080);
    expect(max).toBeGreaterThanOrEqual(200);
  });
});
