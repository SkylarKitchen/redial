// @vitest-environment happy-dom
/**
 * ColorPickerEnhanced keyboard accessibility.
 *
 * The saturation/brightness canvas, hue slider, and opacity slider used to be
 * mouse-only divs with decorative aria-labels — color editing was impossible
 * by keyboard. This pins down that they are now real ARIA sliders that respond
 * to arrow keys.
 *
 * Verified here:
 *   (a) The hue slider exposes role="slider" with aria-valuemax 360.
 *   (b) ArrowRight on the focused hue slider increases its aria-valuenow.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, act, cleanup, fireEvent } from "@testing-library/react";
import { ColorPickerEnhanced } from "../controls/ColorPickerEnhanced";

afterEach(() => cleanup());

function renderPicker() {
  // Start at hue 0 (#ff0000) so ArrowRight has headroom to increase.
  return render(
    <ColorPickerEnhanced
      color="#ff0000"
      opacity={1}
      onChange={vi.fn()}
      onClose={vi.fn()}
    />,
  );
}

describe("ColorPickerEnhanced hue slider — keyboard", () => {
  it("hue slider has role='slider' with aria-valuemax 360", () => {
    const { getByLabelText } = renderPicker();
    const hue = getByLabelText("Hue");
    expect(hue.getAttribute("role")).toBe("slider");
    expect(hue.getAttribute("aria-valuemax")).toBe("360");
    expect(hue.getAttribute("aria-valuemin")).toBe("0");
    // Focusable via keyboard
    expect(hue.getAttribute("tabindex")).toBe("0");
  });

  it("ArrowRight increases the hue slider's aria-valuenow", () => {
    const { getByLabelText } = renderPicker();
    const hue = getByLabelText("Hue");
    const before = Number(hue.getAttribute("aria-valuenow"));
    act(() => {
      fireEvent.keyDown(hue, { key: "ArrowRight" });
    });
    const after = Number(getByLabelText("Hue").getAttribute("aria-valuenow"));
    expect(after).toBeGreaterThan(before);
  });

  it("Shift+ArrowRight steps the hue by 10", () => {
    const { getByLabelText } = renderPicker();
    const before = Number(getByLabelText("Hue").getAttribute("aria-valuenow"));
    act(() => {
      fireEvent.keyDown(getByLabelText("Hue"), { key: "ArrowRight", shiftKey: true });
    });
    const after = Number(getByLabelText("Hue").getAttribute("aria-valuenow"));
    expect(after - before).toBe(10);
  });

  it("hue clamps at 0 with ArrowLeft", () => {
    const { getByLabelText } = renderPicker(); // hue starts at 0
    act(() => {
      fireEvent.keyDown(getByLabelText("Hue"), { key: "ArrowLeft" });
    });
    expect(Number(getByLabelText("Hue").getAttribute("aria-valuenow"))).toBe(0);
  });
});

describe("ColorPickerEnhanced opacity + canvas — keyboard", () => {
  it("opacity slider is a slider clamped 0..100", () => {
    const { getByLabelText } = renderPicker();
    const op = getByLabelText("Opacity");
    expect(op.getAttribute("role")).toBe("slider");
    expect(op.getAttribute("aria-valuemax")).toBe("100");
    expect(op.getAttribute("aria-valuenow")).toBe("100");
  });

  it("ArrowLeft decreases opacity aria-valuenow by 1", () => {
    const { getByLabelText } = renderPicker(); // opacity 100
    act(() => {
      fireEvent.keyDown(getByLabelText("Opacity"), { key: "ArrowLeft" });
    });
    expect(Number(getByLabelText("Opacity").getAttribute("aria-valuenow"))).toBe(99);
  });

  it("saturation/brightness canvas is a focusable slider", () => {
    const { getByLabelText } = renderPicker();
    const canvas = getByLabelText("Saturation and brightness");
    expect(canvas.getAttribute("role")).toBe("slider");
    expect(canvas.getAttribute("tabindex")).toBe("0");
  });

  it("ArrowDown on the canvas decreases brightness (aria-valuetext)", () => {
    const { getByLabelText } = renderPicker(); // #ff0000 → s=100, b=100
    const canvas = getByLabelText("Saturation and brightness");
    act(() => {
      fireEvent.keyDown(canvas, { key: "ArrowDown" });
    });
    // Brightness should drop from 100% toward 99%
    expect(getByLabelText("Saturation and brightness").getAttribute("aria-valuetext"))
      .toContain("brightness 99%");
  });
});
