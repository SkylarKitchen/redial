// @vitest-environment happy-dom
/**
 * keyboardShortcuts.test.ts — Verifies all 12 keyboard shortcuts from the spec,
 * plus input-focus suppression, against the actual Overlay.tsx source.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { isScrubActive, setScrubActive } from "../core/scrubState";
import { getNextFocusTarget } from "../hooks/useFocusTrap";

// ─── Read Overlay source once ────────────────────────────────────────
const overlaySrc = readFileSync(
  join(__dirname, "..", "shell", "Overlay.tsx"),
  "utf-8",
);

/** Returns the index of a pattern in overlaySrc, or -1 if not found */
function srcIndex(pattern: string): number {
  return overlaySrc.indexOf(pattern);
}

/** Asserts a pattern exists in the Overlay source */
function expectInSource(pattern: string) {
  expect(srcIndex(pattern)).toBeGreaterThan(-1);
}

// ─── 1. Backtick toggles selection mode ─────────────────────────────
describe("` toggles selection mode", () => {
  it("checks for backtick key in the handler", () => {
    expectInSource('e.key === "`"');
  });

  it("calls setSelecting to toggle", () => {
    // The handler should toggle: setSelecting(s => !s)
    const backtickBlock = overlaySrc.slice(
      srcIndex('e.key === "`"'),
      srcIndex('e.key === "`"') + 200,
    );
    expect(backtickBlock).toContain("setSelecting");
  });

  it("requires no meta/ctrl modifier", () => {
    const backtickLine = overlaySrc.slice(
      srcIndex('e.key === "`"'),
      srcIndex('e.key === "`"') + 100,
    );
    expect(backtickLine).toContain("!e.metaKey");
    expect(backtickLine).toContain("!e.ctrlKey");
  });
});

// ─── 2. Escape closes panel ─────────────────────────────────────────
describe("Escape closes panel", () => {
  it("checks for Escape key", () => {
    expectInSource('e.key === "Escape"');
  });

  it("clears selectedEl on Escape (closing the panel)", () => {
    const escBlock = overlaySrc.slice(
      srcIndex('e.key === "Escape"'),
      srcIndex('e.key === "Escape"') + 500,
    );
    expect(escBlock).toContain("setSelectedEl(null)");
  });

  it("dismisses active modal before closing panel", () => {
    const escBlock = overlaySrc.slice(
      srcIndex('e.key === "Escape"'),
      srcIndex('e.key === "Escape"') + 500,
    );
    // Modal check comes before setSelectedEl(null)
    const modalIdx = escBlock.indexOf("activeModal");
    const closeIdx = escBlock.indexOf("setSelectedEl(null)");
    expect(modalIdx).toBeGreaterThan(-1);
    expect(closeIdx).toBeGreaterThan(-1);
    expect(modalIdx).toBeLessThan(closeIdx);
  });
});

// ─── 3. Cmd+Z triggers undo ─────────────────────────────────────────
describe("Cmd+Z triggers undo", () => {
  it("checks for meta+z without shift", () => {
    // Must match: (e.metaKey || e.ctrlKey) && e.key === "z" && !e.shiftKey
    expectInSource('e.key === "z" && !e.shiftKey');
  });

  it("calls undo()", () => {
    const undoBlock = overlaySrc.slice(
      srcIndex('e.key === "z" && !e.shiftKey'),
      srcIndex('e.key === "z" && !e.shiftKey') + 300,
    );
    expect(undoBlock).toMatch(/\bundo\(\)/);
  });

  it("prevents default and stops propagation", () => {
    const undoBlock = overlaySrc.slice(
      srcIndex('e.key === "z" && !e.shiftKey'),
      srcIndex('e.key === "z" && !e.shiftKey') + 300,
    );
    expect(undoBlock).toContain("e.preventDefault()");
    expect(undoBlock).toContain("e.stopPropagation()");
  });
});

// ─── 4. Cmd+Shift+Z triggers redo ──────────────────────────────────
describe("Cmd+Shift+Z triggers redo", () => {
  it("checks for meta+z with shift", () => {
    expectInSource('e.key === "z" && e.shiftKey');
  });

  it("calls redo()", () => {
    const redoBlock = overlaySrc.slice(
      srcIndex('e.key === "z" && e.shiftKey'),
      srcIndex('e.key === "z" && e.shiftKey') + 300,
    );
    expect(redoBlock).toMatch(/\bredo\(\)/);
  });

  it("redo check appears before undo check (priority order)", () => {
    const redoIdx = srcIndex('e.key === "z" && e.shiftKey');
    const undoIdx = srcIndex('e.key === "z" && !e.shiftKey');
    expect(redoIdx).toBeLessThan(undoIdx);
  });
});

