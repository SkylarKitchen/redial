/**
 * usePortalDropdown.test.ts — Tests for the shared portal dropdown hook
 *
 * Verifies:
 * - Position computation with flip-above logic
 * - Ref-based click-outside (portalRef, not querySelector)
 * - Dynamic height correction via useLayoutEffect
 * - Hook used by all 4 portal dropdown components
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const overlayDir = join(__dirname, "..");
const hookSrc = readFileSync(join(overlayDir, "hooks", "usePortalDropdown.ts"), "utf-8");
const unitSrc = readFileSync(join(overlayDir, "UnitSelector.tsx"), "utf-8");
const positionSrc = readFileSync(join(overlayDir, "sections", "PositionSelector.tsx"), "utf-8");
const controlsSrc = readFileSync(join(overlayDir, "controls.tsx"), "utf-8");
const textStyleSrc = readFileSync(join(overlayDir, "sections", "TextStyleRow.tsx"), "utf-8");

// ─── Hook implementation ──────────────────────────────────────────

describe("usePortalDropdown hook implementation", () => {
  it("exports usePortalDropdown function", () => {
    expect(hookSrc).toContain("export function usePortalDropdown");
  });

  it("exports PortalDropdownPos interface", () => {
    expect(hookSrc).toContain("export interface PortalDropdownPos");
  });

  it("returns dropdownPos, updateDropdownPos, and portalRef", () => {
    expect(hookSrc).toContain("return { dropdownPos, updateDropdownPos, portalRef }");
  });

  it("uses portalRef for click-outside (not querySelector)", () => {
    expect(hookSrc).toContain("portalRef.current?.contains(target)");
    // No querySelector() calls — only mentioned in comments
    expect(hookSrc).not.toMatch(/querySelector\s*\(/);
  });

  it("uses useLayoutEffect for dynamic height measurement", () => {
    expect(hookSrc).toContain("useLayoutEffect");
    expect(hookSrc).toContain("getBoundingClientRect().height");
  });

  it("computes flip-above position based on estimated height", () => {
    expect(hookSrc).toContain("estimatedHeight");
    expect(hookSrc).toContain("spaceBelow < estimatedHeight");
  });

  it("includes correction flag to prevent infinite reposition loop", () => {
    expect(hookSrc).toContain("correctedRef");
  });
});

// ─── Hook adoption by all 4 components ──────────────────────────

describe("usePortalDropdown adopted by all dropdown components", () => {
  it("UnitSelector imports and uses usePortalDropdown", () => {
    expect(unitSrc).toContain('import { usePortalDropdown }');
    expect(unitSrc).toContain("usePortalDropdown({");
    expect(unitSrc).toContain("portalRef");
  });

  it("PositionSelector imports and uses usePortalDropdown", () => {
    expect(positionSrc).toContain('import { usePortalDropdown }');
    expect(positionSrc).toContain("usePortalDropdown({");
    expect(positionSrc).toContain("portalRef");
  });

  it("SelectRowCustom (SelectRow.tsx) imports and uses usePortalDropdown", () => {
    expect(controlsSrc).toContain('import { usePortalDropdown }');
    expect(controlsSrc).toContain("function SelectRowCustom(");
    expect(controlsSrc).toContain("usePortalDropdown({");
    expect(controlsSrc).toContain("portalRef");
  });

  it("TextStyleRow imports and uses usePortalDropdown", () => {
    expect(textStyleSrc).toContain('import { usePortalDropdown }');
    expect(textStyleSrc).toContain("usePortalDropdown({");
    expect(textStyleSrc).toContain("portalRef");
  });
});

// ─── No more querySelector-based click-outside in components ────

describe("querySelector-based click-outside removed from components", () => {
  it("UnitSelector does not use querySelector for portal detection", () => {
    expect(unitSrc).not.toContain('querySelector("[data-unit-selector-portal]")');
  });

  it("PositionSelector does not use querySelector for portal detection", () => {
    expect(positionSrc).not.toContain('querySelector("[data-position-selector-portal]")');
  });

  it("SelectRowCustom does not use querySelector for portal detection", () => {
    expect(controlsSrc).not.toContain('querySelector("[data-select-custom-portal]")');
  });

  it("TextStyleRow does not use querySelector for portal detection", () => {
    expect(textStyleSrc).not.toContain('querySelector("[data-textstyle-portal]")');
  });
});

// ─── Data attributes preserved for page-level click-through ─────

describe("data attributes preserved on portal divs", () => {
  it("UnitSelector still has data-tuner-portal and data-unit-selector-portal", () => {
    expect(unitSrc).toContain("data-tuner-portal");
    expect(unitSrc).toContain("data-unit-selector-portal");
  });

  it("PositionSelector still has data-tuner-portal and data-position-selector-portal", () => {
    expect(positionSrc).toContain("data-tuner-portal");
    expect(positionSrc).toContain("data-position-selector-portal");
  });

  it("SelectRowCustom still has data-tuner-portal and data-select-custom-portal", () => {
    expect(controlsSrc).toContain("data-tuner-portal");
    expect(controlsSrc).toContain("data-select-custom-portal");
  });

  it("TextStyleRow still has data-tuner-portal and data-textstyle-portal", () => {
    expect(textStyleSrc).toContain("data-tuner-portal");
    expect(textStyleSrc).toContain("data-textstyle-portal");
  });
});

// ─── No hardcoded DROPDOWN_HEIGHT in components ──────────────────

describe("hardcoded DROPDOWN_HEIGHT replaced with estimatedHeight", () => {
  it("UnitSelector passes estimatedHeight to hook (no local DROPDOWN_HEIGHT)", () => {
    expect(unitSrc).toContain("estimatedHeight:");
    // The old constant should be gone from the component
    expect(unitSrc).not.toMatch(/const DROPDOWN_HEIGHT\s*=/);
  });

  it("PositionSelector passes estimatedHeight to hook (no local DROPDOWN_HEIGHT)", () => {
    expect(positionSrc).toContain("estimatedHeight:");
    expect(positionSrc).not.toMatch(/const DROPDOWN_HEIGHT\s*=/);
  });

  it("TextStyleRow passes estimatedHeight to hook (no local DROPDOWN_HEIGHT)", () => {
    expect(textStyleSrc).toContain("estimatedHeight:");
    expect(textStyleSrc).not.toMatch(/const DROPDOWN_HEIGHT\s*=/);
  });
});
