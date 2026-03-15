// @vitest-environment happy-dom
/**
 * unitConversionContext.test.ts — Verifies that unit conversion uses the
 * parent element's actual computed dimensions, not hardcoded assumptions.
 *
 * Tests the full pipeline: buildConversionContext() → convertUnit().
 * This is the integration seam between DOM reads and pure math.
 */

import { describe, it, expect } from "vitest";
import {
  buildConversionContext,
  convertUnit,
  conversionBasis,
  type UnitConversionContext,
} from "../unitConversion";

// ─── Helpers ─────────────────────────────────────────────────────────

/** Create a parent → child DOM pair with specified dimensions. */
function createPair(parentWidth: string, parentHeight: string) {
  const parent = document.createElement("div");
  parent.style.width = parentWidth;
  parent.style.height = parentHeight;
  document.body.appendChild(parent);

  const child = document.createElement("div");
  child.style.width = "200px";
  child.style.height = "100px";
  child.style.fontSize = "16px";
  parent.appendChild(child);

  return { parent, child };
}

function cleanup(parent: HTMLElement) {
  document.body.removeChild(parent);
}

// ─── buildConversionContext reads real parent dimensions ──────────────

describe("buildConversionContext", () => {
  it("reads parentWidth from the parent element's computed style", () => {
    const { parent, child } = createPair("500px", "400px");
    const ctx = buildConversionContext(child);

    expect(ctx.parentWidth).toBe(500);
    cleanup(parent);
  });

  it("reads parentHeight from the parent element's computed style", () => {
    const { parent, child } = createPair("500px", "400px");
    const ctx = buildConversionContext(child);

    expect(ctx.parentHeight).toBe(400);
    cleanup(parent);
  });

  it("reflects a different parent width (not hardcoded to any default)", () => {
    // Use an unusual width to prove it's not hardcoded to 800 or 1024 etc.
    const { parent, child } = createPair("743px", "321px");
    const ctx = buildConversionContext(child);

    expect(ctx.parentWidth).toBe(743);
    expect(ctx.parentHeight).toBe(321);
    cleanup(parent);
  });

  it("returns 0 for parentWidth/parentHeight when element has no parent", () => {
    const orphan = document.createElement("div");
    // Not appended to anything — parentElement is null
    document.body.appendChild(orphan);
    // Remove from body and test as if it has no parent
    // Actually, body IS the parent. Create a truly parentless scenario:
    const detached = document.createElement("div");
    detached.style.fontSize = "16px";
    // detached is not in the DOM at all — parentElement is null
    const ctx = buildConversionContext(detached);

    // parentElement is null → parentWidth/parentHeight should be 0
    expect(ctx.parentWidth).toBe(0);
    expect(ctx.parentHeight).toBe(0);
  });

  it("reads computedFontSize from the element itself", () => {
    const { parent, child } = createPair("500px", "400px");
    child.style.fontSize = "20px";
    const ctx = buildConversionContext(child);

    expect(ctx.computedFontSize).toBe(20);
    cleanup(parent);
  });
});

// ─── Full pipeline: px → % using real parent width ───────────────────

describe("px → % conversion uses parent element width", () => {
  it("converts 250px to 50% when parent is 500px wide", () => {
    const { parent, child } = createPair("500px", "400px");
    const ctx = buildConversionContext(child);
    const percent = convertUnit(250, "px", "%", ctx, "width");

    expect(percent).toBe(50);
    cleanup(parent);
  });

  it("converts 250px to ~33.56% when parent is 745px wide", () => {
    const { parent, child } = createPair("745px", "400px");
    const ctx = buildConversionContext(child);
    const percent = convertUnit(250, "px", "%", ctx, "width");

    // 250 / 745 * 100 = 33.557... → rounded to 33.56
    expect(percent).toBe(33.56);
    cleanup(parent);
  });

  it("converts height 200px to 50% when parent is 400px tall", () => {
    const { parent, child } = createPair("500px", "400px");
    const ctx = buildConversionContext(child);
    const percent = convertUnit(200, "px", "%", ctx, "height");

    expect(percent).toBe(50);
    cleanup(parent);
  });

  it("round-trips: px → % → px preserves the original value", () => {
    const { parent, child } = createPair("600px", "400px");
    const ctx = buildConversionContext(child);

    const original = 180;
    const asPercent = convertUnit(original, "px", "%", ctx, "width");
    const backToPx = convertUnit(asPercent, "%", "px", ctx, "width");

    expect(backToPx).toBe(original);
    cleanup(parent);
  });

  it("round-trips: px → % → px for non-round parent width", () => {
    const { parent, child } = createPair("537px", "400px");
    const ctx = buildConversionContext(child);

    const original = 200;
    const asPercent = convertUnit(original, "px", "%", ctx, "width");
    const backToPx = convertUnit(asPercent, "%", "px", ctx, "width");

    // Due to 2-decimal rounding, we may lose precision.
    // 200/537*100 = 37.24... → 37.24
    // 37.24/100*537 = 199.98... → 199.98
    // This is expected behavior — document the rounding loss
    expect(backToPx).toBeCloseTo(original, 0);
    cleanup(parent);
  });
});

