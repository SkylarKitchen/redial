// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import { SpacingValuePopover } from "../SpacingValuePopover";
import { SpacingBoxModel } from "../SpacingBoxModel";

/**
 * Reproduction test: clicking preset buttons (0, 10, 20, 40, etc.)
 * in the SpacingValuePopover should call onChange with the preset value.
 *
 * Bug report: preset buttons "aren't working" — clicking them has no effect.
 */

describe("SpacingValuePopover preset buttons", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    // Unmount and clean up portal remnants
    act(() => { root.unmount(); });
    container.remove();
    // Portal renders to document.body — remove any leftover popover divs
    document.body.querySelectorAll("div").forEach((el) => {
      if (el.parentElement === document.body && el !== container) {
        el.remove();
      }
    });
  });

  function renderPopover(onChange: (v: number) => void, value = 0) {
    const anchorRect = new DOMRect(100, 100, 50, 24);

    act(() => {
      root.render(
        createElement(SpacingValuePopover, {
          value,
          onChange,
          unit: "px",
          units: ["px", "%", "em", "rem", "vw", "vh"],
          onUnitChange: vi.fn(),
          property: "margin-top",
          isMargin: true,
          anchorRect,
          onClose: vi.fn(),
        }),
      );
    });
  }

  /** Find all preset number buttons in the popover portal */
  function getPresetButtons(): HTMLButtonElement[] {
    const buttons = document.querySelectorAll<HTMLButtonElement>("button[type='button']");
    return Array.from(buttons).filter((btn) => {
      const text = btn.textContent?.trim();
      return text && !isNaN(Number(text));
    });
  }

  it("should call onChange when clicking a different preset", () => {
    const onChange = vi.fn();
    renderPopover(onChange);

    const presets = getPresetButtons();
    expect(presets.length).toBe(8); // 0, 10, 20, 40, 60, 100, 140, 220

    // Click "10" (different from current value of 0)
    const btn10 = presets.find((b) => b.textContent?.trim() === "10");
    expect(btn10).toBeDefined();
    act(() => { btn10!.click(); });
    expect(onChange).toHaveBeenCalledWith(10);
  });

  it("should call onChange when clicking preset matching current value", () => {
    const onChange = vi.fn();
    renderPopover(onChange); // value=0

    const presets = getPresetButtons();
    const btn0 = presets.find((b) => b.textContent?.trim() === "0");
    expect(btn0).toBeDefined();
    act(() => { btn0!.click(); });
    expect(onChange).toHaveBeenCalledWith(0);
  });

  it("should call onChange for preset 40 when current value is 0", () => {
    const onChange = vi.fn();
    renderPopover(onChange);

    const presets = getPresetButtons();
    const btn40 = presets.find((b) => b.textContent?.trim() === "40");
    expect(btn40).toBeDefined();
    act(() => { btn40!.click(); });
    expect(onChange).toHaveBeenCalledWith(40);
  });

  it("should call onChange for preset 10 when current value is 100", () => {
    const onChange = vi.fn();
    renderPopover(onChange, 100); // start at 100

    const presets = getPresetButtons();
    const btn10 = presets.find((b) => b.textContent?.trim() === "10");
    expect(btn10).toBeDefined();
    act(() => { btn10!.click(); });
    expect(onChange).toHaveBeenCalledWith(10);
  });
});
