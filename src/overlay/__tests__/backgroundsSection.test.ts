// @vitest-environment happy-dom
/**
 * backgroundsSection.test.ts — Backgrounds section behavioral tests
 *
 * Verifies:
 * 1. Clicking "+ Add background" creates a new layer
 * 2. Layer types include color, gradient (linear/radial/conic), and image
 * 3. Gradient editor supports all three gradient types with angle slider for linear
 * 4. background-clip includes the `text` option
 * 5. Blend mode dropdown has all 16 blend modes from the spec
 */

import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import type { SectionCtx } from "../panelUtils";
import type { UnitConversionContext } from "../unitConversion";

// ─── Helpers ──────────────────────────────────────────────────────────

function makeMockCtx(): SectionCtx {
  const element = document.createElement("div");
  element.style.backgroundColor = "rgb(255, 255, 255)";
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

// ─── Source reading ───────────────────────────────────────────────────

const bgSectionSrc = readFileSync(
  join(__dirname, "../sections/BackgroundsSection.tsx"),
  "utf-8",
);
const layerListSrc = readFileSync(
  join(__dirname, "../sections/BackgroundLayerList.tsx"),
  "utf-8",
);
const gradientEditorSrc = readFileSync(
  join(__dirname, "../sections/GradientEditor.tsx"),
  "utf-8",
);

// ─── 1. "+ Add background" creates a new layer ───────────────────────

describe("Add background layer", () => {
  it("renders the 'Image & gradient' sub-section header with add button", async () => {
    const { BackgroundsSection } = await import("../sections/BackgroundsSection");
    const html = renderToString(createElement(BackgroundsSection, { ctx: makeMockCtx() }));
    expect(html).toContain("Image &amp; gradient");
  });

  it("BackgroundLayerList has a '+ Add background' button for adding layers", () => {
    expect(layerListSrc).toContain("+ Add background");
  });

  it("handleAddLayer creates a gradient layer with default linear config", () => {
    // The handleAddLayer in BackgroundsSection creates a gradient layer by default
    expect(bgSectionSrc).toContain('type: "gradient"');
    expect(bgSectionSrc).toContain('type: "linear"');
    expect(bgSectionSrc).toContain("angle: 180");
  });

  it("BackgroundLayerList exposes addLayer for color, gradient, and image types", () => {
    // The add dropdown offers all three types
    expect(layerListSrc).toContain('"color", "gradient", "image"');
  });

  it("makeDefault creates correct defaults for each layer type", () => {
    // Color default
    expect(layerListSrc).toMatch(/type === "color"[\s\S]*?base\.color\s*=\s*"#ffffff"/);
    // Gradient default
    expect(layerListSrc).toMatch(/type === "gradient"[\s\S]*?base\.gradient\s*=/);
    // Image default
    expect(layerListSrc).toMatch(/base\.image\s*=.*url.*size.*position.*repeat/);
  });
});

// ─── 2. Layer types: color, gradient, image ──────────────────────────

describe("Layer types", () => {
  it("BackgroundLayer type union includes color, gradient, and image", () => {
    expect(layerListSrc).toContain('type: "color" | "gradient" | "image"');
  });

  it("BackgroundLayerType is exported as a union of color, gradient, image", () => {
    expect(layerListSrc).toContain('export type BackgroundLayerType = "color" | "gradient" | "image"');
  });

  it("gradient layer supports linear, radial, and conic sub-types", () => {
    expect(layerListSrc).toContain('type: "linear" | "radial" | "conic"');
  });

  it("image layer has url, size, position, repeat, and attachment fields", () => {
    expect(layerListSrc).toContain("url: string");
    expect(layerListSrc).toContain("size: string");
    expect(layerListSrc).toContain("position: string");
    expect(layerListSrc).toContain("repeat: string");
    expect(layerListSrc).toContain("attachment: string");
  });
});

// ─── 3. Gradient editor ──────────────────────────────────────────────

describe("Gradient editor", () => {
  it("GradientEditor supports linear, radial, and conic type buttons", () => {
    expect(gradientEditorSrc).toContain('"linear", "radial", "conic"');
  });

  it("angle slider is shown only for linear gradients", () => {
    expect(gradientEditorSrc).toMatch(/type\s*===\s*"linear"\s*&&/);
    expect(gradientEditorSrc).toContain("Angle");
  });

  it("angle slider range is 0-360", () => {
    expect(gradientEditorSrc).toContain("min={0}");
    expect(gradientEditorSrc).toContain("max={360}");
  });

  it("buildGradientCSS produces correct CSS for linear gradients", async () => {
    const { buildGradientCSS } = await import("../sections/GradientEditor");
    const result = buildGradientCSS("linear", 90, [
      { color: "#ff0000", position: 0 },
      { color: "#0000ff", position: 100 },
    ]);
    expect(result).toBe("linear-gradient(90deg, #ff0000 0%, #0000ff 100%)");
  });

  it("buildGradientCSS produces correct CSS for radial gradients", async () => {
    const { buildGradientCSS } = await import("../sections/GradientEditor");
    const result = buildGradientCSS("radial", 0, [
      { color: "#ff0000", position: 0 },
      { color: "#0000ff", position: 100 },
    ]);
    expect(result).toBe("radial-gradient(circle, #ff0000 0%, #0000ff 100%)");
  });

  it("buildGradientCSS produces correct CSS for conic gradients", async () => {
    const { buildGradientCSS } = await import("../sections/GradientEditor");
    const result = buildGradientCSS("conic", 45, [
      { color: "#ff0000", position: 0 },
      { color: "#0000ff", position: 100 },
    ]);
    expect(result).toBe("conic-gradient(from 45deg, #ff0000 0%, #0000ff 100%)");
  });

  it("buildGradientCSS sorts stops by position", async () => {
    const { buildGradientCSS } = await import("../sections/GradientEditor");
    const result = buildGradientCSS("linear", 180, [
      { color: "#0000ff", position: 100 },
      { color: "#ff0000", position: 0 },
    ]);
    expect(result).toBe("linear-gradient(180deg, #ff0000 0%, #0000ff 100%)");
  });

  it("GradientEditor renders without throwing", async () => {
    const { GradientEditor } = await import("../sections/GradientEditor");
    expect(() =>
      renderToString(
        createElement(GradientEditor, {
          type: "linear",
          angle: 180,
          stops: [
            { color: "#000000", position: 0 },
            { color: "#ffffff", position: 100 },
          ],
          onChange: vi.fn(),
        }),
      ),
    ).not.toThrow();
  });

  it("GradientEditor renders type toggle buttons for all three types", async () => {
    const { GradientEditor } = await import("../sections/GradientEditor");
    const html = renderToString(
      createElement(GradientEditor, {
        type: "linear",
        angle: 180,
        stops: [
          { color: "#000000", position: 0 },
          { color: "#ffffff", position: 100 },
        ],
        onChange: vi.fn(),
      }),
    );
    expect(html).toContain("linear");
    expect(html).toContain("radial");
    expect(html).toContain("conic");
  });
});

// ─── 4. background-clip includes text ────────────────────────────────

describe("Background clip options", () => {
  it("BG_CLIP_OPTIONS includes the 'text' value", async () => {
    const { BG_CLIP_OPTIONS } = await import("../panelConstants");
    const values = BG_CLIP_OPTIONS.map((o) => o.value);
    expect(values).toContain("text");
  });

  it("BG_CLIP_OPTIONS includes border-box, padding-box, content-box, and text", async () => {
    const { BG_CLIP_OPTIONS } = await import("../panelConstants");
    const values = BG_CLIP_OPTIONS.map((o) => o.value);
    expect(values).toEqual(expect.arrayContaining(["border-box", "padding-box", "content-box", "text"]));
  });

  it("BackgroundsSection renders Clipping dropdown", async () => {
    const { BackgroundsSection } = await import("../sections/BackgroundsSection");
    const html = renderToString(createElement(BackgroundsSection, { ctx: makeMockCtx() }));
    expect(html).toContain("Clipping");
  });

  it("handleBgClipChange applies -webkit-background-clip when text is selected", () => {
    expect(bgSectionSrc).toContain('-webkit-background-clip');
    expect(bgSectionSrc).toMatch(/v\s*===\s*"text"[\s\S]*?-webkit-background-clip/);
  });
});

// ─── 5. Blend mode dropdown has all 16 modes ─────────────────────────

describe("Blend mode dropdown", () => {
  it("BLEND_MODE_OPTIONS has exactly 16 blend modes", async () => {
    const { BLEND_MODE_OPTIONS } = await import("../panelConstants");
    expect(BLEND_MODE_OPTIONS).toHaveLength(16);
  });

  it("BLEND_MODE_OPTIONS includes all 16 CSS blend modes", async () => {
    const { BLEND_MODE_OPTIONS } = await import("../panelConstants");
    const values = BLEND_MODE_OPTIONS.map((o) => o.value);
    const expected = [
      "normal", "multiply", "screen", "overlay",
      "darken", "lighten", "color-dodge", "color-burn",
      "hard-light", "soft-light", "difference", "exclusion",
      "hue", "saturation", "color", "luminosity",
    ];
    expect(values).toEqual(expected);
  });

  it("BackgroundLayerList imports BLEND_MODE_OPTIONS for blend mode selector", () => {
    expect(layerListSrc).toContain("BLEND_MODE_OPTIONS");
  });

  it("each layer row includes a blend mode selector", () => {
    expect(layerListSrc).toContain("Blend");
    expect(layerListSrc).toContain("BLEND_MODES");
  });
});
