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

/** Read a section component's source code */
function readSection(filename: string): string {
  return fs.readFileSync(
    path.resolve(__dirname, `../${filename}`),
    "utf-8"
  );
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

// ── Import-level check: resetProp and resetAndReadNum must be imported ──

describe("All sections import reset functions", () => {
  const sectionFiles = [
    "PositionSection.tsx",
    "TypographySection.tsx",
    "BackgroundsSection.tsx",
    "BordersSection.tsx",
    "EffectsSection.tsx",
  ];

  for (const file of sectionFiles) {
    it(`${file} imports resetProp or resetAndReadNum`, () => {
      const src = readSection(file);
      const hasResetImport =
        src.includes("resetProp") || src.includes("resetAndReadNum");
      expect(
        hasResetImport,
        `${file} must import resetProp or resetAndReadNum from "./apply" to support Option+Click reset`
      ).toBe(true);
    });
  }
});
