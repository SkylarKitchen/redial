// @vitest-environment happy-dom
/**
 * typographyApplyParity.test.tsx — panel-state vs element parity bugs.
 *
 * Issue #81: changing the line-height UNIT converted the displayed number but
 * never applied it to the element — and switching away from unitless ("—")
 * skipped conversion entirely, so the next scrub applied the raw multiplier
 * in the new unit (1.5 → "1.5px"). These tests drive the Height cell's
 * UnitSelector through the real UI and assert the element actually receives
 * the converted value via the apply layer.
 *
 * Issue #78: decoration edits are applied under one property key while the
 * section indicator tracks another ("text-decoration-line" vs
 * "text-decoration"), so the Typography modified-dot never lights. The parity
 * test toggles a decoration and asserts the tracked key matches the applied
 * key, without hardcoding which spelling wins.
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import { createElement } from "react";
import { render, cleanup, act } from "@testing-library/react";
import { TypographySection } from "../sections/TypographySection";
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

// ── Harness ──────────────────────────────────────────────────────────

/**
 * Build a SectionCtx whose `apply` writes through to the element's inline
 * style (a stand-in for the apply-layer override) and whose computed style
 * reports browser-resolved values (happy-dom echoes authored values back —
 * e.g. `line-height: 1.5` stays "1.5" — where a real browser resolves to px).
 */
