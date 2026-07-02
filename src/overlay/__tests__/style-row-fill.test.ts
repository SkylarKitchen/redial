// @vitest-environment happy-dom
/**
 * style-row-fill.test.ts — Verify the Typography "Style" row's Italicize
 * and Decoration sub-groups both use flex:1 so buttons fill the row
 * edge-to-edge, matching the Align row above it.
 *
 * Bug: The Italicize wrapper lacked flex:1, causing the buttons to shrink
 * to content width instead of filling the row — visually "indented" on
 * the left compared to other full-width button rows.
 *
 * CONVERTED (issue #105): was a source-text test (readFileSync + string
 * slicing around ">Italicize<" looking for "flex: 1" / "items-center").
 * Now renders the real TypographySection and asserts the rendered wrapper
 * styles. Invariant mapping:
 *  - "both wrappers have flex: 1"      → wrapper.style.flex === "1" on the
 *    rendered Italicize AND Decoration wrapper divs (equal fill).
 *  - "no items-center on the wrappers" → wrapper.style.alignItems is not
 *    "center" (default stretch, so the IconButtonGroup fills the width).
 */

import { describe, it, expect, afterEach } from "vitest";
import { createElement } from "react";
import { render, cleanup, screen } from "@testing-library/react";
import { TypographySection } from "../sections/TypographySection";
import { resetAll } from "../core/apply";
import type { SectionCtx } from "../panelUtils";
import type { UnitConversionContext } from "../unitConversion";

// happy-dom lacks document.fonts; TypographySection's mount effect reads
// document.fonts.ready. Stub it so client-side render doesn't throw.
if (!(document as unknown as { fonts?: unknown }).fonts) {
  (document as unknown as { fonts: unknown }).fonts = {
    ready: Promise.resolve(),
    forEach: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
  };
}

afterEach(() => {
  cleanup();
  resetAll();
  document.body.innerHTML = "";
});

function makeCtx(): SectionCtx {
  const element = document.createElement("div");
  document.body.appendChild(element);
  const cs = getComputedStyle(element);
  return {
    element,
    apply: () => {},
    reset: () => {},
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
    ctxMenu: () => () => {},
    isTailwind: false,
  };
}

function renderTypography() {
  return render(
    createElement(TypographySection, {
      ctx: makeCtx(),
      columnGap: 0,
      columnGapUnit: "px",
      onColumnGapChange: () => {},
      onColumnGapUnitChange: () => {},
      forceOpen: true,
    }),
  );
}

/** The sub-group wrapper div that owns a hint label ("Italicize"/"Decoration"). */
function wrapperOf(hintText: string): HTMLElement {
  const hint = screen.getByText(hintText);
  const wrapper = hint.parentElement as HTMLElement;
  expect(wrapper, `${hintText} wrapper should render`).toBeTruthy();
  return wrapper;
}

describe("Typography Style row fill", () => {
  it("both Italicize and Decoration wrappers render with flex: 1 (equal edge-to-edge fill)", () => {
    renderTypography();

    const italicize = wrapperOf("Italicize");
    const decoration = wrapperOf("Decoration");

    // happy-dom expands `flex: 1` to "1 1 0%" — flex-grow: 1 is the invariant
    expect(
      italicize.style.flexGrow,
      "Italicize wrapper should have flex: 1 for consistent fill",
    ).toBe("1");
    expect(
      decoration.style.flexGrow,
      "Decoration wrapper should have flex: 1 for consistent fill",
    ).toBe("1");
    expect(italicize.style.flex).toBe(decoration.style.flex);

    // Both wrappers share the same row (side by side under the Style label)
    expect(italicize.parentElement).toBe(decoration.parentElement);
  });

  it("Style row wrappers do not use align-items: center (would prevent stretch fill)", () => {
    renderTypography();

    for (const hint of ["Italicize", "Decoration"]) {
      const wrapper = wrapperOf(hint);
      expect(
        wrapper.style.alignItems,
        `${hint} wrapper must not center-align — default stretch lets the buttons fill the width`,
      ).not.toBe("center");
    }
  });
});
