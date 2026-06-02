// @vitest-environment happy-dom
/**
 * reset-audit.test.ts — Comprehensive audit that every control showing an
 * orange "modified" dot (via computedProp/computedElement) also wires up
 * onReset for Option+Click reset.
 *
 * The rule: if a SelectRow/SliderRow/ColorRow/TextRow has computedProp,
 * it MUST also have onReset. Otherwise the orange dot promises reset
 * functionality that doesn't work.
 */

import { describe, it, expect, beforeAll } from "vitest";
import fs from "fs";
import path from "path";

/** Read a component's source code (defaults to sections/ subdir) */
function readSection(filename: string): string {
  // Try sections/ first, fall back to overlay root
  const sectionsPath = path.resolve(__dirname, `../sections/${filename}`);
  const rootPath = path.resolve(__dirname, `../${filename}`);
  try {
    return fs.readFileSync(sectionsPath, "utf-8");
  } catch {
    return fs.readFileSync(rootPath, "utf-8");
  }
}

/**
 * Find all instances of a given control (e.g. SelectRow) and check
 * that each one with computedProp also has onReset.
 * Returns array of labels that are missing onReset.
 */
function findMissingResets(src: string, controlName: string): string[] {
  // Split on control start tags
  const regex = new RegExp(`<${controlName}\\b`, "g");
  const missing: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = regex.exec(src)) !== null) {
    // Extract the full JSX element from the match position
    const start = match.index;
    // Find the closing /> or > for this element
    let depth = 0;
    let end = start;
    for (let i = start; i < src.length; i++) {
      if (src[i] === "<") depth++;
      if (src.slice(i, i + 2) === "/>") {
        end = i + 2;
        break;
      }
      if (src[i] === ">" && depth === 1) {
        end = i + 1;
        break;
      }
    }
    const block = src.slice(start, end);

    // Only check controls that have computedProp (these show the orange dot)
    if (!block.includes("computedProp")) continue;

    // Extract label for error message
    const labelMatch = block.match(/label="([^"]+)"/);
    const label = labelMatch ? labelMatch[1] : "unknown";

    if (!block.includes("onReset")) {
      missing.push(label);
    }
  }
  return missing;
}

/**
 * Find all SubSectionHeader instances that have an `indicator` prop
 * but are missing `onReset`. The rule: if a sub-section shows the
 * orange modified dot, it must support resetting.
 */
function findMissingSubSectionResets(src: string): string[] {
  const regex = /<SubSectionHeader\b/g;
  const missing: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = regex.exec(src)) !== null) {
    const start = match.index;
    let end = start;
    for (let i = start; i < src.length; i++) {
      if (src.slice(i, i + 2) === "/>") { end = i + 2; break; }
    }
    const block = src.slice(start, end);

    if (!block.includes("indicator")) continue;

    const labelMatch = block.match(/label="([^"]+)"/);
    const label = labelMatch ? labelMatch[1] : "unknown";

    if (!block.includes("onReset")) {
      missing.push(label);
    }
  }
  return missing;
}

