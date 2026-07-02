// @vitest-environment happy-dom
/**
 * GradientEditor stop bar — keyboard accessibility (issue #85 follow-up).
 *
 * Stops were drag-only (<div onMouseDown>) and the bar was click-only
 * (click to add a stop). Keyboard equivalent:
 *   - each stop marker is a focusable role="slider" with aria-value* attrs
 *   - focusing a marker selects its stop (opens the stop controls)
 *   - Arrow keys nudge position ±1 (Shift = ±10), Home/End jump to 0/100
 *   - Enter/Space select the stop explicitly
 *   - Delete/Backspace remove the stop (min 2 stops enforced, like mouse)
 *   - the bar itself is focusable; Enter adds a stop (mouse: click-to-add
 *     at pointer position; keyboard: added at the 50% midpoint)
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, fireEvent, cleanup } from "@testing-library/react";
import { GradientEditor, type GradientStop } from "../sections/GradientEditor";

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
});

const TWO_STOPS: GradientStop[] = [
  { color: "#ff0000", position: 0 },
  { color: "#0000ff", position: 100 },
];

const THREE_STOPS: GradientStop[] = [
  { color: "#ff0000", position: 0 },
  { color: "#00ff00", position: 50 },
  { color: "#0000ff", position: 100 },
];

function renderEditor(stops: GradientStop[] = TWO_STOPS, onChange = vi.fn()) {
  const utils = render(
    <GradientEditor type="linear" angle={90} stops={stops} onChange={onChange} />,
  );
  const markers = Array.from(
    utils.container.querySelectorAll("[data-marker]"),
  ) as HTMLElement[];
  return { ...utils, markers, onChange };
}

describe("GradientEditor stop markers a11y", () => {
  it("markers are focusable sliders with aria-value attributes", () => {
    const { markers } = renderEditor();
    expect(markers.length).toBe(2);
    for (const m of markers) {
      expect(m.getAttribute("role")).toBe("slider");
      expect(m.tabIndex).toBe(0);
      expect(m.getAttribute("aria-valuemin")).toBe("0");
      expect(m.getAttribute("aria-valuemax")).toBe("100");
      expect(m.getAttribute("aria-label")).toBeTruthy();
    }
    expect(markers[0].getAttribute("aria-valuenow")).toBe("0");
    expect(markers[1].getAttribute("aria-valuenow")).toBe("100");
    markers[0].focus();
    expect(document.activeElement).toBe(markers[0]);
  });

  it("focusing a marker selects its stop (stop controls appear)", () => {
    const { markers, container } = renderEditor();
    expect(container.querySelector('input[type="number"]')).toBeNull();
    fireEvent.focus(markers[1]);
    const posInput = container.querySelector('input[type="number"]') as HTMLInputElement;
    expect(posInput).toBeTruthy();
    expect(posInput.value).toBe("100");
  });

  it("ArrowRight/ArrowLeft nudge the stop position by 1 (clamped 0–100)", () => {
    const { markers, onChange } = renderEditor(THREE_STOPS);
    fireEvent.keyDown(markers[1], { key: "ArrowRight" });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        stops: [
          expect.objectContaining({ position: 0 }),
          expect.objectContaining({ position: 51 }),
          expect.objectContaining({ position: 100 }),
        ],
      }),
    );
    fireEvent.keyDown(markers[1], { key: "ArrowLeft" });
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        stops: expect.arrayContaining([expect.objectContaining({ position: 49 })]),
      }),
    );
    // Clamp at the edges
    fireEvent.keyDown(markers[0], { key: "ArrowLeft" });
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        stops: expect.arrayContaining([expect.objectContaining({ position: 0 })]),
      }),
    );
  });

  it("Shift+Arrow nudges by 10; Home/End jump to 0/100", () => {
    const { markers, onChange } = renderEditor(THREE_STOPS);
    fireEvent.keyDown(markers[1], { key: "ArrowRight", shiftKey: true });
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        stops: expect.arrayContaining([expect.objectContaining({ position: 60 })]),
      }),
    );
    fireEvent.keyDown(markers[1], { key: "Home" });
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        stops: expect.arrayContaining([expect.objectContaining({ position: 0, color: "#00ff00" })]),
      }),
    );
    fireEvent.keyDown(markers[1], { key: "End" });
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        stops: expect.arrayContaining([expect.objectContaining({ position: 100, color: "#00ff00" })]),
      }),
    );
  });

  it("Enter/Space select the stop", () => {
    const { markers, container } = renderEditor();
    fireEvent.keyDown(markers[0], { key: "Enter" });
    expect(container.querySelector('input[type="number"]')).toBeTruthy();
  });

  it("Delete removes the stop when more than 2 remain; blocked at 2", () => {
    const three = renderEditor(THREE_STOPS);
    fireEvent.keyDown(three.markers[1], { key: "Delete" });
    expect(three.onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        stops: [
          expect.objectContaining({ position: 0 }),
          expect.objectContaining({ position: 100 }),
        ],
      }),
    );
    cleanup();
    const two = renderEditor(TWO_STOPS);
    fireEvent.keyDown(two.markers[0], { key: "Delete" });
    expect(two.onChange).not.toHaveBeenCalled();
  });

  it("mouse drag path unchanged: mousedown selects without emitting", () => {
    const { markers, onChange, container } = renderEditor();
    fireEvent.mouseDown(markers[0]);
    expect(onChange).not.toHaveBeenCalled();
    expect(container.querySelector('input[type="number"]')).toBeTruthy();
  });
});

describe("GradientEditor bar keyboard add-stop", () => {
  it("bar is focusable with an Add label; Enter adds a stop at the midpoint", () => {
    const { container, onChange } = renderEditor(TWO_STOPS);
    const bar = container.querySelector('[aria-label="Add gradient stop"]') as HTMLElement;
    expect(bar, "gradient bar must be keyboard-reachable to add stops").toBeTruthy();
    expect(bar.tabIndex).toBe(0);
    expect(bar.getAttribute("role")).toBe("button");
    fireEvent.keyDown(bar, { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        stops: [
          expect.objectContaining({ position: 0 }),
          expect.objectContaining({ position: 100 }),
          expect.objectContaining({ position: 50 }),
        ],
      }),
    );
  });

  it("mouse click-to-add still works (unchanged)", () => {
    const { container, onChange } = renderEditor(TWO_STOPS);
    const bar = container.querySelector('[aria-label="Add gradient stop"]') as HTMLElement;
    fireEvent.click(bar, { clientX: 0 });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        stops: expect.arrayContaining([expect.objectContaining({ color: "#ffffff" })]),
      }),
    );
  });
});
