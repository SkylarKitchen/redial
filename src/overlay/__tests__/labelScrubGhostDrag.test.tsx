// @vitest-environment happy-dom
/**
 * LabelScrub ghost-drag protection — the two terminals its existing cleanup
 * misses (same family as issue #73, fixed in ColorPickerEnhanced / SliderRow).
 *
 * LabelScrub already closes the batch on pointerup / lostpointercapture /
 * window blur via a cleaned-once guard, but:
 *   - Escape mid-drag is not a terminal: the batch stays open until the next
 *     pointerup, silently coalescing subsequent edits.
 *   - A mid-drag unmount (Cmd+Z remounts the panel) removes the element the
 *     pointerup/lostpointercapture listeners live on, so the batch can never
 *     close.
 *
 * These tests pin down both terminals plus the normal lifecycle. The scrub
 * math itself is covered by labelScrub.test.ts and must not change.
 */
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from "vitest";
import { render, cleanup, fireEvent } from "@testing-library/react";
import { LabelScrub } from "../controls/LabelScrub";
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

function renderScrub() {
  const utils = render(
    <LabelScrub value={50} onChange={vi.fn()} step={1}>
      Width
    </LabelScrub>,
  );
  const label = utils.container.querySelector("span") as HTMLElement;
  expect(label, "LabelScrub must render its span").toBeTruthy();
  return { ...utils, label };
}

/** Pointer down + move past the 3px dead zone so the scrub (and batch) starts. */
function startScrub(label: HTMLElement) {
  fireEvent.pointerDown(label, { button: 0, clientX: 100 });
  // Listeners are attached natively to the captured element.
  label.dispatchEvent(
    new PointerEvent("pointermove", { bubbles: true, clientX: 120 }),
  );
  expect(beginBatch).toHaveBeenCalledTimes(1);
  expect(endBatch).not.toHaveBeenCalled();
}

describe("LabelScrub ghost-drag protection", () => {
  it("closes the undo batch when Escape is pressed mid-scrub", () => {
    const { label } = renderScrub();
    startScrub(label);

    fireEvent.keyDown(window, { key: "Escape" });

    expect(endBatch).toHaveBeenCalledTimes(1);
  });

  it("closes the undo batch when the label unmounts mid-scrub", () => {
    const { label, unmount } = renderScrub();
    startScrub(label);

    // Cmd+Z triggers a panelKey remount — the label unmounts mid-scrub and
    // the element-bound pointerup listener can never fire again.
    unmount();

    expect(endBatch).toHaveBeenCalledTimes(1);

    // A later window blur must not close the batch a second time.
    fireEvent(window, new Event("blur"));
    expect(endBatch).toHaveBeenCalledTimes(1);
  });

  it("never double-closes: a late pointerup after Escape is a no-op", () => {
    const { label } = renderScrub();
    startScrub(label);

    fireEvent.keyDown(window, { key: "Escape" });
    expect(endBatch).toHaveBeenCalledTimes(1); // Escape closed the batch

    label.dispatchEvent(
      new PointerEvent("pointerup", { bubbles: true, clientX: 120 }),
    );

    expect(beginBatch).toHaveBeenCalledTimes(1);
    expect(endBatch).toHaveBeenCalledTimes(1); // late release is a no-op
  });

  it("normal scrub lifecycle still opens and closes exactly one batch", () => {
    const { label } = renderScrub();
    startScrub(label);

    label.dispatchEvent(
      new PointerEvent("pointerup", { bubbles: true, clientX: 120 }),
    );

    expect(beginBatch).toHaveBeenCalledTimes(1);
    expect(endBatch).toHaveBeenCalledTimes(1);
  });

  it("Escape without an active scrub does not close anything", () => {
    renderScrub();

    fireEvent.keyDown(window, { key: "Escape" });

    expect(beginBatch).not.toHaveBeenCalled();
    expect(endBatch).not.toHaveBeenCalled();
  });
});
