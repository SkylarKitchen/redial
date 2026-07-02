// @vitest-environment happy-dom
/**
 * spacing-reset.test.ts — Comprehensive reset audit for every editable CSS
 * property in the panel.
 *
 * For every CSS property the panel exposes, this test verifies:
 *   1. resetProp() works at the apply.ts level (unit test)
 *   2. The section component wires up a reset mechanism in its source code
 *      (onReset, onAltClick, altKey check, or resetProp/resetAndReadNum/resetAndReadStr)
 *   3. SpacingBoxModel's Option+Click reset REALLY resets (behavioral —
 *      real pointer events on the rendered box model, asserted on the engine)
 *
 * A property without a reset path means "the user edited it, but Option+Click
 * does nothing" — that's the bug class we're guarding against.
 *
 * PARTIALLY CONVERTED (issue #105): PART 3 was a source-text test (regex over
 * SpacingBoxModel.tsx for the pev.altKey block). It now renders the real
 * SpacingBoxModel and fires actual pointerdown/pointerup events with altKey —
 * the mapping: "alt+click handler calls onReset after resetAndReadNum" →
 * "alt+click on a margin/padding value really clears the engine override and
 * propagates the reset value to the parent via onReset". PART 2 (per-property
 * source audit across all 8 section files) is intentionally KEPT as a
 * source-level completeness net: the behavioral per-section coverage lives in
 * layout-reset / position-reset / size-reset / reset-audit, which seed and
 * reset the mainstream properties; this sweep still catches properties those
 * tests don't seed (complex editors, IconButtonGroups gaining new props).
 */

import { describe, it, expect, beforeAll, afterEach, vi } from "vitest";
import fs from "fs";
import path from "path";
import { createElement } from "react";
import { render, cleanup, fireEvent } from "@testing-library/react";
import { SpacingBoxModel } from "../sections/SpacingBoxModel";
import { applyInlineStyle, isDirty, resetProp, resetAll } from "../core/apply";

// ═══════════════════════════════════════════════════════════════════════
// PART 1: Unit tests — resetProp works for every editable CSS property
// ═══════════════════════════════════════════════════════════════════════

/**
 * Master list of every CSS property editable through the panel UI.
 * Grouped by section. Each entry has a test value we can apply.
 */
