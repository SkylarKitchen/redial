// @vitest-environment happy-dom
/**
 * position-reset.test.ts — Verify every control in the Position section
 * supports Option+Click to reset.
 *
 * The Position section uses several custom components that bypass the
 * standard rows:
 *
 *   1. PositionSelector — custom dropdown (label is the reset trigger)
 *   2. PositionOffsetDiagram — EditableValue spans (altKey on click)
 *   3. Z-Index — RowLabel trigger + "Auto" button altKey path
 *   4. IconButtonGroup for Float/Clear (altKey in the item click handler)
 *
 * Rule: if a control can set a value AND shows an orange dot when
 * modified, Option+Click MUST reset it.
 *
 * CONVERTED (issue #105): was a source-text test (readFileSync over
 * PositionSection/PositionSelector/PositionOffsetDiagram/IconButtonGroup
 * grepping for "onReset"/"altKey"). Now mounts the REAL PositionSection
 * against the real apply engine: each property is genuinely dirtied, the
 * actual control surface is Alt+clicked, and the engine must report the
 * property clean. Every original "component accepts onReset / checks
 * altKey / section passes onReset" assertion maps to "Alt+click on that
 * control's rendered surface really resets the property".
 */

import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { createElement } from "react";
import { render, cleanup, fireEvent, screen } from "@testing-library/react";
import { PositionSection } from "../sections/PositionSection";
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

/** Dirty the Position section's properties and mount the real section. */
function renderDirtyPosition(extra: Array<[string, string]> = []) {
  const ctx = makeRealCtx();
  const dirty: Array<[string, string]> = [
    ["position", "relative"], // non-static so the offset diagram renders
    ["top", "10px"],
    ["right", "11px"],
    ["bottom", "12px"],
    ["left", "13px"],
    ["float", "left"],
    ["clear", "both"],
    ...extra,
  ];
  for (const [p, v] of dirty) applyInlineStyle(ctx.el, p, v);
  for (const [p] of dirty) expect(isDirty(ctx.el, p), `${p} should start dirty`).toBe(true);

  const utils = render(createElement(PositionSection, { ctx, forceOpen: true }));
  return { ctx, utils };
}

function labelTrigger(labelText: string): HTMLElement {
  // The section header also renders "Position" — pick the label whose
  // ancestor is a "Reset …" trigger (only modified labels become triggers).
  const trigger = screen
    .getAllByText(labelText)
    .map((n) => n.closest('[role="button"][aria-label^="Reset"]'))
    .find((t) => t !== null) as HTMLElement;
  expect(trigger, `"${labelText}" label should be a reset trigger while modified`).toBeTruthy();
  return trigger;
}

/** Expand the collapsed "Float and clear" sub-area. */
function expandFloatClear(container: HTMLElement) {
  const toggle = Array.from(container.querySelectorAll("button")).find((b) =>
    b.textContent?.includes("Float and clear"),
  ) as HTMLElement;
  expect(toggle, "'Float and clear' expander should render").toBeTruthy();
  fireEvent.click(toggle);
}

describe("Position section: Option+Click reset — fired against the real engine", () => {
  it("PositionSelector label Alt+click resets position", () => {
    const { ctx } = renderDirtyPosition();
    fireEvent.click(labelTrigger("Position"), { altKey: true });
    expect(isDirty(ctx.el, "position")).toBe(false);
  });

  it("PositionOffsetDiagram EditableValue Alt+click resets each offset (top/right/bottom/left)", () => {
    const { ctx, utils } = renderDirtyPosition();

    const valueSpans = Array.from(
      utils.container.querySelectorAll('[aria-label="Edit offset value"]'),
    ) as HTMLElement[];
    expect(
      valueSpans.length,
      "all four offset EditableValues should render for a non-static element",
    ).toBe(4);

    for (const span of valueSpans) fireEvent.click(span, { altKey: true });

    const stillDirty = ["top", "right", "bottom", "left"].filter((p) => isDirty(ctx.el, p));
    expect(
      stillDirty,
      `offsets still dirty after Alt+click — EditableValue reset broken for: ${stillDirty.join(", ")}`,
    ).toEqual([]);
  });

  it("Z-Index RowLabel Alt+click resets z-index", () => {
    const { ctx } = renderDirtyPosition([["z-index", "5"]]);
    fireEvent.click(labelTrigger("Z-Index"), { altKey: true });
    expect(isDirty(ctx.el, "z-index")).toBe(false);
  });

  it("Z-Index 'Auto' button Alt+click resets z-index (auto branch)", () => {
    // Dirty z-index with the literal "auto" so the Auto button branch renders
    const { ctx, utils } = renderDirtyPosition([["z-index", "auto"]]);

    const autoBtn = Array.from(utils.container.querySelectorAll("*")).find(
      (n) =>
        n.textContent === "Auto" &&
        (n as HTMLElement).closest !== undefined &&
        n.parentElement !== null &&
        !(n as HTMLElement).querySelector("*"),
    ) as HTMLElement;
    expect(autoBtn, "z-index Auto affordance should render").toBeTruthy();

    fireEvent.click(autoBtn, { altKey: true });
    expect(isDirty(ctx.el, "z-index")).toBe(false);
  });

  it("Float IconButtonGroup Alt+click resets float", () => {
    const { ctx, utils } = renderDirtyPosition();
    expandFloatClear(utils.container);
    const group = utils.container.querySelector('[aria-label="Float"]') as HTMLElement;
    expect(group, "Float IconButtonGroup should render").toBeTruthy();
    const btn = group.querySelector("button") as HTMLElement;
    expect(btn).toBeTruthy();
    fireEvent.click(btn, { altKey: true });
    expect(isDirty(ctx.el, "float")).toBe(false);
  });

  it("Clear IconButtonGroup Alt+click resets clear", () => {
    const { ctx, utils } = renderDirtyPosition();
    expandFloatClear(utils.container);
    const group = utils.container.querySelector('[aria-label="Clear"]') as HTMLElement;
    expect(group, "Clear IconButtonGroup should render").toBeTruthy();
    const btn = group.querySelector("button") as HTMLElement;
    expect(btn).toBeTruthy();
    fireEvent.click(btn, { altKey: true });
    expect(isDirty(ctx.el, "clear")).toBe(false);
  });

  it("plain click on an IconButtonGroup option still applies (non-alt path unchanged)", () => {
    const { ctx, utils } = renderDirtyPosition();
    expandFloatClear(utils.container);
    const group = utils.container.querySelector('[aria-label="Float"]') as HTMLElement;
    const buttons = Array.from(group.querySelectorAll("button")) as HTMLElement[];
    // Click a different float option without alt — float must stay an override
    fireEvent.click(buttons[buttons.length - 1]);
    expect(isDirty(ctx.el, "float")).toBe(true);
  });
});
