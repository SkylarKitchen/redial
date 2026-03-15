/**
 * backgroundLayerStacking.test.ts — Multi-layer background stacking order
 *
 * Verifies:
 * 1. Three gradient layers compose into correct CSS stacking order
 *    (array order = CSS order = first is frontmost)
 * 2. Deleting the middle layer recomposes the background correctly
 * 3. Mix of gradient + image layers preserves order
 * 4. Hidden layers are excluded from CSS output
 */

import { describe, it, expect } from "vitest";
import { buildGradientCSS } from "../sections/GradientEditor";
import type { BackgroundLayer } from "../sections/BackgroundLayerList";

// ─── Compose helper — mirrors handleBgLayersChange logic ────────────
// Extracted from BackgroundsSection.tsx lines 55-95 for testability.

function composeBgLayers(layers: BackgroundLayer[]): {
  background: string;
  attachment: string;
  blendMode: string;
} {
  const bgParts: string[] = [];
  const attachments: string[] = [];
  const blendModes: string[] = [];

  for (const layer of layers) {
    if (layer.visible === false) continue;
    if (layer.type === "gradient" && layer.gradient) {
      const g = layer.gradient;
      bgParts.push(
        buildGradientCSS(
          g.type as "linear" | "radial" | "conic",
          g.angle,
          g.stops,
        ),
      );
      blendModes.push(layer.blendMode || "normal");
    } else if (layer.type === "image" && layer.image) {
      const img = layer.image;
      bgParts.push(
        `url(${img.url}) ${img.position} / ${img.size} ${img.repeat}`,
      );
      attachments.push(img.attachment || "scroll");
      blendModes.push(layer.blendMode || "normal");
    }
  }

  return {
    background: bgParts.length > 0 ? bgParts.join(", ") : "none",
    attachment: attachments.some((a) => a !== "scroll")
      ? attachments.join(", ")
      : "",
    blendMode: blendModes.some((m) => m !== "normal")
      ? blendModes.join(", ")
      : "",
  };
}

// ─── Test fixtures ──────────────────────────────────────────────────

function makeGradientLayer(
  id: string,
  gradType: "linear" | "radial" | "conic",
  angle: number,
  stops: Array<{ color: string; position: number }>,
  overrides: Partial<BackgroundLayer> = {},
): BackgroundLayer {
  return {
    id,
    type: "gradient",
    gradient: { type: gradType, angle, stops },
    opacity: 1,
    blendMode: "normal",
    visible: true,
    ...overrides,
  };
}

function makeImageLayer(
  id: string,
  url: string,
  overrides: Partial<BackgroundLayer> = {},
): BackgroundLayer {
  return {
    id,
    type: "image",
    image: {
      url,
      size: "cover",
      position: "center",
      repeat: "no-repeat",
      attachment: "scroll",
    },
    opacity: 1,
    blendMode: "normal",
    visible: true,
    ...overrides,
  };
}

// ─── 1. Three-layer stacking order ─────────────────────────────────

