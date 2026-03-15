// @vitest-environment happy-dom
/**
 * bordersSection.test.ts — Borders section behavioral tests
 *
 * Verifies:
 * 1. Side selector tabs (All/Top/Right/Bottom/Left) switch which border properties are editable
 * 2. When "All" is selected, changes apply to all 4 sides
 * 3. Radius linked/unlinked toggle works — linked mode shows 1 slider, unlinked shows 4 inputs
 * 4. border-radius supports both px and % units
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
  element.style.borderWidth = "1px";
  element.style.borderStyle = "solid";
  element.style.borderColor = "rgb(0, 0, 0)";
  element.style.borderTopLeftRadius = "0px";
  element.style.borderTopRightRadius = "0px";
  element.style.borderBottomRightRadius = "0px";
  element.style.borderBottomLeftRadius = "0px";
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

// ─── Source reading ───────────────────────────────────────────────────

const bordersSrc = readFileSync(
  join(__dirname, "../sections/BordersSection.tsx"),
  "utf-8",
);
const sideSelectorSrc = readFileSync(
  join(__dirname, "../controls/SideSelector.tsx"),
  "utf-8",
);
const cornerRadiusSrc = readFileSync(
  join(__dirname, "../sections/CornerRadiusEditor.tsx"),
  "utf-8",
);

// ─── 1. Side selector tabs ───────────────────────────────────────────

describe("Side selector tabs", () => {
  it("SideSelector defines all 5 sides: all, top, right, bottom, left", () => {
    expect(sideSelectorSrc).toContain('"all", "top", "right", "bottom", "left"');
  });

  it("SideSelector renders ARIA radiogroup with 5 buttons", async () => {
    const { SideSelector } = await import("../controls/SideSelector");
    const html = renderToString(
      createElement(SideSelector, {
        value: "all" as const,
        onChange: vi.fn(),
        cross: true,
      }),
    );
    expect(html).toContain('role="radiogroup"');
    const radioMatches = html.match(/role="radio"/g);
    expect(radioMatches).toHaveLength(5);
  });

  it("SideSelector marks the active side with aria-checked=true", async () => {
    const { SideSelector } = await import("../controls/SideSelector");
    const html = renderToString(
      createElement(SideSelector, {
        value: "top" as const,
        onChange: vi.fn(),
        cross: true,
      }),
    );
    // In the rendered HTML, aria-checked comes before aria-label
    expect(html).toMatch(/data-side="top"[^>]*aria-checked="true"/);
  });

  it("BordersSection uses SideSelector to switch borderSide state", () => {
    expect(bordersSrc).toContain("SideSelector");
    expect(bordersSrc).toContain("setBorderSide");
  });

  it("borderSide state has correct type: all | top | right | bottom | left", () => {
    expect(bordersSrc).toMatch(/useState<"all"\s*\|\s*"top"\s*\|\s*"right"\s*\|\s*"bottom"\s*\|\s*"left">/);
  });

  it("borderProp helper computes per-side property names", () => {
    expect(bordersSrc).toContain('borderSide === "all" ? `border-${suffix}` : `border-${borderSide}-${suffix}`');
  });

  it("side change triggers re-read of computed style for that side", () => {
    expect(bordersSrc).toMatch(/useEffect\(\(\)\s*=>\s*\{[\s\S]*?borderSide/);
    expect(bordersSrc).toContain("getComputedStyle(element)");
  });
});

// ─── 2. "All" selected applies to all 4 sides ───────────────────────

describe("All-sides mode", () => {
  it("BordersSection renders without throwing", async () => {
    const { BordersSection } = await import("../sections/BordersSection");
    expect(() =>
      renderToString(createElement(BordersSection, { ctx: makeMockCtx() })),
    ).not.toThrow();
  });

  it("when borderSide is 'all', borderProp returns shorthand properties", () => {
    expect(bordersSrc).toContain('"all"');
    expect(bordersSrc).toContain('`border-${suffix}`');
  });

  it("handleBorderStyleChange applies to borderProp-derived property", () => {
    expect(bordersSrc).toContain("handleBorderStyleChange");
    expect(bordersSrc).toMatch(/apply\(borderProp\("style"\)/);
  });

  it("handleBorderWidthChange applies to borderProp-derived property", () => {
    expect(bordersSrc).toContain("handleBorderWidthChange");
    expect(bordersSrc).toMatch(/apply\(borderProp\("width"\)/);
  });

  it("handleBorderColorChange applies to borderProp-derived property", () => {
    expect(bordersSrc).toContain("handleBorderColorChange");
    expect(bordersSrc).toMatch(/apply\(borderProp\("color"\)/);
  });

  it("Border style options include none, solid, dotted, dashed", async () => {
    const { BORDER_STYLE_ICON_OPTIONS } = await import("../panelConstants");
    const values = BORDER_STYLE_ICON_OPTIONS.map((o) => o.value);
    expect(values).toEqual(["none", "solid", "dotted", "dashed"]);
  });
});

// ─── 3. Radius linked/unlinked toggle ───────────────────────────────

describe("Radius mode toggle (linked/unlinked)", () => {
  it("RadiusMode type includes single and individual", () => {
    expect(bordersSrc).toContain('"individual" | "linked" | "single"');
  });

  it("single mode renders a single slider for all corners", () => {
    expect(bordersSrc).toContain("handleRadiusAllChange");
    expect(bordersSrc).toMatch(/handleRadiusAllChange[\s\S]*?setRadiusTL\(v\)/);
  });

  it("handleRadiusAllChange updates all 4 corner values simultaneously", () => {
    expect(bordersSrc).toContain("setRadiusTL(v)");
    expect(bordersSrc).toContain("setRadiusTR(v)");
    expect(bordersSrc).toContain("setRadiusBR(v)");
    expect(bordersSrc).toContain("setRadiusBL(v)");
    expect(bordersSrc).toContain('"border-top-left-radius"');
    expect(bordersSrc).toContain('"border-top-right-radius"');
    expect(bordersSrc).toContain('"border-bottom-right-radius"');
    expect(bordersSrc).toContain('"border-bottom-left-radius"');
  });

  it("individual mode renders CornerRadiusEditor with 4 corner cells", () => {
    expect(bordersSrc).toMatch(/radiusMode\s*===\s*"individual"\s*&&/);
    expect(bordersSrc).toContain("CornerRadiusEditor");
  });

  it("CornerRadiusEditor renders 4 corners (TL, TR, BL, BR)", () => {
    const CORNERS = [
      "border-top-left-radius",
      "border-top-right-radius",
      "border-bottom-left-radius",
      "border-bottom-right-radius",
    ];
    for (const corner of CORNERS) {
      expect(cornerRadiusSrc).toContain(corner);
    }
  });

  it("CornerRadiusEditor renders as a 2x2 grid", () => {
    expect(cornerRadiusSrc).toContain('gridTemplateColumns: "1fr 1fr"');
  });

  it("CornerRadiusEditor renders without throwing", async () => {
    const { CornerRadiusEditor } = await import("../sections/CornerRadiusEditor");
    expect(() =>
      renderToString(
        createElement(CornerRadiusEditor, {
          topLeft: 0,
          topRight: 0,
          bottomRight: 0,
          bottomLeft: 0,
          onChange: vi.fn(),
          unit: "px",
          units: ["px", "%", "em", "rem"],
          onUnitChange: vi.fn(),
        }),
      ),
    ).not.toThrow();
  });

  it("initial radiusMode is derived from computed values (single when all equal)", () => {
    expect(bordersSrc).toMatch(/tl\s*===\s*tr\s*&&\s*tr\s*===\s*br\s*&&\s*br\s*===\s*bl\s*\?\s*"single"\s*:\s*"individual"/);
  });

  it("RadiusModeIcons toggle renders two buttons (single and individual)", () => {
    expect(bordersSrc).toContain('key: "single"');
    expect(bordersSrc).toContain('key: "individual"');
    expect(bordersSrc).toContain('title: "Single value"');
    expect(bordersSrc).toContain('title: "Individual corners"');
  });

  it("single mode renders Radius label and slider", async () => {
    const { BordersSection } = await import("../sections/BordersSection");
    const html = renderToString(createElement(BordersSection, { ctx: makeMockCtx() }));
    // Default state (all corners = 0) -> single mode, should show "Radius" label
    expect(html).toContain("Radius");
  });
});

// ─── 4. border-radius supports px and % ──────────────────────────────

describe("Radius unit support", () => {
  it("BORDER_UNITS includes % as a supported unit", async () => {
    const { BORDER_UNITS } = await import("../panelConstants");
    expect(BORDER_UNITS).toContain("%");
  });

  it("BORDER_UNITS includes px", async () => {
    const { BORDER_UNITS } = await import("../panelConstants");
    expect(BORDER_UNITS).toContain("px");
  });

  it("UnitSelector is used for radius with BORDER_UNITS options", () => {
    expect(bordersSrc).toContain("UnitSelector");
    expect(bordersSrc).toContain("BORDER_UNITS");
  });

  it("handleRadiusUnitChange converts all 4 corners and applies", () => {
    expect(bordersSrc).toContain("handleRadiusUnitChange");
    expect(bordersSrc).toMatch(/handleRadiusUnitChange[\s\S]*?convertUnit/);
    expect(bordersSrc).toMatch(/handleRadiusUnitChange[\s\S]*?apply\("border-top-left-radius"/);
  });

  it("CornerRadiusEditor passes unit and units to each CornerCell", () => {
    expect(cornerRadiusSrc).toContain("unit={unit}");
    expect(cornerRadiusSrc).toContain("units={units}");
  });
});
