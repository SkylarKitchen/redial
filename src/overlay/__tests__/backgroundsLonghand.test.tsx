// @vitest-environment happy-dom
/**
 * backgroundsLonghand.test.tsx — Issue #75: the Backgrounds section must write
 * background LONGHANDS, never the `background` shorthand.
 *
 * Reproduces the three compounding bugs:
 *  1. Shorthand clobber — adding a gradient layer wipes an authored
 *     background-color (the shorthand resets every background longhand).
 *  2. Existing backgrounds invisible — authored background-image layers never
 *     appear in the layer list and are overwritten by the first layer edit.
 *  3. Dead control — the per-layer opacity slider changes nothing.
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import { render, fireEvent, cleanup } from "@testing-library/react";
import { BackgroundsSection } from "../sections/BackgroundsSection";
import type { SectionCtx } from "../panelUtils";
import type { UnitConversionContext } from "../unitConversion";

afterEach(() => cleanup());

// ─── Helpers ──────────────────────────────────────────────────────────

function makeCtx(setup?: (el: HTMLElement) => void) {
  const element = document.createElement("div");
  setup?.(element);
  document.body.appendChild(element);
  const cs = getComputedStyle(element);
  const calls: Array<{ prop: string; value: string }> = [];
  // Realistic apply: writes through to the element's inline style, so
  // shorthand-vs-longhand interactions behave like the real engine.
  const apply = vi.fn((prop: string, value: string) => {
    calls.push({ prop, value });
    if (value === "") element.style.removeProperty(prop);
    else element.style.setProperty(prop, value);
  });
  const ctx: SectionCtx = {
    element,
    apply,
    reset: vi.fn((prop: string) => element.style.removeProperty(prop)),
    resetRead: vi.fn(() => 0),
    resetReadStr: vi.fn(() => ""),
    ind: () => "none",
    sectionInd: () => "none",
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
    ctxMenu: () => () => {},
    isTailwind: false,
  };
  return { element, ctx, calls };
}

/** Click the "+" add-layer button in the "Image & gradient" sub-header. */
function clickAddLayer(container: HTMLElement) {
  const label = Array.from(container.querySelectorAll("span")).find(
    (s) => s.textContent === "Image & gradient",
  );
  expect(label).toBeTruthy();
  const row = label!.closest("div")!;
  const btn = row.querySelector("button");
  expect(btn).toBeTruthy();
  fireEvent.click(btn!);
}

/** Last value the section applied for the element's background image. */
function lastBgWrite(calls: Array<{ prop: string; value: string }>) {
  return calls
    .filter((c) => c.prop === "background" || c.prop === "background-image")
    .pop()?.value;
}

/** Spans whose exact text is `text` (layer row labels). */
function layerLabels(container: HTMLElement, text: string) {
  return Array.from(container.querySelectorAll("span")).filter(
    (s) => s.textContent === text,
  );
}

// ─── 1. Shorthand clobbers background-color ──────────────────────────

describe("Issue #75 — shorthand clobbers background-color", () => {
  it("keeps an authored background-color when a gradient layer is added", () => {
    const { element, ctx } = makeCtx((el) =>
      el.style.setProperty("background-color", "rgb(255, 0, 0)"),
    );
    const { container } = render(<BackgroundsSection ctx={ctx} forceOpen />);
    clickAddLayer(container);
    expect(element.style.getPropertyValue("background-color")).toBe(
      "rgb(255, 0, 0)",
    );
  });

  it("writes the background-image longhand, never the background shorthand", () => {
    const { ctx, calls } = makeCtx();
    const { container } = render(<BackgroundsSection ctx={ctx} forceOpen />);
    clickAddLayer(container);
    expect(calls.some((c) => c.prop === "background")).toBe(false);
    const img = calls.filter((c) => c.prop === "background-image").pop();
    expect(img?.value).toContain("linear-gradient");
  });

  it("clears layers via background-image none, not background none", () => {
    const { element, ctx, calls } = makeCtx((el) =>
      el.style.setProperty("background-color", "rgb(0, 128, 0)"),
    );
    const { container } = render(<BackgroundsSection ctx={ctx} forceOpen />);
    clickAddLayer(container);
    // Delete the layer we just added (X button in its row)
    const del = Array.from(container.querySelectorAll("button")).find((b) =>
      b.querySelector("svg.lucide-x"),
    );
    expect(del).toBeTruthy();
    fireEvent.click(del!);
    expect(calls.some((c) => c.prop === "background")).toBe(false);
    expect(element.style.getPropertyValue("background-color")).toBe(
      "rgb(0, 128, 0)",
    );
  });
});

// ─── 2. Authored background layers are seeded into the list ──────────

describe("Issue #75 — authored background layers are seeded", () => {
  it("shows an authored gradient as a layer row", () => {
    const { ctx } = makeCtx((el) => {
      el.style.backgroundImage =
        "linear-gradient(90deg, rgb(255, 0, 0) 0%, rgb(0, 0, 255) 100%)";
    });
    const { container } = render(<BackgroundsSection ctx={ctx} forceOpen />);
    expect(layerLabels(container, "Gradient").length).toBe(1);
  });

  it("shows an authored url() image as a layer row", () => {
    const { ctx } = makeCtx((el) => {
      el.style.backgroundImage = 'url("/hero.jpg")';
    });
    const { container } = render(<BackgroundsSection ctx={ctx} forceOpen />);
    expect(layerLabels(container, "Image").length).toBe(1);
  });

  it("keeps the authored gradient when a new layer is added", () => {
    const { element, ctx } = makeCtx((el) => {
      el.style.backgroundImage =
        "linear-gradient(90deg, rgb(255, 0, 0) 0%, rgb(0, 0, 255) 100%)";
    });
    const { container } = render(<BackgroundsSection ctx={ctx} forceOpen />);
    clickAddLayer(container);
    const bg = element.style.getPropertyValue("background-image");
    expect((bg.match(/linear-gradient\(/g) ?? []).length).toBe(2);
    expect(bg).toContain("rgb(255, 0, 0) 0%");
  });
});

// ─── 3. Opacity slider is inert ───────────────────────────────────────

describe("Issue #75 — layer opacity slider", () => {
  it("changes the applied background value when moved", () => {
    const { ctx, calls } = makeCtx();
    const { container } = render(<BackgroundsSection ctx={ctx} forceOpen />);
    clickAddLayer(container);
    const before = lastBgWrite(calls);
    expect(before).toBeTruthy();
    const slider = container.querySelector(
      'input[type="range"][max="1"]',
    ) as HTMLInputElement;
    expect(slider).toBeTruthy();
    fireEvent.change(slider, { target: { value: "0.5" } });
    const after = lastBgWrite(calls);
    expect(after).not.toBe(before);
    expect(after).toContain("0.5");
  });
});
