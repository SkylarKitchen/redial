import { describe, it, expect } from "vitest";
import { buildConversionHint } from "../hooks/useConversionHint";
import type { UnitConversionContext } from "../unitConversion";

/** Helper to create a standard conversion context. */
function makeCtx(overrides?: Partial<UnitConversionContext>): UnitConversionContext {
  return {
    computedFontSize: 16,
    rootFontSize: 16,
    parentWidth: 400,
    parentHeight: 300,
    viewportWidth: 1280,
    viewportHeight: 720,
    ...overrides,
  };
}

describe("buildConversionHint", () => {
  // ── Basic shape ───────────────────────────────────────────────────

  it("preserves all fields in the returned object", () => {
    const hint = buildConversionHint(16, "px", 1, "em");
    expect(hint).toEqual({
      oldValue: 16,
      oldUnit: "px",
      newValue: 1,
      newUnit: "em",
      basis: undefined,
    });
  });

  it("returns basis as undefined when no context is provided", () => {
    const hint = buildConversionHint(100, "%", 400, "px");
    expect(hint.basis).toBeUndefined();
  });

  // ── With context ──────────────────────────────────────────────────

  it("computes basis for em using computedFontSize", () => {
    const ctx = makeCtx({ computedFontSize: 18 });
    const hint = buildConversionHint(18, "px", 1, "em", ctx);
    expect(hint.basis).toBe("base: 18px");
  });

  it("computes basis for rem using rootFontSize", () => {
    const ctx = makeCtx({ rootFontSize: 20 });
    const hint = buildConversionHint(20, "px", 1, "rem", ctx);
    expect(hint.basis).toBe("root: 20px");
  });

  it("computes basis for % using parentWidth by default", () => {
    const ctx = makeCtx({ parentWidth: 500 });
    const hint = buildConversionHint(250, "px", 50, "%", ctx);
    expect(hint.basis).toBe("parent: 500px");
  });

  it("computes basis for % using parentHeight when axis is height", () => {
    const ctx = makeCtx({ parentHeight: 600 });
    const hint = buildConversionHint(300, "px", 50, "%", ctx, "height");
    expect(hint.basis).toBe("parent: 600px");
  });

  it("computes basis for vw using viewportWidth", () => {
    const ctx = makeCtx({ viewportWidth: 1920 });
    const hint = buildConversionHint(192, "px", 10, "vw", ctx);
    expect(hint.basis).toBe("viewport: 1920px");
  });

  it("computes basis for vh using viewportHeight", () => {
    const ctx = makeCtx({ viewportHeight: 1080 });
    const hint = buildConversionHint(108, "px", 10, "vh", ctx);
    expect(hint.basis).toBe("viewport: 1080px");
  });

  it("returns undefined basis for px even with context", () => {
    const ctx = makeCtx();
    const hint = buildConversionHint(1, "em", 16, "px", ctx);
    expect(hint.basis).toBeUndefined();
  });

  // ── Edge values ───────────────────────────────────────────────────

  it("handles zero values", () => {
    const hint = buildConversionHint(0, "px", 0, "em", makeCtx());
    expect(hint.oldValue).toBe(0);
    expect(hint.newValue).toBe(0);
    expect(hint.basis).toBe("base: 16px");
  });

  it("handles negative values", () => {
    const hint = buildConversionHint(-10, "px", -0.63, "em", makeCtx());
    expect(hint.oldValue).toBe(-10);
    expect(hint.newValue).toBe(-0.63);
  });

  it("handles decimal values", () => {
    const hint = buildConversionHint(1.5, "rem", 24, "px");
    expect(hint.oldValue).toBe(1.5);
    expect(hint.newValue).toBe(24);
  });
});
