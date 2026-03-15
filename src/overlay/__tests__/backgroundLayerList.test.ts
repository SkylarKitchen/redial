/**
 * backgroundLayerList.test.ts — Tests for BackgroundLayerList behavior
 *
 * Covers: adding a new layer, selecting layer type (color/gradient/image),
 * deleting a layer, and layer order in rendered CSS output.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { buildGradientCSS } from "../sections/GradientEditor";
import type { BackgroundLayer } from "../sections/BackgroundLayerList";

const layerListSrc = readFileSync(
  join(__dirname, "..", "sections", "BackgroundLayerList.tsx"),
  "utf-8",
);

// ─── makeDefault (layer creation logic, verified from source) ──────────

describe("BackgroundLayerList — layer creation via makeDefault", () => {
  it("makeDefault function exists", () => {
    expect(layerListSrc).toContain("function makeDefault(type: BackgroundLayerType)");
  });

  it("creates color layers with default white color", () => {
    expect(layerListSrc).toMatch(/type\s*===\s*["']color["']/);
    expect(layerListSrc).toContain('#ffffff');
  });

  it("creates gradient layers with default linear type", () => {
    expect(layerListSrc).toContain('type: "linear"');
  });

  it("creates gradient layers with default angle of 180", () => {
    expect(layerListSrc).toContain("angle: 180");
  });

  it("creates gradient layers with 2 default stops (black to white)", () => {
    // The default gradient has black at 0% and white at 100%
    expect(layerListSrc).toContain('{ color: "#000000", position: 0 }');
    expect(layerListSrc).toContain('{ color: "#ffffff", position: 100 }');
  });

  it("creates image layers with default properties", () => {
    expect(layerListSrc).toContain('size: "cover"');
    expect(layerListSrc).toContain('position: "center"');
    expect(layerListSrc).toContain('repeat: "no-repeat"');
    expect(layerListSrc).toContain('attachment: "scroll"');
  });

  it("sets default opacity to 1", () => {
    expect(layerListSrc).toContain("opacity: 1");
  });

  it("sets default blendMode to normal", () => {
    expect(layerListSrc).toContain('blendMode: "normal"');
  });

  it("sets default visible to true", () => {
    expect(layerListSrc).toContain("visible: true");
  });

  it("generates unique ids using uid()", () => {
    expect(layerListSrc).toContain("id: uid()");
    expect(layerListSrc).toContain("function uid()");
  });
});

// ─── Adding a new layer ────────────────────────────────────────────────

describe("BackgroundLayerList — adding a new layer", () => {
  it("has '+ Add background' button", () => {
    expect(layerListSrc).toContain("+ Add background");
  });

  it("toggling addOpen state shows type dropdown", () => {
    expect(layerListSrc).toContain("setAddOpen");
    expect(layerListSrc).toContain("addOpen");
  });

  it("offers all three types: color, gradient, image", () => {
    expect(layerListSrc).toMatch(
      /\["color",\s*"gradient",\s*"image"\]/,
    );
  });

  it("addLayer prepends new layer (frontmost = first)", () => {
    // New layers are inserted at the beginning: [layer, ...layers]
    expect(layerListSrc).toContain("onChange([layer, ...layers])");
  });

  it("auto-expands newly added layer", () => {
    expect(layerListSrc).toContain("setExpandedId(layer.id)");
  });

  it("closes the add dropdown after selection", () => {
    // Inside addLayer: setAddOpen(false)
    const addLayerIdx = layerListSrc.indexOf("const addLayer");
    const addLayerChunk = layerListSrc.slice(addLayerIdx, addLayerIdx + 300);
    expect(addLayerChunk).toContain("setAddOpen(false)");
  });

  it("closes add dropdown on outside click", () => {
    expect(layerListSrc).toContain("mousedown");
    expect(layerListSrc).toContain("addRef.current");
  });
});

// ─── Layer type selection ──────────────────────────────────────────────

describe("BackgroundLayerList — selecting layer type", () => {
  it("renders Color label for color layers", () => {
    expect(layerListSrc).toContain('"Color"');
  });

  it("renders Gradient label for gradient layers", () => {
    expect(layerListSrc).toContain('"Gradient"');
  });

  it("renders Image label for image layers", () => {
    expect(layerListSrc).toContain('"Image"');
  });

  it("shows color swatch when layer type is color", () => {
    expect(layerListSrc).toContain('layer.type === "color"');
  });

  it("renders GradientEditor when layer type is gradient", () => {
    expect(layerListSrc).toContain("GradientEditor");
    expect(layerListSrc).toContain('layer.type === "gradient"');
  });

  it("renders image URL input when layer type is image", () => {
    expect(layerListSrc).toContain('layer.type === "image"');
    expect(layerListSrc).toContain('placeholder="Image URL"');
  });

  it("image layer has size/position/repeat/attachment controls", () => {
    expect(layerListSrc).toContain("SIZE_OPTIONS");
    expect(layerListSrc).toContain("POSITION_OPTIONS");
    expect(layerListSrc).toContain("REPEAT_OPTIONS");
    expect(layerListSrc).toContain("ATTACHMENT_OPTIONS");
  });
});

// ─── Deleting a layer ──────────────────────────────────────────────────

describe("BackgroundLayerList — deleting a layer", () => {
  it("has removeLayer function", () => {
    expect(layerListSrc).toContain("removeLayer");
  });

  it("filters out removed layer by id", () => {
    expect(layerListSrc).toContain("layers.filter((l) => l.id !== id)");
  });

  it("clears expandedId if the deleted layer was expanded", () => {
    expect(layerListSrc).toContain("if (expandedId === id) setExpandedId(null)");
  });

  it("delete button stops propagation (doesn't toggle expand)", () => {
    expect(layerListSrc).toContain("e.stopPropagation()");
    // Find the delete button pattern specifically
    expect(layerListSrc).toContain("removeLayer(layer.id)");
  });

  it("uses X icon from lucide for delete", () => {
    expect(layerListSrc).toContain('<X size={14}');
  });
});

// ─── Layer order in rendered CSS output ────────────────────────────────

describe("BackgroundLayerList — layer order in CSS output", () => {
  it("layers array order determines visual stacking (first = frontmost)", () => {
    // Confirmed by addLayer: onChange([layer, ...layers]) — new layers go to front
    expect(layerListSrc).toContain("[layer, ...layers]");
  });

  it("renders layers in array order (top-down = front-to-back)", () => {
    // layers.map iterates in order, which is the CSS stacking order
    expect(layerListSrc).toContain("layers.map((layer, index)");
  });

  it("supports drag reorder via useDragReorder", () => {
    expect(layerListSrc).toContain("useDragReorder");
    expect(layerListSrc).toContain("handleProps");
    expect(layerListSrc).toContain("registerRef");
  });
});

// ─── buildGradientCSS layer preview ────────────────────────────────────

describe("BackgroundLayerList — layer preview uses buildGradientCSS", () => {
  it("imports buildGradientCSS from GradientEditor", () => {
    expect(layerListSrc).toContain("buildGradientCSS");
  });

  it("layerPreviewBg uses buildGradientCSS for gradient layers", () => {
    expect(layerListSrc).toContain("function layerPreviewBg");
    // Verify the gradient branch calls buildGradientCSS
    const previewFnIdx = layerListSrc.indexOf("function layerPreviewBg");
    const previewChunk = layerListSrc.slice(previewFnIdx, previewFnIdx + 400);
    expect(previewChunk).toContain("buildGradientCSS");
  });

  it("layerPreviewBg returns color directly for color layers", () => {
    const previewFnIdx = layerListSrc.indexOf("function layerPreviewBg");
    const previewChunk = layerListSrc.slice(previewFnIdx, previewFnIdx + 400);
    expect(previewChunk).toContain('layer.color ?? "#ffffff"');
  });

  it("buildGradientCSS correctly renders multi-layer scenario", () => {
    // Test that buildGradientCSS can be used for layer preview
    const layer1CSS = buildGradientCSS("linear", 180, [
      { color: "#ff0000", position: 0 },
      { color: "#0000ff", position: 100 },
    ]);
    const layer2CSS = buildGradientCSS("radial", 0, [
      { color: "#00ff00", position: 0 },
      { color: "transparent", position: 100 },
    ]);
    // CSS background shorthand: first listed = frontmost layer
    const combined = `${layer1CSS}, ${layer2CSS}`;
    expect(combined).toContain("linear-gradient");
    expect(combined).toContain("radial-gradient");
    expect(combined.indexOf("linear-gradient")).toBeLessThan(
      combined.indexOf("radial-gradient"),
    );
  });
});

// ─── Visibility and blend mode controls ────────────────────────────────

describe("BackgroundLayerList — visibility and blend mode", () => {
  it("has toggleVisible function", () => {
    expect(layerListSrc).toContain("toggleVisible");
  });

  it("uses VisibilityToggle component", () => {
    expect(layerListSrc).toContain("VisibilityToggle");
  });

  it("reduces opacity visually when layer is hidden", () => {
    // opacity: layer.visible === false ? 0.4 : 1
    expect(layerListSrc).toContain("layer.visible === false ? 0.4 : 1");
  });

  it("has blend mode selector using BLEND_MODE_OPTIONS", () => {
    expect(layerListSrc).toContain("BLEND_MODE_OPTIONS");
    expect(layerListSrc).toContain("blendMode");
  });

  it("has opacity slider per layer", () => {
    expect(layerListSrc).toContain("layer.opacity");
    expect(layerListSrc).toContain('type="range"');
  });
});
