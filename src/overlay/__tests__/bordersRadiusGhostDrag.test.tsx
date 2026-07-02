// @vitest-environment happy-dom
/**
 * BordersSection radius slider ghost-drag protection (same family as issue
 * #73, fixed in ColorPickerEnhanced / SliderRow).
 *
 * The radius slider opens an undo batch on pointerdown and relies solely on
 * the input's own pointerup to call `endBatch()`. If the release is lost —
 * window blurred mid-drag (Cmd+Tab), pointer canceled, Escape pressed, or the
 * section unmounted (Cmd+Z remounts the panel) — the batch stays permanently
 * open and every subsequent edit silently coalesces into one giant undo entry.
 *
 * These tests pin down that every terminal event closes the batch exactly
 * once, mirroring the SliderRow ghost-drag pattern.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup, fireEvent } from "@testing-library/react";
import { BordersSection } from "../sections/BordersSection";
import { beginBatch, endBatch } from "../core/apply";
import type { SectionCtx } from "../panelUtils";
import type { UnitConversionContext } from "../unitConversion";

vi.mock("../core/apply", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../core/apply")>();
  return { ...actual, beginBatch: vi.fn(), endBatch: vi.fn() };
});

beforeEach(() => {
  vi.mocked(beginBatch).mockClear();
  vi.mocked(endBatch).mockClear();
});

afterEach(() => cleanup());

function makeCtx(): SectionCtx {
  const element = document.createElement("div");
  element.style.borderWidth = "1px";
  element.style.borderStyle = "solid";
  element.style.borderColor = "rgb(0, 0, 0)";
  element.style.borderTopLeftRadius = "0px";
  element.style.borderTopRightRadius = "0px";
  element.style.borderBottomRightRadius = "0px";
  element.style.borderBottomLeftRadius = "0px";
  document.body.appendChild(element);
  const cs = getComputedStyle(element);
  return {
    element,
    apply: vi.fn(),
    reset: vi.fn(),
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
}

function renderSection() {
  const utils = render(<BordersSection ctx={makeCtx()} forceOpen />);
  // The radius row hosts the only <Slider> in the section.
  const slider = utils.container.querySelector(
    'input[type="range"]',
  ) as HTMLInputElement;
  expect(slider, "BordersSection must render the radius range input").toBeTruthy();
  return { ...utils, slider };
}

/** Press down on the radius slider track without releasing. */
function startDrag(slider: HTMLInputElement) {
  fireEvent.pointerDown(slider);
  expect(beginBatch).toHaveBeenCalledTimes(1);
  expect(endBatch).not.toHaveBeenCalled();
}

describe("BordersSection radius slider ghost-drag protection", () => {
  it("closes the undo batch when the window blurs mid-drag (lost pointerup)", () => {
    const { slider } = renderSection();
    startDrag(slider);

    // Cmd+Tab mid-drag: blur fires, pointerup never does.
    fireEvent(window, new Event("blur"));

    expect(endBatch).toHaveBeenCalledTimes(1);
  });

  it("closes the undo batch on pointercancel without a pointerup", () => {
    const { slider } = renderSection();
    startDrag(slider);

    fireEvent(document, new Event("pointercancel"));

    expect(endBatch).toHaveBeenCalledTimes(1);
  });

  it("closes the undo batch when Escape is pressed mid-drag", () => {
    const { slider } = renderSection();
    startDrag(slider);

    fireEvent.keyDown(window, { key: "Escape" });

    expect(endBatch).toHaveBeenCalledTimes(1);
  });

  it("closes the undo batch when the section unmounts mid-drag", () => {
    const { slider, unmount } = renderSection();
    startDrag(slider);

    // Cmd+Z triggers a panelKey remount — the section unmounts mid-drag.
    unmount();

    expect(endBatch).toHaveBeenCalledTimes(1);
  });

  it("never double-closes: a late pointerup after blur is a no-op", () => {
    const { slider } = renderSection();
    startDrag(slider);

    fireEvent(window, new Event("blur"));
    expect(endBatch).toHaveBeenCalledTimes(1); // blur closed the batch

    fireEvent.pointerUp(slider);

    expect(beginBatch).toHaveBeenCalledTimes(1);
    expect(endBatch).toHaveBeenCalledTimes(1); // late release is a no-op
  });

  it("normal drag lifecycle still opens and closes exactly one batch", () => {
    const { slider } = renderSection();
    startDrag(slider);

    fireEvent.pointerUp(slider);

    expect(beginBatch).toHaveBeenCalledTimes(1);
    expect(endBatch).toHaveBeenCalledTimes(1);
  });

  it("a pointerup without a preceding pointerdown does not close anything", () => {
    const { slider } = renderSection();

    fireEvent.pointerUp(slider);

    expect(beginBatch).not.toHaveBeenCalled();
    expect(endBatch).not.toHaveBeenCalled();
  });
});
