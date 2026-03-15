// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from "vitest";
import {
  PX_PROPS,
  TOGGLE_CSS,
  toCSSValue,
  flattenValues,
  SPACING_PROPS,
  infer,
} from "../core/infer";

// ─── Setup ────────────────────────────────────────────────────────────

beforeEach(() => {
  document.body.innerHTML = "";
});

function makeEl(tag = "div"): HTMLElement {
  const el = document.createElement(tag);
  document.body.appendChild(el);
  return el;
}

// ─── PX_PROPS ─────────────────────────────────────────────────────────

describe("PX_PROPS", () => {
  it("includes common px-unit properties", () => {
    expect(PX_PROPS.has("font-size")).toBe(true);
    expect(PX_PROPS.has("width")).toBe(true);
    expect(PX_PROPS.has("height")).toBe(true);
    expect(PX_PROPS.has("padding-top")).toBe(true);
    expect(PX_PROPS.has("margin-left")).toBe(true);
    expect(PX_PROPS.has("border-radius")).toBe(true);
    expect(PX_PROPS.has("gap")).toBe(true);
  });

  it("does not include non-px properties", () => {
    expect(PX_PROPS.has("opacity")).toBe(false);
    expect(PX_PROPS.has("display")).toBe(false);
    expect(PX_PROPS.has("color")).toBe(false);
  });
});

// ─── TOGGLE_CSS ───────────────────────────────────────────────────────

describe("TOGGLE_CSS", () => {
  it("maps pointer-events to auto/none", () => {
    expect(TOGGLE_CSS["pointer-events"]).toEqual({ on: "auto", off: "none" });
  });

  it("maps visibility to visible/hidden", () => {
    expect(TOGGLE_CSS["visibility"]).toEqual({ on: "visible", off: "hidden" });
  });
});

// ─── toCSSValue ───────────────────────────────────────────────────────

describe("toCSSValue", () => {
  it("appends px for PX_PROPS numeric values", () => {
    expect(toCSSValue("width", 100)).toBe("100px");
    expect(toCSSValue("font-size", 16)).toBe("16px");
    expect(toCSSValue("padding-top", 0)).toBe("0px");
  });

  it("converts non-PX numeric values to string without units", () => {
    expect(toCSSValue("opacity", 0.5)).toBe("0.5");
    expect(toCSSValue("font-weight", 700)).toBe("700");
  });

  it("converts booleans using TOGGLE_CSS on/off", () => {
    expect(toCSSValue("pointer-events", true)).toBe("auto");
    expect(toCSSValue("pointer-events", false)).toBe("none");
    expect(toCSSValue("visibility", true)).toBe("visible");
    expect(toCSSValue("visibility", false)).toBe("hidden");
  });

  it("returns null for boolean with unknown toggle prop", () => {
    expect(toCSSValue("display", true)).toBeNull();
  });

  it("passes strings through unchanged", () => {
    expect(toCSSValue("display", "flex")).toBe("flex");
    expect(toCSSValue("color", "#ff0000")).toBe("#ff0000");
    expect(toCSSValue("font-family", "Arial, sans-serif")).toBe("Arial, sans-serif");
  });

  it("returns null for objects and arrays", () => {
    expect(toCSSValue("display", { type: "select" })).toBeNull();
    expect(toCSSValue("display", [1, 2, 3])).toBeNull();
  });
});

// ─── flattenValues ────────────────────────────────────────────────────

describe("flattenValues", () => {
  it("returns a flat object unchanged", () => {
    const obj = { width: 100, height: 50 };
    expect(flattenValues(obj)).toEqual({ width: 100, height: 50 });
  });

  it("flattens nested folder objects", () => {
    const obj = {
      layout: {
        display: "flex",
        gap: 8,
      },
      size: {
        width: 100,
      },
    };
    expect(flattenValues(obj)).toEqual({
      display: "flex",
      gap: 8,
      width: 100,
    });
  });

  it("recurses deeply nested folders", () => {
    const obj = {
      outer: {
        inner: {
          deep: "value",
        },
      },
    };
    expect(flattenValues(obj)).toEqual({ deep: "value" });
  });

  it("preserves leaf objects that have a 'type' field (dialkit configs)", () => {
    const selectConfig = { type: "select", options: [], default: "block" };
    const obj = { display: selectConfig };
    const result = flattenValues(obj);
    expect(result["display"]).toBe(selectConfig);
  });

  it("preserves arrays as leaf values", () => {
    const obj = { width: [100, 0, 1200, 1] };
    const result = flattenValues(obj);
    expect(result["width"]).toEqual([100, 0, 1200, 1]);
  });

  it("handles null values", () => {
    const obj = { color: null, width: 100 };
    const result = flattenValues(obj);
    expect(result["color"]).toBeNull();
    expect(result["width"]).toBe(100);
  });
});

// ─── SPACING_PROPS ────────────────────────────────────────────────────

describe("SPACING_PROPS", () => {
  it("contains all 8 spacing properties", () => {
    expect(SPACING_PROPS).toHaveLength(8);
    expect(SPACING_PROPS).toContain("padding-top");
    expect(SPACING_PROPS).toContain("padding-right");
    expect(SPACING_PROPS).toContain("padding-bottom");
    expect(SPACING_PROPS).toContain("padding-left");
    expect(SPACING_PROPS).toContain("margin-top");
    expect(SPACING_PROPS).toContain("margin-right");
    expect(SPACING_PROPS).toContain("margin-bottom");
    expect(SPACING_PROPS).toContain("margin-left");
  });
});

