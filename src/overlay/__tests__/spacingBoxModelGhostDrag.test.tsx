// @vitest-environment happy-dom
/**
 * SpacingBoxModel scrub ghost-drag protection — the terminals its existing
 * cleanup misses (same family as issue #73, fixed in ColorPickerEnhanced /
 * SliderRow).
 *
 * The box-model value cells already close the batch on pointerup /
 * lostpointercapture / window blur via a cleaned-once guard, and an unmount
 * effect closes a dangling batch via scrubActiveRef — but:
 *   - Escape mid-drag is not a terminal: the batch stays open until the next
 *     pointerup, silently coalescing subsequent edits.
 *   - The unmount effect calls endBatch() directly without removing the
 *     window blur listener, so a later blur closes the batch a SECOND time,
 *     corrupting the begin/end balance.
 *
 * These tests pin down both terminals plus the normal lifecycle. The scrub
 * math itself is covered by spacingBoxModel.test.ts / spacingShiftMidDrag.test.ts
 * and must not change.
 */
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from "vitest";
import { render, cleanup, fireEvent } from "@testing-library/react";
import { SpacingBoxModel } from "../sections/SpacingBoxModel";
import { beginBatch, endBatch } from "../core/apply";

vi.mock("../core/apply", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../core/apply")>();
  return { ...actual, beginBatch: vi.fn(), endBatch: vi.fn() };
});

beforeAll(() => {
  // happy-dom may not implement pointer capture — polyfill as no-ops.
  const proto = HTMLElement.prototype as unknown as Record<string, unknown>;
  if (!proto.setPointerCapture) proto.setPointerCapture = () => {};
  if (!proto.releasePointerCapture) proto.releasePointerCapture = () => {};
  if (!proto.hasPointerCapture) proto.hasPointerCapture = () => false;
});

beforeEach(() => {
  vi.mocked(beginBatch).mockClear();
  vi.mocked(endBatch).mockClear();
});

afterEach(() => cleanup());

const stubElement = document.createElement("div");

function renderBoxModel() {
  const utils = render(
    <SpacingBoxModel
      margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
      padding={{ top: 0, right: 0, bottom: 0, left: 0 }}
      onChange={vi.fn()}
      marginUnit="px"
      paddingUnit="px"
      marginUnits={["px", "%", "em", "rem"]}
      paddingUnits={["px", "%", "em", "rem"]}
      onMarginUnitChange={vi.fn()}
      onPaddingUnitChange={vi.fn()}
      element={stubElement}
      ind={() => "none" as const}
    />,
  );
  const cell = utils.container.querySelector<HTMLElement>(
    '[data-spacing-prop="padding-left"]',
  ) as HTMLElement;
  expect(cell, "SpacingBoxModel must render the padding-left cell").toBeTruthy();
  return { ...utils, cell };
}

/** Pointer down + move past the 3px dead zone so the scrub (and batch) starts. */
function startScrub(cell: HTMLElement) {
  fireEvent.pointerDown(cell, { button: 0, clientX: 100, clientY: 50 });
  // Listeners are attached natively to the captured element.
  cell.dispatchEvent(
    new PointerEvent("pointermove", { bubbles: true, clientX: 120, clientY: 50 }),
  );
  expect(beginBatch).toHaveBeenCalledTimes(1);
  expect(endBatch).not.toHaveBeenCalled();
}

describe("SpacingBoxModel scrub ghost-drag protection", () => {
  it("closes the undo batch when Escape is pressed mid-scrub", () => {
    const { cell } = renderBoxModel();
    startScrub(cell);

    fireEvent.keyDown(window, { key: "Escape" });

    expect(endBatch).toHaveBeenCalledTimes(1);
  });

  it("closes the undo batch exactly once when unmounted mid-scrub, even if the window later blurs", () => {
    const { cell, unmount } = renderBoxModel();
    startScrub(cell);

    // Cmd+Z triggers a panelKey remount — the cell unmounts mid-scrub.
    unmount();
    expect(endBatch).toHaveBeenCalledTimes(1);

    // The drag's window blur listener must be gone: a later blur must not
    // close the batch a second time.
    fireEvent(window, new Event("blur"));
    expect(endBatch).toHaveBeenCalledTimes(1);
  });

  it("never double-closes: a late pointerup after Escape is a no-op", () => {
    const { cell } = renderBoxModel();
    startScrub(cell);

    fireEvent.keyDown(window, { key: "Escape" });
    expect(endBatch).toHaveBeenCalledTimes(1); // Escape closed the batch

    cell.dispatchEvent(
      new PointerEvent("pointerup", { bubbles: true, clientX: 120, clientY: 50 }),
    );

    expect(beginBatch).toHaveBeenCalledTimes(1);
    expect(endBatch).toHaveBeenCalledTimes(1); // late release is a no-op
  });

  it("normal scrub lifecycle still opens and closes exactly one batch", () => {
    const { cell } = renderBoxModel();
    startScrub(cell);

    cell.dispatchEvent(
      new PointerEvent("pointerup", { bubbles: true, clientX: 120, clientY: 50 }),
    );

    expect(beginBatch).toHaveBeenCalledTimes(1);
    expect(endBatch).toHaveBeenCalledTimes(1);
  });

  it("Escape without an active scrub does not close anything", () => {
    renderBoxModel();

    fireEvent.keyDown(window, { key: "Escape" });

    expect(beginBatch).not.toHaveBeenCalled();
    expect(endBatch).not.toHaveBeenCalled();
  });
});
