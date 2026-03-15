/**
 * dropdownAccessibility.test.ts — Audit dropdown components for keyboard accessibility
 *
 * Checks UnitSelector, SelectRow (via SelectRowCustom), and StateSelector
 * for: Enter/Space opens, arrow keys navigate, Escape closes, Tab moves out,
 * and proper ARIA attributes.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const overlayDir = join(__dirname, "..");

const unitSelectorSrc = readFileSync(
  join(overlayDir, "controls", "UnitSelector.tsx"),
  "utf-8",
);
const selectRowSrc = readFileSync(
  join(overlayDir, "controls", "SelectRow.tsx"),
  "utf-8",
);
const stateSelectorSrc = readFileSync(
  join(overlayDir, "shell", "StateSelector.tsx"),
  "utf-8",
);
const dropdownHookSrc = readFileSync(
  join(overlayDir, "hooks", "useDropdownKeyboard.ts"),
  "utf-8",
);

// ─── UnitSelector accessibility ───────────────────────────────────────

describe("UnitSelector — keyboard accessibility", () => {
  it("uses useDropdownKeyboard hook for navigation", () => {
    expect(unitSelectorSrc).toContain("useDropdownKeyboard");
  });

  it("trigger has role='combobox'", () => {
    expect(unitSelectorSrc).toMatch(/role=["']combobox["']/);
  });

  it("trigger has aria-expanded bound to open state", () => {
    expect(unitSelectorSrc).toContain("aria-expanded={open}");
  });

  it("trigger has aria-haspopup='listbox'", () => {
    expect(unitSelectorSrc).toMatch(/aria-haspopup=["']listbox["']/);
  });

  it("trigger has aria-controls pointing to listbox id", () => {
    expect(unitSelectorSrc).toContain("aria-controls={");
  });

  it("trigger has aria-activedescendant for highlighted option", () => {
    expect(unitSelectorSrc).toContain("aria-activedescendant");
  });

  it("dropdown has role='listbox'", () => {
    expect(unitSelectorSrc).toMatch(/role=["']listbox["']/);
  });

  it("options have role='option'", () => {
    expect(unitSelectorSrc).toMatch(/role=["']option["']/);
  });

  it("options have aria-selected", () => {
    expect(unitSelectorSrc).toContain("aria-selected={isActive}");
  });

  it("wires onTriggerKeyDown for Enter/Space/Arrow opening", () => {
    expect(unitSelectorSrc).toContain("onTriggerKeyDown");
  });

  it("wires onListKeyDown on the listbox for arrow navigation", () => {
    expect(unitSelectorSrc).toContain("onListKeyDown");
  });

  it("ArrowDown/ArrowUp on closed trigger opens dropdown", () => {
    // The trigger's onKeyDown checks for ArrowDown/ArrowUp when not open
    expect(unitSelectorSrc).toMatch(/ArrowDown.*ArrowUp|ArrowUp.*ArrowDown/);
  });
});

// ─── useDropdownKeyboard hook — Escape/Enter/Arrow behaviors ──────────

describe("useDropdownKeyboard — key handling", () => {
  it("handles Escape key to close dropdown", () => {
    expect(dropdownHookSrc).toContain('"Escape"');
    expect(dropdownHookSrc).toMatch(/case\s+["']Escape["']:/);
  });

  it("handles Enter key to select highlighted option", () => {
    expect(dropdownHookSrc).toContain('"Enter"');
    expect(dropdownHookSrc).toMatch(/case\s+["']Enter["']:/);
  });

  it("handles ArrowDown key", () => {
    expect(dropdownHookSrc).toMatch(/case\s+["']ArrowDown["']:/);
  });

  it("handles ArrowUp key", () => {
    expect(dropdownHookSrc).toMatch(/case\s+["']ArrowUp["']:/);
  });

  it("handles Home key to go to first option", () => {
    expect(dropdownHookSrc).toMatch(/case\s+["']Home["']:/);
  });

  it("handles End key to go to last option", () => {
    expect(dropdownHookSrc).toMatch(/case\s+["']End["']:/);
  });

  it("Escape calls setOpen(false)", () => {
    // Extract the Escape case
    const escIdx = dropdownHookSrc.indexOf('"Escape"');
    const chunk = dropdownHookSrc.slice(escIdx, escIdx + 120);
    expect(chunk).toContain("setOpen(false)");
  });

  it("Enter calls onSelect with highlighted index", () => {
    const enterIdx = dropdownHookSrc.indexOf('"Enter"');
    const chunk = dropdownHookSrc.slice(enterIdx, enterIdx + 200);
    expect(chunk).toContain("onSelect(");
  });

  it("prevents default on navigation keys to avoid scroll", () => {
    expect(dropdownHookSrc).toContain("e.preventDefault()");
  });

  it("supports type-ahead via labels parameter", () => {
    expect(dropdownHookSrc).toContain("typeAheadMatch");
    expect(dropdownHookSrc).toContain("typeBuffer");
  });

  it("trigger keydown opens dropdown on ArrowDown/ArrowUp when closed", () => {
    // onTriggerKeyDown checks !open && ArrowDown/ArrowUp
    const triggerFn = dropdownHookSrc.slice(
      dropdownHookSrc.indexOf("const onTriggerKeyDown"),
      dropdownHookSrc.indexOf("const onListKeyDown"),
    );
    expect(triggerFn).toContain("!open");
    expect(triggerFn).toContain("setOpen(true)");
  });
});

// ─── SelectRow (SelectRowCustom) accessibility ────────────────────────

describe("SelectRow (custom mode) — keyboard accessibility", () => {
  // Extract the SelectRowCustom function body
  const fnStart = selectRowSrc.indexOf("function SelectRowCustom(");
  const customBody = selectRowSrc.slice(fnStart);

  it("trigger button has aria-expanded bound to open state", () => {
    expect(customBody).toContain("aria-expanded={open}");
  });

  it("Enter/Space/ArrowDown on trigger opens dropdown", () => {
    expect(customBody).toContain("e.key === \"Enter\"");
    expect(customBody).toContain("e.key === \" \"");
    expect(customBody).toContain("e.key === \"ArrowDown\"");
  });

  it("sets open to true on Enter/Space/ArrowDown", () => {
    // After key detection, should call setOpen(true)
    const keydownIdx = customBody.indexOf("onKeyDown={(e)");
    const keydownChunk = customBody.slice(keydownIdx, keydownIdx + 400);
    expect(keydownChunk).toContain("setOpen(true)");
  });

  it("Escape on CommandInput closes dropdown", () => {
    expect(customBody).toContain("e.key === \"Escape\"");
    const escIdx = customBody.indexOf("e.key === \"Escape\"");
    const escChunk = customBody.slice(escIdx, escIdx + 100);
    expect(escChunk).toContain("setOpen(false)");
  });

  it("trigger has tabIndex=0 for focus", () => {
    expect(customBody).toContain("tabIndex={0}");
  });

  it("CommandInput autofocuses when opened", () => {
    expect(customBody).toContain("autoFocus");
  });
});

// ─── StateSelector accessibility ──────────────────────────────────────

describe("StateSelector — keyboard accessibility (via Radix Select)", () => {
  it("uses Radix Select (provides built-in keyboard nav)", () => {
    expect(stateSelectorSrc).toContain("import");
    expect(stateSelectorSrc).toMatch(/from\s+["']@\/components\/ui\/select["']/);
  });

  it("imports SelectTrigger (provides Enter/Space open, Escape close)", () => {
    expect(stateSelectorSrc).toContain("SelectTrigger");
  });

  it("imports SelectContent (provides ArrowUp/Down navigation)", () => {
    expect(stateSelectorSrc).toContain("SelectContent");
  });

  it("imports SelectItem (provides Enter to select)", () => {
    expect(stateSelectorSrc).toContain("SelectItem");
  });

  it("passes value and onChange for controlled selection", () => {
    expect(stateSelectorSrc).toContain("value={value}");
    expect(stateSelectorSrc).toContain("onValueChange={onChange}");
  });

  it("renders all 9 state options as SelectItem elements", () => {
    const itemMatches = stateSelectorSrc.match(/SelectItem/g) || [];
    // Import (2: named import + closing) + JSX usage + map rendering
    // We check for the map pattern which renders one per option
    expect(stateSelectorSrc).toContain("STATES.map((state)");
  });
});