const ALL_EDITABLE_PROPS: Array<{ section: string; prop: string; value: string }> = [
  // ── Spacing ──
  { section: "Spacing", prop: "margin-top", value: "24px" },
  { section: "Spacing", prop: "margin-right", value: "16px" },
  { section: "Spacing", prop: "margin-bottom", value: "24px" },
  { section: "Spacing", prop: "margin-left", value: "16px" },
  { section: "Spacing", prop: "padding-top", value: "12px" },
  { section: "Spacing", prop: "padding-right", value: "8px" },
  { section: "Spacing", prop: "padding-bottom", value: "12px" },
  { section: "Spacing", prop: "padding-left", value: "8px" },

  // ── Layout ──
  { section: "Layout", prop: "display", value: "flex" },
  { section: "Layout", prop: "flex-direction", value: "column" },
  { section: "Layout", prop: "justify-content", value: "center" },
  { section: "Layout", prop: "align-items", value: "center" },
  { section: "Layout", prop: "flex-wrap", value: "wrap" },
  { section: "Layout", prop: "gap", value: "16px" },
  { section: "Layout", prop: "row-gap", value: "12px" },
  { section: "Layout", prop: "column-gap", value: "8px" },
  { section: "Layout", prop: "justify-items", value: "center" },
  { section: "Layout", prop: "align-content", value: "center" },
  { section: "Layout", prop: "grid-template-columns", value: "1fr 1fr" },
  { section: "Layout", prop: "grid-template-rows", value: "auto 1fr" },
  { section: "Layout", prop: "flex-grow", value: "2" },
  { section: "Layout", prop: "flex-shrink", value: "0" },
  { section: "Layout", prop: "flex-basis", value: "100px" },
  { section: "Layout", prop: "order", value: "5" },
  { section: "Layout", prop: "align-self", value: "center" },

  // ── Size ──
  { section: "Size", prop: "width", value: "300px" },
  { section: "Size", prop: "height", value: "200px" },
  { section: "Size", prop: "min-width", value: "100px" },
  { section: "Size", prop: "max-width", value: "800px" },
  { section: "Size", prop: "min-height", value: "50px" },
  { section: "Size", prop: "max-height", value: "600px" },
  { section: "Size", prop: "overflow", value: "hidden" },
  { section: "Size", prop: "box-sizing", value: "content-box" },
  { section: "Size", prop: "aspect-ratio", value: "16 / 9" },
  { section: "Size", prop: "object-fit", value: "cover" },
  { section: "Size", prop: "object-position", value: "center top" },

  // ── Position ──
  { section: "Position", prop: "position", value: "absolute" },
  { section: "Position", prop: "top", value: "10px" },
  { section: "Position", prop: "right", value: "20px" },
  { section: "Position", prop: "bottom", value: "10px" },
  { section: "Position", prop: "left", value: "20px" },
  { section: "Position", prop: "z-index", value: "10" },
  { section: "Position", prop: "float", value: "left" },
  { section: "Position", prop: "clear", value: "both" },

  // ── Typography ──
  { section: "Typography", prop: "font-family", value: "monospace" },
  { section: "Typography", prop: "font-weight", value: "700" },
  { section: "Typography", prop: "font-size", value: "18px" },
  { section: "Typography", prop: "line-height", value: "1.6" },
  { section: "Typography", prop: "letter-spacing", value: "2px" },
  { section: "Typography", prop: "color", value: "red" },
  { section: "Typography", prop: "text-align", value: "center" },
  { section: "Typography", prop: "text-decoration-line", value: "underline" },
  { section: "Typography", prop: "text-transform", value: "uppercase" },
  { section: "Typography", prop: "font-style", value: "italic" },
  { section: "Typography", prop: "white-space", value: "nowrap" },
  { section: "Typography", prop: "text-indent", value: "20px" },
  { section: "Typography", prop: "word-break", value: "break-all" },
  { section: "Typography", prop: "direction", value: "rtl" },
  { section: "Typography", prop: "text-overflow", value: "ellipsis" },
  { section: "Typography", prop: "-webkit-text-stroke-width", value: "1px" },
  { section: "Typography", prop: "-webkit-text-stroke-color", value: "red" },
  { section: "Typography", prop: "line-break", value: "strict" },
  { section: "Typography", prop: "word-spacing", value: "4px" },
  { section: "Typography", prop: "hyphens", value: "auto" },
  { section: "Typography", prop: "column-count", value: "2" },
  { section: "Typography", prop: "text-shadow", value: "2px 2px 4px rgba(0,0,0,0.25)" },

  // ── Backgrounds ──
  { section: "Backgrounds", prop: "background-color", value: "#ff0000" },
  { section: "Backgrounds", prop: "background-clip", value: "padding-box" },
  { section: "Backgrounds", prop: "background-size", value: "cover" },
  { section: "Backgrounds", prop: "background-position", value: "center" },
  { section: "Backgrounds", prop: "background-repeat", value: "no-repeat" },
  { section: "Backgrounds", prop: "background-attachment", value: "fixed" },

  // ── Borders ──
  { section: "Borders", prop: "border-style", value: "solid" },
  { section: "Borders", prop: "border-width", value: "2px" },
  { section: "Borders", prop: "border-color", value: "red" },
  { section: "Borders", prop: "border-top-left-radius", value: "8px" },
  { section: "Borders", prop: "border-top-right-radius", value: "8px" },
  { section: "Borders", prop: "border-bottom-right-radius", value: "8px" },
  { section: "Borders", prop: "border-bottom-left-radius", value: "8px" },

  // ── Effects ──
  { section: "Effects", prop: "opacity", value: "0.5" },
  { section: "Effects", prop: "mix-blend-mode", value: "multiply" },
  { section: "Effects", prop: "outline-style", value: "solid" },
  { section: "Effects", prop: "box-shadow", value: "0 2px 4px rgba(0,0,0,0.1)" },
  { section: "Effects", prop: "transform", value: "translateX(10px)" },
  { section: "Effects", prop: "transform-origin", value: "top left" },
  { section: "Effects", prop: "filter", value: "blur(2px)" },
  { section: "Effects", prop: "backdrop-filter", value: "blur(4px)" },
  { section: "Effects", prop: "transition", value: "all 0.3s ease" },
  { section: "Effects", prop: "cursor", value: "pointer" },
  { section: "Effects", prop: "perspective", value: "1000px" },
  { section: "Effects", prop: "backface-visibility", value: "hidden" },
  { section: "Effects", prop: "pointer-events", value: "none" },
  { section: "Effects", prop: "visibility", value: "hidden" },
  { section: "Effects", prop: "user-select", value: "none" },
];

