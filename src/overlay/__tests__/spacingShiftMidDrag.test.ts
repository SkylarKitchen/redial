// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import { SpacingBoxModel } from "../sections/SpacingBoxModel";

/**
 * Reproduction test: pressing Shift MID-DRAG should link all 4 sides.
 *
 * Bug: shiftHeldRef is captured once at pointerdown and never updated,
 * so pressing Shift after the drag starts has no effect on side-linking.
 * The user expects: start dragging padding-left → press Shift → all 4
 * padding sides update together.
 */

describe("SpacingBoxModel shift mid-drag linking", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => { root.unmount(); });
    container.remove();
  });

  const stubElement = document.createElement("div");
  const stubInd = () => "none" as const;

  function renderBoxModel(onChange: ReturnType<typeof vi.fn>) {
    act(() => {
      root.render(
        createElement(SpacingBoxModel, {
          margin: { top: 0, right: 0, bottom: 0, left: 0 },
          padding: { top: 0, right: 0, bottom: 0, left: 56 },
          onChange,
          marginUnit: "px",
          paddingUnit: "px",
          marginUnits: ["px", "%", "em", "rem"],
          paddingUnits: ["px", "%", "em", "rem"],
          onMarginUnitChange: vi.fn(),
          onPaddingUnitChange: vi.fn(),
          element: stubElement,
          ind: stubInd,
        }),
      );
    });
  }

  function findCell(prop: string): HTMLElement {
    const cell = container.querySelector<HTMLElement>(`[data-spacing-prop="${prop}"]`);
    if (!cell) throw new Error(`Cell for ${prop} not found`);
    return cell;
  }

  it("should update all 4 padding sides when Shift is pressed mid-drag", () => {
    const onChange = vi.fn();
    renderBoxModel(onChange);

    const cell = findCell("padding-left");

    // 1) pointerdown WITHOUT shift (user starts a normal drag)
    act(() => {
      cell.dispatchEvent(new PointerEvent("pointerdown", {
        bubbles: true, button: 0,
        clientX: 100, clientY: 50,
        shiftKey: false,
      }));
    });

    // 2) pointermove beyond dead zone (3px) WITH shiftKey = true
    //    (user pressed Shift while already dragging)
    act(() => {
      cell.dispatchEvent(new PointerEvent("pointermove", {
        bubbles: true,
        clientX: 110, clientY: 50,
        shiftKey: true,
      }));
    });

    // 3) Expect onChange called for ALL 4 padding sides (linked by shift)
    const calledProps = onChange.mock.calls.map((c: unknown[]) => c[0]);
    expect(calledProps).toContain("padding-top");
    expect(calledProps).toContain("padding-right");
    expect(calledProps).toContain("padding-bottom");
    expect(calledProps).toContain("padding-left");
  });

  it("should update axis pair when Alt is pressed mid-drag", () => {
    const onChange = vi.fn();
    renderBoxModel(onChange);

    const cell = findCell("padding-left");

    // pointerdown WITHOUT alt
    act(() => {
      cell.dispatchEvent(new PointerEvent("pointerdown", {
        bubbles: true, button: 0,
        clientX: 100, clientY: 50,
        altKey: false,
      }));
    });

    // pointermove beyond dead zone WITH altKey = true (pressed mid-drag)
    act(() => {
      cell.dispatchEvent(new PointerEvent("pointermove", {
        bubbles: true,
        clientX: 110, clientY: 50,
        altKey: true,
      }));
    });

    // Expect onChange called for the axis pair: padding-left + padding-right
    const calledProps = onChange.mock.calls.map((c: unknown[]) => c[0]);
    expect(calledProps).toContain("padding-left");
    expect(calledProps).toContain("padding-right");
    // Should NOT have called top/bottom (that's shift, not alt)
    expect(calledProps).not.toContain("padding-top");
    expect(calledProps).not.toContain("padding-bottom");
  });

  it("should allow toggling shift off mid-drag to return to single-side", () => {
    const onChange = vi.fn();
    renderBoxModel(onChange);

    const cell = findCell("padding-left");

    // pointerdown WITH shift (starts linked)
    act(() => {
      cell.dispatchEvent(new PointerEvent("pointerdown", {
        bubbles: true, button: 0,
        clientX: 100, clientY: 50,
        shiftKey: true,
      }));
    });

    // First move with shift — should update all 4
    act(() => {
      cell.dispatchEvent(new PointerEvent("pointermove", {
        bubbles: true,
        clientX: 110, clientY: 50,
        shiftKey: true,
      }));
    });

    const firstBatchProps = onChange.mock.calls.map((c: unknown[]) => c[0]);
    expect(firstBatchProps).toContain("padding-top");
    expect(firstBatchProps).toContain("padding-right");
    expect(firstBatchProps).toContain("padding-bottom");
    expect(firstBatchProps).toContain("padding-left");

    // Clear and move again WITHOUT shift — should update only padding-left
    onChange.mockClear();
    act(() => {
      cell.dispatchEvent(new PointerEvent("pointermove", {
        bubbles: true,
        clientX: 115, clientY: 50,
        shiftKey: false,
      }));
    });

    const secondBatchProps = onChange.mock.calls.map((c: unknown[]) => c[0]);
    expect(secondBatchProps).toEqual(["padding-left"]);
  });
});
