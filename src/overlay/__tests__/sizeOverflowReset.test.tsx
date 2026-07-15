// @vitest-environment happy-dom
/**
 * sizeOverflowReset.test.tsx — Behavioral test for overflow reset in SizeSection
 *
 * Issue #142: Overflow controls (overflow, overflow-x, overflow-y) have no onReset
 * wired, so Alt+click on their modified indicators does nothing.
 *
 * This test verifies the full reset contract in BOTH locked and unlocked modes:
 *
 * 1. Locked mode: When overflowLocked=true, only the unified "overflow" control
 *    is visible. Alt+clicking its reset trigger must reset all three properties
 *    (overflow, overflow-x, overflow-y) coherently.
 *
 * 2. Unlocked mode: When overflowLocked=false, overflow-x and overflow-y controls
 *    are visible separately. Alt+clicking their individual reset triggers must
 *    reset each axis independently.
 *
 * The test mounts SizeSection with a real SectionCtx wired to the apply engine,
 * genuinely dirties overflow properties, renders with forceOpen=true, finds the
 * reset triggers (role="button" with aria-label starting with "Reset"), Alt+clicks
 * them, and asserts all three properties are clean.
 *
 * Expected to FAIL initially since overflow controls have no reset wiring yet.
 */

import { describe, it, expect, afterEach } from "vitest";
import { createElement } from "react";
import { render, cleanup, fireEvent } from "@testing-library/react";
import { SizeSection } from "../sections/SizeSection";
import {
  applyInlineStyle,
  isDirty,
  resetProp,
  resetAll,
  resetAndReadNum,
  resetAndReadStr,
} from "../core/apply";
import type { SectionCtx } from "../panelUtils";
import type { UnitConversionContext } from "../unitConversion";

afterEach(() => {
  cleanup();
  resetAll();
  document.body.innerHTML = "";
});

