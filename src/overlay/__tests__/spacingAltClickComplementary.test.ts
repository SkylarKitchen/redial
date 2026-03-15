// @vitest-environment happy-dom
/**
 * spacingAltClickComplementary.test.ts
 *
 * Spec (webflow-style-panel-spec.md §4 lines 234–235):
 *   - Alt+click side label: applies value to both complementary sides
 *     (left+right or top+bottom)
 *   - Alt+click corner: applies value to all 4 sides
 *
 * Current behavior (BUG): Alt+click resets to default instead of copying.
 * Corner zones don't exist at all.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import { SpacingBoxModel } from "../sections/SpacingBoxModel";

describe("SpacingBoxModel Alt+click complementary-side shortcut", () => {
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

  function renderBoxModel(
    onChange: ReturnType<typeof vi.fn>,
    overrides?: {
      margin?: { top: number; right: number; bottom: number; left: number };
      padding?: { top: number; right: number; bottom: number; left: number };
    },
  ) {
    act(() => {
      root.render(
        createElement(SpacingBoxModel, {
          margin: overrides?.margin ?? { top: 16, right: 0, bottom: 16, left: 24 },
          padding: overrides?.padding ?? { top: 12, right: 8, bottom: 12, left: 20 },
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

  /**
   * Simulate a click (pointerdown + pointerup at the same position, no drag)
   * with the altKey modifier.
   */
  function altClick(cell: HTMLElement) {
    act(() => {
      cell.dispatchEvent(new PointerEvent("pointerdown", {
        bubbles: true, button: 0, clientX: 100, clientY: 50, altKey: true,
      }));
    });
    act(() => {
      cell.dispatchEvent(new PointerEvent("pointerup", {
        bubbles: true, button: 0, clientX: 100, clientY: 50, altKey: true,
      }));
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  // PART 1: Alt+click on side label → complementary sides
  // ═══════════════════════════════════════════════════════════════════

  it("Alt+click margin-left copies its value to margin-right", () => {
    const onChange = vi.fn();
    renderBoxModel(onChange, {
      margin: { top: 0, right: 0, bottom: 0, left: 24 },
    });

    altClick(findCell("margin-left"));

    // Should call onChange for BOTH margin-left and margin-right with left's value (24)
    const calls = onChange.mock.calls;
    const props = calls.map((c: unknown[]) => c[0]);

    expect(props).toContain("margin-right");
    // The value applied to margin-right should be margin-left's value (24)
    const rightCall = calls.find((c: unknown[]) => c[0] === "margin-right");
    expect(rightCall).toBeTruthy();
    expect(rightCall![1]).toBe(24);
  });

  it("Alt+click margin-top copies its value to margin-bottom", () => {
    const onChange = vi.fn();
    renderBoxModel(onChange, {
      margin: { top: 16, right: 0, bottom: 0, left: 0 },
    });

    altClick(findCell("margin-top"));

    const calls = onChange.mock.calls;
    const bottomCall = calls.find((c: unknown[]) => c[0] === "margin-bottom");
    expect(bottomCall).toBeTruthy();
    expect(bottomCall![1]).toBe(16);
  });

  it("Alt+click padding-right copies its value to padding-left", () => {
    const onChange = vi.fn();
    renderBoxModel(onChange, {
      padding: { top: 0, right: 8, bottom: 0, left: 0 },
    });

    altClick(findCell("padding-right"));

    const calls = onChange.mock.calls;
    const leftCall = calls.find((c: unknown[]) => c[0] === "padding-left");
    expect(leftCall).toBeTruthy();
    expect(leftCall![1]).toBe(8);
  });

  it("Alt+click padding-bottom copies its value to padding-top", () => {
    const onChange = vi.fn();
    renderBoxModel(onChange, {
      padding: { top: 0, right: 0, bottom: 12, left: 0 },
    });

    altClick(findCell("padding-bottom"));

    const calls = onChange.mock.calls;
    const topCall = calls.find((c: unknown[]) => c[0] === "padding-top");
    expect(topCall).toBeTruthy();
    expect(topCall![1]).toBe(12);
  });

  // ═══════════════════════════════════════════════════════════════════
  // PART 2: Alt+click on corner → all 4 sides
  // ═══════════════════════════════════════════════════════════════════

  function findCorner(group: "margin" | "padding", corner: string): HTMLElement {
    const el = container.querySelector<HTMLElement>(
      `[data-spacing-corner="${group}-${corner}"]`
    );
    if (!el) throw new Error(`Corner zone for ${group}-${corner} not found`);
    return el;
  }

  it("corner zones exist for both margin and padding boxes", () => {
    const onChange = vi.fn();
    renderBoxModel(onChange);

    for (const group of ["margin", "padding"] as const) {
      for (const corner of ["top-left", "top-right", "bottom-left", "bottom-right"]) {
        const el = container.querySelector(`[data-spacing-corner="${group}-${corner}"]`);
        expect(el, `Missing corner zone: ${group}-${corner}`).toBeTruthy();
      }
    }
  });

  it("Alt+click margin top-left corner applies margin-top value to all 4 margin sides", () => {
    const onChange = vi.fn();
    renderBoxModel(onChange, {
      margin: { top: 16, right: 0, bottom: 8, left: 24 },
    });

    const corner = findCorner("margin", "top-left");
    altClick(corner);

    const calls = onChange.mock.calls;
    const props = calls.map((c: unknown[]) => c[0]);

    // All 4 margin sides should be updated
    expect(props).toContain("margin-top");
    expect(props).toContain("margin-right");
    expect(props).toContain("margin-bottom");
    expect(props).toContain("margin-left");

    // Each should receive the top side's value (16)
    for (const call of calls) {
      expect(call[1]).toBe(16);
    }
  });

  it("Alt+click padding bottom-right corner applies padding-bottom value to all 4 padding sides", () => {
    const onChange = vi.fn();
    renderBoxModel(onChange, {
      padding: { top: 4, right: 8, bottom: 20, left: 12 },
    });

    const corner = findCorner("padding", "bottom-right");
    altClick(corner);

    const calls = onChange.mock.calls;
    const props = calls.map((c: unknown[]) => c[0]);

    expect(props).toContain("padding-top");
    expect(props).toContain("padding-right");
    expect(props).toContain("padding-bottom");
    expect(props).toContain("padding-left");

    // Bottom-right corner → uses "bottom" side's value (20)
    for (const call of calls) {
      expect(call[1]).toBe(20);
    }
  });
});
