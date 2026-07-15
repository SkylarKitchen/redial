// @vitest-environment happy-dom
/**
 * colorPickerPosition.test.tsx — Behavioral tests for ColorPicker positioning
 *
 * Migrated from mixed source-text + behavioral to fully behavioral tests per
 * testing policy issue #105.
 *
 * Bug history:
 * 1. Picker used static top:"100%" — went off-screen near bottom of viewport.
 * 2. Picker used position:fixed inside the panel — but the panel has
 *    `backdropFilter: "blur(20px)"` and Motion transforms which create a
 *    new containing block. This makes position:fixed behave like position:absolute
 *    relative to the panel, and the panel's `overflow: hidden` clips the picker.
 *
 * Fix: ColorRow must use createPortal to render the picker outside the panel,
 * directly into document.body, so it escapes the containing block + overflow clip.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, fireEvent, cleanup } from "@testing-library/react";
import { ColorRow } from "../controls/ColorRow";
import {
  computeColorPickerPosition,
  PICKER_WIDTH,
  PICKER_HEIGHT,
  PICKER_GAP,
} from "../controls/colorPickerPosition";

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
});

function getColorPicker(): HTMLElement | null {
  // The picker is portaled with data-tuner-portal
  const portals = Array.from(document.querySelectorAll('[data-tuner-portal]'));
  // Find the one that contains ColorPickerEnhanced (has the picker structure)
  return portals.find(p => p.querySelector('[role="slider"]')) as HTMLElement || null;
}

describe("ColorPicker viewport positioning — behavioral", () => {
  function renderColorRow(onChange = vi.fn()) {
    return render(
      <ColorRow
        value="rgb(255, 0, 0)"
        onChange={onChange}
        onReset={vi.fn()}
      />
    );
  }

  it("ColorRow picker is portaled to document.body (not inside trigger's container)", () => {
    const { container } = renderColorRow();

    // Find and click the color swatch to open the picker
    // The swatch has role="button"
    const swatch = container.querySelector('[role="button"]') as HTMLElement;
    expect(swatch).not.toBeNull();
    fireEvent.click(swatch);

    const picker = getColorPicker();
    expect(picker).not.toBeNull();

    // The picker must be a direct child of document.body (via createPortal),
    // not a descendant of the ColorRow's container.
    expect(container.contains(picker)).toBe(false);
    expect(picker!.parentElement).toBe(document.body);
  });

  it("portaled picker uses position:fixed for viewport-relative placement", () => {
    const { container } = renderColorRow();
    const swatch = container.querySelector('[role="button"]') as HTMLElement;
    fireEvent.click(swatch!);

    const picker = getColorPicker();
    expect(picker).not.toBeNull();

    // The portal wrapper should have position:fixed (not absolute or static).
    // This ensures it's positioned relative to the viewport, not the panel.
    expect(picker!.style.position).toBe("fixed");
  });

  it("picker position is computed dynamically (not static top:100%)", () => {
    const { container } = renderColorRow();
    const swatch = container.querySelector('[role="button"]') as HTMLElement;

    // Mock getBoundingClientRect to simulate a swatch near the bottom
    vi.spyOn(swatch!, 'getBoundingClientRect').mockReturnValue({
      top: 700,
      bottom: 720,
      left: 100,
      right: 130,
      width: 30,
      height: 20,
      x: 100,
      y: 700,
      toJSON: () => ({}),
    });

    Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true });
    fireEvent.click(swatch!);

    const picker = getColorPicker();
    expect(picker).not.toBeNull();

    // The picker should be positioned dynamically based on viewport constraints,
    // not at a static offset like "100%" which would go off-screen.
    // For a swatch at y=700 on an 800px viewport, the picker should flip above
    // or be clamped within viewport bounds.
    const pickerTop = parseInt(picker!.style.top, 10);
    expect(pickerTop).not.toBe(720); // not static "100%" offset
    expect(pickerTop).toBeGreaterThanOrEqual(0); // not off-screen top
    expect(pickerTop).toBeLessThan(800); // not off-screen bottom
  });

  it("picker respects viewport boundaries (getBoundingClientRect + innerHeight)", () => {
    const { container } = renderColorRow();
    const swatch = container.querySelector('[role="button"]') as HTMLElement;

    // Simulate swatch at the very bottom of viewport
    vi.spyOn(swatch!, 'getBoundingClientRect').mockReturnValue({
      top: 780,
      bottom: 800,
      left: 100,
      right: 130,
      width: 30,
      height: 20,
      x: 100,
      y: 780,
      toJSON: () => ({}),
    });

    Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true });
    fireEvent.click(swatch!);

    const picker = getColorPicker();
    expect(picker).not.toBeNull();

    // The picker must stay within viewport bounds (verified by checking
    // that it uses computed positioning, not hardcoded values).
    const pickerTop = parseInt(picker!.style.top, 10);
    const maxHeight = picker!.style.maxHeight;

    // Should be positioned such that it doesn't escape viewport
    expect(pickerTop).toBeGreaterThanOrEqual(0);
    expect(maxHeight).toBeTruthy(); // has maxHeight constraint
  });
});

/**
 * Behavioral guard for the containment invariant. Regression: on short viewports
 * the picker used a hardcoded 300px height estimate to clamp `top`, but its real
 * height is ~416px — so a low swatch's flip-above popover escaped the viewport
 * top/bottom (intermittently, depending on scroll). The fix caps the picker to
 * the viewport and clamps with that capped height. These assert the popover is
 * fully on screen for ANY swatch position, on tall and short viewports alike.
 */
