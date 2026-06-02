// @vitest-environment happy-dom
/**
 * spacingBoxModelAltClickReset.test.tsx — Behavioral regression for the
 * Option(Alt)+click reset on the Spacing box model.
 *
 * BUG (reported 2026-06-02): the box-model value cells advertise
 * "⌥ click to reset" in their tooltip, but Alt+click instead COPIED the
 * value to the opposite side (padding-top → padding-bottom). The existing
 * spacing-reset.test.ts only checks source text (an `altKey` branch exists,
 * `resetAndReadNum` is imported), so it stayed green while the feature was
 * broken in the browser.
 *
 * This test fires a real Alt+click (pointerdown → pointerup, no drag) and
 * asserts the property is actually RESET — not copied to its partner.
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from "vitest";
import { render, fireEvent, cleanup } from "@testing-library/react";
import { SpacingBoxModel } from "../sections/SpacingBoxModel";
import { applyInlineStyle, isDirty, resetAll } from "../core/apply";
import { SPACING_UNITS } from "../panelConstants";

beforeAll(() => {
  // happy-dom doesn't implement pointer capture — the box model calls it in
  // onPointerDown, so polyfill it as a no-op or the handler throws before it
  // can attach its pointerup listener.
  const proto = Element.prototype as unknown as Record<string, unknown>;
  if (!proto.setPointerCapture) proto.setPointerCapture = () => {};
  if (!proto.releasePointerCapture) proto.releasePointerCapture = () => {};
  if (!proto.hasPointerCapture) proto.hasPointerCapture = () => false;
});

afterEach(() => {
  cleanup();
  resetAll();
});

function renderBoxModel(element: Element, padding: { top: number; right: number; bottom: number; left: number }) {
  const onChange = vi.fn();
  const onReset = vi.fn();
  const utils = render(
    <SpacingBoxModel
      margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
      padding={padding}
      onChange={onChange}
      marginUnit="px"
      paddingUnit="px"
      marginUnits={SPACING_UNITS}
      paddingUnits={SPACING_UNITS}
      onMarginUnitChange={() => {}}
      onPaddingUnitChange={() => {}}
      element={element}
      ind={(prop) => (isDirty(element, prop) ? "modified" : "none") as never}
      onReset={onReset}
    />,
  );
  return { onChange, onReset, ...utils };
}

/** Alt+click = pointerdown then pointerup on the same cell with no movement. */
function altClick(cell: Element) {
  fireEvent.pointerDown(cell, { button: 0, altKey: true, pointerId: 1, clientX: 100, clientY: 100 });
  fireEvent.pointerUp(cell, { button: 0, altKey: true, pointerId: 1, clientX: 100, clientY: 100 });
}

describe("SpacingBoxModel — Option(Alt)+click resets the property", () => {
  let el: HTMLElement;

  beforeEach(() => {
    el = document.createElement("div");
    document.body.appendChild(el);
  });

  afterEach(() => {
    el.remove();
  });

  it("Alt+click on padding-top clears the inline override (does NOT copy to padding-bottom)", () => {
    applyInlineStyle(el, "padding-top", "28px");
    expect(isDirty(el, "padding-top")).toBe(true);

    const { onChange, onReset, container } = renderBoxModel(el, { top: 28, right: 0, bottom: 0, left: 0 });

    const cell = container.querySelector('[data-spacing-prop="padding-top"]');
    expect(cell, "padding-top cell should render").toBeTruthy();

    altClick(cell!);

    // The reset must propagate to the parent…
    expect(onReset).toHaveBeenCalledWith("padding-top", expect.any(Number));
    // …the inline override must actually be cleared…
    expect(el.style.paddingTop).toBe("");
    expect(isDirty(el, "padding-top")).toBe(false);
    // …and it must NOT have written the opposite side (the old "copy" bug).
    expect(onChange).not.toHaveBeenCalledWith("padding-bottom", expect.anything(), expect.anything());
  });

  it("Alt+click on margin-left clears the inline override (does NOT copy to margin-right)", () => {
    applyInlineStyle(el, "margin-left", "16px");
    expect(isDirty(el, "margin-left")).toBe(true);

    const { onChange, onReset, container } = renderBoxModel(el, { top: 0, right: 0, bottom: 0, left: 0 });

    const cell = container.querySelector('[data-spacing-prop="margin-left"]');
    expect(cell).toBeTruthy();

    altClick(cell!);

    expect(onReset).toHaveBeenCalledWith("margin-left", expect.any(Number));
    expect(el.style.marginLeft).toBe("");
    expect(onChange).not.toHaveBeenCalledWith("margin-right", expect.anything(), expect.anything());
  });
});
