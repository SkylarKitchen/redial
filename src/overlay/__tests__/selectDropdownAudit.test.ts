/**
 * selectDropdownAudit.test.ts — Verify portal, ARIA, and theme fixes
 * for PositionSelector, SelectRowCustom (controls.tsx), and SideSelector.
 *
 * Fix 1: PositionSelector portal (dropdown clipping)
 * Fix 2: SelectRowCustom portal (dropdown clipping)
 * Fix 3: PositionSelector keyboard nav + ARIA
 * Fix 4: SideSelector hardcoded colors → theme tokens
 * Fix 5: SideSelector keyboard nav + ARIA
 * Fix 6: PositionSelector border-radius consistency
 */

import { readFileSync } from "fs";
import { join } from "path";
import { describe, it, expect } from "vitest";

const overlayDir = join(__dirname, "..");
const positionSrc = readFileSync(join(overlayDir, "PositionSelector.tsx"), "utf-8");
const controlsSrc = readFileSync(join(overlayDir, "controls.tsx"), "utf-8");
const sideSrc = readFileSync(join(overlayDir, "SideSelector.tsx"), "utf-8");

// ─── Fix 1: PositionSelector portal ─────────────────────────────────

describe("Fix 1: PositionSelector uses portal for dropdown", () => {
  it("imports createPortal from react-dom", () => {
    expect(positionSrc).toMatch(/import\s+\{[^}]*createPortal[^}]*\}\s+from\s+["']react-dom["']/);
  });

  it("calls createPortal to render dropdown", () => {
    expect(positionSrc).toContain("createPortal(");
  });

  it("uses position: fixed for the portaled dropdown", () => {
    expect(positionSrc).toMatch(/position:\s*["']fixed["']/);
  });

  it("marks portal with data-tuner-portal", () => {
    expect(positionSrc).toContain("data-tuner-portal");
  });

  it("marks portal with data-position-selector-portal for click-outside", () => {
    expect(positionSrc).toContain("data-position-selector-portal");
  });

  it("uses zIndex.max instead of hardcoded z-index", () => {
    expect(positionSrc).toContain("zIndex: zIndex.max");
    expect(positionSrc).not.toMatch(/zIndex:\s*200/);
  });

  it("uses shadow.dropdown from theme", () => {
    expect(positionSrc).toContain("shadow.dropdown");
    expect(positionSrc).not.toContain("0 4px 16px rgba(0,0,0,0.1)");
  });

  it("click-outside uses ref-based detection via usePortalDropdown hook", () => {
    expect(positionSrc).toContain("usePortalDropdown");
    expect(positionSrc).toContain("portalRef");
  });
});

// ─── Fix 2: SelectRowCustom portal ──────────────────────────────────

describe("Fix 2: SelectRowCustom uses portal for dropdown", () => {
  // Extract just the SelectRowCustom function to avoid false positives
  // from other components in controls.tsx
  const fnStart = controlsSrc.indexOf("function SelectRowCustom(");
  const fnBody = controlsSrc.slice(fnStart, controlsSrc.indexOf("\n// ─── Color", fnStart));

  it("calls createPortal for the Command dropdown", () => {
    expect(fnBody).toContain("createPortal(");
  });

  it("uses position: fixed for the portaled dropdown", () => {
    expect(fnBody).toMatch(/position:\s*["']fixed["']/);
  });

  it("marks portal with data-tuner-portal", () => {
    expect(fnBody).toContain("data-tuner-portal");
  });

  it("marks portal with data-select-custom-portal for click-outside", () => {
    expect(fnBody).toContain("data-select-custom-portal");
  });

  it("uses zIndex.max instead of hardcoded z-index", () => {
    expect(fnBody).toContain("zIndex: zIndex.max");
    expect(fnBody).not.toMatch(/zIndex:\s*200/);
  });

  it("click-outside uses ref-based detection via usePortalDropdown hook", () => {
    expect(fnBody).toContain("usePortalDropdown");
    expect(fnBody).toContain("portalRef");
  });

  it("has triggerRef for position computation", () => {
    expect(fnBody).toContain("triggerRef");
    // Position computation is now in the usePortalDropdown hook
    expect(fnBody).toContain("updateDropdownPos");
  });
});

// ─── Fix 3: PositionSelector keyboard + ARIA ────────────────────────

describe("Fix 3: PositionSelector keyboard navigation and ARIA", () => {
  it("imports useDropdownKeyboard hook", () => {
    expect(positionSrc).toContain("useDropdownKeyboard");
  });

  it('trigger has role="combobox"', () => {
    expect(positionSrc).toMatch(/role=["']combobox["']/);
  });

  it('dropdown has role="listbox"', () => {
    expect(positionSrc).toMatch(/role=["']listbox["']/);
  });

  it('items have role="option"', () => {
    expect(positionSrc).toMatch(/role=["']option["']/);
  });

  it("has aria-expanded on trigger", () => {
    expect(positionSrc).toContain("aria-expanded={open}");
  });

  it("has aria-activedescendant for keyboard highlight", () => {
    expect(positionSrc).toContain("aria-activedescendant");
  });

  it("has aria-selected on options", () => {
    expect(positionSrc).toContain("aria-selected={isActive}");
  });

  it("wires onTriggerKeyDown from the hook", () => {
    // Accepts both direct wiring and wrapper that calls onTriggerKeyDown
    // (wrapper needed to compute dropdownPos on keyboard-open)
    expect(positionSrc).toContain("onTriggerKeyDown(e)");
  });

  it("wires onListKeyDown on the listbox", () => {
    expect(positionSrc).toContain("onKeyDown={onListKeyDown}");
  });

  it("description area reflects keyboard-highlighted item", () => {
    expect(positionSrc).toContain("highlightedItem");
  });
});

// ─── Fix 4: SideSelector theme token compliance ─────────────────────

describe("Fix 4: SideSelector uses theme tokens (no hardcoded rgba)", () => {
  it("has zero hardcoded rgba(0,0,0,...) strings", () => {
    const matches = sideSrc.match(/["']rgba\(0,\s*0,\s*0,/g) || [];
    expect(
      matches,
      `Found ${matches.length} hardcoded rgba(0,0,0,...) in SideSelector:\n` +
        matches.map((m) => `  - ${m}`).join("\n"),
    ).toEqual([]);
  });

  it("imports blackAlpha from theme", () => {
    expect(sideSrc).toContain("blackAlpha");
  });

  it("uses blackAlpha for SVG stroke colors", () => {
    expect(sideSrc).toMatch(/blackAlpha\(0\.25\)/);
    expect(sideSrc).toMatch(/blackAlpha\(0\.15\)/);
    expect(sideSrc).toMatch(/blackAlpha\(0\.55\)/);
  });

  it("uses theme tokens for tab bar backgrounds", () => {
    // Active bg should use a theme token, not a raw rgba string
    expect(sideSrc).toContain("borderToken.subtle");
    // Hover bg should use a theme token
    expect(sideSrc).toContain("color.input");
  });
});

// ─── Fix 5: SideSelector keyboard + ARIA ────────────────────────────

describe("Fix 5: SideSelector keyboard navigation and ARIA", () => {
  it('has role="radiogroup" on containers', () => {
    const matches = sideSrc.match(/role=["']radiogroup["']/g) || [];
    expect(matches.length).toBeGreaterThanOrEqual(3); // tab, compact, cross
  });

  it('has role="radio" on buttons', () => {
    expect(sideSrc).toMatch(/role=["']radio["']/);
  });

  it("has aria-checked on buttons", () => {
    expect(sideSrc).toContain("aria-checked={active}");
  });

  it("has aria-label on buttons", () => {
    expect(sideSrc).toContain("aria-label={");
  });

  it("implements roving tabindex (active=0, inactive=-1)", () => {
    expect(sideSrc).toContain("tabIndex={active ? 0 : -1}");
  });

  it("has data-side attribute for focus management", () => {
    expect(sideSrc).toContain("data-side={side}");
  });

  it("has onKeyDown handler for arrow navigation", () => {
    expect(sideSrc).toContain("handleLinearKeyDown");
    expect(sideSrc).toContain("handleKeyDown");
  });

  it("has spatial cross-mode navigation map", () => {
    expect(sideSrc).toContain("CROSS_NAV");
  });
});

// ─── Fix 6: PositionSelector border-radius consistency ──────────────

describe("Fix 6: PositionSelector trigger border-radius", () => {
  it("uses borderRadius: 2 (matching SelectRow/SelectRowCustom)", () => {
    // The trigger button should have borderRadius: 2 (was 3)
    expect(positionSrc).toMatch(/borderRadius:\s*2[,\s]/);
  });

  it("does not use the old borderRadius: 3 on the trigger", () => {
    // Extract just the trigger button style (before the portal)
    const triggerSection = positionSrc.slice(
      positionSrc.indexOf("{/* Trigger button */}"),
      positionSrc.indexOf("{/* Dropdown"),
    );
    expect(triggerSection).not.toMatch(/borderRadius:\s*["']?3(?:px)?["']?/);
  });
});
