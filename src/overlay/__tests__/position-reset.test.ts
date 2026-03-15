// @vitest-environment happy-dom
/**
 * position-reset.test.ts — Verify every control in the Position section
 * supports Option+Click to reset.
 *
 * The existing reset-audit.test.ts catches standard rows (SelectRow,
 * SliderRow, etc.) but the Position section uses several custom
 * components that bypass those checks:
 *
 *   1. PositionSelector — custom dropdown (needs altKey on trigger)
 *   2. PositionOffsetDiagram — EditableValue (needs altKey on click)
 *   3. Z-Index input — auto button + number input (needs altKey)
 *   4. IconButtonGroup for Float/Clear (needs onReset prop + altKey)
 *
 * Rule: if a control can set a value AND shows an orange dot when
 * modified, Option+Click MUST reset it.
 */

import { describe, it, expect, beforeAll } from "vitest";
import fs from "fs";
import path from "path";

function readFile(filename: string): string {
  return fs.readFileSync(
    path.resolve(__dirname, `../${filename}`),
    "utf-8"
  );
}

describe("Position section: Option+Click reset coverage", () => {
  let positionSection: string;
  let positionSelector: string;
  let positionOffsetDiagram: string;
  let iconButtonGroup: string;

  beforeAll(() => {
    positionSection = readFile("sections/PositionSection.tsx");
    positionSelector = readFile("sections/PositionSelector.tsx");
    positionOffsetDiagram = readFile("sections/PositionOffsetDiagram.tsx");
    iconButtonGroup = readFile("controls/IconButtonGroup.tsx");
  });

  // ── PositionSelector (the "Position: Fixed" dropdown) ──

  describe("PositionSelector", () => {
    it("accepts an onReset prop", () => {
      expect(
        positionSelector.includes("onReset"),
        "PositionSelector must accept an onReset prop for Option+Click reset"
      ).toBe(true);
    });

    it("checks altKey on the trigger button click", () => {
      expect(
        positionSelector.includes("altKey"),
        "PositionSelector trigger button must check e.altKey to fire onReset"
      ).toBe(true);
    });
  });

  // ── PositionSection wiring ──

  describe("PositionSection passes onReset to PositionSelector", () => {
    it("passes onReset to <PositionSelector", () => {
      // Find <PositionSelector usage and check it has onReset
      const selectorUsage = positionSection.match(/<PositionSelector[\s\S]*?\/>/);
      expect(selectorUsage, "PositionSelector must be used in PositionSection").toBeTruthy();
      expect(
        selectorUsage![0].includes("onReset"),
        "PositionSection must pass onReset to PositionSelector"
      ).toBe(true);
    });
  });

  // ── PositionOffsetDiagram (top/right/bottom/left inputs) ──

  describe("PositionOffsetDiagram", () => {
    it("accepts an onReset prop", () => {
      expect(
        positionOffsetDiagram.includes("onReset"),
        "PositionOffsetDiagram must accept an onReset callback for Option+Click reset"
      ).toBe(true);
    });

    it("EditableValue checks altKey on click (not just keyDown step)", () => {
      // EditableValue is defined inside PositionOffsetDiagram.tsx
      // Its onClick handler must check e.altKey before entering edit mode.
      // Note: altKey already exists in handleKeyDown for step-size — that doesn't count.
      // We need altKey in a click/pointer handler context for reset.
      const clickHandlers = positionOffsetDiagram.match(/onClick\s*=\s*\{[^}]*altKey[^}]*\}/g);
      expect(
        clickHandlers && clickHandlers.length > 0,
        "EditableValue onClick must check e.altKey to fire onReset instead of entering edit mode"
      ).toBe(true);
    });
  });

  describe("PositionSection passes onReset to PositionOffsetDiagram", () => {
    it("passes onReset to <PositionOffsetDiagram", () => {
      const diagramUsage = positionSection.match(/<PositionOffsetDiagram[\s\S]*?\/>/);
      expect(diagramUsage, "PositionOffsetDiagram must be used in PositionSection").toBeTruthy();
      expect(
        diagramUsage![0].includes("onReset"),
        "PositionSection must pass onReset to PositionOffsetDiagram"
      ).toBe(true);
    });
  });

  // ── Z-Index controls ──

  describe("Z-Index", () => {
    it("z-index auto button checks altKey", () => {
      // The "Auto" button for z-index must check altKey
      // Look for altKey near the z-index area (after "handleZIndexAutoToggle")
      // We check that somewhere in the z-index rendering area, altKey is used
      const zIndexArea = positionSection.slice(
        positionSection.indexOf("Z-Index row"),
        positionSection.indexOf("Columns / Rows") || positionSection.indexOf("Float and clear")
      );
      expect(
        zIndexArea.includes("altKey"),
        "Z-index controls must check e.altKey for Option+Click reset"
      ).toBe(true);
    });
  });

  // ── IconButtonGroup (used for Float and Clear) ──

  describe("IconButtonGroup", () => {
    it("accepts an onReset prop", () => {
      expect(
        iconButtonGroup.includes("onReset"),
        "IconButtonGroup must accept an onReset prop for Option+Click reset"
      ).toBe(true);
    });

    it("checks altKey in click handler", () => {
      expect(
        iconButtonGroup.includes("altKey"),
        "IconButtonGroup must check e.altKey in its click handler to fire onReset"
      ).toBe(true);
    });
  });

  describe("PositionSection passes onReset to Float/Clear IconButtonGroups", () => {
    it("Float IconButtonGroup receives onReset", () => {
      // Find all IconButtonGroup usages, find the float one
      const floatSection = positionSection.slice(
        positionSection.indexOf("Float row"),
        positionSection.indexOf("Clear row")
      );
      expect(
        floatSection.includes("onReset"),
        "Float IconButtonGroup must receive onReset prop"
      ).toBe(true);
    });

    it("Clear IconButtonGroup receives onReset", () => {
      const clearSection = positionSection.slice(
        positionSection.indexOf("Clear row")
      );
      expect(
        clearSection.includes("onReset"),
        "Clear IconButtonGroup must receive onReset prop"
      ).toBe(true);
    });
  });
});