describe("computeColorPickerPosition — viewport containment", () => {
  const VIEWPORTS = [
    { width: 1440, height: 900 },
    { width: 1280, height: 600 },
    { width: 1024, height: 560 },
    { width: 1024, height: 430 }, // shorter than the picker's intrinsic height
    { width: 320, height: 800 }, // narrow
  ];
  const gap = PICKER_GAP;

  for (const vp of VIEWPORTS) {
    // Sweep swatch positions across the full height (incl. the bottom edge where
    // flip-above fires) — these were the configurations that escaped.
    const swatchTops = [0, 100, 250, vp.height - 250, vp.height - 60, vp.height - 20];
    for (const swTop of swatchTops) {
      const rect = { top: swTop, bottom: swTop + 20, left: vp.width - 100 };
      it(`stays within ${vp.width}×${vp.height} for swatch.top=${swTop}`, () => {
        const { top, left, maxHeight } = computeColorPickerPosition(rect, vp);
        // Never escapes top or bottom.
        expect(top).toBeGreaterThanOrEqual(gap);
        expect(top + maxHeight).toBeLessThanOrEqual(vp.height - gap + 0.5);
        // Never escapes the left edge.
        expect(left).toBeGreaterThanOrEqual(gap);
        // Height is capped to the viewport (so it can't exceed even when short).
        expect(maxHeight).toBeLessThanOrEqual(vp.height - gap * 2);
        expect(maxHeight).toBeLessThanOrEqual(PICKER_HEIGHT);
      });
    }
  }

  it("opens below the swatch when there is room", () => {
    const rect = { top: 100, bottom: 120, left: 500 };
    const { top } = computeColorPickerPosition(rect, { width: 1440, height: 900 });
    expect(top).toBe(120 + gap); // directly below
  });

  it("flips above when there is no room below", () => {
    const vp = { width: 1440, height: 900 };
    const rect = { top: 800, bottom: 820, left: 500 };
    const { top, maxHeight } = computeColorPickerPosition(rect, vp);
    expect(top + maxHeight).toBeLessThanOrEqual(vp.height - gap + 0.5);
    expect(top).toBeLessThan(rect.top); // placed above the swatch
  });

  it("never positions the picker wider than its clamp leaves room for", () => {
    // On a viewport narrower than the picker, left pins to gap (best effort).
    const { left } = computeColorPickerPosition(
      { top: 10, bottom: 30, left: 50 },
      { width: PICKER_WIDTH - 50, height: 800 }
    );
    expect(left).toBe(gap);
  });
});