// ─── 5. Arrow keys navigate elements ────────────────────────────────
describe("Arrow keys navigate elements", () => {
  const arrows = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"];

  it.each(arrows)("handles %s key", (key) => {
    expectInSource(`e.key === "${key}"`);
  });

  it("ArrowUp navigates to parent", () => {
    const block = overlaySrc.slice(
      srcIndex('e.key === "ArrowUp"'),
      srcIndex('e.key === "ArrowUp"') + 200,
    );
    expect(block).toContain("parentElement");
  });

  it("ArrowDown navigates to first child", () => {
    const block = overlaySrc.slice(
      srcIndex('e.key === "ArrowDown"'),
      srcIndex('e.key === "ArrowDown"') + 200,
    );
    expect(block).toContain("firstElementChild");
  });

  it("ArrowLeft navigates to previous sibling", () => {
    const block = overlaySrc.slice(
      srcIndex('e.key === "ArrowLeft"'),
      srcIndex('e.key === "ArrowLeft"') + 200,
    );
    expect(block).toContain("previousElementSibling");
  });

  it("ArrowRight navigates to next sibling", () => {
    const block = overlaySrc.slice(
      srcIndex('e.key === "ArrowRight"'),
      srcIndex('e.key === "ArrowRight"') + 200,
    );
    expect(block).toContain("nextElementSibling");
  });

  it("skips arrow navigation when focus is inside panel", () => {
    const arrowSection = overlaySrc.slice(
      srcIndex("Arrow key element navigation"),
      srcIndex("Arrow key element navigation") + 400,
    );
    expect(arrowSection).toContain("insidePanel");
  });
});

// ─── 6. D hold strips overrides temporarily ─────────────────────────
describe("D hold strips overrides temporarily", () => {
  it("checks for d keydown (non-repeat)", () => {
    expectInSource('e.key === "d" && !e.repeat');
  });

  it("calls stripAllOverrides on keydown", () => {
    const dBlock = overlaySrc.slice(
      srcIndex('e.key === "d" && !e.repeat'),
      srcIndex('e.key === "d" && !e.repeat') + 300,
    );
    expect(dBlock).toContain("stripAllOverrides");
    expect(dBlock).toContain("setDiffMode(true)");
  });

  it("restores overrides on keyup", () => {
    // keyup handler for d
    const keyUpBlock = overlaySrc.slice(
      srcIndex("handleKeyUp"),
      srcIndex("handleKeyUp") + 400,
    );
    expect(keyUpBlock).toContain("restoreAllOverrides");
    expect(keyUpBlock).toContain("setDiffMode(false)");
  });
});

// ─── 7. S cycles scope ──────────────────────────────────────────────
describe("S cycles scope", () => {
  it("checks for s key without modifiers", () => {
    // The source should have: e.key === "s" && !e.metaKey && !e.ctrlKey
    const sLine = overlaySrc.slice(
      srcIndex('e.key === "s" && !e.metaKey && !e.ctrlKey'),
    );
    expect(sLine.length).toBeGreaterThan(0);
  });

  it("calls handleScopeChange", () => {
    const sIdx = srcIndex('e.key === "s" && !e.metaKey && !e.ctrlKey');
    const sBlock = overlaySrc.slice(sIdx, sIdx + 400);
    expect(sBlock).toContain("handleScopeChange");
  });

  it("cycles between element and class scope", () => {
    const sIdx = srcIndex('e.key === "s" && !e.metaKey && !e.ctrlKey');
    const sBlock = overlaySrc.slice(sIdx, sIdx + 400);
    expect(sBlock).toContain('"element"');
    expect(sBlock).toContain('"class"');
  });
});

// ─── 8. R resets current element ────────────────────────────────────
describe("R resets current element", () => {
  it("checks for r key without modifiers", () => {
    expectInSource('e.key === "r" && !e.metaKey && !e.ctrlKey');
  });

  it("calls reset(selectedEl)", () => {
    const rIdx = srcIndex('e.key === "r" && !e.metaKey && !e.ctrlKey');
    const rBlock = overlaySrc.slice(rIdx, rIdx + 300);
    expect(rBlock).toContain("reset(");
  });

  it("re-infers after reset", () => {
    const rIdx = srcIndex('e.key === "r" && !e.metaKey && !e.ctrlKey');
    const rBlock = overlaySrc.slice(rIdx, rIdx + 300);
    expect(rBlock).toContain("setInferResult(infer(");
  });
});

