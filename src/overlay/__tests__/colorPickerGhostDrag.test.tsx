// @vitest-environment happy-dom
/**
 * ColorPickerEnhanced ghost-drag protection (issue #73).
 *
 * `startDrag` calls `beginBatch()` and relies solely on a document `mouseup`
 * to call `endBatch()`. If the release is lost — window blurred mid-drag
 * (Cmd+Tab), pointer canceled, or the picker unmounted (Cmd+Z remounts the
 * panel) — the batch stays permanently open and every subsequent edit
 * silently coalesces into one giant undo entry.
 *
 * These tests pin down that every terminal event closes the batch exactly
 * once, mirroring the LabelScrub ghost-drag pattern.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup, fireEvent } from "@testing-library/react";
import { ColorPickerEnhanced } from "../controls/ColorPickerEnhanced";
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

function renderPicker() {
  return render(
    <ColorPickerEnhanced
      color="#ff0000"
      opacity={1}
      onChange={vi.fn()}
      onClose={vi.fn()}
    />,
  );
}

/** Start a drag on the hue slider without releasing the mouse. */
function startHueDrag(getByLabelText: (label: string) => HTMLElement) {
  fireEvent.mouseDown(getByLabelText("Hue"), { clientX: 10, clientY: 5 });
  expect(beginBatch).toHaveBeenCalledTimes(1);
  expect(endBatch).not.toHaveBeenCalled();
}

describe("ColorPickerEnhanced ghost-drag protection", () => {
  it("closes the undo batch when the window blurs mid-drag (lost mouseup)", () => {
    const { getByLabelText } = renderPicker();
    startHueDrag(getByLabelText);

    // Cmd+Tab mid-drag: blur fires, mouseup never does.
    fireEvent(window, new Event("blur"));

    expect(endBatch).toHaveBeenCalledTimes(1);
  });

  it("closes the undo batch on pointercancel without a pointerup", () => {
    const { getByLabelText } = renderPicker();
    startHueDrag(getByLabelText);

    fireEvent(document, new Event("pointercancel"));

    expect(endBatch).toHaveBeenCalledTimes(1);
  });

  it("closes the undo batch when Escape is pressed mid-drag", () => {
    const { getByLabelText } = renderPicker();
    startHueDrag(getByLabelText);

    fireEvent.keyDown(window, { key: "Escape" });

    expect(endBatch).toHaveBeenCalledTimes(1);
  });

  it("closes the undo batch when the picker unmounts mid-drag", () => {
    const { getByLabelText, unmount } = renderPicker();
    startHueDrag(getByLabelText);

    // Cmd+Z triggers a panelKey remount — the picker unmounts mid-drag.
    unmount();

    expect(endBatch).toHaveBeenCalledTimes(1);
  });

  it("never double-closes: a late mouseup after blur is a no-op", () => {
    const { getByLabelText } = renderPicker();
    startHueDrag(getByLabelText);

    fireEvent(window, new Event("blur"));
    fireEvent.mouseUp(document);

    expect(beginBatch).toHaveBeenCalledTimes(1);
    expect(endBatch).toHaveBeenCalledTimes(1);
  });

  it("stops applying color changes after a ghost-drag ends (orphaned mousemove)", () => {
    const onChange = vi.fn();
    const { getByLabelText } = render(
      <ColorPickerEnhanced
        color="#ff0000"
        opacity={1}
        onChange={onChange}
        onClose={vi.fn()}
      />,
    );
    fireEvent.mouseDown(getByLabelText("Hue"), { clientX: 10, clientY: 5 });
    fireEvent(window, new Event("blur"));
    onChange.mockClear();

    // Buttons are up; no mousemove listener should still be live.
    fireEvent.mouseMove(document, { clientX: 50, clientY: 5 });

    expect(onChange).not.toHaveBeenCalled();
  });

  it("normal drag lifecycle still opens and closes exactly one batch", () => {
    const { getByLabelText } = renderPicker();
    startHueDrag(getByLabelText);

    fireEvent.mouseMove(document, { clientX: 30, clientY: 5 });
    fireEvent.mouseUp(document);

    expect(beginBatch).toHaveBeenCalledTimes(1);
    expect(endBatch).toHaveBeenCalledTimes(1);
  });
});