// ─── % conversion with varying parent sizes ──────────────────────────

describe("% conversion varies with parent size", () => {
  it("same px value converts to different % for different parent widths", () => {
    const { parent: p1, child: c1 } = createPair("400px", "400px");
    const { parent: p2, child: c2 } = createPair("800px", "400px");

    const ctx1 = buildConversionContext(c1);
    const ctx2 = buildConversionContext(c2);

    const pct1 = convertUnit(200, "px", "%", ctx1, "width"); // 200/400 = 50%
    const pct2 = convertUnit(200, "px", "%", ctx2, "width"); // 200/800 = 25%

    expect(pct1).toBe(50);
    expect(pct2).toBe(25);
    expect(pct1).not.toBe(pct2); // proves it's not hardcoded

    cleanup(p1);
    cleanup(p2);
  });

  it("returns 0% when parent width is 0", () => {
    const { parent, child } = createPair("0px", "400px");
    const ctx = buildConversionContext(child);
    const percent = convertUnit(200, "px", "%", ctx, "width");

    expect(percent).toBe(0);
    cleanup(parent);
  });
});

// ─── conversionBasis reports parent dimension ────────────────────────

describe("conversionBasis shows parent dimension for %", () => {
  it("shows actual parent width in basis string", () => {
    const { parent, child } = createPair("500px", "400px");
    const ctx = buildConversionContext(child);
    const basis = conversionBasis("%", ctx, "width");

    expect(basis).toBe("parent: 500px");
    cleanup(parent);
  });

  it("shows actual parent height in basis string for height axis", () => {
    const { parent, child } = createPair("500px", "400px");
    const ctx = buildConversionContext(child);
    const basis = conversionBasis("%", ctx, "height");

    expect(basis).toBe("parent: 400px");
    cleanup(parent);
  });

  it("shows non-standard parent width (not a common breakpoint)", () => {
    const { parent, child } = createPair("937px", "400px");
    const ctx = buildConversionContext(child);
    const basis = conversionBasis("%", ctx, "width");

    expect(basis).toBe("parent: 937px");
    cleanup(parent);
  });
});

// ─── SizeSection onUnitChange handler pattern ────────────────────────

describe("SizeSection unit change handler wiring", () => {
  it("onUnitChange calls getConversionCtx then convertUnit (source verification)", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const src = fs.readFileSync(
      path.resolve(__dirname, "../sections/SizeSection.tsx"),
      "utf-8"
    );

    // Width onUnitChange handler: should call getConversionCtx() then convertUnit()
    const widthBlock = src.match(/<SizeInputCell[\s\S]*?label="Width"[\s\S]*?\/>/);
    expect(widthBlock, "Could not find Width SizeInputCell").toBeTruthy();

    const widthJsx = widthBlock![0];
    // Must call getConversionCtx() — not use a hardcoded context
    expect(widthJsx).toContain("getConversionCtx()");
    // Must pass the context to convertUnit
    expect(widthJsx).toContain("convertUnit(");
    // Must pass axis "width" for width conversions
    expect(widthJsx).toMatch(/convertUnit\(.*"width"\)/);
  });

  it("height onUnitChange passes axis 'height' to convertUnit", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const src = fs.readFileSync(
      path.resolve(__dirname, "../sections/SizeSection.tsx"),
      "utf-8"
    );

    const heightBlock = src.match(/<SizeInputCell[\s\S]*?label="Height"[\s\S]*?\/>/);
    expect(heightBlock, "Could not find Height SizeInputCell").toBeTruthy();

    const heightJsx = heightBlock![0];
    expect(heightJsx).toContain("getConversionCtx()");
    expect(heightJsx).toMatch(/convertUnit\(.*"height"\)/);
  });
});