describe("Option+Click reset audit: every control with computedProp must have onReset", () => {
  // ── PositionSection ──
  describe("PositionSection", () => {
    let src: string;
    beforeAll(() => { src = readSection("PositionSection.tsx"); });

    it("all SelectRows with computedProp have onReset", () => {
      const missing = findMissingResets(src, "SelectRow");
      expect(missing, `SelectRows missing onReset: ${missing.join(", ")}`).toEqual([]);
    });

    it("all SliderRows with computedProp have onReset", () => {
      const missing = findMissingResets(src, "SliderRow");
      expect(missing, `SliderRows missing onReset: ${missing.join(", ")}`).toEqual([]);
    });
  });

  // ── TypographySection ──
  describe("TypographySection", () => {
    let src: string;
    beforeAll(() => { src = readSection("TypographySection.tsx"); });

    it("all SelectRows with computedProp have onReset", () => {
      const missing = findMissingResets(src, "SelectRow");
      expect(missing, `SelectRows missing onReset: ${missing.join(", ")}`).toEqual([]);
    });

    it("all ColorRows with computedProp have onReset", () => {
      const missing = findMissingResets(src, "ColorRow");
      expect(missing, `ColorRows missing onReset: ${missing.join(", ")}`).toEqual([]);
    });
  });

  // ── BackgroundsSection ──
  describe("BackgroundsSection", () => {
    let src: string;
    beforeAll(() => { src = readSection("BackgroundsSection.tsx"); });

    it("all SelectRows with computedProp have onReset", () => {
      const missing = findMissingResets(src, "SelectRow");
      expect(missing, `SelectRows missing onReset: ${missing.join(", ")}`).toEqual([]);
    });

    it("all ColorRows with computedProp have onReset", () => {
      const missing = findMissingResets(src, "ColorRow");
      expect(missing, `ColorRows missing onReset: ${missing.join(", ")}`).toEqual([]);
    });
  });

  // ── BordersSection ──
  describe("BordersSection", () => {
    let src: string;
    beforeAll(() => { src = readSection("BordersSection.tsx"); });

    it("all SelectRows with computedProp have onReset", () => {
      const missing = findMissingResets(src, "SelectRow");
      expect(missing, `SelectRows missing onReset: ${missing.join(", ")}`).toEqual([]);
    });

    it("all ColorRows with computedProp have onReset", () => {
      const missing = findMissingResets(src, "ColorRow");
      expect(missing, `ColorRows missing onReset: ${missing.join(", ")}`).toEqual([]);
    });
  });

  // ── EffectsSection ──
  describe("EffectsSection", () => {
    let src: string;
    beforeAll(() => { src = readSection("EffectsSection.tsx"); });

    it("all SelectRows with computedProp have onReset", () => {
      const missing = findMissingResets(src, "SelectRow");
      expect(missing, `SelectRows missing onReset: ${missing.join(", ")}`).toEqual([]);
    });

    it("all SliderRows with computedProp have onReset", () => {
      const missing = findMissingResets(src, "SliderRow");
      expect(missing, `SliderRows missing onReset: ${missing.join(", ")}`).toEqual([]);
    });

    it("all SubSectionHeaders with indicator have onReset", () => {
      const missing = findMissingSubSectionResets(src);
      expect(missing, `SubSectionHeaders missing onReset: ${missing.join(", ")}`).toEqual([]);
    });
  });

  // ── SizeSection (more size options) ──
  describe("SizeSection", () => {
    let src: string;
    beforeAll(() => { src = readSection("SizeSection.tsx"); });

    it("all SelectRows with computedProp have onReset", () => {
      const missing = findMissingResets(src, "SelectRow");
      expect(missing, `SelectRows missing onReset: ${missing.join(", ")}`).toEqual([]);
    });

    it("all TextRows with computedProp have onReset", () => {
      const missing = findMissingResets(src, "TextRow");
      expect(missing, `TextRows missing onReset: ${missing.join(", ")}`).toEqual([]);
    });
  });
});

// ── BordersSection custom controls: Radius, Style, Width must have indicator + reset ──

describe("BordersSection custom controls have indicator + reset wiring", () => {
  let src: string;
  beforeAll(() => { src = readSection("BordersSection.tsx"); });

  it("Radius label uses indicatorStyle (not bare LABEL)", () => {
    // The Radius label span must use indicatorStyle() for the modified highlight pill.
    // A bare `style={LABEL}` or `style={{ ...LABEL }}` with no indicator is a bug.
    const hasIndicator = src.includes("indicatorStyle") && /Radius[\s\S]{0,300}indicatorStyle/.test(src);
    expect(hasIndicator, "Radius label must use indicatorStyle() for modified highlight").toBe(true);
  });

  it("Radius row has alt-click reset handler", () => {
    // The Radius row must handle option+click to batch-reset all 4 corners
    const hasRadiusReset = /handleRadiusReset|radiusReset|altKey[\s\S]{0,100}Radius|Radius[\s\S]{0,300}altKey/.test(src);
    expect(hasRadiusReset, "Radius row must have alt-click reset handler").toBe(true);
  });

  it("Radius row has useResetPopover for click-to-show", () => {
    const hasPopover = /radiusPopover|useResetPopover[\s\S]{0,100}radius|useResetPopover[\s\S]{0,100}Radius/.test(src);
    expect(hasPopover, "Radius row must use useResetPopover for click-on-label reset").toBe(true);
  });

  it("Style label uses indicatorStyle", () => {
    // The border Style label must show modified highlight via indicatorStyle()
    const hasIndicator = /Style[\s\S]{0,300}indicatorStyle|styleInd[\s\S]{0,100}indicatorStyle/.test(src);
    expect(hasIndicator, "Style label must use indicatorStyle() for modified highlight").toBe(true);
  });

  it("Style row has reset handler", () => {
    const hasReset = /handleStyleReset|styleReset|Style[\s\S]{0,300}(altKey|onReset|resetProp)/.test(src);
    expect(hasReset, "Style row must have reset handler").toBe(true);
  });

  it("Width label uses indicatorStyle", () => {
    // The border Width label must show modified highlight via indicatorStyle()
    const hasIndicator = /Width[\s\S]{0,300}indicatorStyle|widthInd[\s\S]{0,100}indicatorStyle/.test(src);
    expect(hasIndicator, "Width label must use indicatorStyle() for modified highlight").toBe(true);
  });

  it("sectionInd uses individual corner properties (not shorthand border-radius)", () => {
    // The section header must list individual corners for accurate dirty tracking
    const usesIndividual = src.includes("border-top-left-radius") && src.includes("border-bottom-right-radius");
    expect(usesIndividual, "sectionInd must use individual corner CSS properties for accurate dirty tracking").toBe(true);
  });
});

