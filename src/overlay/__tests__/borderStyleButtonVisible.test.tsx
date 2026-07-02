// @vitest-environment happy-dom
/**
 * borderStyleButtonVisible.test.tsx — Border STYLE buttons must produce a
 * *visible* border (regression for the Tailwind-Preflight interaction).
 *
 * Reported bug: "the border buttons are not working as expected."
 *
 * Root cause (reproduced here):
 *   Tailwind Preflight sets `border-style: solid; border-width: 0` on every
 *   element. So the Borders panel's Style group shows "Solid" pre-active even
 *   though there is no visible border (width 0).
 *
 *   1. IconButtonGroup's single-select TOGGLE-DESELECT logic treats a click on
 *      the already-active value as "remove" -> clicking "Solid" to add a border
 *      instead applies `border-style: none`. The user's click does the opposite
 *      of intent.
 *   2. Even when a style IS applied (Dashed/Dotted), border-width stays 0, so
 *      nothing is visible.
 *
 * Expected: clicking a visible style (solid/dotted/dashed) yields a border that
 * actually renders — the style is set (never silently switched to "none") and
 * the width is given a visible default when it was 0. Clicking "None" (the X)
 * remains the explicit way to remove the border.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import { BordersSection } from "../sections/BordersSection";
import type { SectionCtx } from "../panelUtils";
import type { UnitConversionContext } from "../unitConversion";

// Enable React's act() environment so state updates flush deterministically.
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// ── Helpers ──────────────────────────────────────────────────────────

/**
 * An element in the Tailwind-Preflight default state: border-style is "solid"
 * but border-width is 0 (so no border is actually visible).
 */
function makePreflightCtx(overrides?: { borderWidth?: string }): SectionCtx {
  const element = document.createElement("div");
  element.style.borderStyle = "solid";
  element.style.borderWidth = overrides?.borderWidth ?? "0px";
  element.style.borderColor = "rgb(23, 23, 23)";
  document.body.appendChild(element);
  const cs = getComputedStyle(element);
  return {
    element,
    apply: vi.fn(),
    reset: vi.fn(),
    resetRead: () => 0,
    resetReadStr: () => "",
    ind: () => "none" as const,
    sectionInd: () => "none" as const,
    cs,
    parentCs: null,
    getConversionCtx: (): UnitConversionContext => ({
      computedFontSize: 16,
      rootFontSize: 16,
      parentWidth: 800,
      parentHeight: 600,
      viewportWidth: 1280,
      viewportHeight: 720,
    }),
    ctxMenu: () => vi.fn(),
    isTailwind: false,
  };
}

function setup() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  return { container, root };
}

function teardown(container: HTMLDivElement, root: Root) {
  act(() => { root.unmount(); });
  container.remove();
}

/** Click a border-style button by its accessible name (e.g. "solid"). */
function clickStyle(container: HTMLElement, name: string) {
  const group = container.querySelector('[aria-label="Border style"]') as HTMLElement;
  if (!group) throw new Error("Border style group not found");
  const btn = Array.from(group.querySelectorAll('[role="radio"]')).find(
    (b) => (b.getAttribute("aria-label") || "").toLowerCase() === name.toLowerCase(),
  ) as HTMLElement | undefined;
  if (!btn) throw new Error(`Style button "${name}" not found`);
  act(() => { btn.click(); });
}

type ApplyCall = [string, string];
function applyCalls(ctx: SectionCtx): ApplyCall[] {
  return (ctx.apply as ReturnType<typeof vi.fn>).mock.calls as ApplyCall[];
}
function lastValue(calls: ApplyCall[], prop: string): string | undefined {
  const hits = calls.filter(([p]) => p === prop);
  return hits.length ? hits[hits.length - 1][1] : undefined;
}

// ── Tests ─────────────────────────────────────────────────────────────

describe("Border style buttons produce a visible border (Preflight regression)", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => { ({ container, root } = setup()); });
  afterEach(() => { teardown(container, root); });

  it("clicking Solid does NOT remove the border and makes it visible", () => {
    const ctx = makePreflightCtx();
    act(() => { root.render(createElement(BordersSection, { ctx, forceOpen: true })); });

    clickStyle(container, "solid");
    const calls = applyCalls(ctx);

    // The toggle-deselect bug applied `border-style: none` — that must not happen.
    expect(calls.filter(([p, v]) => p === "border-style" && v === "none")).toHaveLength(0);
    // Resulting style is solid.
    expect(lastValue(calls, "border-style")).toBe("solid");
    // Width must be bumped to a visible value (was 0).
    const w = lastValue(calls, "border-width");
    expect(w, "expected border-width to be applied so the border is visible").toBeDefined();
    expect(parseFloat(String(w))).toBeGreaterThan(0);
  });

  it("clicking Dashed makes the border visible (width coupled from 0)", () => {
    const ctx = makePreflightCtx();
    act(() => { root.render(createElement(BordersSection, { ctx, forceOpen: true })); });

    clickStyle(container, "dashed");
    const calls = applyCalls(ctx);

    expect(lastValue(calls, "border-style")).toBe("dashed");
    const w = lastValue(calls, "border-width");
    expect(w, "expected border-width to be applied so the dashed border is visible").toBeDefined();
    expect(parseFloat(String(w))).toBeGreaterThan(0);
  });

  it("clicking a style when width is already > 0 leaves the width untouched", () => {
    const ctx = makePreflightCtx({ borderWidth: "5px" });
    act(() => { root.render(createElement(BordersSection, { ctx, forceOpen: true })); });

    clickStyle(container, "dotted");
    const calls = applyCalls(ctx);

    expect(lastValue(calls, "border-style")).toBe("dotted");
    // No auto-bump when there's already a visible width.
    expect(calls.filter(([p]) => p === "border-width")).toHaveLength(0);
  });

  it("clicking None (X) still removes the border", () => {
    const ctx = makePreflightCtx({ borderWidth: "3px" });
    act(() => { root.render(createElement(BordersSection, { ctx, forceOpen: true })); });

    clickStyle(container, "none");
    const calls = applyCalls(ctx);

    expect(lastValue(calls, "border-style")).toBe("none");
  });
});
