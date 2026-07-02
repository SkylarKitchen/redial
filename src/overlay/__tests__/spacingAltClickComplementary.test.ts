// @vitest-environment happy-dom
/**
 * spacingAltClickComplementary.test.ts
 *
 * Box-model Alt(Option) gesture contract (webflow-style-panel-spec.md §4,
 * resolved 2026-06-02 in favour of the panel-wide reset convention + the
 * box-model's own "⌥ click to reset" tooltip):
 *   - Alt+click on a VALUE cell → RESETS that property (it must NOT copy the
 *     value to the complementary side — that was the reported bug).
 *   - Alt+DRAG a value → adjusts the complementary axis pair together.
 *   - Alt+click on a CORNER zone → applies that side's value to all 4 sides.
 *
 * The full reset behaviour is covered by spacingBoxModelAltClickReset.test.tsx;
 * PART 1 here is an anti-regression guard that the old "copy to complementary"
 * gesture is gone. PART 2 verifies the corner-zone all-sides shortcut survives.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import { SpacingBoxModel } from "../sections/SpacingBoxModel";
import { applyInlineStyle, resetAll } from "../core/apply";

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
    onChange: (prop: string, value: number, unit: string) => void,
    overrides?: {
      margin?: { top: number; right: number; bottom: number; left: number };
      padding?: { top: number; right: number; bottom: number; left: number };
      element?: Element;
      onReset?: (prop: string, value: number) => void;
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
          element: overrides?.element ?? stubElement,
          ind: stubInd,
          onReset: overrides?.onReset,
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
  // PART 1: Alt+click on a value cell RESETS (must NOT copy to complementary)
  // Anti-regression for the 2026-06-02 bug where Alt+click copied the value
  // to the opposite side instead of resetting.
  // ═══════════════════════════════════════════════════════════════════

  afterEach(() => { resetAll(); });

  it("Alt+click margin-left resets it and does NOT copy to margin-right", () => {
    const el = document.createElement("div");
    document.body.appendChild(el);
    applyInlineStyle(el, "margin-left", "24px");
    const onChange = vi.fn();
    const onReset = vi.fn();
    renderBoxModel(onChange, {
      margin: { top: 0, right: 0, bottom: 0, left: 24 },
      element: el,
      onReset,
    });

    altClick(findCell("margin-left"));

    expect(onReset).toHaveBeenCalledWith("margin-left", expect.any(Number));
    expect(el.style.marginLeft).toBe("");
    const props = onChange.mock.calls.map((c: unknown[]) => c[0]);
    expect(props).not.toContain("margin-right");
    el.remove();
  });

  it("Alt+click padding-bottom resets it and does NOT copy to padding-top", () => {
    const el = document.createElement("div");
    document.body.appendChild(el);
    applyInlineStyle(el, "padding-bottom", "12px");
    const onChange = vi.fn();
    const onReset = vi.fn();
    renderBoxModel(onChange, {
      padding: { top: 0, right: 0, bottom: 12, left: 0 },
      element: el,
      onReset,
    });

    altClick(findCell("padding-bottom"));

    expect(onReset).toHaveBeenCalledWith("padding-bottom", expect.any(Number));
    expect(el.style.paddingBottom).toBe("");
    const props = onChange.mock.calls.map((c: unknown[]) => c[0]);
    expect(props).not.toContain("padding-top");
    el.remove();
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