// ── CornerRadiusEditor must accept indicator/reset props ──

describe("CornerRadiusEditor has indicator + reset props", () => {
  let src: string;
  beforeAll(() => { src = readSection("CornerRadiusEditor.tsx"); });

  it("accepts indicators prop", () => {
    const hasIndicators = src.includes("indicators");
    expect(hasIndicators, "CornerRadiusEditor must accept indicators prop for per-corner modified state").toBe(true);
  });

  it("accepts onCornerReset prop", () => {
    const hasReset = src.includes("onCornerReset");
    expect(hasReset, "CornerRadiusEditor must accept onCornerReset prop for per-corner alt-click reset").toBe(true);
  });
});

// ── Reset wiring check: every section must support Option+Click reset ──
// Either via the legacy direct core/apply import (resetProp/resetAndReadNum)
// or via the SectionCtx reset path (ctx.reset / resetRead / resetReadStr).

describe("All sections wire up reset", () => {
  const sectionFiles = [
    "PositionSection.tsx",
    "TypographySection.tsx",
    "BackgroundsSection.tsx",
    "BordersSection.tsx",
    "EffectsSection.tsx",
  ];

  for (const file of sectionFiles) {
    it(`${file} supports Option+Click reset`, () => {
      const src = readSection(file);
      const hasReset =
        src.includes("resetProp") ||
        src.includes("resetAndReadNum") ||
        // ctx.reset(...) / resetRead(...) / resetReadStr(...)
        /\breset(Read(Str)?)?\(/.test(src);
      expect(
        hasReset,
        `${file} must support Option+Click reset (resetProp/resetAndReadNum or the ctx.reset/resetRead path)`
      ).toBe(true);
    });
  }
});

// ── SubSectionHeader audit: ALL section files must use shared component ──

describe("SubSectionHeader is shared — no local definitions", () => {
  const sectionFiles = [
    "EffectsSection.tsx",
    "BackgroundsSection.tsx",
    "TypographySection.tsx",
  ];

  for (const file of sectionFiles) {
    it(`${file} does not define a local SubSectionHeader`, () => {
      const src = readSection(file);
      const hasLocalDef = /^function SubSectionHeader/m.test(src);
      expect(
        hasLocalDef,
        `${file} still has a local SubSectionHeader — must import from ./controls`
      ).toBe(false);
    });
  }

  it("controls exports SubSectionHeader", () => {
    const src = fs.readFileSync(path.resolve(__dirname, "../controls/SubSectionHeader.tsx"), "utf-8");
    expect(src).toContain("export function SubSectionHeader");
  });
});

describe("SubSectionHeader with indicator must have onReset (all section files)", () => {
  const sectionFilesWithSubSectionHeader = [
    "EffectsSection.tsx",
    "BackgroundsSection.tsx",
    "TypographySection.tsx",
  ];

  for (const file of sectionFilesWithSubSectionHeader) {
    it(`${file}: all SubSectionHeaders with indicator have onReset`, () => {
      const src = readSection(file);
      const missing = findMissingSubSectionResets(src);
      expect(missing, `SubSectionHeaders missing onReset in ${file}: ${missing.join(", ")}`).toEqual([]);
    });
  }
});

// ── LayoutSection coverage ──

describe("LayoutSection", () => {
  let src: string;
  beforeAll(() => { src = readSection("LayoutSection.tsx"); });

  it("all SelectRows with computedProp have onReset", () => {
    const missing = findMissingResets(src, "SelectRow");
    expect(missing, `SelectRows missing onReset: ${missing.join(", ")}`).toEqual([]);
  });

  it("all SliderRows with computedProp have onReset", () => {
    const missing = findMissingResets(src, "SliderRow");
    expect(missing, `SliderRows missing onReset: ${missing.join(", ")}`).toEqual([]);
  });

  it("all NumberRows with computedProp have onReset", () => {
    const missing = findMissingResets(src, "NumberRow");
    expect(missing, `NumberRows missing onReset: ${missing.join(", ")}`).toEqual([]);
  });
});

// ── SizeSection TextRow coverage ──

describe("SizeSection TextRows", () => {
  let src: string;
  beforeAll(() => { src = readSection("SizeSection.tsx"); });

  it("Aspect TextRow has computedProp and onReset", () => {
    const missing = findMissingResets(src, "TextRow");
    expect(missing, `TextRows missing onReset: ${missing.join(", ")}`).toEqual([]);
  });
});

// ── EditorRemoveButton and VisibilityToggle: shared component usage audit ──

describe("Editor files use shared EditorRemoveButton (no inline X buttons)", () => {
  const editorFiles = [
    "TransformEditor.tsx",
    "ShadowEditor.tsx",
    "FilterSliders.tsx",
    "TransitionEditor.tsx",
  ];

  for (const file of editorFiles) {
    it(`${file} imports EditorRemoveButton from ./controls`, () => {
      const src = readSection(file);
      expect(src).toContain("EditorRemoveButton");
    });

    it(`${file} does not have inline <X size= buttons`, () => {
      const src = readSection(file);
      // Should not have direct X icon usage for remove buttons
      const hasInlineX = /<X\s+size=/.test(src);
      expect(
        hasInlineX,
        `${file} still has inline <X size=...> — must use EditorRemoveButton`
      ).toBe(false);
    });
  }

  it("controls exports EditorRemoveButton", () => {
    const src = fs.readFileSync(path.resolve(__dirname, "../controls/EditorRemoveButton.tsx"), "utf-8");
    expect(src).toContain("export function EditorRemoveButton");
  });
});

describe("Editor files use shared VisibilityToggle (no inline Eye imports)", () => {
  const editorFiles = [
    "ShadowEditor.tsx",
    "FilterSliders.tsx",
    "TransitionEditor.tsx",
    "BackgroundLayerList.tsx",
  ];

  for (const file of editorFiles) {
    it(`${file} imports VisibilityToggle from ./controls`, () => {
      const src = readSection(file);
      expect(src).toContain("VisibilityToggle");
    });

    it(`${file} does not import Eye/EyeOff from lucide-react`, () => {
      const src = readSection(file);
      const importsEye = /import\s*\{[^}]*\bEye\b[^}]*\}\s*from\s*["']lucide-react["']/.test(src);
      expect(
        importsEye,
        `${file} still imports Eye from lucide-react — must use VisibilityToggle`
      ).toBe(false);
    });
  }

  it("controls exports VisibilityToggle", () => {
    const src = fs.readFileSync(path.resolve(__dirname, "../controls/VisibilityToggle.tsx"), "utf-8");
    expect(src).toContain("export function VisibilityToggle");
  });
});

// ── BackgroundLayerList intentionally keeps its custom delete button ──

describe("BackgroundLayerList keeps custom delete button", () => {
  it("still uses X from lucide-react (intentional 20×20 destructive variant)", () => {
    const src = readSection("BackgroundLayerList.tsx");
    const hasX = /import\s*\{[^}]*\bX\b[^}]*\}\s*from\s*["']lucide-react["']/.test(src);
    expect(hasX, "BackgroundLayerList should keep X for its 20×20 destructive delete button").toBe(true);
  });
});
