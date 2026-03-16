// @vitest-environment happy-dom
/**
 * commandPalette.test.ts — Tests for the CommandPalette component
 *
 * Covers:
 * 1. Cmd+K opens the palette (Overlay wiring)
 * 2. Typing filters commands (fuzzy match, property/action search)
 * 3. Enter executes selected command (action dispatch + close)
 * 4. Escape closes the palette (Dialog + Overlay dismiss)
 * 5. Palette includes commands for all keyboard shortcuts
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { SECTION_PROPERTIES } from "../shell/PropertySearch";

// ─── Read source files once ─────────────────────────────────────────
const paletteSrc = readFileSync(
  join(__dirname, "..", "shell", "CommandPalette.tsx"),
  "utf-8",
);
const overlaySrc = readFileSync(
  join(__dirname, "..", "shell", "Overlay.tsx"),
  "utf-8",
);

function expectInPalette(pattern: string) {
  expect(paletteSrc.indexOf(pattern)).toBeGreaterThan(-1);
}

function expectInOverlay(pattern: string) {
  expect(overlaySrc.indexOf(pattern)).toBeGreaterThan(-1);
}

// ─── Mirror internal helpers for direct testing ─────────────────────

function fuzzyMatch(query: string, target: string): boolean {
  return target.toLowerCase().includes(query.toLowerCase());
}

function searchProperties(query: string): Array<{ section: string; props: string[] }> {
  const results: Array<{ section: string; props: string[] }> = [];
  for (const [section, props] of Object.entries(SECTION_PROPERTIES)) {
    if (fuzzyMatch(query, section)) {
      results.push({ section, props: [] });
      continue;
    }
    const matched = props.filter((p) => fuzzyMatch(query, p));
    if (matched.length > 0) {
      results.push({ section, props: matched });
    }
  }
  return results;
}

const ACTIONS = ["Save", "Reset", "Copy CSS", "Copy Tailwind", "Paste Styles", "Toggle Diff", "Toggle Changes Drawer", "Toggle Navigator"];

function searchActions(query: string): string[] {
  return ACTIONS.filter((a) => fuzzyMatch(query, a));
}

// ─── 1. Cmd+K opens the palette ─────────────────────────────────────

describe("Cmd+K opens the command palette", () => {
  it("Overlay checks for meta+k", () => {
    expectInOverlay('(e.metaKey || e.ctrlKey) && e.key === "k"');
  });

  it("toggles the commandPalette modal state", () => {
    const metaKIdx = overlaySrc.indexOf('(e.metaKey || e.ctrlKey) && e.key === "k"');
    const block = overlaySrc.slice(metaKIdx, metaKIdx + 300);
    expect(block).toContain("commandPalette");
    expect(block).toContain("setActiveModal");
  });

  it("prevents default to avoid browser shortcut conflicts", () => {
    const metaKIdx = overlaySrc.indexOf('(e.metaKey || e.ctrlKey) && e.key === "k"');
    const block = overlaySrc.slice(metaKIdx, metaKIdx + 200);
    expect(block).toContain("e.preventDefault()");
  });

  it("stops propagation", () => {
    const metaKIdx = overlaySrc.indexOf('(e.metaKey || e.ctrlKey) && e.key === "k"');
    const block = overlaySrc.slice(metaKIdx, metaKIdx + 200);
    expect(block).toContain("e.stopPropagation()");
  });

  it("requires a selected element to render the palette", () => {
    expectInOverlay('activeModal.type === "commandPalette" && selectedEl');
  });

  it("toggles off when already open", () => {
    const metaKIdx = overlaySrc.indexOf('(e.metaKey || e.ctrlKey) && e.key === "k"');
    const block = overlaySrc.slice(metaKIdx, metaKIdx + 300);
    // Should toggle: if commandPalette → none, else → commandPalette
    expect(block).toContain('prev.type === "commandPalette"');
    expect(block).toContain('{ type: "none" }');
    expect(block).toContain('{ type: "commandPalette" }');
  });
});

// ─── 2. Typing filters commands ─────────────────────────────────────

describe("typing filters commands", () => {
  describe("fuzzy match logic", () => {
    it("matches case-insensitive substrings", () => {
      expect(fuzzyMatch("pad", "padding")).toBe(true);
      expect(fuzzyMatch("PAD", "padding")).toBe(true);
      expect(fuzzyMatch("Pad", "padding-top")).toBe(true);
    });

    it("rejects non-matching strings", () => {
      expect(fuzzyMatch("xyz", "padding")).toBe(false);
      expect(fuzzyMatch("zz", "display")).toBe(false);
    });

    it("empty query matches everything", () => {
      expect(fuzzyMatch("", "padding")).toBe(true);
      expect(fuzzyMatch("", "anything")).toBe(true);
    });
  });

  describe("property search", () => {
    it("matches section names directly", () => {
      const results = searchProperties("Layout");
      expect(results.some((r) => r.section === "Layout" && r.props.length === 0)).toBe(true);
    });

    it("matches individual CSS property names", () => {
      const results = searchProperties("padding");
      const spacing = results.find((r) => r.section === "Spacing");
      expect(spacing).toBeDefined();
      expect(spacing!.props).toContain("padding");
    });

    it("returns multiple sections when properties span sections", () => {
      // "gap" appears in Layout (gap, row-gap, column-gap) and Typography (column-gap)
      const results = searchProperties("gap");
      expect(results.length).toBeGreaterThanOrEqual(2);
    });

    it("returns empty for no-match queries", () => {
      expect(searchProperties("zzzzz")).toHaveLength(0);
    });

    it("partial match finds properties", () => {
      const results = searchProperties("flex");
      const layout = results.find((r) => r.section === "Layout");
      expect(layout).toBeDefined();
      expect(layout!.props.some((p) => p.startsWith("flex"))).toBe(true);
    });
  });

  describe("action search", () => {
    it("matches single action", () => {
      expect(searchActions("save")).toEqual(["Save"]);
    });

    it("matches multiple actions with common substring", () => {
      expect(searchActions("copy")).toEqual(["Copy CSS", "Copy Tailwind"]);
    });

    it("returns empty for no-match queries", () => {
      expect(searchActions("xyz")).toEqual([]);
    });

    it("is case-insensitive", () => {
      expect(searchActions("RESET")).toEqual(["Reset"]);
    });
  });

  describe("source-level search wiring", () => {
    it("uses fuzzyMatch for property section name matching", () => {
      expectInPalette("fuzzyMatch(query, section)");
    });

    it("uses fuzzyMatch for individual property matching", () => {
      expectInPalette("fuzzyMatch(query, p)");
    });

    it("uses fuzzyMatch for action filtering", () => {
      expectInPalette("ACTIONS.filter((a) => fuzzyMatch(query, a))");
    });

    it("searches across three categories: Property, Action, Element", () => {
      expectInPalette('["Property", "Action", "Element"]');
    });

    it("element search is debounced at 300ms", () => {
      expectInPalette("ELEMENT_DEBOUNCE_MS = 300");
    });

    it("limits total results to 30", () => {
      expectInPalette("MAX_RESULTS = 30");
    });

    it("limits element results to 10", () => {
      expectInPalette("MAX_ELEMENT_RESULTS = 10");
    });

    it("disables cmdk built-in filter (uses custom fuzzy search)", () => {
      expectInPalette("shouldFilter={false}");
    });
  });
});

// ─── 3. Enter executes selected command ─────────────────────────────

describe("enter executes selected command", () => {
  it("executeResult calls the result's action function", () => {
    expectInPalette("result.action()");
  });

  it("executeResult calls onClose after executing", () => {
    const idx = paletteSrc.indexOf("const executeResult");
    const block = paletteSrc.slice(idx, idx + 300);
    expect(block).toContain("result.action()");
    expect(block).toContain("onClose()");
  });

  it("action() runs before onClose() (correct ordering)", () => {
    const idx = paletteSrc.indexOf("const executeResult");
    const block = paletteSrc.slice(idx, idx + 300);
    const actionIdx = block.indexOf("result.action()");
    const closeIdx = block.indexOf("onClose()");
    expect(actionIdx).toBeGreaterThan(-1);
    expect(closeIdx).toBeGreaterThan(-1);
    expect(actionIdx).toBeLessThan(closeIdx);
  });

  it("CommandItem onSelect wires to executeResult", () => {
    expectInPalette("onSelect={() => executeResult(r)}");
  });

  it("property results dispatch onScrollToSection", () => {
    expectInPalette("action: () => onScrollToSection(section)");
  });

  it("action results dispatch onAction", () => {
    expectInPalette("action: () => onAction(act)");
  });

  it("element results dispatch onSelectElement", () => {
    expectInPalette("action: () => onSelectElement(el)");
  });
});

// ─── 4. Escape closes the palette ───────────────────────────────────

describe("escape closes the palette", () => {
  it("Dialog onOpenChange calls onClose when dialog closes", () => {
    expectInPalette("onOpenChange");
    expectInPalette("if (!open) onClose()");
  });

  it("Overlay dismisses active modal on Escape before closing panel", () => {
    const escIdx = overlaySrc.indexOf('e.key === "Escape"');
    const block = overlaySrc.slice(escIdx, escIdx + 500);
    expect(block).toContain("activeModal");
    expect(block).toContain('{ type: "none" }');
  });

  it("modal dismiss happens before panel close (priority order)", () => {
    const escIdx = overlaySrc.indexOf('e.key === "Escape"');
    const block = overlaySrc.slice(escIdx, escIdx + 500);
    const modalIdx = block.indexOf("activeModal");
    const closeIdx = block.indexOf("handleCloseAttempt()");
    expect(modalIdx).toBeGreaterThan(-1);
    expect(closeIdx).toBeGreaterThan(-1);
    expect(modalIdx).toBeLessThan(closeIdx);
  });

  it("component receives onClose prop for external close control", () => {
    expectInPalette("onClose: () => void");
  });
});

// ─── 5. Palette includes commands for all keyboard shortcuts ────────

describe("palette includes commands for all keyboard shortcuts", () => {
  describe("ACTIONS constant covers shortcut-equivalent commands", () => {
    it.each(ACTIONS)("includes '%s' in ACTIONS array", (action) => {
      expectInPalette(`"${action}"`);
    });

    it("ACTIONS array has exactly 8 entries", () => {
      // Verify the source defines exactly these actions
      expectInPalette(
        '[\n  "Save",\n  "Reset",\n  "Copy CSS",\n  "Copy Tailwind",\n  "Paste Styles",\n  "Toggle Diff",\n  "Toggle Changes Drawer",\n  "Toggle Navigator",\n]',
      );
    });
  });

  describe("all 8 CSS sections are searchable", () => {
    const expectedSections = [
      "Layout", "Spacing", "Size", "Position",
      "Typography", "Backgrounds", "Borders", "Effects",
    ];

    it("SECTION_PROPERTIES has all 8 sections", () => {
      expect(Object.keys(SECTION_PROPERTIES)).toEqual(expectedSections);
    });

    it("CommandPalette imports SECTION_PROPERTIES", () => {
      expectInPalette('import { SECTION_PROPERTIES } from "./PropertySearch"');
    });

    it.each(expectedSections)("section '%s' has at least one searchable property", (section) => {
      expect(SECTION_PROPERTIES[section].length).toBeGreaterThan(0);
    });
  });

  describe("shortcut-to-palette mapping", () => {
    it("save shortcut (Cmd+S) has palette equivalent 'Save'", () => {
      expectInOverlay("handleSaveShortcut");
      expectInPalette('"Save"');
    });

    it("copy shortcut (Cmd+C) has palette equivalent 'Copy CSS'", () => {
      expectInOverlay("handleCopyShortcut");
      expectInPalette('"Copy CSS"');
    });

    it("paste styles shortcut (Cmd+Alt+V) has palette equivalent 'Paste Styles'", () => {
      expectInOverlay("handlePasteStyles");
      expectInPalette('"Paste Styles"');
    });

    it("diff shortcut (D) has palette equivalent 'Toggle Diff'", () => {
      expectInOverlay('e.key === "d"');
      expectInPalette('"Toggle Diff"');
    });

    it("reset shortcut (R) has palette equivalent 'Reset'", () => {
      expectInOverlay('e.key === "r"');
      expectInPalette('"Reset"');
    });
  });

  describe("Overlay dispatches palette actions correctly", () => {
    it("handleCommandAction exists in Overlay", () => {
      expectInOverlay("handleCommandAction");
    });

    it("onAction prop calls handleCommandAction", () => {
      const idx = overlaySrc.indexOf("<CommandPalette");
      const block = overlaySrc.slice(idx, idx + 500);
      expect(block).toContain("onAction=");
      expect(block).toContain("handleCommandAction(action)");
    });

    it("handleCommandAction dispatches Save", () => {
      const idx = overlaySrc.indexOf("handleCommandAction");
      const block = overlaySrc.slice(idx, idx + 600);
      expect(block).toContain("Save");
    });

    it("handleCommandAction dispatches Reset", () => {
      const idx = overlaySrc.indexOf("handleCommandAction");
      const block = overlaySrc.slice(idx, idx + 600);
      expect(block).toContain("Reset");
    });

    it("handleCommandAction dispatches Copy CSS", () => {
      const idx = overlaySrc.indexOf("handleCommandAction");
      const block = overlaySrc.slice(idx, idx + 600);
      expect(block).toContain("Copy CSS");
    });
  });
});
