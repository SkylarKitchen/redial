/**
 * gradientEditor.test.ts — Tests for GradientEditor behavior
 *
 * Covers: buildGradientCSS output, adding color stops, dragging stops,
 * deleting stops (min 2 enforced), gradient type switching,
 * angle slider visibility per type.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { buildGradientCSS, type GradientStop } from "../sections/GradientEditor";

const gradientSrc = readFileSync(
  join(__dirname, "..", "sections", "GradientEditor.tsx"),
  "utf-8",
);

// ─── buildGradientCSS (pure function) ─────────────────────────────────

describe("buildGradientCSS", () => {
  const stops: GradientStop[] = [
    { color: "#000000", position: 0 },
    { color: "#ffffff", position: 100 },
  ];

  it("builds linear-gradient with angle", () => {
    const css = buildGradientCSS("linear", 90, stops);
    expect(css).toBe("linear-gradient(90deg, #000000 0%, #ffffff 100%)");
  });

  it("builds radial-gradient with circle", () => {
    const css = buildGradientCSS("radial", 0, stops);
    expect(css).toBe("radial-gradient(circle, #000000 0%, #ffffff 100%)");
  });

  it("builds conic-gradient with from angle", () => {
    const css = buildGradientCSS("conic", 45, stops);
    expect(css).toBe("conic-gradient(from 45deg, #000000 0%, #ffffff 100%)");
  });

  it("sorts stops by position before serializing", () => {
    const unordered: GradientStop[] = [
      { color: "#ff0000", position: 75 },
      { color: "#000000", position: 0 },
      { color: "#00ff00", position: 50 },
    ];
    const css = buildGradientCSS("linear", 180, unordered);
    expect(css).toBe(
      "linear-gradient(180deg, #000000 0%, #00ff00 50%, #ff0000 75%)",
    );
  });

  it("handles 0 angle for linear", () => {
    const css = buildGradientCSS("linear", 0, stops);
    expect(css).toContain("0deg");
  });

  it("handles 360 angle for linear", () => {
    const css = buildGradientCSS("linear", 360, stops);
    expect(css).toContain("360deg");
  });

  it("handles single stop", () => {
    const single: GradientStop[] = [{ color: "#ff0000", position: 50 }];
    const css = buildGradientCSS("linear", 0, single);
    expect(css).toBe("linear-gradient(0deg, #ff0000 50%)");
  });

  it("handles rgba colors", () => {
    const rgbaStops: GradientStop[] = [
      { color: "rgba(255, 0, 0, 0.5)", position: 0 },
      { color: "rgba(0, 0, 255, 1)", position: 100 },
    ];
    const css = buildGradientCSS("linear", 90, rgbaStops);
    expect(css).toContain("rgba(255, 0, 0, 0.5)");
    expect(css).toContain("rgba(0, 0, 255, 1)");
  });
});

// ─── Source structure: adding a color stop ─────────────────────────────

describe("GradientEditor — adding a color stop", () => {
  it("has handleBarClick that adds a new stop on empty area click", () => {
    expect(gradientSrc).toContain("handleBarClick");
  });

  it("ignores clicks on marker elements (data-marker)", () => {
    // The bar click handler checks data.marker to avoid adding when clicking an existing stop
    expect(gradientSrc).toContain("data.marker");
  });

  it("new stop defaults to white (#ffffff)", () => {
    expect(gradientSrc).toMatch(/color:\s*["']#ffffff["']/);
  });

  it("calculates position from clientX relative to bar", () => {
    expect(gradientSrc).toContain("positionFromEvent");
    expect(gradientSrc).toContain("clientX");
  });

  it("selects the newly added stop", () => {
    // After adding, selectedIndex is set to the new stop's index
    expect(gradientSrc).toContain("setSelectedIndex(next.length - 1)");
  });

  it("emits updated stops array after adding", () => {
    // handleBarClick calls emit with the new stops
    const barClickIdx = gradientSrc.indexOf("handleBarClick");
    const barClickChunk = gradientSrc.slice(barClickIdx, barClickIdx + 500);
    expect(barClickChunk).toContain("emit({ stops: next })");
  });
});

// ─── Source structure: dragging a stop ─────────────────────────────────

describe("GradientEditor — dragging a stop changes position", () => {
  it("has mousedown handler on stop markers", () => {
    expect(gradientSrc).toContain("handleMarkerDown");
    expect(gradientSrc).toContain("onMouseDown");
  });

  it("sets dragging state on mousedown", () => {
    expect(gradientSrc).toContain("setDragging(true)");
  });

  it("adds mousemove listener when dragging", () => {
    expect(gradientSrc).toContain('addEventListener("mousemove"');
  });

  it("adds mouseup listener for drag end", () => {
    expect(gradientSrc).toContain('addEventListener("mouseup"');
  });

  it("removes listeners on cleanup", () => {
    expect(gradientSrc).toContain('removeEventListener("mousemove"');
    expect(gradientSrc).toContain('removeEventListener("mouseup"');
  });

  it("clamps position to 0-100 range", () => {
    expect(gradientSrc).toContain("clamp");
    // Verify the clamp function bounds
    expect(gradientSrc).toMatch(/clamp\([^)]*,\s*0,\s*100\)/);
  });

  it("disables text selection during drag", () => {
    expect(gradientSrc).toContain("userSelect");
  });

  it("emits updated stops during drag", () => {
    // handleMove calculates new position and emits
    expect(gradientSrc).toContain("emit({ stops: next })");
  });
});

// ─── Source structure: deleting a stop (min 2 enforced) ────────────────

describe("GradientEditor — deleting a stop", () => {
  it("has handleDelete function", () => {
    expect(gradientSrc).toContain("handleDelete");
  });

  it("enforces minimum 2 stops", () => {
    // Check condition: stops.length <= 2 prevents deletion
    expect(gradientSrc).toContain("stops.length <= 2");
  });

  it("delete button is disabled when only 2 stops", () => {
    expect(gradientSrc).toMatch(/disabled=\{stops\.length\s*<=\s*2\}/);
  });

  it("changes cursor to 'default' when delete disabled", () => {
    expect(gradientSrc).toContain('cursor: stops.length <= 2 ? "default" : "pointer"');
  });

  it("returns early from handleDelete when at minimum", () => {
    const deleteIdx = gradientSrc.indexOf("handleDelete");
    const deleteChunk = gradientSrc.slice(deleteIdx, deleteIdx + 200);
    expect(deleteChunk).toContain("stops.length <= 2");
    expect(deleteChunk).toContain("return");
  });

  it("filters out selected stop when deleting", () => {
    expect(gradientSrc).toContain("stops.filter((_, i) => i !== selectedIndex)");
  });

  it("clears selection after delete", () => {
    expect(gradientSrc).toContain("setSelectedIndex(null)");
  });

  it("renders delete button with × character", () => {
    expect(gradientSrc).toContain("×");
  });
});

// ─── Source structure: gradient type switching ──────────────────────────

describe("GradientEditor — gradient type switching", () => {
  it("renders all three type options: linear, radial, conic", () => {
    expect(gradientSrc).toContain('"linear"');
    expect(gradientSrc).toContain('"radial"');
    expect(gradientSrc).toContain('"conic"');
  });

  it("defines typeOptions array with all three types", () => {
    expect(gradientSrc).toMatch(/typeOptions.*linear.*radial.*conic/s);
  });

  it("emits type change on button click", () => {
    expect(gradientSrc).toContain("emit({ type: t })");
  });

  it("highlights active type with primary color", () => {
    expect(gradientSrc).toContain("color.primary");
    expect(gradientSrc).toContain("isActive");
  });
});

// ─── Source structure: angle slider visibility ──────────────────────────

describe("GradientEditor — angle slider only for linear type", () => {
  it("conditionally renders angle slider based on type === 'linear'", () => {
    expect(gradientSrc).toMatch(/\{type\s*===\s*["']linear["']\s*&&/);
  });

  it("angle slider has range input from 0 to 360", () => {
    expect(gradientSrc).toContain('min={0}');
    expect(gradientSrc).toContain('max={360}');
  });

  it("angle change emits new angle value", () => {
    expect(gradientSrc).toContain("emit({ angle:");
  });

  it("displays angle label text", () => {
    expect(gradientSrc).toContain("Angle");
  });

  it("shows degree symbol next to angle value", () => {
    expect(gradientSrc).toContain("{angle}°");
  });
});
