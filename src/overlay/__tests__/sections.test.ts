// @vitest-environment happy-dom
import { describe, it, expect, vi } from "vitest";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import type { SectionCtx } from "../panelUtils";
import type { UnitConversionContext } from "../unitConversion";
import type { SpacingValues } from "../core/infer";

// ─── Mock SectionCtx ─────────────────────────────────────────────────

function makeMockCtx(): SectionCtx {
  const element = document.createElement("div");
  element.style.display = "flex";
  element.style.width = "200px";
  element.style.height = "100px";
  element.style.padding = "10px";
  element.style.margin = "8px";
  element.style.fontSize = "16px";
  element.style.color = "rgb(0, 0, 0)";
  element.style.backgroundColor = "rgb(255, 255, 255)";
  element.style.borderWidth = "1px";
  element.style.borderStyle = "solid";
  element.style.borderColor = "rgb(0, 0, 0)";
  document.body.appendChild(element);

  const cs = getComputedStyle(element);

  return {
    element,
    apply: vi.fn(),
    reset: vi.fn(),
    resetRead: () => 0,
    resetReadStr: () => "",
    ind: () => "none",
    sectionInd: () => "none",
    cs,
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

// ─── Mock spacing values ─────────────────────────────────────────────

function makeMockSpacing(): SpacingValues {
  return {
    margin: { top: 8, right: 8, bottom: 8, left: 8 },
    padding: { top: 10, right: 10, bottom: 10, left: 10 },
  };
}

// ─── Section smoke tests ─────────────────────────────────────────────

describe("Section components render without throwing", () => {
  it("LayoutSection renders without throwing", async () => {
    const { LayoutSection } = await import("../sections/LayoutSection");
    const ctx = makeMockCtx();
    expect(() => {
      renderToString(
        createElement(LayoutSection, {
          ctx,
          display: "flex",
          onDisplayChange: vi.fn(),
          columnGap: 0,
          columnGapUnit: "px",
          onColumnGapChange: vi.fn(),
          onColumnGapUnitChange: vi.fn(),
          isFlex: true,
          isGrid: false,
          parentIsFlex: false,
          parentIsGrid: false,
        }),
      );
    }).not.toThrow();
  });

  it("SpacingSection renders without throwing", async () => {
    const { SpacingSection } = await import("../sections/SpacingSection");
    const ctx = makeMockCtx();
    expect(() => {
      renderToString(
        createElement(SpacingSection, {
          ctx,
          spacing: makeMockSpacing(),
          onSpacingChange: vi.fn(),
        }),
      );
    }).not.toThrow();
  });

  it("SizeSection renders without throwing", async () => {
    const { SizeSection } = await import("../sections/SizeSection");
    const ctx = makeMockCtx();
    expect(() => {
      renderToString(
        createElement(SizeSection, {
          ctx,
          display: "flex",
          isMedia: false,
        }),
      );
    }).not.toThrow();
  });

  it("PositionSection renders without throwing", async () => {
    const { PositionSection } = await import("../sections/PositionSection");
    const ctx = makeMockCtx();
    expect(() => {
      renderToString(createElement(PositionSection, { ctx }));
    }).not.toThrow();
  });

  it("TypographySection renders without throwing", async () => {
    const { TypographySection } = await import("../sections/TypographySection");
    const ctx = makeMockCtx();
    expect(() => {
      renderToString(
        createElement(TypographySection, {
          ctx,
          columnGap: 0,
          columnGapUnit: "px",
          onColumnGapChange: vi.fn(),
          onColumnGapUnitChange: vi.fn(),
        }),
      );
    }).not.toThrow();
  });

  it("BackgroundsSection renders without throwing", async () => {
    const { BackgroundsSection } = await import("../sections/BackgroundsSection");
    const ctx = makeMockCtx();
    expect(() => {
      renderToString(createElement(BackgroundsSection, { ctx }));
    }).not.toThrow();
  });

  it("BordersSection renders without throwing", async () => {
    const { BordersSection } = await import("../sections/BordersSection");
    const ctx = makeMockCtx();
    expect(() => {
      renderToString(createElement(BordersSection, { ctx }));
    }).not.toThrow();
  });

  it("EffectsSection renders without throwing", async () => {
    const { EffectsSection } = await import("../sections/EffectsSection");
    const ctx = makeMockCtx();
    expect(() => {
      renderToString(createElement(EffectsSection, { ctx }));
    }).not.toThrow();
  });
});

// ─── Export verification ─────────────────────────────────────────────

describe("Section components export correctly", () => {
  it("LayoutSection is a function", async () => {
    const mod = await import("../sections/LayoutSection");
    expect(typeof mod.LayoutSection).toBe("object"); // memo wraps in object
    expect(typeof (mod.LayoutSection as unknown as { type: unknown }).type).toBe("function");
  });

  it("SpacingSection is a function", async () => {
    const mod = await import("../sections/SpacingSection");
    expect(typeof mod.SpacingSection).toBe("object");
    expect(typeof (mod.SpacingSection as unknown as { type: unknown }).type).toBe("function");
  });

  it("SizeSection is a function", async () => {
    const mod = await import("../sections/SizeSection");
    expect(typeof mod.SizeSection).toBe("object");
    expect(typeof (mod.SizeSection as unknown as { type: unknown }).type).toBe("function");
  });

  it("PositionSection is a function", async () => {
    const mod = await import("../sections/PositionSection");
    expect(typeof mod.PositionSection).toBe("object");
    expect(typeof (mod.PositionSection as unknown as { type: unknown }).type).toBe("function");
  });

  it("TypographySection is a function", async () => {
    const mod = await import("../sections/TypographySection");
    expect(typeof mod.TypographySection).toBe("object");
    expect(typeof (mod.TypographySection as unknown as { type: unknown }).type).toBe("function");
  });

  it("BackgroundsSection is a function", async () => {
    const mod = await import("../sections/BackgroundsSection");
    expect(typeof mod.BackgroundsSection).toBe("object");
    expect(typeof (mod.BackgroundsSection as unknown as { type: unknown }).type).toBe("function");
  });

  it("BordersSection is a function", async () => {
    const mod = await import("../sections/BordersSection");
    expect(typeof mod.BordersSection).toBe("object");
    expect(typeof (mod.BordersSection as unknown as { type: unknown }).type).toBe("function");
  });

  it("EffectsSection is a function", async () => {
    const mod = await import("../sections/EffectsSection");
    expect(typeof mod.EffectsSection).toBe("object");
    expect(typeof (mod.EffectsSection as unknown as { type: unknown }).type).toBe("function");
  });
});
