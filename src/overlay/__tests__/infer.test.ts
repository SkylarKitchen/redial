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
      expect(result.spacing).toEqual({
        margin: { top: 0, right: 0, bottom: 0, left: 0 },
        padding: { top: 0, right: 0, bottom: 0, left: 0 },
      });
    } finally {
      globalThis.getComputedStyle = origGetComputedStyle;
    }
  });
});