function makeCtx(
  element: HTMLElement,
  computedOverrides: Record<string, string> = {},
): SectionCtx {
  document.body.appendChild(element);
  const realCs = getComputedStyle(element);
  const cs = new Proxy(realCs, {
    get(target, prop) {
      if (typeof prop === "string" && prop in computedOverrides) {
        return computedOverrides[prop];
      }
      const v = Reflect.get(target, prop);
      return typeof v === "function" ? v.bind(target) : v;
    },
  }) as CSSStyleDeclaration;

  return {
    element,
    apply: vi.fn((prop: string, value: string) => {
      element.style.setProperty(prop, value);
    }),
    reset: vi.fn(),
    resetRead: vi.fn(() => 0),
    resetReadStr: vi.fn(() => ""),
    ind: () => "none" as const,
    sectionInd: vi.fn(() => "none" as const),
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

function renderTypography(ctx: SectionCtx) {
  return render(
    createElement(TypographySection, {
      ctx,
      columnGap: 0,
      columnGapUnit: "px",
      onColumnGapChange: vi.fn(),
      onColumnGapUnitChange: vi.fn(),
      forceOpen: true,
    }),
  );
}

/** Find the unit-selector trigger (combobox pill) currently showing `unit`. */
function unitTrigger(container: HTMLElement, unit: string): HTMLElement {
  const triggers = Array.from(
    container.querySelectorAll('[role="combobox"]'),
  ).filter((b) => (b.textContent || "").trim() === unit) as HTMLElement[];
  if (triggers.length !== 1) {
    throw new Error(
      `Expected exactly 1 unit trigger showing "${unit}", found ${triggers.length}`,
    );
  }
  return triggers[0];
}

/** Open a unit trigger and click the option with the given label. */
function selectUnit(trigger: HTMLElement, optionLabel: string) {
  act(() => {
    trigger.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  const portal = document.body.querySelector("[data-unit-selector-portal]");
  if (!portal) throw new Error("Unit selector dropdown did not open");
  const option = Array.from(portal.querySelectorAll('[role="option"]')).find(
    (o) => (o.textContent || "").trim() === optionLabel,
  ) as HTMLElement | undefined;
  if (!option) throw new Error(`Unit option "${optionLabel}" not found`);
  act(() => {
    option.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

/**
 * Element authored with unitless line-height 1.5 at 16px font-size.
 * Font-size is authored in em so the Size cell's trigger never collides
 * with the Height cell's when both would otherwise read "px".
 * Computed overrides mirror what a real browser resolves.
 */
function makeUnitlessLineHeightCtx(): SectionCtx {
  const el = document.createElement("div");
  el.style.fontSize = "1em";
  el.style.lineHeight = "1.5";
  el.textContent = "Hello world";
  return makeCtx(el, { fontSize: "16px", lineHeight: "24px" });
}

afterEach(() => {
  cleanup();
  document.body
    .querySelectorAll("[data-tuner-portal]")
    .forEach((n) => n.remove());
  document.body.querySelectorAll("div").forEach((n) => {
    if (n.textContent === "Hello world") n.remove();
  });
});

// ── Issue #81 — line-height unit change must apply to the element ────

describe("typography line-height unit change applies to the element (#81)", () => {
  it("unitless → px converts (1.5 × 16px font) and applies 24px to the element", () => {
    const ctx = makeUnitlessLineHeightCtx();
    const { container } = renderTypography(ctx);

    // The Height cell displays unitless as an en dash.
    selectUnit(unitTrigger(container, "–"), "px");

    expect(ctx.apply).toHaveBeenCalledWith("line-height", "24px");
    expect(
      (ctx.element as HTMLElement).style.getPropertyValue("line-height"),
    ).toBe("24px");
  });

  it("unitless → % converts to 150% (of font-size) and applies it", () => {
    const ctx = makeUnitlessLineHeightCtx();
    const { container } = renderTypography(ctx);

    selectUnit(unitTrigger(container, "–"), "%");

    expect(ctx.apply).toHaveBeenCalledWith("line-height", "150%");
    expect(
      (ctx.element as HTMLElement).style.getPropertyValue("line-height"),
    ).toBe("150%");
  });

  it("round-trips px back to unitless: 24px → 1.5 applied without a unit", () => {
    const ctx = makeUnitlessLineHeightCtx();
    const { container } = renderTypography(ctx);

    selectUnit(unitTrigger(container, "–"), "px"); // 1.5 → 24px
    selectUnit(unitTrigger(container, "px"), "—"); // 24px → 1.5

    expect(ctx.apply).toHaveBeenLastCalledWith("line-height", "1.5");
    expect(
      (ctx.element as HTMLElement).style.getPropertyValue("line-height"),
    ).toBe("1.5");
  });

  it("panel display and element value agree after a unit change (no silent drift)", () => {
    const ctx = makeUnitlessLineHeightCtx();
    const { container } = renderTypography(ctx);

    selectUnit(unitTrigger(container, "–"), "em");

    // The Height cell now shows the converted number (1.5em) — the element
    // must hold the same value, not the stale unitless 1.5.
    expect(
      (ctx.element as HTMLElement).style.getPropertyValue("line-height"),
    ).toBe("1.5em");
  });
});

// ── Issue #78 — decoration tracked key must match the applied key ────

describe("typography text-decoration tracked key matches applied key (#78)", () => {
  it("toggling underline applies a property that the section indicator tracks", () => {
    const el = document.createElement("div");
    el.style.fontSize = "16px";
    el.textContent = "Hello world";
    const ctx = makeCtx(el);
    const { container } = renderTypography(ctx);

    const underline = Array.from(
      container.querySelectorAll("[aria-pressed]"),
    ).find(
      (b) => (b.getAttribute("aria-label") || "") === "Underline",
    ) as HTMLElement | undefined;
    expect(underline, "Underline toggle not found").toBeTruthy();

    act(() => {
      underline!.click();
    });

    const applyMock = ctx.apply as ReturnType<typeof vi.fn>;
    const decorationCall = applyMock.mock.calls.find(([, v]) =>
      String(v).includes("underline"),
    );
    expect(decorationCall, "toggling underline must apply a style").toBeTruthy();
    const appliedProp = decorationCall![0] as string;

    const sectionIndMock = ctx.sectionInd as ReturnType<typeof vi.fn>;
    expect(sectionIndMock).toHaveBeenCalled();
    const trackedProps = sectionIndMock.mock.calls.at(-1)![0] as string[];

    expect(
      trackedProps,
      `applied "${appliedProp}" but the section indicator only tracks [${trackedProps.join(", ")}]`,
    ).toContain(appliedProp);
  });
});
