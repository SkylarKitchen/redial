// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import { SpacingValuePopover } from "../sections/SpacingValuePopover";
import { SpacingBoxModel } from "../sections/SpacingBoxModel";

/**
 * Reproduction test: clicking preset buttons (0, 8, 16, 32, etc.)
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
    expect(presets.length).toBe(8); // 0, 8, 16, 32, 48, 64, 96, 128

    // Click "8" (different from current value of 0)
    const btn8 = presets.find((b) => b.textContent?.trim() === "8");
    expect(btn8).toBeDefined();
    act(() => { btn8!.click(); });
    expect(onChange).toHaveBeenCalledWith(8);
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

  it("should call onChange for preset 32 when current value is 0", () => {
    const onChange = vi.fn();
    renderPopover(onChange);

    const presets = getPresetButtons();
    const btn32 = presets.find((b) => b.textContent?.trim() === "32");
    expect(btn32).toBeDefined();
    act(() => { btn32!.click(); });
    expect(onChange).toHaveBeenCalledWith(32);
  });

  it("should call onChange for preset 8 when current value is 64", () => {
    const onChange = vi.fn();
    renderPopover(onChange, 64); // start at 64

    const presets = getPresetButtons();
    const btn8 = presets.find((b) => b.textContent?.trim() === "8");
    expect(btn8).toBeDefined();
    act(() => { btn8!.click(); });
    expect(onChange).toHaveBeenCalledWith(8);
  });
});

describe("SpacingBoxModel → popover → preset integration", () => {
  let container: HTMLDivElement;
  let root: Root;
  const stubElement = document.createElement("div");
  const stubInd = () => "none" as const;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => { root.unmount(); });
    container.remove();
    document.body.querySelectorAll("div").forEach((el) => {
      if (el.parentElement === document.body && el !== container) el.remove();
    });
  });

  it("should propagate preset click through to parent onChange", () => {
    const onChange = vi.fn();

    act(() => {
      root.render(
        createElement(SpacingBoxModel, {
          margin: { top: 0, right: 0, bottom: 0, left: 0 },
          padding: { top: 0, right: 0, bottom: 0, left: 0 },
          onChange,
          marginUnit: "px",
          paddingUnit: "px",
          marginUnits: ["px", "%", "em"],
          paddingUnits: ["px", "%", "em"],
          onMarginUnitChange: vi.fn(),
          onPaddingUnitChange: vi.fn(),
          element: stubElement,
          ind: stubInd,
        }),
      );
    });

    // Find the margin-top value cell (first spacing value rendered)
    const valueCells = container.querySelectorAll<HTMLElement>("[data-spacing-index]");
    expect(valueCells.length).toBeGreaterThan(0);

    const marginTopCell = valueCells[0]; // index 0 = margin-top

    // Simulate click to open popover (pointerdown + pointerup without drag)
    act(() => {
      marginTopCell.dispatchEvent(new PointerEvent("pointerdown", {
        bubbles: true, clientX: 50, clientY: 50, button: 0,
      }));
      marginTopCell.dispatchEvent(new PointerEvent("pointerup", {
        bubbles: true, clientX: 50, clientY: 50, button: 0,
      }));
    });

    // Popover should now be open — find preset buttons in the portal
    const presetButtons = Array.from(
      document.querySelectorAll<HTMLButtonElement>("button[type='button']"),
    ).filter((btn) => {
      const text = btn.textContent?.trim();
      return text && !isNaN(Number(text));
    });

    // If popover didn't open, the test will fail here with 0 buttons
    expect(presetButtons.length).toBe(8);

    // Click "16" preset
    const btn16 = presetButtons.find((b) => b.textContent?.trim() === "16");
    expect(btn16).toBeDefined();
    act(() => { btn16!.click(); });

    // onChange should have been called with (prop, value, unit)
    expect(onChange).toHaveBeenCalledWith("margin-top", 16, "px");
  });
});
