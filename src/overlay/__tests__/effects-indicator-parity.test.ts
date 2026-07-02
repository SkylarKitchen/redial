// @vitest-environment happy-dom
/**
 * effects-indicator-parity.test.ts
 *
 * Bug: The Effects section header shows a blue "modified" dot, but some
 * properties tracked by sectionInd have no per-row indicator — so the user
 * sees the dot but can't find which control to reset.
 *
 * Also: secondary controls (perspective, backface-visibility, pointer-events,
 * visibility, user-select) had per-row indicators but were MISSING from
 * sectionInd, so editing them wouldn't light up the section header.
 *
 * This test enforces: every property in sectionInd must have a row-level
 * indicator, and every property with a row-level indicator must be in
 * sectionInd.
 *
 * CONVERTED (issue #105): was a source-text test (regexes extracting
 * `sectionInd([...])` and `ind("...")` calls from EffectsSection.tsx). Now
 * mounts the REAL EffectsSection with a recording SectionCtx and compares
 * the property names the component actually passes to ctx.sectionInd (the
 * section-header dirty set) against the ones it actually asks ctx.ind for
 * (the row-level indicators). Same invariant, but measured at runtime — a
 * renamed helper or moved row can no longer make the regex silently vacuous,
 * and rows must really RENDER their indicator for it to count.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { createElement } from "react";
import { render } from "@testing-library/react";
import { EffectsSection } from "../sections/EffectsSection";
import type { SectionCtx } from "../panelUtils";
import type { UnitConversionContext } from "../unitConversion";

// Properties whose row indicators are delegated to child components
// (TransformEditor's settings sub-panel handles perspective &
// backface-visibility internally — it only renders once the settings popup
// is opened). They must stay in sectionInd so the section header lights up,
// but no ind() call happens for them at initial mount.
const DELEGATED_TO_CHILD = ["perspective", "backface-visibility"];

// ── Mount the real section with a recording ctx ───────────────────────

const rowProps: string[] = [];
let sectionProps: string[] = [];

beforeAll(() => {
  // happy-dom doesn't implement pointer capture (useDragReorder needs it).
  const proto = Element.prototype as unknown as Record<string, unknown>;
  if (!proto.setPointerCapture) proto.setPointerCapture = () => {};
  if (!proto.releasePointerCapture) proto.releasePointerCapture = () => {};
  if (!proto.hasPointerCapture) proto.hasPointerCapture = () => false;

  const element = document.createElement("div");
  document.body.appendChild(element);
  const cs = getComputedStyle(element);
  const ctx: SectionCtx = {
    element,
    apply: () => {},
    reset: () => {},
    resetRead: () => 0,
    resetReadStr: () => "",
    ind: (prop: string) => {
      rowProps.push(prop);
      return "none" as const;
    },
    sectionInd: (props: string[]) => {
      sectionProps = props;
      return "none" as const;
    },
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

  render(createElement(EffectsSection, { ctx, forceOpen: true }));
});

describe("Effects section indicator parity", () => {
  it("mounting the section records its header dirty-set (sectionInd was called)", () => {
    expect(sectionProps.length, "EffectsSection must pass its property list to ctx.sectionInd").toBeGreaterThan(0);
    expect(rowProps.length, "EffectsSection rows must render ctx.ind indicators").toBeGreaterThan(0);
  });

  it("every sectionInd property has a matching row-level ind() call", () => {
    const missing = sectionProps.filter(
      (p) => !rowProps.includes(p) && !DELEGATED_TO_CHILD.includes(p),
    );
    expect(
      missing,
      `These properties are in sectionInd but rendered NO row indicator — ` +
        `the user sees the blue dot but can't find which row to reset: ${missing.join(", ")}`,
    ).toEqual([]);
  });

  it("every row-level ind() property is included in sectionInd", () => {
    const missing = [...new Set(rowProps)].filter((p) => !sectionProps.includes(p));
    expect(
      missing,
      `These properties render row indicators but are NOT in sectionInd — ` +
        `editing them won't light up the section header: ${missing.join(", ")}`,
    ).toEqual([]);
  });
});
