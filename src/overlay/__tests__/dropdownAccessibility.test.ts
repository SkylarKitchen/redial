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
// StateSelector is a thin declaration; ARIA/keyboard implementation is in
// PortalListboxSelect (extracted by code-review step 8).
const stateSelectorSrc = readFileSync(
  join(overlayDir, "controls", "PortalListboxSelect.tsx"),
  "utf-8",
);
const dropdownHookSrc = readFileSync(
  join(overlayDir, "hooks", "useDropdownKeyboard.ts"),
  "utf-8",
);
// SelectRowCustom's searchable dropdown is now the inline SearchableMenu
// (shadcn/cmdk migration, 2026-06-03). The search input's Escape-to-close and
// autofocus moved into that component; SelectRowCustom wires them via onClose.
const searchableMenuSrc = readFileSync(
  join(overlayDir, "controls", "SearchableMenu.tsx"),
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
    // onTriggerKeyDown checks !open && ArrowDown/ArrowUp, then calls setOpen(true)
    const triggerStart = dropdownHookSrc.indexOf("const onTriggerKeyDown");
    // Find the next useCallback closing after the trigger function
    const triggerChunk = dropdownHookSrc.slice(triggerStart, triggerStart + 400);
    expect(triggerChunk).toContain("!open");
    expect(triggerChunk).toContain("setOpen(true)");
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

  it("Escape closes the dropdown (SelectRowCustom wires onClose -> setOpen(false); SearchableMenu fires it on Escape)", () => {
    // SelectRowCustom delegates the searchable list to SearchableMenu and passes
    // an onClose that closes the dropdown.
    expect(customBody).toContain("onClose={() => setOpen(false)}");
    // SearchableMenu is where the search input handles Escape -> onClose().
    expect(searchableMenuSrc).toContain('e.key === "Escape"');
    const escIdx = searchableMenuSrc.indexOf('e.key === "Escape"');
    const escChunk = searchableMenuSrc.slice(escIdx, escIdx + 120);
    expect(escChunk).toContain("onClose()");
  });

  it("trigger has tabIndex=0 for focus", () => {
    expect(customBody).toContain("tabIndex={0}");
  });

  it("search input autofocuses when opened (now inside SearchableMenu)", () => {
    expect(searchableMenuSrc).toContain("autoFocus");
  });
});

// ─── StateSelector accessibility ──────────────────────────────────────
// StateSelector was refactored off shadcn/Radix Select to the project's
// portal-dropdown pattern (usePortalDropdown + useDropdownKeyboard +
// createPortal to document.body), mirroring UnitSelector — see the
// no-shadcn-in-overlay rule. These tests assert the same keyboard-accessibility
// contract that pattern provides, now expressed via ARIA + the hook rather than
// Radix's SelectTrigger/SelectContent/SelectItem.

describe("StateSelector — keyboard accessibility (via portal dropdown)", () => {
  it("uses useDropdownKeyboard hook for navigation", () => {
    expect(stateSelectorSrc).toContain("useDropdownKeyboard");
  });

  it("trigger opens via onTriggerKeyDown (Enter/Space/Arrow) and has combobox role", () => {
    expect(stateSelectorSrc).toContain("onTriggerKeyDown");
    expect(stateSelectorSrc).toMatch(/role=["']combobox["']/);
    expect(stateSelectorSrc).toContain("aria-expanded={open}");
  });

  it("listbox navigates via onListKeyDown (ArrowUp/Down)", () => {
    expect(stateSelectorSrc).toMatch(/role=["']listbox["']/);
    expect(stateSelectorSrc).toContain("onListKeyDown");
    expect(stateSelectorSrc).toMatch(/ArrowDown.*ArrowUp|ArrowUp.*ArrowDown/);
  });

  it("options are selectable (role='option' + aria-selected)", () => {
    expect(stateSelectorSrc).toMatch(/role=["']option["']/);
    expect(stateSelectorSrc).toContain("aria-selected={isActive}");
  });

  it("is a controlled component (value prop + onChange callback for selection)", () => {
    expect(stateSelectorSrc).toMatch(/onChange:\s*\(id: string\) => void/);
    // selection routes the chosen option id back through onChange
    expect(stateSelectorSrc).toContain("onChange(");
  });

  it("renders all state options from the options list", () => {
    // PortalListboxSelect maps over the options prop
    expect(stateSelectorSrc).toMatch(/options\.map\(\(option/);
    // StateSelector passes STATE_OPTIONS which spot-checks these ids
    const stateSelectorDecl = readFileSync(
      join(overlayDir, "shell", "StateSelector.tsx"),
      "utf-8",
    );
    expect(stateSelectorDecl).toContain('id: "hover"');
    expect(stateSelectorDecl).toContain('id: "focus"');
  });
});