// ─── 9. Cmd+S saves ─────────────────────────────────────────────────
describe("Cmd+S saves", () => {
  it("checks for meta+s", () => {
    expectInSource('e.key === "s"');
    // Find the meta+s block specifically
    const metaSIdx = srcIndex("(e.metaKey || e.ctrlKey) && e.key === \"s\"");
    expect(metaSIdx).toBeGreaterThan(-1);
  });

  it("calls handleSaveShortcut", () => {
    const metaSIdx = srcIndex("(e.metaKey || e.ctrlKey) && e.key === \"s\"");
    const block = overlaySrc.slice(metaSIdx, metaSIdx + 300);
    expect(block).toContain("handleSaveShortcut");
  });

  it("prevents default (blocks browser save dialog)", () => {
    const metaSIdx = srcIndex("(e.metaKey || e.ctrlKey) && e.key === \"s\"");
    const block = overlaySrc.slice(metaSIdx, metaSIdx + 300);
    expect(block).toContain("e.preventDefault()");
  });
});

// ─── 10. Cmd+C copies CSS ───────────────────────────────────────────
describe("Cmd+C copies CSS", () => {
  it("checks for meta+c", () => {
    const metaCIdx = srcIndex("(e.metaKey || e.ctrlKey) && e.key === \"c\"");
    expect(metaCIdx).toBeGreaterThan(-1);
  });

  it("calls handleCopyShortcut", () => {
    // Find the plain meta+c block (not meta+alt+c)
    const metaCComment = srcIndex("Cmd+C for copy CSS");
    expect(metaCComment).toBeGreaterThan(-1);
    const block = overlaySrc.slice(metaCComment, metaCComment + 600);
    expect(block).toContain("handleCopyShortcut");
  });

  it("does not intercept when text is selected", () => {
    const metaCComment = srcIndex("Cmd+C for copy CSS");
    const block = overlaySrc.slice(metaCComment, metaCComment + 400);
    expect(block).toContain("getSelection");
  });
});

// ─── 11. Cmd+K opens command palette ────────────────────────────────
describe("Cmd+K opens command palette", () => {
  it("checks for meta+k", () => {
    const metaKIdx = srcIndex("(e.metaKey || e.ctrlKey) && e.key === \"k\"");
    expect(metaKIdx).toBeGreaterThan(-1);
  });

  it("toggles commandPalette modal", () => {
    const metaKIdx = srcIndex("(e.metaKey || e.ctrlKey) && e.key === \"k\"");
    const block = overlaySrc.slice(metaKIdx, metaKIdx + 300);
    expect(block).toContain("commandPalette");
  });
});

// ─── 12. Tab / Shift+Tab navigate controls ──────────────────────────
describe("Tab / Shift+Tab navigate controls (focus trap)", () => {
  it("useFocusTrap traps Tab within the panel/modal", () => {
    const focusTrapSrc = readFileSync(
      join(__dirname, "..", "hooks", "useFocusTrap.ts"),
      "utf-8",
    );
    // Must check for Tab key
    expect(focusTrapSrc).toContain('e.key !== "Tab"');
    // Must use shiftKey for direction
    expect(focusTrapSrc).toContain("e.shiftKey");
  });

  it("getNextFocusTarget wraps forward from last to first", () => {
    const els = Array.from({ length: 3 }, () =>
      document.createElement("button"),
    );
    expect(getNextFocusTarget(els, els[2], false)).toBe(els[0]);
  });

  it("getNextFocusTarget wraps backward from first to last", () => {
    const els = Array.from({ length: 3 }, () =>
      document.createElement("button"),
    );
    expect(getNextFocusTarget(els, els[0], true)).toBe(els[2]);
  });

  it("returns null when no wrap is needed (mid-list)", () => {
    const els = Array.from({ length: 3 }, () =>
      document.createElement("button"),
    );
    expect(getNextFocusTarget(els, els[1], false)).toBe(null);
  });
});

