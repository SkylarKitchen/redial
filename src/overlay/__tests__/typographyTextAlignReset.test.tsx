// @vitest-environment happy-dom
/**
 * typographyTextAlignReset.test.tsx — Behavioral test for text-align reset
 *
 * Issue #142: text-align IconButtonGroup in TypographySection has no onReset
 * wiring, so the alt+click reset handler (if (e.altKey && onReset)) fails
 * silently when the user tries to reset an overflowing text-align value.
 *
 * This test:
 * 1. Mounts TypographySection with real SectionCtx wired to apply engine
 * 2. Applies text-align to make it dirty via applyInlineStyle
 * 3. Renders with forceOpen and showTypoAdvanced=false (text-align is NOT in advanced)
 * 4. Finds the reset trigger (modified dot/label) for text-align
 * 5. Alt+clicks it
 * 6. Asserts isDirty(element, "text-align") is false
 *
 * EXPECTED TO FAIL initially: text-align IconButtonGroup has no onReset prop
 * and the Align label has no indicator prop, so the reset trigger doesn't exist.
 */

import { describe, it, expect, afterEach } from "vitest";
import { createElement } from "react";
import { render, cleanup, fireEvent } from "@testing-library/react";
import { TypographySection } from "../sections/TypographySection";
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

// happy-dom lacks document.fonts; TypographySection's mount effect reads
// document.fonts.ready. Stub it so client-side render doesn't throw.
if (!(document as unknown as { fonts?: unknown }).fonts) {
  (document as unknown as { fonts: unknown }).fonts = {
    ready: Promise.resolve(),
    forEach: () => {},
  };
}

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

describe("TypographySection text-align reset", () => {
  it("resetProp clears the dirty flag for text-align", () => {
    const el = document.createElement("div");
    el.style.textAlign = "left";
    document.body.appendChild(el);

    applyInlineStyle(el, "text-align", "center");
    expect(isDirty(el, "text-align")).toBe(true);

    resetProp(el, "text-align");
    expect(isDirty(el, "text-align")).toBe(false);
  });

  it("Alt+click on text-align reset trigger resets the property through the real engine", () => {
    const ctx = makeRealCtx();

    // Genuinely dirty text-align
    applyInlineStyle(ctx.element, "text-align", "center");
    expect(isDirty(ctx.element, "text-align")).toBe(true);

    const { container } = render(
      createElement(TypographySection, {
        ctx,
        columnGap: 0,
        columnGapUnit: "px",
        onColumnGapChange: () => {},
        onColumnGapUnitChange: () => {},
        forceOpen: true,
        focusOpen: false,
        onToggle: () => {},
      }),
    );

    // The modified text-align should show a reset trigger. In the current
    // implementation pattern (ColorRow, SizeInputCell), the label becomes a
    // focusable button with aria-label="Reset <label>" when modified.
    // For IconButtonGroup rows, we expect the same pattern: the "Align" label
    // should become a reset trigger when text-align is dirty.
    const resetTriggers = Array.from(
      container.querySelectorAll('[role="button"][aria-haspopup][aria-label^="Reset"]'),
    ) as HTMLElement[];

    const alignResetTrigger = resetTriggers.find((t) =>
      t.getAttribute("aria-label")?.includes("Align"),
    );

    expect(
      alignResetTrigger,
      'expected reset trigger for text-align (aria-label="Reset Align") but found none — the "Align" label needs indicator={ind("text-align")} and the IconButtonGroup needs onReset wiring',
    ).toBeDefined();

    // Alt+click the reset trigger — the shared contract resets directly
    if (alignResetTrigger) {
      fireEvent.click(alignResetTrigger, { altKey: true });
    }

    expect(
      isDirty(ctx.element, "text-align"),
      'text-align still dirty after Alt+click — the "Align" label or IconButtonGroup is missing working onReset wiring',
    ).toBe(false);
  });
});