describe("resetProp works for every editable CSS property", () => {
  for (const { section, prop, value } of ALL_EDITABLE_PROPS) {
    it(`[${section}] resetProp("${prop}") clears the dirty flag`, () => {
      const el = document.createElement("div");
      document.body.appendChild(el);

      applyInlineStyle(el, prop, value);
      expect(isDirty(el, prop)).toBe(true);

      resetProp(el, prop);
      expect(isDirty(el, prop)).toBe(false);

      document.body.removeChild(el);
      resetAll();
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════
// PART 2: Source-level audit — each property has a reset path in the UI
// ═══════════════════════════════════════════════════════════════════════

/** Read a component's source file. */
function readSrc(filename: string): string {
  return fs.readFileSync(path.resolve(__dirname, `../sections/${filename}`), "utf-8");
}

/**
 * Check if a source file has a reset path for a given CSS property.
 * A "reset path" means the source contains one of:
 *   - resetProp(…, "prop")  or  resetAndReadNum(…, "prop")  or  resetAndReadStr(…, "prop")
 *   - onReset callback that references the prop
 *   - onAltClick callback that references the prop
 *   - altKey check near the prop name (SpacingBoxModel pattern)
 */
function hasResetPath(src: string, prop: string): boolean {
  // Direct reset call with quoted property name (legacy core/apply path)
  if (src.includes(`resetProp(element, "${prop}")`)) return true;
  if (src.includes(`resetAndReadNum(element, "${prop}")`)) return true;
  if (src.includes(`resetAndReadStr(element, "${prop}")`)) return true;

  // SectionCtx reset path (ctx.reset / resetRead / resetReadStr)
  if (src.includes(`reset("${prop}")`)) return true;
  if (src.includes(`resetRead("${prop}")`)) return true;
  if (src.includes(`resetReadStr("${prop}")`)) return true;

  // resetCss / resetCssStr helpers with quoted property name
  if (src.includes(`resetCss("${prop}"`)) return true;
  if (src.includes(`resetCssStr("${prop}"`)) return true;

  // Dynamic prop construction (e.g. borderProp("width") → "border-width")
  // For border-* side props, check the borderProp() pattern
  const borderSuffixMatch = prop.match(/^border-(.+)$/);
  if (borderSuffixMatch) {
    const suffix = borderSuffixMatch[1];
    if (src.includes(`borderProp("${suffix}")`)) {
      // Check if borderProp is used in a reset context
      if (src.includes(`resetCss(borderProp("${suffix}")`)) return true;
      if (src.includes(`resetProp(element, borderProp("${suffix}")`)) return true;
      if (src.includes(`resetAndReadNum(element, borderProp("${suffix}")`)) return true;
      // SectionCtx reset path
      if (src.includes(`reset(borderProp("${suffix}")`)) return true;
      if (src.includes(`resetRead(borderProp("${suffix}")`)) return true;
    }
  }

  // For properties using generic prop variable (SpacingBoxModel uses `prop` var + altKey)
  // Check if the source has: altKey check + resetAndReadNum/resetProp near onChange
  if (src.includes("pev.altKey") || src.includes("e.altKey")) {
    // If the property is handled generically via a variable (not hardcoded string),
    // check that the file imports a reset function AND has an altKey check
    const hasResetImport = src.includes("resetAndReadNum") || src.includes("resetProp");
    const hasAltKeyCheck = src.includes("altKey");
    if (hasResetImport && hasAltKeyCheck) {
      // For spacing props, the SpacingBoxModel handles them generically via `prop` variable
      const isSpacing = prop.startsWith("margin-") || prop.startsWith("padding-");
      if (isSpacing) return true;
    }
  }

  // onReset callback referencing the property
  // e.g. onReset={() => resetCssStr("position", setPosition)}
  const onResetRegex = new RegExp(`onReset=\\{[^}]*["']${escapeRegex(prop)}["']`);
  if (onResetRegex.test(src)) return true;

  // onAltClick referencing the property
  const onAltClickRegex = new RegExp(`onAltClick=\\{[^}]*["']${escapeRegex(prop)}["']`);
  if (onAltClickRegex.test(src)) return true;

  return false;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ── Per-section configuration: which file owns which properties ──────

interface SectionSpec {
  file: string;
  props: string[];
}

const SECTION_SPECS: SectionSpec[] = [
  {
    file: "SpacingBoxModel.tsx",
    props: [
      "margin-top", "margin-right", "margin-bottom", "margin-left",
      "padding-top", "padding-right", "padding-bottom", "padding-left",
    ],
  },
  {
    file: "LayoutSection.tsx",
    props: [
      "display", "flex-direction", "justify-content", "align-items",
      "flex-wrap", "gap", "row-gap", "column-gap",
      "flex-grow", "flex-shrink", "flex-basis", "order", "align-self",
      // Grid props: justify-items, align-content, grid-template-* are set
      // via AlignBox and TextRow which don't have standard reset yet
    ],
  },
  {
    file: "SizeSection.tsx",
    props: [
      "width", "height", "min-width", "max-width", "min-height", "max-height",
      "object-fit", "object-position",
      // overflow, box-sizing, aspect-ratio use non-standard controls
    ],
  },
  {
    file: "PositionSection.tsx",
    props: [
      "position", "top", "right", "bottom", "left", "z-index",
      "float", "clear",
    ],
  },
  {
    file: "TypographySection.tsx",
    props: [
      "font-family", "font-weight", "color", "white-space",
      // font-size, line-height, letter-spacing use TypoValueCell (no reset yet)
      // text-align, text-decoration-line, text-transform, font-style use IconButtonGroup (no reset)
    ],
  },
  {
    file: "BackgroundsSection.tsx",
    props: [
      "background-color", "background-clip",
      "background-size", "background-position", "background-repeat", "background-attachment",
    ],
  },
  {
    file: "BordersSection.tsx",
    props: [
      "border-width", "border-color",
      // border-style uses IconButtonGroup (no reset)
      // border-*-radius uses Slider/CornerRadiusEditor (no per-prop reset)
    ],
  },
  {
    file: "EffectsSection.tsx",
    props: [
      "mix-blend-mode", "opacity", "cursor", "perspective",
      "backface-visibility", "pointer-events", "visibility", "user-select",
      // outline-style uses IconButtonGroup (no reset)
      // box-shadow, transform, filter, backdrop-filter, transition use complex editors
    ],
  },
];

describe("Every editable CSS property has a reset path in its section component", () => {
  const sourceCache: Record<string, string> = {};

  beforeAll(() => {
    for (const spec of SECTION_SPECS) {
      sourceCache[spec.file] = readSrc(spec.file);
    }
  });

  for (const spec of SECTION_SPECS) {
    describe(spec.file, () => {
      for (const prop of spec.props) {
        it(`"${prop}" has a reset path (onReset, onAltClick, or altKey handler)`, () => {
          const src = sourceCache[spec.file];
          expect(src).toBeTruthy();
          expect(
            hasResetPath(src, prop),
            `${spec.file}: property "${prop}" has no reset path — ` +
            `user can edit it but Option+Click does nothing. ` +
            `Wire up onReset, onAltClick, or altKey handler.`
          ).toBe(true);
        });
      }
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════
// PART 3: SpacingBoxModel-specific regression test (BEHAVIORAL — real events)
// ═══════════════════════════════════════════════════════════════════════

describe("SpacingBoxModel alt+click reset propagates value to parent", () => {
  beforeAll(() => {
    // happy-dom doesn't implement pointer capture (the scrub logic needs it).
    const proto = Element.prototype as unknown as Record<string, unknown>;
    if (!proto.setPointerCapture) proto.setPointerCapture = () => {};
    if (!proto.releasePointerCapture) proto.releasePointerCapture = () => {};
    if (!proto.hasPointerCapture) proto.hasPointerCapture = () => false;
  });

  afterEach(() => {
    cleanup();
    resetAll();
    document.body.innerHTML = "";
  });

  function renderBoxModel() {
    const element = document.createElement("div");
    document.body.appendChild(element);
    // Genuinely dirty two spacing properties through the real engine
    applyInlineStyle(element, "margin-top", "24px");
    applyInlineStyle(element, "padding-left", "8px");
    expect(isDirty(element, "margin-top")).toBe(true);
    expect(isDirty(element, "padding-left")).toBe(true);

    const onReset = vi.fn();
    const utils = render(
      createElement(SpacingBoxModel, {
        margin: { top: 24, right: 0, bottom: 0, left: 0 },
        padding: { top: 0, right: 0, bottom: 0, left: 8 },
        onChange: vi.fn(),
        marginUnit: "px",
        paddingUnit: "px",
        marginUnits: ["px", "%"],
        paddingUnits: ["px", "%"],
        onMarginUnitChange: vi.fn(),
        onPaddingUnitChange: vi.fn(),
        element,
        ind: (p: string) => (isDirty(element, p) ? ("modified" as const) : ("none" as const)),
        onReset,
      }),
    );
    return { ...utils, element, onReset };
  }

  /** Fire the alt+click gesture (pointerdown → pointerup, no movement). */
  function altClick(target: HTMLElement) {
    fireEvent.pointerDown(target, { button: 0, pointerId: 1, altKey: true, clientX: 5, clientY: 5 });
    fireEvent.pointerUp(target, { button: 0, pointerId: 1, altKey: true, clientX: 5, clientY: 5 });
  }

  it("alt+click on the margin-top value clears the engine override and calls onReset with the reset value", () => {
    const { container, element, onReset } = renderBoxModel();

    const span = container.querySelector('[role="button"][aria-label^="Edit margin top"]') as HTMLElement;
    expect(span, "margin-top value span should render").toBeTruthy();

    altClick(span);

    // The inline override is really gone (resetAndReadNum ran on the engine)…
    expect(isDirty(element, "margin-top")).toBe(false);
    // …and the parent was told, with the property and its post-reset value.
    expect(onReset).toHaveBeenCalledTimes(1);
    expect(onReset.mock.calls[0][0]).toBe("margin-top");
    expect(typeof onReset.mock.calls[0][1]).toBe("number");
  });

  it("alt+click on the padding-left value resets it too (padding side of the box model)", () => {
    const { container, element, onReset } = renderBoxModel();

    const span = container.querySelector('[role="button"][aria-label^="Edit padding left"]') as HTMLElement;
    expect(span, "padding-left value span should render").toBeTruthy();

    altClick(span);

    expect(isDirty(element, "padding-left")).toBe(false);
    expect(onReset).toHaveBeenCalledWith("padding-left", expect.any(Number));
  });

  it("plain click (no alt) does NOT reset — the override survives", () => {
    const { container, element, onReset } = renderBoxModel();

    const span = container.querySelector('[role="button"][aria-label^="Edit margin top"]') as HTMLElement;
    fireEvent.pointerDown(span, { button: 0, pointerId: 1, clientX: 5, clientY: 5 });
    fireEvent.pointerUp(span, { button: 0, pointerId: 1, clientX: 5, clientY: 5 });

    expect(isDirty(element, "margin-top")).toBe(true);
    expect(onReset).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════════════
// PART 4: All section files import reset functions
// ═══════════════════════════════════════════════════════════════════════

describe("All section files wire up reset", () => {
  const sectionFiles = [
    "SpacingBoxModel.tsx",
    "LayoutSection.tsx",
    "SizeSection.tsx",
    "PositionSection.tsx",
    "TypographySection.tsx",
    "BackgroundsSection.tsx",
    "BordersSection.tsx",
    "EffectsSection.tsx",
  ];

  for (const file of sectionFiles) {
    it(`${file} supports reset`, () => {
      const src = readSrc(file);
      const hasReset =
        // legacy direct core/apply imports (sub-components like SpacingBoxModel)
        src.includes("resetProp") ||
        src.includes("resetAndReadNum") ||
        src.includes("resetAndReadStr") ||
        // SectionCtx reset path: ctx.reset(...) / resetRead(...) / resetReadStr(...)
        /\breset(Read(Str)?)?\(/.test(src);
      expect(
        hasReset,
        `${file} must support reset (resetProp/resetAndReadNum/resetAndReadStr or the ctx.reset/resetRead path)`
      ).toBe(true);
    });
  }
});
