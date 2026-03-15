// @vitest-environment happy-dom
/**
 * typographySection.test.ts — Typography section behavioral + structural tests
 *
 * Verifies:
 * 1. Font-family dropdown is searchable
 * 2. Font-weight dropdown shows labels (Thin, Light, Regular, ..., Black) alongside numeric values
 * 3. Text-align icon buttons are mutually exclusive (radio behavior)
 * 4. Text-decoration toggles can combine multiple values (underline + line-through)
 * 5. Text-transform buttons are mutually exclusive
 * 6. Advanced sub-section is collapsed by default and expands on click
 * 7. Advanced sub-section contains ALL spec properties
 */

import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import type { SectionCtx } from "../panelUtils";
import type { UnitConversionContext } from "../unitConversion";

// ─── Source reading ───────────────────────────────────────────────────

const typoSrc = readFileSync(
  join(__dirname, "../sections/TypographySection.tsx"),
  "utf-8",
);

const iconButtonGroupSrc = readFileSync(
  join(__dirname, "../controls/IconButtonGroup.tsx"),
  "utf-8",
);

const panelConstantsSrc = readFileSync(
  join(__dirname, "../panelConstants.tsx"),
  "utf-8",
);

// ─── Helpers ──────────────────────────────────────────────────────────

function makeMockCtx(): SectionCtx {
  const element = document.createElement("div");
  element.style.fontSize = "16px";
  element.style.fontWeight = "400";
  element.style.lineHeight = "1.4";
  element.style.letterSpacing = "0px";
  element.style.color = "rgb(0, 0, 0)";
  element.style.textAlign = "left";
  element.style.textTransform = "none";
  element.style.fontStyle = "normal";
  element.style.fontFamily = "sans-serif";
  element.style.whiteSpace = "normal";
  element.style.textIndent = "0px";
  element.style.wordBreak = "normal";
  element.style.columnCount = "auto";
  element.style.direction = "ltr";
  element.textContent = "Hello world";
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

async function renderTypography(overrides?: Record<string, unknown>) {
  const { TypographySection } = await import("../sections/TypographySection");
  const defaults = {
    ctx: makeMockCtx(),
    columnGap: 0,
    columnGapUnit: "px",
    onColumnGapChange: vi.fn(),
    onColumnGapUnitChange: vi.fn(),
  };
  return renderToString(createElement(TypographySection, { ...defaults, ...overrides }));
}

// ─── 1. Font-family dropdown is searchable ────────────────────────────

describe("Font-family dropdown searchable", () => {
  it("source passes searchable prop to the font SelectRow", () => {
    expect(typoSrc).toMatch(/SelectRow[^>]*label="Font"[^>]*searchable/);
  });

  it("source passes fontPreview prop to the font SelectRow", () => {
    expect(typoSrc).toMatch(/SelectRow[^>]*label="Font"[^>]*fontPreview/);
  });

  it("renders a font-family control in the output", async () => {
    const html = await renderTypography();
    expect(html).toContain("Font");
  });
});

// ─── 2. Font-weight dropdown shows labels alongside numeric values ────

describe("Font-weight dropdown labels", () => {
  it("FONT_WEIGHT_OPTIONS contains all 9 weight levels (100-900)", async () => {
    const { FONT_WEIGHT_OPTIONS } = await import("../panelConstants");
    expect(FONT_WEIGHT_OPTIONS).toHaveLength(9);

    const values = FONT_WEIGHT_OPTIONS.map((o: { value: string }) => o.value);
    expect(values).toEqual(["100", "200", "300", "400", "500", "600", "700", "800", "900"]);
  });

  it("each weight option includes a descriptive label (Thin, Light, Regular, ..., Black)", async () => {
    const { FONT_WEIGHT_OPTIONS } = await import("../panelConstants");
    const expectedNames = ["Thin", "Extra Light", "Light", "Regular", "Medium", "Semi Bold", "Bold", "Extra Bold", "Black"];

    for (const name of expectedNames) {
      const match = FONT_WEIGHT_OPTIONS.find((o: { label: string }) => o.label.includes(name));
      expect(match, `Expected a weight option containing "${name}"`).toBeTruthy();
    }
  });

  it("weight labels combine numeric value + name (e.g. '400 - Regular')", async () => {
    const { FONT_WEIGHT_OPTIONS } = await import("../panelConstants");
    const regular = FONT_WEIGHT_OPTIONS.find((o: { value: string }) => o.value === "400");
    expect(regular.label).toBe("400 - Regular");

    const bold = FONT_WEIGHT_OPTIONS.find((o: { value: string }) => o.value === "700");
    expect(bold.label).toBe("700 - Bold");
  });

  it("source uses FONT_WEIGHT_OPTIONS for the weight SelectRow", () => {
    expect(typoSrc).toMatch(/SelectRow[^>]*label="Weight"[^>]*options=\{FONT_WEIGHT_OPTIONS\}/);
  });

  it("renders weight controls in the output", async () => {
    const html = await renderTypography();
    expect(html).toContain("Weight");
  });
});

// ─── 3. Text-align icon buttons are mutually exclusive (radio) ────────

describe("Text-align radio behavior", () => {
  it("TEXT_ALIGN_OPTIONS has 4 values: left, center, right, justify", async () => {
    const { TEXT_ALIGN_OPTIONS } = await import("../panelConstants");
    expect(TEXT_ALIGN_OPTIONS).toHaveLength(4);

    const values = TEXT_ALIGN_OPTIONS.map((o: { value: string }) => o.value);
    expect(values).toEqual(["left", "center", "right", "justify"]);
  });

  it("text-align IconButtonGroup does NOT pass multi prop (defaults to radio)", () => {
    // Find the IconButtonGroup for TEXT_ALIGN_OPTIONS and verify no multi prop
    const alignMatch = typoSrc.match(
      /<IconButtonGroup\s+options=\{TEXT_ALIGN_OPTIONS\}[^/]*?\/>/,
    );
    expect(alignMatch, "Could not find text-align IconButtonGroup").toBeTruthy();
    // The match should NOT contain "multi"
    expect(alignMatch![0]).not.toContain("multi");
  });

  it("IconButtonGroup uses type='single' when multi is false", () => {
    expect(iconButtonGroupSrc).toContain('type="single"');
  });

  it("IconButtonGroup items get role='radio' in single mode", () => {
    expect(iconButtonGroupSrc).toMatch(/role=\{multi \? undefined : "radio"\}/);
  });

  it("IconButtonGroup single mode: clicking same value toggles to 'none'", () => {
    expect(iconButtonGroupSrc).toContain('optValue === value ? "none" : optValue');
  });
});

// ─── 4. Text-decoration toggles can combine multiple values ───────────

describe("Text-decoration multi-toggle behavior", () => {
  it("text-decoration IconButtonGroup passes multi prop", () => {
    const decoMatch = typoSrc.match(
      /<IconButtonGroup\s+options=\{TEXT_DECORATION_OPTIONS\}[^/]*?multi[^/]*?\/>/,
    );
    expect(decoMatch, "Could not find text-decoration IconButtonGroup with multi").toBeTruthy();
  });

  it("TEXT_DECORATION_OPTIONS includes none, line-through, underline, overline", async () => {
    const { TEXT_DECORATION_OPTIONS } = await import("../panelConstants");
    const values = TEXT_DECORATION_OPTIONS.map((o: { value: string }) => o.value);
    expect(values).toContain("none");
    expect(values).toContain("line-through");
    expect(values).toContain("underline");
    expect(values).toContain("overline");
  });

  it("IconButtonGroup multi mode combines values with space separator", () => {
    expect(iconButtonGroupSrc).toContain("Array.from(current).join(\" \")");
  });

  it("IconButtonGroup uses type='multiple' when multi is true", () => {
    expect(iconButtonGroupSrc).toContain('type="multiple"');
  });

  it("IconButtonGroup items get aria-pressed in multi mode", () => {
    expect(iconButtonGroupSrc).toMatch(/aria-pressed=\{multi \? isActive : undefined\}/);
  });

  it("clicking 'none' in multi mode clears all selections", () => {
    expect(iconButtonGroupSrc).toContain('if (optValue === "none")');
    expect(iconButtonGroupSrc).toContain('onChange("none")');
  });
});

// ─── 5. Text-transform buttons are mutually exclusive ─────────────────

describe("Text-transform radio behavior", () => {
  it("CAPITALIZE_OPTIONS has 4 values: none, uppercase, capitalize, lowercase", async () => {
    const { CAPITALIZE_OPTIONS } = await import("../panelConstants");
    expect(CAPITALIZE_OPTIONS).toHaveLength(4);

    const values = CAPITALIZE_OPTIONS.map((o: { value: string }) => o.value);
    expect(values).toEqual(["none", "uppercase", "capitalize", "lowercase"]);
  });

  it("text-transform IconButtonGroup does NOT pass multi prop", () => {
    const capsMatch = typoSrc.match(
      /<IconButtonGroup\s+options=\{CAPITALIZE_OPTIONS\}[^/]*?\/>/,
    );
    expect(capsMatch, "Could not find text-transform IconButtonGroup").toBeTruthy();
    expect(capsMatch![0]).not.toContain("multi");
  });

  it("text-transform uses handleTextTransformChange which applies text-transform CSS", () => {
    expect(typoSrc).toContain('apply("text-transform", v)');
  });
});

// ─── 6. Advanced sub-section collapsed by default, expands on click ───

describe("Advanced sub-section toggle", () => {
  it("showTypoAdvanced is initialized to false (collapsed by default)", () => {
    expect(typoSrc).toMatch(/useState\(false\)/);
    expect(typoSrc).toContain("showTypoAdvanced");
  });

  it("advanced content is gated by {showTypoAdvanced && (...)}", () => {
    expect(typoSrc).toMatch(/\{showTypoAdvanced\s*&&\s*\(/);
  });

  it("toggle button text says 'More type options'", () => {
    expect(typoSrc).toContain("More type options");
  });

  it("toggle button flips showTypoAdvanced state on click", () => {
    expect(typoSrc).toContain("setShowTypoAdvanced(!showTypoAdvanced)");
  });

  it("renders with advanced section collapsed by default (no advanced controls visible)", async () => {
    const html = await renderTypography();
    // Advanced section has controls like "Letter spacing", "Text indent", etc.
    // When collapsed, these should NOT appear
    expect(html).toContain("More type options");
    expect(html).not.toContain("Letter spacing");
    expect(html).not.toContain("Text indent");
    expect(html).not.toContain("Columns");
    expect(html).not.toContain("Word spacing");
    expect(html).not.toContain("Hyphens");
    expect(html).not.toContain("Text shadows");
  });

  it("chevron rotates when expanded (source uses rotate(90deg))", () => {
    expect(typoSrc).toContain('showTypoAdvanced ? "rotate(90deg)" : "rotate(0deg)"');
  });
});

// ─── 7. Advanced sub-section includes ALL spec properties ─────────────

describe("Advanced sub-section spec completeness", () => {
  it("includes word-spacing control", () => {
    expect(typoSrc).toContain("Word spacing");
    expect(typoSrc).toContain('apply("word-spacing"');
  });

  it("includes white-space (Wrap) control", () => {
    expect(typoSrc).toContain('label="Wrap"');
    expect(typoSrc).toContain("WHITE_SPACE_OPTIONS");
    expect(typoSrc).toContain('apply("white-space"');
  });

  it("white-space includes break-spaces option", async () => {
    const { WHITE_SPACE_OPTIONS } = await import("../panelConstants");
    const values = WHITE_SPACE_OPTIONS.map((o: { value: string }) => o.value);
    expect(values).toContain("break-spaces");
  });

  it("includes text-indent control", () => {
    expect(typoSrc).toContain("Text indent");
    expect(typoSrc).toContain('apply("text-indent"');
  });

  it("includes word-break control", () => {
    expect(typoSrc).toContain("WORD_BREAK_OPTIONS");
    expect(typoSrc).toContain('apply("word-break"');
  });

  it("includes hyphens control", () => {
    expect(typoSrc).toContain("HYPHENS_OPTIONS");
    expect(typoSrc).toContain('apply("hyphens"');
  });

  it("includes direction control (LTR/RTL)", () => {
    expect(typoSrc).toContain("DIRECTION_OPTIONS");
    expect(typoSrc).toContain("Direction");
    expect(typoSrc).toContain('apply("direction"');
  });

  it("includes column-count control", () => {
    expect(typoSrc).toContain("Columns");
    expect(typoSrc).toContain('apply("column-count"');
  });

  it("includes column-gap control", () => {
    expect(typoSrc).toContain("Column gap");
    expect(typoSrc).toContain('apply("column-gap"');
  });

  it("includes text-shadow editor with ShadowEditor component", () => {
    expect(typoSrc).toContain("Text shadows");
    expect(typoSrc).toContain("<ShadowEditor");
    expect(typoSrc).toContain('apply("text-shadow"');
  });

  it("includes letter-spacing control", () => {
    expect(typoSrc).toContain("Letter spacing");
    expect(typoSrc).toContain('apply("letter-spacing"');
  });

  it("includes text-overflow (Truncate) control with clip/ellipsis options", () => {
    expect(typoSrc).toContain("Truncate");
    expect(typoSrc).toContain('apply("text-overflow"');
    expect(typoSrc).toContain('"clip"');
    expect(typoSrc).toContain('"ellipsis"');
  });

  it("includes line-break control", () => {
    expect(typoSrc).toContain("LINE_BREAK_OPTIONS");
    expect(typoSrc).toContain('apply("line-break"');
  });

  it("includes text-stroke controls (width + color)", () => {
    expect(typoSrc).toContain("Stroke");
    expect(typoSrc).toContain('apply("-webkit-text-stroke-width"');
    expect(typoSrc).toContain('apply("-webkit-text-stroke-color"');
  });

  it("all advanced controls are inside the showTypoAdvanced guard", () => {
    const guardIdx = typoSrc.indexOf("{showTypoAdvanced && (");
    expect(guardIdx).toBeGreaterThan(-1);

    const advancedBlock = typoSrc.slice(guardIdx);

    const expectedInAdvanced = [
      "Letter spacing",
      "Text indent",
      "Columns",
      "Column gap",
      "Word spacing",
      "Hyphens",
      "Case",
      "Direction",
      "Breaking",
      "Wrap",
      "Truncate",
      "Stroke",
      "Text shadows",
    ];

    for (const label of expectedInAdvanced) {
      expect(advancedBlock, `Advanced block should contain "${label}"`).toContain(label);
    }
  });
});

// ─── Smoke test: renders without throwing ─────────────────────────────

describe("TypographySection render smoke test", () => {
  it("renders without throwing", async () => {
    await expect(renderTypography()).resolves.toBeDefined();
  });

  it("renders the section title 'Typography'", async () => {
    const html = await renderTypography();
    expect(html).toContain("Typography");
  });

  it("renders core controls: Font, Weight, Size, Height, Color, Align", async () => {
    const html = await renderTypography();
    expect(html).toContain("Font");
    expect(html).toContain("Weight");
    expect(html).toContain("Size");
    expect(html).toContain("Height");
    expect(html).toContain("Color");
    expect(html).toContain("Align");
  });

  it("renders Style row with Italicize and Decoration sub-labels", async () => {
    const html = await renderTypography();
    expect(html).toContain("Italicize");
    expect(html).toContain("Decoration");
  });
});

// ─── Option arrays completeness ───────────────────────────────────────

describe("Typography-related option arrays completeness", () => {
  it("HYPHENS_OPTIONS includes none, manual, auto", async () => {
    const { HYPHENS_OPTIONS } = await import("../panelConstants");
    const values = HYPHENS_OPTIONS.map((o: { value: string }) => o.value);
    expect(values).toEqual(["none", "manual", "auto"]);
  });

  it("WORD_BREAK_OPTIONS includes normal, break-all, keep-all, break-word", async () => {
    const { WORD_BREAK_OPTIONS } = await import("../panelConstants");
    const values = WORD_BREAK_OPTIONS.map((o: { value: string }) => o.value);
    expect(values).toEqual(["normal", "break-all", "keep-all", "break-word"]);
  });

  it("LINE_BREAK_OPTIONS includes auto, normal, loose, strict, anywhere", async () => {
    const { LINE_BREAK_OPTIONS } = await import("../panelConstants");
    const values = LINE_BREAK_OPTIONS.map((o: { value: string }) => o.value);
    expect(values).toEqual(["auto", "normal", "loose", "strict", "anywhere"]);
  });

  it("DIRECTION_OPTIONS has ltr and rtl", async () => {
    const { DIRECTION_OPTIONS } = await import("../panelConstants");
    const values = DIRECTION_OPTIONS.map((o: { value: string }) => o.value);
    expect(values).toEqual(["ltr", "rtl"]);
  });

  it("ITALIC_OPTIONS has normal and italic", async () => {
    const { ITALIC_OPTIONS } = await import("../panelConstants");
    const values = ITALIC_OPTIONS.map((o: { value: string }) => o.value);
    expect(values).toEqual(["normal", "italic"]);
  });

  it("WHITE_SPACE_OPTIONS includes all 6 values including break-spaces", async () => {
    const { WHITE_SPACE_OPTIONS } = await import("../panelConstants");
    expect(WHITE_SPACE_OPTIONS).toHaveLength(6);
    const values = WHITE_SPACE_OPTIONS.map((o: { value: string }) => o.value);
    expect(values).toEqual(["normal", "nowrap", "pre", "pre-wrap", "pre-line", "break-spaces"]);
  });
});
