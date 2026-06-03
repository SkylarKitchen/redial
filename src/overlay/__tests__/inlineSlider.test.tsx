// @vitest-environment happy-dom
/**
 * inlineSlider.test.tsx — behavioral guard for the inline Slider that replaced
 * the shadcn/Radix Slider (shadcn migration, 2026-06-03).
 *
 * Guards the contract the call sites depend on:
 *   - keeps the array-based API (value={[n]} / onValueChange=([v]) => ...)
 *   - is a real <input type="range"> (so OverlayStyles thumb/track CSS applies)
 *   - forwards aria-label, min/max/step, and pointer handlers (batch begin/end)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import { fireEvent } from "@testing-library/react";
import { Slider } from "../controls/Slider";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function getInput(): HTMLInputElement {
  const input = container.querySelector('input[type="range"]');
  expect(input, "Slider must render a native range input").toBeTruthy();
  return input as HTMLInputElement;
}

describe("inline Slider", () => {
  it("renders a native range input reflecting the array value, min, max, step", () => {
    act(() => {
      root.render(
        createElement(Slider, { value: [42], min: 10, max: 200, step: 5, "aria-label": "Radius" }),
      );
    });
    const input = getInput();
    expect(input.value).toBe("42");
    expect(input.min).toBe("10");
    expect(input.max).toBe("200");
    expect(input.step).toBe("5");
    expect(input.getAttribute("aria-label")).toBe("Radius");
  });

  it("fires onValueChange with an array when the user drags", () => {
    const onValueChange = vi.fn();
    act(() => {
      root.render(createElement(Slider, { value: [10], min: 0, max: 100, onValueChange }));
    });
    const input = getInput();
    act(() => {
      fireEvent.change(input, { target: { value: "73" } });
    });
    expect(onValueChange).toHaveBeenCalledWith([73]);
  });

  it("forwards pointer handlers (used for undo-batch begin/end)", () => {
    const onPointerDown = vi.fn();
    const onPointerUp = vi.fn();
    act(() => {
      root.render(createElement(Slider, { value: [5], onPointerDown, onPointerUp }));
    });
    const input = getInput();
    act(() => {
      input.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
      input.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
    });
    expect(onPointerDown).toHaveBeenCalled();
    expect(onPointerUp).toHaveBeenCalled();
  });

  it("does not import shadcn/Radix", async () => {
    const { readFileSync } = await import("fs");
    const { join } = await import("path");
    const src = readFileSync(join(__dirname, "../controls/Slider.tsx"), "utf-8");
    // Match import statements, not prose in the file's doc comment.
    expect(src).not.toMatch(/from\s+["']@\/components\/ui/);
    expect(src).not.toMatch(/from\s+["']@?radix-ui/);
  });
});
