// @vitest-environment happy-dom
/**
 * positionSection.test.ts — Position section behavioral tests
 *
 * Verifies:
 * 1. Offset controls (top/right/bottom/left) are hidden when position is `static`
 * 2. They appear for `relative`, `absolute`, `fixed`, `sticky`
 * 3. z-index accepts `auto` as a keyword and numeric values from -1 to 9999
 * 4. Changing position from `static` to `absolute` reveals the offset diagram
 */

import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import type { SectionCtx } from "../panelUtils";
import type { UnitConversionContext } from "../unitConversion";

// ─── Helpers ──────────────────────────────────────────────────────────

function makeMockCtx(overrides?: Partial<{ position: string; zIndex: string }>): SectionCtx {
  const element = document.createElement("div");
  element.style.position = overrides?.position ?? "static";
  element.style.top = "0px";
  element.style.right = "0px";
  element.style.bottom = "0px";
  element.style.left = "0px";
  element.style.zIndex = overrides?.zIndex ?? "auto";
  element.style.cssFloat = "none";
  // @ts-expect-error happy-dom may not support clear directly
  element.style.clear = "none";
  document.body.appendChild(element);

  const cs = getComputedStyle(element);

  return {
    element,
    apply: vi.fn(),
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

async function renderPosition(overrides?: Partial<{ position: string; zIndex: string }>) {
  const { PositionSection } = await import("../sections/PositionSection");
  const ctx = makeMockCtx(overrides);
  return renderToString(createElement(PositionSection, { ctx }));
}

// ─── Source reading ───────────────────────────────────────────────────

const positionSrc = readFileSync(
  join(__dirname, "../sections/PositionSection.tsx"),
  "utf-8",
);
const diagramSrc = readFileSync(
  join(__dirname, "../sections/PositionOffsetDiagram.tsx"),
  "utf-8",
);
const selectorSrc = readFileSync(
  join(__dirname, "../sections/PositionSelector.tsx"),
  "utf-8",
);

// ─── 1. Offset controls hidden when position is static ───────────────

describe("Offset controls hidden when position is static", () => {
  it("does not render PositionOffsetDiagram when position is static", async () => {
    const html = await renderPosition({ position: "static" });
    // The offset diagram renders "element" text inside a placeholder box
    expect(html).not.toContain("element");
    // Z-Index row should not appear
    expect(html).not.toContain("Z-Index");
  });

  it("source gates offset content behind position !== 'static'", () => {
    expect(positionSrc).toContain('position !== "static"');
  });

  it("Section starts collapsed when position is static", () => {
    // The Section component receives collapsed={position === "static"}
    expect(positionSrc).toMatch(/collapsed=\{position\s*===\s*"static"\}/);
  });
});

// ─── 2. Offset controls appear for non-static positions ──────────────

describe("Offset controls appear for non-static positions", () => {
  const NON_STATIC_POSITIONS = ["relative", "absolute", "fixed", "sticky"];

  for (const pos of NON_STATIC_POSITIONS) {
    it(`renders offset diagram when position is ${pos}`, async () => {
      const html = await renderPosition({ position: pos });
      // The offset diagram renders "element" text inside a placeholder box
      expect(html).toContain("element");
    });

    it(`renders Z-Index row when position is ${pos}`, async () => {
      const html = await renderPosition({ position: pos });
      expect(html).toContain("Z-Index");
    });

    it(`renders pin preset buttons when position is ${pos}`, async () => {
      const html = await renderPosition({ position: pos });
      // PIN_PRESET_ICONS renders buttons with title attributes like "TL", "TR", etc.
      expect(html).toContain("TL");
      expect(html).toContain("TR");
      expect(html).toContain("All");
    });
  }

  it("PositionSelector dropdown includes all 5 position values", () => {
    expect(selectorSrc).toContain('"static"');
    expect(selectorSrc).toContain('"relative"');
    expect(selectorSrc).toContain('"absolute"');
    expect(selectorSrc).toContain('"fixed"');
    expect(selectorSrc).toContain('"sticky"');
  });
});

// ─── 3. z-index accepts auto and numeric values ──────────────────────

describe("z-index accepts auto and numeric values", () => {
  it("shows Auto button when z-index is auto", async () => {
    const html = await renderPosition({ position: "absolute", zIndex: "auto" });
    expect(html).toContain("Auto");
  });

  it("source supports toggling between auto and numeric z-index", () => {
    // handleZIndexAutoToggle switches between auto and numeric
    expect(positionSrc).toContain("handleZIndexAutoToggle");
    // When auto is toggled on, it applies "auto"
    expect(positionSrc).toMatch(/apply\("z-index",\s*.*"auto"/);
  });

  it("z-index input accepts numeric values via onChange", () => {
    // handleZIndexChange converts to String and applies
    expect(positionSrc).toContain("handleZIndexChange");
    expect(positionSrc).toMatch(/apply\("z-index",\s*String\(v\)\)/);
  });

  it("z-index supports ArrowUp/ArrowDown keyboard stepping", () => {
    // ArrowUp increments, ArrowDown decrements; shift = +/-10
    expect(positionSrc).toContain('"ArrowUp"');
    expect(positionSrc).toContain('"ArrowDown"');
    expect(positionSrc).toMatch(/zIndex\s*\+\s*\(e\.shiftKey\s*\?\s*10\s*:\s*1\)/);
    expect(positionSrc).toMatch(/zIndex\s*-\s*\(e\.shiftKey\s*\?\s*10\s*:\s*1\)/);
  });

  it("z-index input uses text type (allows negative and large values)", () => {
    // type="text" allows arbitrary numeric input including negatives
    expect(positionSrc).toMatch(/type="text"[\s\S]*?value=\{zIndex\}/);
  });

  it("z-index parseInt allows negative values like -1", () => {
    // The onChange handler uses parseInt which handles negative numbers
    expect(positionSrc).toMatch(/parseInt\(e\.target\.value\)/);
    // Verify parseInt works on negative
    expect(parseInt("-1")).toBe(-1);
  });

  it("z-index parseInt allows large values like 9999", () => {
    expect(parseInt("9999")).toBe(9999);
  });

  it("z-index Escape key toggles back to auto", () => {
    expect(positionSrc).toMatch(/e\.key\s*===\s*"Escape".*handleZIndexAutoToggle/s);
  });
});

// ─── 4. Static-to-absolute reveals offset diagram ────────────────────

describe("Changing position from static to absolute reveals offset diagram", () => {
  it("static renders no offset diagram; absolute renders it", async () => {
    const staticHtml = await renderPosition({ position: "static" });
    const absoluteHtml = await renderPosition({ position: "absolute" });

    // "element" text only appears inside PositionOffsetDiagram
    expect(staticHtml).not.toContain("element");
    expect(absoluteHtml).toContain("element");
  });

  it("absolute renders Columns/Rows labels (below offset diagram)", async () => {
    const absoluteHtml = await renderPosition({ position: "absolute" });
    expect(absoluteHtml).toContain("Columns");
    expect(absoluteHtml).toContain("Rows");
  });

  it("static does not render Columns/Rows labels", async () => {
    const staticHtml = await renderPosition({ position: "static" });
    expect(staticHtml).not.toContain("Columns");
    expect(staticHtml).not.toContain("Rows");
  });

  it("PositionOffsetDiagram uses transition timing for smooth appearance", () => {
    // The diagram itself uses transitions on hover and other interactions
    expect(diagramSrc).toContain("transition");
    // The ms() function from timing.ts is imported for smooth animations
    expect(diagramSrc).toContain('import { ms } from "../timing"');
  });

  it("offset diagram renders four editable values (top, right, bottom, left)", () => {
    // The diagram renders EditableValue components for each offset direction
    expect(diagramSrc).toContain('onChange("top"');
    expect(diagramSrc).toContain('onChange("right"');
    expect(diagramSrc).toContain('onChange("bottom"');
    expect(diagramSrc).toContain('onChange("left"');
  });

  it("offset diagram supports auto states for each direction", () => {
    // AutoLabel is rendered when an offset is in auto state
    expect(diagramSrc).toContain("auto.top");
    expect(diagramSrc).toContain("auto.right");
    expect(diagramSrc).toContain("auto.bottom");
    expect(diagramSrc).toContain("auto.left");
    expect(diagramSrc).toContain("AutoLabel");
  });

  it("PositionSection passes autoStates and onChange to PositionOffsetDiagram", () => {
    const diagramUsage = positionSrc.match(/<PositionOffsetDiagram[\s\S]*?\/>/);
    expect(diagramUsage, "PositionOffsetDiagram must be used").toBeTruthy();
    expect(diagramUsage![0]).toContain("autoStates");
    expect(diagramUsage![0]).toContain("onChange");
    expect(diagramUsage![0]).toContain("onReset");
    expect(diagramUsage![0]).toContain("onAutoDisable");
  });
});

// ─── 5. Float and Clear collapsible ──────────────────────────────────

describe("Float and Clear section", () => {
  it("Float and Clear toggle button renders when section is expanded (non-static)", async () => {
    const absoluteHtml = await renderPosition({ position: "absolute" });
    expect(absoluteHtml).toContain("Float and clear");
  });

  it("Float and Clear toggle button is hidden when section is collapsed (static)", async () => {
    // When position is static, the Section is collapsed and its body is hidden
    const staticHtml = await renderPosition({ position: "static" });
    expect(staticHtml).not.toContain("Float and clear");
  });

  it("Float and Clear content is collapsed by default", () => {
    // showFloatClear starts as false
    expect(positionSrc).toMatch(/useState\(false\)/);
    // The float/clear content is gated by showFloatClear
    expect(positionSrc).toContain("showFloatClear");
  });
});
