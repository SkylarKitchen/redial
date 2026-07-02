// @vitest-environment happy-dom
/**
 * TransformEditor AxisSliderRow ghost-drag protection (same family as issue
 * #73, fixed in ColorPickerEnhanced / SliderRow).
 *
 * The axis slider opens an undo batch on pointerdown and relies solely on the
 * input's own pointerup to call `endBatch()`. If the release is lost — window
 * blurred mid-drag (Cmd+Tab), pointer canceled, Escape pressed, or the editor
 * unmounted (Cmd+Z remounts the panel) — the batch stays permanently open and
 * every subsequent edit silently coalesces into one giant undo entry.
 *
 * These tests pin down that every terminal event closes the batch exactly
 * once, mirroring the SliderRow ghost-drag pattern.
 */
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from "vitest";
import { render, cleanup, fireEvent } from "@testing-library/react";
import {
  TransformEditor,
  type TransformValue,
} from "../sections/TransformEditor";
import { beginBatch, endBatch } from "../core/apply";

vi.mock("../core/apply", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../core/apply")>();
  return { ...actual, beginBatch: vi.fn(), endBatch: vi.fn() };
});

beforeAll(() => {
  // happy-dom doesn't implement pointer capture — useDragReorder calls it in
  // its pointer handlers, so polyfill as no-ops to prevent throws.
  const proto = Element.prototype as unknown as Record<string, unknown>;
  if (!proto.setPointerCapture) proto.setPointerCapture = () => {};
  if (!proto.releasePointerCapture) proto.releasePointerCapture = () => {};
  if (!proto.hasPointerCapture) proto.hasPointerCapture = () => false;
});

beforeEach(() => {
  vi.mocked(beginBatch).mockClear();
  vi.mocked(endBatch).mockClear();
});

afterEach(() => cleanup());

const TRANSLATE: TransformValue = { type: "translate", x: 0, y: 0, z: 0 };

function renderEditor() {
  const utils = render(
    <TransformEditor
      transforms={[TRANSLATE]}
      onChange={vi.fn()}
      origin="50% 50%"
      onOriginChange={vi.fn()}
      backfaceVisibility="visible"
      onBackfaceChange={vi.fn()}
      selfPerspective={0}
      onSelfPerspectiveChange={vi.fn()}
      childrenPerspective={0}
      onChildrenPerspectiveChange={vi.fn()}
      perspectiveOrigin="50% 50%"
      onPerspectiveOriginChange={vi.fn()}
      settingsOpen={false}
    />,
  );
  // Expand the single transform pill so the AxisSliderRows render.
  const pill = utils.container.querySelector(
    'div[style*="cursor: pointer"]',
  ) as HTMLElement;
  expect(pill, "TransformEditor must render the transform pill").toBeTruthy();
  fireEvent.click(pill);
  const slider = utils.container.querySelector(
    'input[type="range"][aria-label^="X:"]',
  ) as HTMLInputElement;
  expect(slider, "expanded editor must render the X axis slider").toBeTruthy();
  return { ...utils, slider };
}

/** Press down on the axis slider track without releasing. */
function startDrag(slider: HTMLInputElement) {
  fireEvent.pointerDown(slider);
  expect(beginBatch).toHaveBeenCalledTimes(1);
  expect(endBatch).not.toHaveBeenCalled();
}

describe("TransformEditor axis slider ghost-drag protection", () => {
  it("closes the undo batch when the window blurs mid-drag (lost pointerup)", () => {
    const { slider } = renderEditor();
    startDrag(slider);

    // Cmd+Tab mid-drag: blur fires, pointerup never does.
    fireEvent(window, new Event("blur"));

    expect(endBatch).toHaveBeenCalledTimes(1);
  });

  it("closes the undo batch on pointercancel without a pointerup", () => {
    const { slider } = renderEditor();
    startDrag(slider);

    fireEvent(document, new Event("pointercancel"));

    expect(endBatch).toHaveBeenCalledTimes(1);
  });

  it("closes the undo batch when Escape is pressed mid-drag", () => {
    const { slider } = renderEditor();
    startDrag(slider);

    fireEvent.keyDown(window, { key: "Escape" });

    expect(endBatch).toHaveBeenCalledTimes(1);
  });

  it("closes the undo batch when the editor unmounts mid-drag", () => {
    const { slider, unmount } = renderEditor();
    startDrag(slider);

    // Cmd+Z triggers a panelKey remount — the editor unmounts mid-drag.
    unmount();

    expect(endBatch).toHaveBeenCalledTimes(1);
  });

  it("never double-closes: a late pointerup after blur is a no-op", () => {
    const { slider } = renderEditor();
    startDrag(slider);

    fireEvent(window, new Event("blur"));
    expect(endBatch).toHaveBeenCalledTimes(1); // blur closed the batch

    fireEvent.pointerUp(slider);

    expect(beginBatch).toHaveBeenCalledTimes(1);
    expect(endBatch).toHaveBeenCalledTimes(1); // late release is a no-op
  });

  it("normal drag lifecycle still opens and closes exactly one batch", () => {
    const { slider } = renderEditor();
    startDrag(slider);

    fireEvent.pointerUp(slider);

    expect(beginBatch).toHaveBeenCalledTimes(1);
    expect(endBatch).toHaveBeenCalledTimes(1);
  });

  it("a pointerup without a preceding pointerdown does not close anything", () => {
    const { slider } = renderEditor();

    fireEvent.pointerUp(slider);

    expect(beginBatch).not.toHaveBeenCalled();
    expect(endBatch).not.toHaveBeenCalled();
  });
});