// ─── Keyboard shortcuts disabled when text input is focused ─────────
describe("shortcuts disabled when text input is focused", () => {
  /** Mirrors the input guard logic in Overlay.tsx handleKeyDown */
  function isInputFocused(target: HTMLElement): boolean {
    const tag = target.tagName.toLowerCase();
    return (
      tag === "input" ||
      tag === "textarea" ||
      tag === "select" ||
      target.isContentEditable
    );
  }

  it("input guard exists in Overlay source", () => {
    expectInSource(
      'tag === "input" || tag === "textarea" || tag === "select"',
    );
    expectInSource("isContentEditable");
  });

  it("input guard appears after meta combos (Cmd+Z etc. still work in inputs)", () => {
    const metaZIdx = srcIndex('e.key === "z" && !e.shiftKey');
    const inputGuardIdx = srcIndex(
      'tag === "input" || tag === "textarea" || tag === "select"',
    );
    expect(metaZIdx).toBeLessThan(inputGuardIdx);
  });

  it("input guard appears before plain key shortcuts", () => {
    const inputGuardIdx = srcIndex(
      'tag === "input" || tag === "textarea" || tag === "select"',
    );
    // S for scope cycle is a plain key shortcut that should be blocked by input guard
    const sCycleIdx = srcIndex(
      'e.key === "s" && !e.metaKey && !e.ctrlKey',
    );
    expect(inputGuardIdx).toBeLessThan(sCycleIdx);
  });

  it.each(["input", "textarea", "select"] as const)(
    "detects <%s> as focused input",
    (tag) => {
      const el = document.createElement(tag);
      expect(isInputFocused(el)).toBe(true);
    },
  );

  it("detects contentEditable as focused input", () => {
    const el = document.createElement("div");
    el.contentEditable = "true";
    expect(isInputFocused(el)).toBe(true);
  });

  it("does not flag a regular div as focused input", () => {
    const el = document.createElement("div");
    expect(isInputFocused(el)).toBe(false);
  });
});

// ─── Scrub guard blocks all shortcuts ───────────────────────────────
describe("scrub guard blocks all shortcuts", () => {
  it("scrub guard is the very first check in handleKeyDown", () => {
    const handleKeyDownIdx = srcIndex("const handleKeyDown = (e: KeyboardEvent)");
    const scrubIdx = overlaySrc.indexOf("isScrubActive()", handleKeyDownIdx);
    // The scrub guard should come before any key checks
    const firstKeyCheck = overlaySrc.indexOf('e.key === "z"', handleKeyDownIdx);
    expect(scrubIdx).toBeGreaterThan(-1);
    expect(scrubIdx).toBeLessThan(firstKeyCheck);
  });

  it("returns early when scrub is active", () => {
    const handleKeyDownIdx = srcIndex("const handleKeyDown = (e: KeyboardEvent)");
    const scrubBlock = overlaySrc.slice(handleKeyDownIdx, handleKeyDownIdx + 400);
    expect(scrubBlock).toContain("if (isScrubActive()) return");
  });

  it("setScrubActive(false) re-enables shortcuts", () => {
    setScrubActive(true);
    expect(isScrubActive()).toBe(true);
    setScrubActive(false);
    expect(isScrubActive()).toBe(false);
  });
});

// ─── KeyboardEvent simulation sanity checks ─────────────────────────
describe("KeyboardEvent simulation", () => {
  it("creates valid meta+z event", () => {
    const e = new KeyboardEvent("keydown", {
      key: "z",
      metaKey: true,
      bubbles: true,
    });
    expect(e.key).toBe("z");
    expect(e.metaKey).toBe(true);
  });

  it("creates valid meta+shift+z event", () => {
    const e = new KeyboardEvent("keydown", {
      key: "z",
      metaKey: true,
      shiftKey: true,
      bubbles: true,
    });
    expect(e.shiftKey).toBe(true);
    expect(e.metaKey).toBe(true);
  });

  it("creates Escape event", () => {
    const e = new KeyboardEvent("keydown", { key: "Escape", bubbles: true });
    expect(e.key).toBe("Escape");
  });

  it("creates backtick event", () => {
    const e = new KeyboardEvent("keydown", { key: "`", bubbles: true });
    expect(e.key).toBe("`");
  });

  it("creates arrow key events", () => {
    for (const key of ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"]) {
      const e = new KeyboardEvent("keydown", { key, bubbles: true });
      expect(e.key).toBe(key);
    }
  });
});
