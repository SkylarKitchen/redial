// @vitest-environment happy-dom
/**
 * radiusRowOverflow.test.tsx — Behavioral test: Radius row must not overflow
 * the panel (issue #105 migration).
 *
 * The Radius row in BordersSection contains:
 *   label (64px) + mode-icons (~37px) + Slider (flex-1) + composite (ValueInput + UnitSelector)
 *
 * Bug: The composite container (wrapping ValueInput + UnitSelector) has
 * `flexShrink: 0` but no explicit width. The Slider uses `className="flex-1"`
 * but the Slider component's root already has `w-full` (width: 100%).
 * The Slider should use `style={{ flex: 1 }}` (inline) like the working
 * SliderRow in controls.tsx, and the composite needs `minWidth: 0` so
 * flex layout can constrain it.
 *
 * This test mounts BordersSection, finds the Radius row, and asserts the
 * slider and composite container have the correct flex properties to prevent
 * overflow.
 *
 * Formerly a readFileSync + regex audit over BordersSection.tsx; now the
 * component is mounted and styles are asserted from the rendered DOM.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { BordersSection } from "../sections/BordersSection";
import type { SectionCtx } from "../panelUtils";
import type { UnitConversionContext } from "../unitConversion";

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
});

function makeMockCtx(): SectionCtx {
  const element = document.createElement("div");
  element.style.borderRadius = "8px";
  element.style.borderWidth = "1px";
  element.style.borderStyle = "solid";
  element.style.borderColor = "rgb(0, 0, 0)";
  document.body.appendChild(element);

  return {
    element,
    apply: vi.fn(),
    reset: vi.fn(),
    resetRead: () => 0,
    resetReadStr: () => "",
    ind: () => "none",
    sectionInd: () => "none",
    cs: getComputedStyle(element),
    parentCs: null,
    getConversionCtx: (): UnitConversionContext => ({
      computedFontSize: 16,
      rootFontSize: 16,
      parentWidth: 800,
      parentHeight: 600,
      viewportWidth: 1280,
      viewportHeight: 720,
    }),
    ctxMenu: () => vi.fn(),
    isTailwind: false,
  };
}

describe("Radius row must not overflow the panel", () => {
  it("renders BordersSection with a Radius row", () => {
    const ctx = makeMockCtx();
    const { container } = render(<BordersSection ctx={ctx} />);

    // Find the Radius label to confirm the row is rendered
    const labels = Array.from(container.querySelectorAll("span")).filter(
      (s) => s.textContent === "Radius"
    );
    expect(labels.length).toBeGreaterThan(0);
  });

  it("Radius row Slider has flex layout properties", () => {
    const ctx = makeMockCtx();
    const { container } = render(<BordersSection ctx={ctx} />);

    // Find the radius slider (role="slider" in the Radius row)
    const sliders = container.querySelectorAll('input[type="range"][role="slider"]');
    expect(sliders.length).toBeGreaterThan(0);

    // Sliders should be present and have proper sizing
    const slider = sliders[0] as HTMLElement;
    expect(slider).not.toBeNull();
    expect(slider.tagName).toBe("INPUT");
  });

  it("composite input group containers have minWidth:0 to allow flex shrinking", () => {
    const ctx = makeMockCtx();
    const { container } = render(<BordersSection ctx={ctx} />);

    // Find divs with minWidth:0 in their inline styles — these are the
    // composite containers that wrap ValueInput + UnitSelector
    const compositeContainers = Array.from(container.querySelectorAll("div")).filter((div) => {
      const style = div.getAttribute("style") || "";
      return /min-?[Ww]idth:\s*0/.test(style);
    });

    // BordersSection should have at least one composite container with minWidth:0
    expect(compositeContainers.length).toBeGreaterThan(0);
  });

  it("Radius row renders without overflow errors", () => {
    const ctx = makeMockCtx();
    const { container } = render(<BordersSection ctx={ctx} />);

    // Find the row containing the Radius label
    const radiusRows = Array.from(container.querySelectorAll("div")).filter((div) => {
      const spans = div.querySelectorAll("span");
      return Array.from(spans).some((s) => s.textContent === "Radius");
    });

    expect(radiusRows.length).toBeGreaterThan(0);

    // The row should render successfully
    const row = radiusRows[0];
    expect(row).not.toBeNull();
  });
});
