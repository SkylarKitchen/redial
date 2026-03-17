// @vitest-environment happy-dom
/**
 * sliderRowVariableMode.test.ts — Verifies that SliderRow in variable mode
 * does NOT fire onChange when the label is dragged.
 *
 * Bug: LabelScrub in variable mode had onChange={onChange} wired, so any
 * accidental 3px label drag called handleGapChange → setGapVar(null) → reset to px.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import { SliderRow } from "../controls/SliderRow";

// ─── Setup ───────────────────────────────────────────────────────────

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);

  if (!HTMLElement.prototype.setPointerCapture) {
    HTMLElement.prototype.setPointerCapture = vi.fn();
  }
  if (!HTMLElement.prototype.releasePointerCapture) {
    HTMLElement.prototype.releasePointerCapture = vi.fn();
  }
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

// ─── Helpers ──────────────────────────────────────────────────────────

function pointerDown(el: Element, x: number) {
  el.dispatchEvent(
    new PointerEvent("pointerdown", { clientX: x, button: 0, bubbles: true }),
  );
}

function pointerMove(el: Element, x: number) {
  el.dispatchEvent(
    new PointerEvent("pointermove", { clientX: x, bubbles: true }),
  );
}

function pointerUp(el: Element) {
  el.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
}

// ─── Tests ────────────────────────────────────────────────────────────

describe("SliderRow variable mode", () => {
  it("does NOT fire onChange when label is dragged while variable is active", () => {
    const onChange = vi.fn();

    act(() => {
      root.render(
        createElement(SliderRow, {
          label: "Gap",
          value: 20,
          min: 0,
          max: 200,
          step: 4,
          unit: "px",
          onChange,
          activeVariable: "--space-5",
          variableElement: document.body,
          computedProp: "gap",
          onSelectVariable: vi.fn(),
        }),
      );
    });

    // Find the label element (LabelScrub renders a <span> with cursor: ew-resize)
    const label = container.querySelector('span[style*="ew-resize"]');
    expect(label).toBeTruthy();

    // Simulate a drag: pointerdown, move past 3px dead zone, pointerup
    act(() => {
      pointerDown(label!, 100);
      pointerMove(label!, 110); // 10px > 3px dead zone
      pointerUp(label!);
    });

    // onChange should NOT have been called — variable mode label should be inert
    expect(onChange).not.toHaveBeenCalled();
  });

  it("renders VariableField pill when activeVariable is set", () => {
    act(() => {
      root.render(
        createElement(SliderRow, {
          label: "Gap",
          value: 20,
          min: 0,
          max: 200,
          step: 4,
          unit: "px",
          onChange: vi.fn(),
          activeVariable: "--space-5",
          variableElement: document.body,
          computedProp: "gap",
          onSelectVariable: vi.fn(),
        }),
      );
    });

    // Should NOT render a slider
    const slider = container.querySelector('[role="slider"]');
    expect(slider).toBeNull();

    // Should render the variable name text somewhere
    expect(container.textContent).toContain("space-5");
  });

  it("renders numeric mode (slider) when activeVariable is null", () => {
    act(() => {
      root.render(
        createElement(SliderRow, {
          label: "Gap",
          value: 20,
          min: 0,
          max: 200,
          step: 4,
          unit: "px",
          onChange: vi.fn(),
          activeVariable: null,
        }),
      );
    });

    // Should render a slider
    const slider = container.querySelector('[role="slider"]');
    expect(slider).toBeTruthy();
  });
});