// ─── infer ────────────────────────────────────────────────────────────

describe("infer", () => {
  it("returns config with expected top-level sections", () => {
    const el = makeEl("div");
    const result = infer(el);
    expect(result.config).toHaveProperty("layout");
    expect(result.config).toHaveProperty("size");
    expect(result.config).toHaveProperty("position");
    expect(result.config).toHaveProperty("effects");
  });

  it("includes tag name in the name field", () => {
    const el = makeEl("div");
    const result = infer(el);
    expect(result.name).toContain("div");
  });

  it("includes class name in name when present", () => {
    const el = makeEl("div");
    el.className = "hero";
    const result = infer(el);
    expect(result.name).toBe("div.hero");
  });

  it("extracts CSS module class names for display", () => {
    const el = makeEl("div");
    el.className = "Button_btn__a8f2k";
    const result = infer(el);
    expect(result.name).toBe("div.btn");
  });

  it("returns spacing values with margin and padding", () => {
    const el = makeEl("div");
    const result = infer(el);
    expect(result.spacing).toHaveProperty("margin");
    expect(result.spacing).toHaveProperty("padding");
    expect(result.spacing.margin).toHaveProperty("top");
    expect(result.spacing.margin).toHaveProperty("right");
    expect(result.spacing.margin).toHaveProperty("bottom");
    expect(result.spacing.margin).toHaveProperty("left");
    expect(result.spacing.padding).toHaveProperty("top");
    expect(result.spacing.padding).toHaveProperty("right");
    expect(result.spacing.padding).toHaveProperty("bottom");
    expect(result.spacing.padding).toHaveProperty("left");
  });

  it("returns an empty varUnits object when no custom properties", () => {
    const el = makeEl("div");
    const result = infer(el);
    expect(result.varUnits).toEqual({});
  });

  it("includes display select in layout section", () => {
    const el = makeEl("div");
    const result = infer(el);
    const layout = result.config["layout"] as Record<string, unknown>;
    expect(layout).toHaveProperty("display");
    const displayConfig = layout["display"] as { type: string };
    expect(displayConfig.type).toBe("select");
  });

  it("includes overflow select in size section", () => {
    const el = makeEl("div");
    const result = infer(el);
    const size = result.config["size"] as Record<string, unknown>;
    expect(size).toHaveProperty("overflow");
    const overflowConfig = size["overflow"] as { type: string };
    expect(overflowConfig.type).toBe("select");
  });

  it("includes position select in position section", () => {
    const el = makeEl("div");
    const result = infer(el);
    const position = result.config["position"] as Record<string, unknown>;
    expect(position).toHaveProperty("position");
    const posConfig = position["position"] as { type: string };
    expect(posConfig.type).toBe("select");
  });

  it("includes opacity in effects section", () => {
    const el = makeEl("div");
    const result = infer(el);
    const effects = result.config["effects"] as Record<string, unknown>;
    expect(effects).toHaveProperty("opacity");
  });

  it("includes typography for text-bearing elements", () => {
    const el = makeEl("h1");
    el.textContent = "Hello";
    const result = infer(el);
    expect(result.config).toHaveProperty("typography");
  });

  it("omits typography for non-text elements", () => {
    const el = makeEl("div");
    const result = infer(el);
    expect(result.config).not.toHaveProperty("typography");
  });

  it("includes object-fit for img elements", () => {
    const el = makeEl("img");
    const result = infer(el);
    const size = result.config["size"] as Record<string, unknown>;
    expect(size).toHaveProperty("object-fit");
  });

  it("omits object-fit for non-media elements", () => {
    const el = makeEl("div");
    const result = infer(el);
    const size = result.config["size"] as Record<string, unknown>;
    expect(size).not.toHaveProperty("object-fit");
  });

  it("border-radius range uses step of 4", () => {
    const el = makeEl("div");
    el.style.borderRadius = "32px";
    const result = infer(el);
    const borders = result.config["borders"] as Record<string, unknown>;
    const radiusRange = borders["border-radius"] as [number, number, number, number];
    // [value, min, max, step] — step should be 4px, not 1px
    expect(radiusRange[3]).toBe(4);
  });

  it("returns safe fallback for detached element (getComputedStyle throws)", () => {
    // Create an element but do NOT attach it to the DOM
    const el = document.createElement("div");
    // In some environments getComputedStyle on a detached element throws;
    // force the throw to simulate SVG foreignObject / shadow DOM / detached cases
    const origGetComputedStyle = globalThis.getComputedStyle;
    globalThis.getComputedStyle = () => {
      throw new Error("Failed to execute 'getComputedStyle' on detached element");
    };
    try {
      const result = infer(el);
      // Should not throw — returns a safe fallback
      expect(result).toBeDefined();
      expect(result.name).toBe("div");
      expect(result.config).toBeDefined();
      expect(result.varUnits).toEqual({});
      expect(result.spacing).toEqual({
        margin: { top: 0, right: 0, bottom: 0, left: 0 },
        padding: { top: 0, right: 0, bottom: 0, left: 0 },
      });
    } finally {
      globalThis.getComputedStyle = origGetComputedStyle;
    }
  });
});
