// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from "vitest";
import {
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
