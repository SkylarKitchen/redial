// @vitest-environment happy-dom
/**
 * layout-reset.test.ts — Regression test for Option+Click reset in Layout section
 *
 * Bug: LayoutSection never passed onReset/onAltClick to many controls, so
 * alt+click (Option+Click) to reset style changes silently did nothing for:
 * - DisplayTabs (display)
 * - FlexDirectionRow (flex-direction, flex-wrap)
 * - Align RowLabel (justify-content, align-items)
 * - Flex Grow/Shrink ValueInput + LabelScrub/CompactLabel
 * - Flex Basis ValueInput + CompactLabel
 * - Align Self SelectRow
 * - Order ValueInput
 *
 * CONVERTED (issue #105): Part 2 was a source-text test (regexes over
 * LayoutSection.tsx checking each control tag contained "onAltClick" /
 * "onReset"). It now mounts the REAL LayoutSection against the real apply
 * engine: every property is genuinely dirtied, the actual reset surface is
 * Alt+clicked (value inputs AND label triggers — both original invariants),
 * and the engine must report the property clean afterwards. If any control
 * loses its onReset/onAltClick wiring, its property stays dirty and the
 * assertion names it.
 */

import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { createElement } from "react";
import { render, cleanup, fireEvent, screen, type RenderResult } from "@testing-library/react";
import { LayoutSection } from "../sections/LayoutSection";
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

beforeAll(() => {
  // happy-dom doesn't implement pointer capture (LabelScrub needs it).
  const proto = Element.prototype as unknown as Record<string, unknown>;
  if (!proto.setPointerCapture) proto.setPointerCapture = () => {};
  if (!proto.releasePointerCapture) proto.releasePointerCapture = () => {};
  if (!proto.hasPointerCapture) proto.hasPointerCapture = () => false;
});

afterEach(() => {
  cleanup();
  resetAll();
  document.body.innerHTML = "";
});

// ── Unit test: resetProp works for layout properties ──────────────────

describe("resetProp works for layout CSS properties", () => {
  const layoutProps = [
    { prop: "display", value: "flex", initial: "block" },
    { prop: "flex-direction", value: "column", initial: "row" },
    { prop: "flex-wrap", value: "wrap", initial: "nowrap" },
    { prop: "justify-content", value: "center", initial: "normal" },
    { prop: "align-items", value: "center", initial: "normal" },
    { prop: "flex-grow", value: "2", initial: "0" },
    { prop: "flex-shrink", value: "0", initial: "1" },
    { prop: "flex-basis", value: "100px", initial: "auto" },
    { prop: "align-self", value: "center", initial: "auto" },
    { prop: "order", value: "5", initial: "0" },
  ];

  for (const { prop, value } of layoutProps) {
    it(`resetProp("${prop}") clears the dirty flag`, () => {
      const el = document.createElement("div");
      document.body.appendChild(el);

      applyInlineStyle(el, prop, value);
      expect(isDirty(el, prop)).toBe(true);

      resetProp(el, prop);
      expect(isDirty(el, prop)).toBe(false);

      document.body.removeChild(el);
      resetAll();
    });
  }
});

// ── Behavioral: every Layout control's reset surface really resets ─────

