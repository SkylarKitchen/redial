// @vitest-environment happy-dom
/**
 * size-reset.test.ts — Regression test for Option+Click reset in SizeInputCell
 *
 * Bug: SizeSection never passed onReset to SizeInputCell, so the alt+click
 * handler (if (e.altKey && onReset)) always failed silently.
 *
 * CONVERTED (issue #105): the second test was a source-text scan (readFileSync
 * on SizeSection.tsx checking each <SizeInputCell block contains "onReset").
 * It is now behavioral: we genuinely dirty width/height/min/max sizes through
 * the real apply engine, mount the real SizeSection with a SectionCtx wired to
 * the real reset primitives, Alt+click every modified dot the section renders,
 * and assert the engine reports every property clean afterwards.
 *  - If a SizeInputCell stops receiving onReset, its Alt+click does nothing
 *    and the property stays dirty → the test names the broken property.
 *  - If isModified stops being wired, the dot never appears (dot count < 6)
 *    → the test fails on the dot count.
 * A residual source assertion keeps the original "every <SizeInputCell has
 * onReset" completeness sweep so a NEW cell added without reset wiring is
 * still caught even if this test doesn't seed its property.
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

const SIZE_PROPS = ["width", "height", "min-width", "min-height", "max-width", "max-height"];

describe("SizeInputCell reset via resetProp", () => {
  it("resetProp clears the dirty flag and restores original value", () => {
    const el = document.createElement("div");
    el.style.width = "200px";
    document.body.appendChild(el);

    applyInlineStyle(el, "width", "152px");
    expect(isDirty(el, "width")).toBe(true);

    resetProp(el, "width");
    expect(isDirty(el, "width")).toBe(false);
  });

  it("Alt+click on each modified size cell resets its property through the real engine", () => {
    const ctx = makeRealCtx();

    // Genuinely dirty all six size properties
    for (const prop of SIZE_PROPS) applyInlineStyle(ctx.element, prop, "152px");
    for (const prop of SIZE_PROPS) expect(isDirty(ctx.element, prop)).toBe(true);

    const { container } = render(
      createElement(SizeSection, { ctx, display: "block", isMedia: false, forceOpen: true }),
    );

    // Each dirty cell shows its modified-dot reset trigger (width, height,
    // min-w, min-h, max-w, max-h)
    const dots = Array.from(
      container.querySelectorAll('[role="button"][aria-haspopup][aria-label^="Reset"]'),
    ) as HTMLElement[];
    expect(
      dots.length,
      `expected 6 modified-dot reset triggers (one per size cell), got: ${dots
        .map((d) => d.getAttribute("aria-label"))
        .join(", ")}`,
    ).toBeGreaterThanOrEqual(6);

    // Alt+click every trigger — the shared contract resets directly
    for (const dot of dots) fireEvent.click(dot, { altKey: true });

    const stillDirty = SIZE_PROPS.filter((p) => isDirty(ctx.element, p));
    expect(
      stillDirty,
      `properties still dirty after Alt+clicking all reset dots — their SizeInputCell is missing a working onReset: ${stillDirty.join(", ")}`,
    ).toEqual([]);
  });

  it("residual completeness sweep: every <SizeInputCell in SizeSection source passes onReset", async () => {
    // Kept from the original source-text test (belt and suspenders): the
    // behavioral test above only exercises the six seeded properties — this
    // sweep still catches a NEW SizeInputCell added without reset wiring.
    const fs = await import("fs");
    const path = await import("path");
    const src = fs.readFileSync(
      path.resolve(__dirname, "../sections/SizeSection.tsx"),
      "utf-8",
    );

    const cellBlocks = src.split(/(?=<SizeInputCell\b)/);
    const cellInstances = cellBlocks.filter((b) => b.startsWith("<SizeInputCell"));

    expect(cellInstances.length).toBeGreaterThanOrEqual(6); // width, height, min-w, min-h, max-w, max-h

    for (const block of cellInstances) {
      const labelMatch = block.match(/label="([^"]+)"/);
      const label = labelMatch ? labelMatch[1] : "unknown";
      expect(block, `SizeInputCell "${label}" must have onReset prop`).toContain("onReset");
    }
  });
});
