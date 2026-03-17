/**
 * variableAudit.test.ts — Source-level audit tests for variable system consistency.
 *
 * Catches structural bugs: missing data-tuner-portal on portals, inconsistent
 * VariableField usage, and missing null guards on unlink handlers.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const SRC = join(__dirname, "..");

function readSrc(relPath: string): string {
  return readFileSync(join(SRC, relPath), "utf-8");
}

// ─── Critical: Portal data-tuner-portal attribute ─────────────────────

describe("createPortal wrappers must have data-tuner-portal", () => {
  // Every file that uses createPortal to render to document.body must include
  // data-tuner-portal on the portal root element. Without it, clicks inside
  // the portal are intercepted by Overlay's capture-phase reselect handler.

  const portalFiles = [
    "controls/VariablePicker.tsx",
    "controls/VariableField.tsx",
    "controls/ColorRow.tsx",
    "controls/SelectRow.tsx",
    "controls/UnitSelector.tsx",
    "controls/ResetPopover.tsx",
    "sections/SpacingValuePopover.tsx",
    "sections/SpacingBoxModel.tsx",
    "sections/TextStyleRow.tsx",
    "sections/EffectsSection.tsx",
    "sections/GridSettingsPopup.tsx",
    "sections/PositionSelector.tsx",
    "shell/ContextMenu.tsx",
    "shell/PropertyContextMenu.tsx",
    "variables/CollectionDetail.tsx",
    "variables/CollectionSidebar.tsx",
  ];

  for (const file of portalFiles) {
    it(`${file} has data-tuner-portal on portal root`, () => {
      const src = readSrc(file);
      if (!src.includes("createPortal")) return; // skip if no portal
      expect(src).toContain("data-tuner-portal");
    });
  }
});

// ─── Critical: SpacingValuePopover must use VariableField ─────────────

describe("SpacingValuePopover linked state", () => {
  const src = readSrc("sections/SpacingValuePopover.tsx");

  it("imports VariableField for consistent purple pill rendering", () => {
    expect(src).toMatch(/import.*VariableField.*from/);
  });

  it("renders <VariableField> when linked (not custom inline display)", () => {
    // The linked state should use <VariableField, not a hand-rolled purple div
    expect(src).toContain("<VariableField");
  });
});

// ─── Warning: ColorRow unlink null guard ──────────────────────────────

describe("ColorRow unlink handler", () => {
  const src = readSrc("controls/ColorRow.tsx");

  it("has fallback when resolveVarColor returns null on unlink", () => {
    // The onUnlink handler should NOT silently do nothing when resolvedColor
    // is null. It should fall back to getComputedStyle or at least call
    // onChange with some value.
    //
    // Current code: onChange(resolvedColor) — if resolvedColor is null, no-op.
    // Fixed code should have a fallback path.

    // Look for a getComputedStyle fallback in the unlink handler context
    // The fix should use getComputedStyle as fallback when resolveVarColor fails
    const unlinkSection = src.slice(
      src.indexOf("onUnlink"),
      src.indexOf("onUnlink") + 200,
    );
    // Should have some kind of fallback (getComputedStyle or a conditional)
    // that doesn't silently swallow a null resolvedColor
    const hasNullGuard =
      unlinkSection.includes("getComputedStyle") ||
      unlinkSection.includes("||") ||
      unlinkSection.includes("??");
    expect(hasNullGuard).toBe(true);
  });
});