/** SectionCtx wired to the REAL apply engine (indicators come from isDirty). */
function makeRealCtx(): SectionCtx {
  const element = document.createElement("div");
  document.body.appendChild(element);
  const cs = getComputedStyle(element);
  return {
    element,
    apply: (p: string, v: string) => applyInlineStyle(element, p, v),
    reset: (p: string) => resetProp(element, p),
    resetRead: (p: string) => resetAndReadNum(element, p),
    resetReadStr: (p: string) => resetAndReadStr(element, p),
    ind: (p: string) => (isDirty(element, p) ? ("modified" as const) : ("none" as const)),
    sectionInd: (props: string[]) =>
      props.some((p) => isDirty(element, p)) ? ("modified" as const) : ("none" as const),
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
}

const OVERFLOW_PROPS = ["overflow", "overflow-x", "overflow-y"];

describe("SizeSection overflow reset", () => {
  it("resetProp clears the dirty flag for overflow properties", () => {
    const el = document.createElement("div");
    document.body.appendChild(el);

    // Dirty each overflow property
    applyInlineStyle(el, "overflow", "hidden");
    expect(isDirty(el, "overflow")).toBe(true);

    applyInlineStyle(el, "overflow-x", "scroll");
    expect(isDirty(el, "overflow-x")).toBe(true);

    applyInlineStyle(el, "overflow-y", "auto");
    expect(isDirty(el, "overflow-y")).toBe(true);

    // Reset them
    resetProp(el, "overflow");
    expect(isDirty(el, "overflow")).toBe(false);

    resetProp(el, "overflow-x");
    expect(isDirty(el, "overflow-x")).toBe(false);

    resetProp(el, "overflow-y");
    expect(isDirty(el, "overflow-y")).toBe(false);
  });

  it("Alt+click on overflow reset triggers resets all three properties (locked mode)", () => {
    const ctx = makeRealCtx();

    // Dirty all three overflow properties
    applyInlineStyle(ctx.element, "overflow", "hidden");
    applyInlineStyle(ctx.element, "overflow-x", "hidden");
    applyInlineStyle(ctx.element, "overflow-y", "hidden");

    for (const prop of OVERFLOW_PROPS) {
      expect(isDirty(ctx.element, prop), `${prop} should start dirty`).toBe(true);
    }

    const { container } = render(
      createElement(SizeSection, {
        ctx,
        display: "block",
        isMedia: false,
        forceOpen: true
      }),
    );

    // In locked mode, we expect ONE reset trigger for the unified overflow control.
    // The trigger should reset all three properties (overflow, overflow-x, overflow-y).
    const dots = Array.from(
      container.querySelectorAll('[role="button"][aria-haspopup][aria-label*="Overflow"]'),
    ) as HTMLElement[];

    expect(
      dots.length,
      `expected at least 1 overflow reset trigger in locked mode, got: ${dots
        .map((d) => d.getAttribute("aria-label"))
        .join(", ")}`,
    ).toBeGreaterThanOrEqual(1);

    // Alt+click the overflow reset trigger
    for (const dot of dots) {
      const label = dot.getAttribute("aria-label");
      if (label?.toLowerCase().includes("overflow")) {
        fireEvent.click(dot, { altKey: true });
      }
    }

    // All three properties should be clean now
    const stillDirty = OVERFLOW_PROPS.filter((p) => isDirty(ctx.element, p));
    expect(
      stillDirty,
      `properties still dirty after Alt+clicking overflow reset (locked mode): ${stillDirty.join(", ")}`,
    ).toEqual([]);
  });

  it("Alt+click on overflow-x and overflow-y reset triggers resets each axis independently (unlocked mode)", () => {
    const ctx = makeRealCtx();

    // Set overflow-x and overflow-y to different values to force unlocked mode
    applyInlineStyle(ctx.element, "overflow-x", "scroll");
    applyInlineStyle(ctx.element, "overflow-y", "hidden");

    expect(isDirty(ctx.element, "overflow-x"), "overflow-x should start dirty").toBe(true);
    expect(isDirty(ctx.element, "overflow-y"), "overflow-y should start dirty").toBe(true);

    const { container } = render(
      createElement(SizeSection, {
        ctx,
        display: "block",
        isMedia: false,
        forceOpen: true
      }),
    );

    // In unlocked mode, we expect TWO reset triggers: one for overflow-x, one for overflow-y.
    const dots = Array.from(
      container.querySelectorAll('[role="button"][aria-haspopup][aria-label*="Overflow"]'),
    ) as HTMLElement[];

    expect(
      dots.length,
      `expected at least 2 overflow reset triggers in unlocked mode (overflow-x, overflow-y), got: ${dots
        .map((d) => d.getAttribute("aria-label"))
        .join(", ")}`,
    ).toBeGreaterThanOrEqual(2);

    // Alt+click all overflow reset triggers
    for (const dot of dots) {
      fireEvent.click(dot, { altKey: true });
    }

    // Both overflow-x and overflow-y should be clean now
    const stillDirty = ["overflow-x", "overflow-y"].filter((p) => isDirty(ctx.element, p));
    expect(
      stillDirty,
      `properties still dirty after Alt+clicking overflow reset triggers (unlocked mode): ${stillDirty.join(", ")}`,
    ).toEqual([]);
  });

  it("residual completeness sweep: SizeSection overflow controls must support reset", async () => {
    // Belt-and-suspenders: verify that the SizeSection source includes reset
    // wiring for overflow controls. The behavioral tests above only exercise
    // the reset when properties are dirty — this sweep catches if reset
    // handling is completely absent from the overflow control rows.
    const fs = await import("fs");
    const path = await import("path");
    const src = fs.readFileSync(
      path.resolve(__dirname, "../sections/SizeSection.tsx"),
      "utf-8",
    );

    // Look for overflow control rows and verify they have reset-related props or wiring.
    // This is a loose check since overflow uses WebflowSegmentedControl, not SizeInputCell.
    // We're looking for evidence of reset capability near overflow controls.
    const hasOverflowControls = src.includes("Overflow") || src.includes("overflow");
    expect(hasOverflowControls, "SizeSection should have overflow controls").toBe(true);

    // Look for reset-related patterns near overflow (onReset, resetProp, etc.)
    // This will fail initially since overflow controls don't have reset wired yet.
    const overflowSectionMatch = src.match(/overflowLocked[\s\S]{0,2000}(?:onReset|resetProp|reset\()/);
    expect(
      overflowSectionMatch,
      "Overflow controls should have reset wiring (onReset callback or resetProp call)",
    ).not.toBeNull();
  });
});