describe("Multi-layer background stacking — 3 gradient layers", () => {
  const layerA = makeGradientLayer("a", "linear", 90, [
    { color: "#ff0000", position: 0 },
    { color: "#ff0000", position: 100 },
  ]);
  const layerB = makeGradientLayer("b", "radial", 0, [
    { color: "#00ff00", position: 0 },
    { color: "#00ff00", position: 100 },
  ]);
  const layerC = makeGradientLayer("c", "conic", 45, [
    { color: "#0000ff", position: 0 },
    { color: "#0000ff", position: 100 },
  ]);

  const layers = [layerA, layerB, layerC];

  it("composes 3 layers into a comma-separated CSS background", () => {
    const result = composeBgLayers(layers);
    // Count top-level layers by matching gradient function calls
    const layerMatches = result.background.match(/(linear|radial|conic)-gradient\(/g);
    expect(layerMatches).toHaveLength(3);
  });

  it("first layer in array = first (frontmost) in CSS output", () => {
    const result = composeBgLayers(layers);
    expect(result.background).toMatch(/^linear-gradient/);
  });

  it("last layer in array = last (bottommost) in CSS output", () => {
    const result = composeBgLayers(layers);
    expect(result.background).toMatch(/conic-gradient.*$/);
  });

  it("middle layer appears between first and last in CSS", () => {
    const result = composeBgLayers(layers);
    const linearIdx = result.background.indexOf("linear-gradient");
    const radialIdx = result.background.indexOf("radial-gradient");
    const conicIdx = result.background.indexOf("conic-gradient");
    expect(linearIdx).toBeLessThan(radialIdx);
    expect(radialIdx).toBeLessThan(conicIdx);
  });

  it("produces the exact expected CSS string", () => {
    const result = composeBgLayers(layers);
    expect(result.background).toBe(
      "linear-gradient(90deg, #ff0000 0%, #ff0000 100%), " +
        "radial-gradient(circle, #00ff00 0%, #00ff00 100%), " +
        "conic-gradient(from 45deg, #0000ff 0%, #0000ff 100%)",
    );
  });
});

// ─── 2. Deleting the middle layer recomposes correctly ─────────────

describe("Multi-layer background stacking — delete middle layer", () => {
  const layerA = makeGradientLayer("a", "linear", 90, [
    { color: "#ff0000", position: 0 },
    { color: "#ff0000", position: 100 },
  ]);
  const layerB = makeGradientLayer("b", "radial", 0, [
    { color: "#00ff00", position: 0 },
    { color: "#00ff00", position: 100 },
  ]);
  const layerC = makeGradientLayer("c", "conic", 45, [
    { color: "#0000ff", position: 0 },
    { color: "#0000ff", position: 100 },
  ]);

  it("removing middle layer leaves only first and last", () => {
    const withoutMiddle = [layerA, layerB, layerC].filter(
      (l) => l.id !== "b",
    );
    const result = composeBgLayers(withoutMiddle);
    const layerMatches = result.background.match(/(linear|radial|conic)-gradient\(/g);
    expect(layerMatches).toHaveLength(2);
  });

  it("recomposed CSS has correct order after middle deletion", () => {
    const withoutMiddle = [layerA, layerB, layerC].filter(
      (l) => l.id !== "b",
    );
    const result = composeBgLayers(withoutMiddle);
    expect(result.background).toBe(
      "linear-gradient(90deg, #ff0000 0%, #ff0000 100%), " +
        "conic-gradient(from 45deg, #0000ff 0%, #0000ff 100%)",
    );
  });

  it("radial-gradient is absent after middle layer deletion", () => {
    const withoutMiddle = [layerA, layerB, layerC].filter(
      (l) => l.id !== "b",
    );
    const result = composeBgLayers(withoutMiddle);
    expect(result.background).not.toContain("radial-gradient");
  });

  it("removing the first layer promotes second to frontmost", () => {
    const withoutFirst = [layerA, layerB, layerC].filter(
      (l) => l.id !== "a",
    );
    const result = composeBgLayers(withoutFirst);
    expect(result.background).toMatch(/^radial-gradient/);
  });

  it("removing the last layer makes second the bottommost", () => {
    const withoutLast = [layerA, layerB, layerC].filter(
      (l) => l.id !== "c",
    );
    const result = composeBgLayers(withoutLast);
    expect(result.background).toMatch(/radial-gradient.*$/);
    expect(result.background).not.toContain("conic-gradient");
  });
});

// ─── 3. Mixed gradient + image layers ──────────────────────────────

describe("Multi-layer background stacking — mixed types", () => {
  const gradient = makeGradientLayer("g1", "linear", 180, [
    { color: "#000000", position: 0 },
    { color: "#ffffff", position: 100 },
  ]);
  const image = makeImageLayer("i1", "hero.jpg");
  const gradient2 = makeGradientLayer("g2", "radial", 0, [
    { color: "rgba(0,0,0,0.5)", position: 0 },
    { color: "transparent", position: 100 },
  ]);

  it("gradient and image layers compose in array order", () => {
    const result = composeBgLayers([gradient, image, gradient2]);
    const linearIdx = result.background.indexOf("linear-gradient");
    const urlIdx = result.background.indexOf("url(hero.jpg)");
    const radialIdx = result.background.indexOf("radial-gradient");
    expect(linearIdx).toBeLessThan(urlIdx);
    expect(urlIdx).toBeLessThan(radialIdx);
  });

  it("image layer format includes position / size repeat", () => {
    const result = composeBgLayers([image]);
    expect(result.background).toBe("url(hero.jpg) center / cover no-repeat");
  });

  it("deleting image layer from middle preserves gradient order", () => {
    const withoutImage = [gradient, image, gradient2].filter(
      (l) => l.id !== "i1",
    );
    const result = composeBgLayers(withoutImage);
    expect(result.background).toContain("linear-gradient");
    expect(result.background).toContain("radial-gradient");
    expect(result.background).not.toContain("url(");
    // linear still before radial
    expect(result.background.indexOf("linear-gradient")).toBeLessThan(
      result.background.indexOf("radial-gradient"),
    );
  });
});

// ─── 4. Hidden layers excluded from CSS ─────────────────────────────

describe("Multi-layer background stacking — visibility", () => {
  const visible1 = makeGradientLayer("v1", "linear", 0, [
    { color: "#ff0000", position: 0 },
    { color: "#ff0000", position: 100 },
  ]);
  const hidden = makeGradientLayer(
    "h1",
    "radial",
    0,
    [
      { color: "#00ff00", position: 0 },
      { color: "#00ff00", position: 100 },
    ],
    { visible: false },
  );
  const visible2 = makeGradientLayer("v2", "conic", 90, [
    { color: "#0000ff", position: 0 },
    { color: "#0000ff", position: 100 },
  ]);

  it("hidden layer is excluded from CSS output", () => {
    const result = composeBgLayers([visible1, hidden, visible2]);
    expect(result.background).not.toContain("radial-gradient");
  });

  it("visible layers still compose in correct order", () => {
    const result = composeBgLayers([visible1, hidden, visible2]);
    expect(result.background).toMatch(/^linear-gradient/);
    expect(result.background).toMatch(/conic-gradient.*$/);
  });

  it("only 2 layers when middle layer is hidden", () => {
    const result = composeBgLayers([visible1, hidden, visible2]);
    const layerMatches = result.background.match(/(linear|radial|conic)-gradient\(/g);
    expect(layerMatches).toHaveLength(2);
  });
});

// ─── 5. Blend modes and attachments compose per-layer ───────────────

describe("Multi-layer background stacking — blend modes & attachments", () => {
  it("non-normal blend modes produce comma-separated output", () => {
    const layerA = makeGradientLayer("a", "linear", 0, [
      { color: "#ff0000", position: 0 },
      { color: "#ff0000", position: 100 },
    ]);
    const layerB = makeGradientLayer(
      "b",
      "radial",
      0,
      [
        { color: "#00ff00", position: 0 },
        { color: "#00ff00", position: 100 },
      ],
      { blendMode: "multiply" },
    );
    const result = composeBgLayers([layerA, layerB]);
    expect(result.blendMode).toBe("normal, multiply");
  });

  it("all-normal blend modes produce empty string (no override needed)", () => {
    const layerA = makeGradientLayer("a", "linear", 0, [
      { color: "#ff0000", position: 0 },
      { color: "#ff0000", position: 100 },
    ]);
    const layerB = makeGradientLayer("b", "radial", 0, [
      { color: "#00ff00", position: 0 },
      { color: "#00ff00", position: 100 },
    ]);
    const result = composeBgLayers([layerA, layerB]);
    expect(result.blendMode).toBe("");
  });

  it("non-scroll attachments on image layers produce comma-separated output", () => {
    const img1 = makeImageLayer("i1", "a.jpg");
    const img2 = makeImageLayer("i2", "b.jpg");
    img2.image!.attachment = "fixed";
    const result = composeBgLayers([img1, img2]);
    expect(result.attachment).toBe("scroll, fixed");
  });

  it("empty layers produce background: none", () => {
    const result = composeBgLayers([]);
    expect(result.background).toBe("none");
  });
});