/** SectionCtx wired to the REAL apply engine (indicators come from isDirty). */
function makeRealCtx(): SectionCtx & { el: HTMLElement } {
  const element = document.createElement("div");
  document.body.appendChild(element);
  const cs = getComputedStyle(element);
  return {
    el: element,
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

/** Dirty every layout property, then mount LayoutSection as a flex container
 *  that is itself a flex child (so Grow/Shrink/Basis/Order render). */
function renderDirtyLayout(): { ctx: ReturnType<typeof makeRealCtx>; utils: RenderResult } {
  const ctx = makeRealCtx();
  const dirty: Array<[string, string]> = [
    ["display", "flex"],
    ["flex-direction", "column"],
    ["flex-wrap", "wrap"],
    ["justify-content", "center"],
    ["align-items", "center"],
    ["flex-grow", "2"],
    ["flex-shrink", "0"],
    ["flex-basis", "100px"],
    ["align-self", "center"],
    ["order", "5"],
  ];
  for (const [p, v] of dirty) applyInlineStyle(ctx.el, p, v);
  for (const [p] of dirty) expect(isDirty(ctx.el, p), `${p} should start dirty`).toBe(true);

  const utils = render(
    createElement(LayoutSection, {
      ctx,
      display: "flex",
      onDisplayChange: () => {},
      columnGap: 0,
      columnGapUnit: "px",
      onColumnGapChange: () => {},
      onColumnGapUnitChange: () => {},
      isFlex: true,
      isGrid: false,
      parentIsFlex: true,
      parentIsGrid: false,
      forceOpen: true,
    }),
  );
  return { ctx, utils };
}

/** The reset trigger ([role=button]) that wraps a row/compact label. */
function labelTrigger(labelText: string): HTMLElement {
  const trigger = screen.getByText(labelText).closest('[role="button"]') as HTMLElement;
  expect(trigger, `"${labelText}" label should be a reset trigger while modified`).toBeTruthy();
  return trigger;
}

/** The ValueInput <input> living in the same compact cell as a label. */
function cellInput(labelText: string): HTMLElement {
  let node: HTMLElement | null = screen.getByText(labelText) as HTMLElement;
  while (node && !node.querySelector("input")) node = node.parentElement;
  expect(node, `compact cell with input for "${labelText}" should exist`).toBeTruthy();
  return node!.querySelector("input") as HTMLElement;
}

describe("LayoutSection Option+Click reset — fired against the real engine", () => {
  it("Display label Alt+click resets display", () => {
    const { ctx } = renderDirtyLayout();
    fireEvent.click(labelTrigger("Display"), { altKey: true });
    expect(isDirty(ctx.el, "display")).toBe(false);
  });

  it("Direction label Alt+click resets flex-direction AND flex-wrap", () => {
    const { ctx } = renderDirtyLayout();
    fireEvent.click(labelTrigger("Direction"), { altKey: true });
    expect(isDirty(ctx.el, "flex-direction")).toBe(false);
    expect(isDirty(ctx.el, "flex-wrap")).toBe(false);
  });

  it("Align label Alt+click resets justify-content AND align-items", () => {
    const { ctx } = renderDirtyLayout();
    fireEvent.click(labelTrigger("Align"), { altKey: true });
    expect(isDirty(ctx.el, "justify-content")).toBe(false);
    expect(isDirty(ctx.el, "align-items")).toBe(false);
  });

  it("Flex Grow ValueInput Alt+click resets flex-grow", () => {
    const { ctx } = renderDirtyLayout();
    fireEvent.click(cellInput("Grow"), { altKey: true });
    expect(isDirty(ctx.el, "flex-grow")).toBe(false);
  });

  it("Flex Shrink label (CompactLabel trigger) Alt+click resets flex-shrink", () => {
    const { ctx } = renderDirtyLayout();
    fireEvent.click(labelTrigger("Shrink"), { altKey: true });
    expect(isDirty(ctx.el, "flex-shrink")).toBe(false);
  });

  it("Flex Basis ValueInput Alt+click resets flex-basis", () => {
    const { ctx } = renderDirtyLayout();
    fireEvent.click(cellInput("Basis"), { altKey: true });
    expect(isDirty(ctx.el, "flex-basis")).toBe(false);
  });

  it("Order ValueInput Alt+click resets order", () => {
    const { ctx } = renderDirtyLayout();
    fireEvent.click(cellInput("Order"), { altKey: true });
    expect(isDirty(ctx.el, "order")).toBe(false);
  });

  it("Grow label trigger Alt+click also resets flex-grow (label path, was LabelScrub onAltClick)", () => {
    const { ctx } = renderDirtyLayout();
    fireEvent.click(labelTrigger("Grow"), { altKey: true });
    expect(isDirty(ctx.el, "flex-grow")).toBe(false);
  });

  it("Basis label trigger Alt+click also resets flex-basis (label path, was LabelScrub onAltClick)", () => {
    const { ctx } = renderDirtyLayout();
    fireEvent.click(labelTrigger("Basis"), { altKey: true });
    expect(isDirty(ctx.el, "flex-basis")).toBe(false);
  });

  it("Shrink ValueInput Alt+click also resets flex-shrink (input path)", () => {
    const { ctx } = renderDirtyLayout();
    fireEvent.click(cellInput("Shrink"), { altKey: true });
    expect(isDirty(ctx.el, "flex-shrink")).toBe(false);
  });

  it("Order label trigger Alt+click also resets order (label path)", () => {
    const { ctx } = renderDirtyLayout();
    fireEvent.click(labelTrigger("Order"), { altKey: true });
    expect(isDirty(ctx.el, "order")).toBe(false);
  });

  it("Align Self SelectRow label Alt+click resets align-self", () => {
    const { ctx } = renderDirtyLayout();
    fireEvent.click(labelTrigger("Align Self"), { altKey: true });
    expect(isDirty(ctx.el, "align-self")).toBe(false);
  });
});
