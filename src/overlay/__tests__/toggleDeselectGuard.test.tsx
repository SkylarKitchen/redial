// @vitest-environment happy-dom
/**
 * toggleDeselectGuard.test.tsx — class-wide guard for the
 * "toggle-deselect on an inherited default" bug.
 *
 * THE BUG CLASS (see resolved-bugs memory + BordersSection border-style fix):
 *   A single-select IconButtonGroup uses toggle-deselect — clicking the
 *   already-active option emits onChange("none"). When the control's value is
 *   derived from getComputedStyle, a property whose inherited/computed default
 *   (UA stylesheet, Tailwind Preflight, or an internal normal->stretch remap)
 *   is one of the options renders that option PRE-ACTIVE on a pristine element.
 *   The user's click to apply it instead deselects to "none" — and for
 *   properties where "none" is INVALID CSS (box-sizing, justify-content,
 *   align-content, text-align) that writes garbage to the saved source.
 *
 * THE GUARD: render each at-risk section on a pristine element, find the
 * pre-active toggle button, click it, and assert the control never applies
 * `<prop>: none`. Clicking the visibly-active option must re-affirm it, not
 * destroy it. This is the durable "check all the buttons" net — add a CASE
 * row when a new single-select toggle ships.
 *
 * Controls intentionally NOT covered (verified safe): text-transform, float,
 * clear, outline-style (their "none" is a valid value AND an intended option);
 * font-style / direction (handlers map "none" -> a safe default).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Mock } from "vitest";
import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import { SizeSection } from "../sections/SizeSection";
import { LayoutSection } from "../sections/LayoutSection";
import { TypographySection } from "../sections/TypographySection";
import type { SectionCtx } from "../panelUtils";
import type { UnitConversionContext } from "../unitConversion";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

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

// ── Helpers ──────────────────────────────────────────────────────────

function makeCtx(element: HTMLElement): SectionCtx {
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
      computedFontSize: 16, rootFontSize: 16, parentWidth: 800,
      parentHeight: 600, viewportWidth: 1280, viewportHeight: 720,
    }),
    ctxMenu: () => vi.fn(),
    isTailwind: false,
  };
}

let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => { root.unmount(); });
  container.remove();
});

function render(node: React.ReactElement) {
  act(() => { root.render(node); });
}

/** Click the "More …" expander whose label contains `label`. */
function expand(label: string) {
  const span = Array.from(container.querySelectorAll("span")).find(
    (s) => (s.textContent || "").toLowerCase().includes(label.toLowerCase()),
  );
  if (!span) throw new Error(`Expander "${label}" not found`);
  act(() => { (span.parentElement as HTMLElement).click(); });
}

/** Find a toggle button by accessible name, optionally scoped to a group. */
function button(accName: string, groupLabel?: string): HTMLElement {
  const scope = groupLabel
    ? (container.querySelector(`[aria-label="${groupLabel}"]`) as HTMLElement)
    : container;
  if (!scope) throw new Error(`Group "${groupLabel}" not found`);
  const btn = Array.from(scope.querySelectorAll('[role="radio"]')).find(
    (b) => (b.getAttribute("aria-label") || "").toLowerCase() === accName.toLowerCase(),
  ) as HTMLElement | undefined;
  if (!btn) throw new Error(`Button "${accName}" not found in ${groupLabel || "section"}`);
  return btn;
}

function appliedNone(ctx: SectionCtx, prop: string): boolean {
  return (ctx.apply as Mock<(prop: string, value: string) => void>).mock.calls.some(
    ([p, v]) => p === prop && v === "none",
  );
}

// ── The guard, one row per at-risk control ───────────────────────────

describe("Toggle controls never emit invalid `none` when the inherited default is pre-active", () => {
  it("Box Sizing (box-sizing) — clicking the pre-active option re-affirms it", () => {
    const el = document.createElement("div");
    el.style.boxSizing = "border-box";
    const ctx = makeCtx(el);
    render(createElement(SizeSection, { ctx, display: "block", isMedia: false, forceOpen: true }));
    expand("More size options");

    const btn = button("border-box");
    expect(btn.getAttribute("aria-checked"), "border-box should be pre-active").toBe("true");
    act(() => { btn.click(); });

    expect(appliedNone(ctx, "box-sizing"), "must not apply invalid `box-sizing: none`").toBe(false);
  });

  it("Grid Columns (justify-content) — clicking pre-active Stretch re-affirms it", () => {
    const el = document.createElement("div");
    el.style.display = "grid";
    el.style.justifyContent = "normal";
    el.style.alignContent = "normal";
    const ctx = makeCtx(el);
    render(createElement(LayoutSection, {
      ctx, display: "grid", onDisplayChange: vi.fn(),
      columnGap: 0, columnGapUnit: "px", onColumnGapChange: vi.fn(), onColumnGapUnitChange: vi.fn(),
      isFlex: false, isGrid: true, parentIsFlex: false, parentIsGrid: false, forceOpen: true,
    }));
    expand("More alignment options");

    const btn = button("Stretch", "Grid justify-content");
    expect(btn.getAttribute("aria-checked"), "Stretch should be pre-active").toBe("true");
    act(() => { btn.click(); });

    expect(appliedNone(ctx, "justify-content"), "must not apply invalid `justify-content: none`").toBe(false);
  });

  it("Grid Rows (align-content) — clicking pre-active Stretch re-affirms it", () => {
    const el = document.createElement("div");
    el.style.display = "grid";
    el.style.justifyContent = "normal";
    el.style.alignContent = "normal";
    const ctx = makeCtx(el);
    render(createElement(LayoutSection, {
      ctx, display: "grid", onDisplayChange: vi.fn(),
      columnGap: 0, columnGapUnit: "px", onColumnGapChange: vi.fn(), onColumnGapUnitChange: vi.fn(),
      isFlex: false, isGrid: true, parentIsFlex: false, parentIsGrid: false, forceOpen: true,
    }));
    expand("More alignment options");

    const btn = button("Stretch", "Grid align-content");
    expect(btn.getAttribute("aria-checked"), "Stretch should be pre-active").toBe("true");
    act(() => { btn.click(); });

    expect(appliedNone(ctx, "align-content"), "must not apply invalid `align-content: none`").toBe(false);
  });

  it("text-align — clicking the pre-active alignment (e.g. <button>'s center) re-affirms it", () => {
    const el = document.createElement("div");
    el.style.textAlign = "center"; // mimics a <button>'s UA default, which IS an option
    const ctx = makeCtx(el);
    render(createElement(TypographySection, {
      ctx, columnGap: 0, columnGapUnit: "px", onColumnGapChange: vi.fn(), onColumnGapUnitChange: vi.fn(),
      forceOpen: true,
    }));

    const btn = button("Align center");
    expect(btn.getAttribute("aria-checked"), "center should be pre-active").toBe("true");
    act(() => { btn.click(); });

    expect(appliedNone(ctx, "text-align"), "must not apply invalid `text-align: none`").toBe(false);
  });
});
