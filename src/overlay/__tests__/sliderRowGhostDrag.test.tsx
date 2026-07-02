// @vitest-environment happy-dom
/**
 * SliderRow ghost-drag protection (same family as issue #73, fixed in
 * ColorPickerEnhanced).
 *
 * The slider opens an undo batch on pointerdown and relies solely on the
 * input's own pointerup to call `endBatch()`. If the release is lost — window
 * blurred mid-drag (Cmd+Tab), pointer canceled, Escape pressed, or the row
 * unmounted (Cmd+Z remounts the panel) — the batch stays permanently open and
 * every subsequent edit silently coalesces into one giant undo entry.
 *
 * These tests pin down that every terminal event closes the batch exactly
 * once, mirroring the ColorPickerEnhanced / LabelScrub ghost-drag pattern.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup, fireEvent } from "@testing-library/react";
import { SliderRow } from "../controls/SliderRow";
import { beginBatch, endBatch } from "../core/apply";

vi.mock("../core/apply", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../core/apply")>();
  return { ...actual, beginBatch: vi.fn(), endBatch: vi.fn() };
});

beforeEach(() => {
  vi.mocked(beginBatch).mockClear();
  vi.mocked(endBatch).mockClear();
});

afterEach(() => cleanup());

function renderRow() {
  const utils = render(
    <SliderRow
      label="Width"
      value={50}
      min={0}
      max={100}
      step={1}
      unit="px"
      onChange={vi.fn()}
    />,
  );
  const slider = utils.container.querySelector(
    'input[type="range"]',
  ) as HTMLInputElement;
  expect(slider, "SliderRow must render a native range input").toBeTruthy();
  return { ...utils, slider };
}

/** Press down on the slider track without releasing. */
function startDrag(slider: HTMLInputElement) {
  fireEvent.pointerDown(slider);
  expect(beginBatch).toHaveBeenCalledTimes(1);
  expect(endBatch).not.toHaveBeenCalled();
}

describe("SliderRow ghost-drag protection", () => {
  it("closes the undo batch when the window blurs mid-drag (lost pointerup)", () => {
    const { slider } = renderRow();
    startDrag(slider);

    // Cmd+Tab mid-drag: blur fires, pointerup never does.
    fireEvent(window, new Event("blur"));

    expect(endBatch).toHaveBeenCalledTimes(1);
  });

  it("closes the undo batch on pointercancel without a pointerup", () => {
    const { slider } = renderRow();
    startDrag(slider);

    fireEvent(document, new Event("pointercancel"));

    expect(endBatch).toHaveBeenCalledTimes(1);
  });

  it("closes the undo batch when Escape is pressed mid-drag", () => {
    const { slider } = renderRow();
    startDrag(slider);

    fireEvent.keyDown(window, { key: "Escape" });

    expect(endBatch).toHaveBeenCalledTimes(1);
  });

  it("closes the undo batch when the row unmounts mid-drag", () => {
    const { slider, unmount } = renderRow();
    startDrag(slider);

    // Cmd+Z triggers a panelKey remount — the row unmounts mid-drag.
    unmount();

    expect(endBatch).toHaveBeenCalledTimes(1);
  });

  it("never double-closes: a late pointerup after blur is a no-op", () => {
    const { slider } = renderRow();
    startDrag(slider);

    fireEvent(window, new Event("blur"));
    expect(endBatch).toHaveBeenCalledTimes(1); // blur closed the batch

    fireEvent.pointerUp(slider);

    expect(beginBatch).toHaveBeenCalledTimes(1);
    expect(endBatch).toHaveBeenCalledTimes(1); // late release is a no-op
  });

  it("normal drag lifecycle still opens and closes exactly one batch", () => {
    const { slider } = renderRow();
    startDrag(slider);

    fireEvent.pointerUp(slider);

    expect(beginBatch).toHaveBeenCalledTimes(1);
    expect(endBatch).toHaveBeenCalledTimes(1);
  });

  it("a pointerup without a preceding pointerdown does not close anything", () => {
    const { slider } = renderRow();

    fireEvent.pointerUp(slider);

    expect(beginBatch).not.toHaveBeenCalled();
    expect(endBatch).not.toHaveBeenCalled();
  });
});
