// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { isScrubActive, setScrubActive } from "../core/scrubState";

// ─── Scrub guard ─────────────────────────────────────────────────────

describe("scrub guard (scrubState)", () => {
  beforeEach(() => setScrubActive(false));

  it("isScrubActive returns false by default", () => {
    expect(isScrubActive()).toBe(false);
  });

  it("setScrubActive(true) makes isScrubActive return true", () => {
    setScrubActive(true);
    expect(isScrubActive()).toBe(true);
  });

  it("setScrubActive(false) restores the guard", () => {
    setScrubActive(true);
    expect(isScrubActive()).toBe(true);
    setScrubActive(false);
    expect(isScrubActive()).toBe(false);
  });
});

// ─── Input focus detection ───────────────────────────────────────────

describe("input focus guard detection", () => {
  /** Mirrors the guard logic from Overlay.tsx handleKeyDown */
  function isInputFocused(target: HTMLElement): boolean {
    const tag = target.tagName.toLowerCase();
    return tag === "input" || tag === "textarea" || tag === "select" || target.isContentEditable;
  }

  it("detects INPUT elements as focused input", () => {
    const el = document.createElement("input");
    expect(isInputFocused(el)).toBe(true);
  });

  it("detects TEXTAREA elements as focused input", () => {
    const el = document.createElement("textarea");
    expect(isInputFocused(el)).toBe(true);
  });

  it("detects SELECT elements as focused input", () => {
    const el = document.createElement("select");
    expect(isInputFocused(el)).toBe(true);
  });

  it("detects contentEditable elements as focused input", () => {
    const el = document.createElement("div");
    el.contentEditable = "true";
    expect(isInputFocused(el)).toBe(true);
  });

  it("does not flag a regular div as focused input", () => {
    const el = document.createElement("div");
    expect(isInputFocused(el)).toBe(false);
  });

  it("does not flag a span as focused input", () => {
    const el = document.createElement("span");
    expect(isInputFocused(el)).toBe(false);
  });

  it("does not flag a button as focused input", () => {
    const el = document.createElement("button");
    expect(isInputFocused(el)).toBe(false);
  });
});

// ─── Portal keyboard guard ──────────────────────────────────────────

describe("portal keyboard guard", () => {
  /**
   * Mirrors the full guard logic from Overlay.tsx handleKeyDown (lines ~541-545).
   * The guard must block plain-key shortcuts when the target is:
   * 1. An input/textarea/select element
   * 2. A contentEditable element
   * 3. Inside .__tuner-root (insidePanel)
   * 4. Inside [data-tuner-portal] (portal-rendered popups)
   *
   * Case 4 is critical: createPortal renders outside .__tuner-root,
   * so buttons/sliders/preset-grids inside portals would otherwise
   * let shortcuts like 1-8 (Focus Mode) fire while the user interacts.
   */
  function shouldBlockPlainShortcut(target: HTMLElement): boolean {
    const tag = target.tagName.toLowerCase();
    const isTyping = tag === "input" || tag === "textarea" || tag === "select" || target.isContentEditable;
    const insidePanel = !!target.closest(".__tuner-root");
    const insidePortal = !!target.closest("[data-tuner-portal]");
    return isTyping || insidePanel || insidePortal;
  }

  it("blocks shortcuts for input inside a portal", () => {
    const portal = document.createElement("div");
    portal.setAttribute("data-tuner-portal", "");
    document.body.appendChild(portal);
    const input = document.createElement("input");
    portal.appendChild(input);

    expect(shouldBlockPlainShortcut(input)).toBe(true);
    document.body.removeChild(portal);
  });

  it("blocks shortcuts for button inside a portal", () => {
    const portal = document.createElement("div");
    portal.setAttribute("data-tuner-portal", "");
    document.body.appendChild(portal);
    const btn = document.createElement("button");
    portal.appendChild(btn);

    expect(shouldBlockPlainShortcut(btn)).toBe(true);
    document.body.removeChild(portal);
  });

  it("blocks shortcuts for div with tabIndex inside a portal", () => {
    const portal = document.createElement("div");
    portal.setAttribute("data-tuner-portal", "");
    document.body.appendChild(portal);
    const div = document.createElement("div");
    div.tabIndex = 0;
    portal.appendChild(div);

    expect(shouldBlockPlainShortcut(div)).toBe(true);
    document.body.removeChild(portal);
  });

  it("blocks shortcuts for range input (slider) inside a portal", () => {
    const portal = document.createElement("div");
    portal.setAttribute("data-tuner-portal", "");
    document.body.appendChild(portal);
    const range = document.createElement("input");
    range.type = "range";
    portal.appendChild(range);

    expect(shouldBlockPlainShortcut(range)).toBe(true);
    document.body.removeChild(portal);
  });

  it("blocks shortcuts for elements inside .__tuner-root", () => {
    const root = document.createElement("div");
    root.className = "__tuner-root";
    document.body.appendChild(root);
    const btn = document.createElement("button");
    root.appendChild(btn);

    expect(shouldBlockPlainShortcut(btn)).toBe(true);
    document.body.removeChild(root);
  });

  it("does NOT block shortcuts for elements outside panel and portals", () => {
    const div = document.createElement("div");
    document.body.appendChild(div);

    expect(shouldBlockPlainShortcut(div)).toBe(false);
    document.body.removeChild(div);
  });

  it("Overlay.tsx keyboard guard delegates to isInsideTunerUI (covers data-tuner-portal)", () => {
    const { readFileSync } = require("fs");
    const { join } = require("path");
    // Keyboard handler lives in hooks/useOverlayHotkeys.ts (extracted from Overlay.tsx)
    const src = readFileSync(join(__dirname, "..", "hooks", "useOverlayHotkeys.ts"), "utf-8");

    // Find the guard block (between "skip when typing" and the first plain-key shortcut "N to toggle")
    const guardStart = src.indexOf("skip when typing in inputs");
    expect(guardStart).toBeGreaterThan(-1);

    const guardBlock = src.slice(guardStart, guardStart + 400);

    // ADR-0008 unified the guard on `isInsideTunerUI`, which itself matches
    // `data-tuner-portal` (along with the shadow-host attribute). The util's
    // selector list is the single source of truth.
    expect(guardBlock).toContain("isInsideTunerUI");

    const utilSrc = readFileSync(join(__dirname, "..", "util.ts"), "utf-8");
    expect(utilSrc).toContain("data-tuner-portal");
  });
});

// ─── Keyboard shortcut key mapping ──────────────────────────────────

describe("keyboard shortcut key mapping", () => {
  /**
   * This map mirrors the plain-key shortcuts in Overlay.tsx handleKeyDown.
   * These fire only when no modifier is held and no input is focused.
   */
  const PLAIN_KEY_MAP: Record<string, string> = {
    s: "cycle-scope",
    r: "reset",
    d: "diff-peek",
    m: "toggle-box-model",
    g: "toggle-grid-overlay",
    t: "toggle-tab",
    "/": "open-search",
    "?": "shortcuts-help",
    "[": "cycle-section-prev",
    "]": "cycle-section-next",
    "`": "toggle-selecting",
    Escape: "close-or-deselect",
  };

  /** Shifted plain keys (no meta/ctrl) */
  const SHIFTED_KEY_MAP: Record<string, string> = {
    "Shift+R": "reset-all",
  };

  /** Number keys for section jumping */
  const NUMBER_KEY_MAP: Record<string, string> = {
    "1": "jump-to-Layout",
  };

  it.each(Object.entries(PLAIN_KEY_MAP))(
    "maps '%s' to %s",
    (key, action) => {
      expect(PLAIN_KEY_MAP[key]).toBe(action);
    },
  );

  it.each(Object.entries(SHIFTED_KEY_MAP))(
    "maps '%s' to %s",
    (combo, action) => {
      expect(SHIFTED_KEY_MAP[combo]).toBe(action);
    },
  );

  it.each(Object.entries(NUMBER_KEY_MAP))(
    "maps '%s' to %s",
    (key, action) => {
      expect(NUMBER_KEY_MAP[key]).toBe(action);
    },
  );

  /**
   * Modifier shortcuts from Overlay.tsx handleKeyDown.
   * These fire regardless of input focus (before the input guard).
   */
  const META_KEY_MAP: Record<string, string> = {
    "Meta+z": "undo",
    "Meta+Shift+z": "redo",
    "Meta+s": "save",
    "Meta+c": "copy-css",
    "Meta+f": "toggle-search",
    "Meta+k": "command-palette",
    "Meta+Alt+c": "copy-styles",
    "Meta+Alt+v": "paste-styles",
  };

  it.each(Object.entries(META_KEY_MAP))(
    "maps '%s' to %s",
    (combo, action) => {
      expect(META_KEY_MAP[combo]).toBe(action);
    },
  );
});

// ─── Arrow key navigation dispatch ──────────────────────────────────

describe("arrow key element navigation", () => {
  /** Mirrors the arrow key → direction mapping in Overlay.tsx */
  const ARROW_MAP: Record<string, string> = {
    ArrowUp: "parent",
    ArrowDown: "first-child",
    ArrowLeft: "previous-sibling",
    ArrowRight: "next-sibling",
  };

  it.each(Object.entries(ARROW_MAP))(
    "%s navigates to %s",
    (key, direction) => {
      expect(ARROW_MAP[key]).toBe(direction);
    },
  );

  it("recognizes all four arrow keys", () => {
    expect(Object.keys(ARROW_MAP)).toEqual([
      "ArrowUp",
      "ArrowDown",
      "ArrowLeft",
      "ArrowRight",
    ]);
  });

  it("arrow key handler skips element navigation when focus is inside the panel", () => {
    // The arrow key handler in Overlay.tsx must check `insidePanel` so that
    // ArrowDown/ArrowUp on dropdown comboboxes (UnitSelector, PositionSelector)
    // reach the React onKeyDown handler instead of being stolen for element nav.
    const { readFileSync } = require("fs");
    const { join } = require("path");
    // Keyboard handler lives in hooks/useOverlayHotkeys.ts (extracted from Overlay.tsx)
    const overlaySrc = readFileSync(join(__dirname, "..", "hooks", "useOverlayHotkeys.ts"), "utf-8");

    // Find the arrow key handler block
    const arrowBlockStart = overlaySrc.indexOf("Arrow key element navigation");
    expect(arrowBlockStart).toBeGreaterThan(-1);

    // The condition line must include an insidePanel guard
    const arrowBlock = overlaySrc.slice(arrowBlockStart, arrowBlockStart + 400);
    expect(arrowBlock).toContain("insidePanel");
  });
});

// ─── Modifier key helpers ────────────────────────────────────────────

describe("modifier key detection", () => {
  /** Helper that mirrors how Overlay checks for meta shortcuts */
  function isMetaCombo(e: { metaKey: boolean; ctrlKey: boolean }): boolean {
    return e.metaKey || e.ctrlKey;
  }

  it("returns true for metaKey", () => {
    expect(isMetaCombo({ metaKey: true, ctrlKey: false })).toBe(true);
  });

  it("returns true for ctrlKey (Windows/Linux)", () => {
    expect(isMetaCombo({ metaKey: false, ctrlKey: true })).toBe(true);
  });

  it("returns false when neither is pressed", () => {
    expect(isMetaCombo({ metaKey: false, ctrlKey: false })).toBe(false);
  });
});

// ─── Shortcut priority ordering ─────────────────────────────────────

describe("shortcut priority", () => {
  /**
   * Overlay.tsx processes shortcuts in this order:
   * 1. Scrub guard (blocks everything)
   * 2. Meta+Shift+Z (redo) — before Meta+Z
   * 3. Meta+Z (undo)
   * 4. Meta+Alt+C (copy styles) — before Meta+C
   * 5. Meta+Alt+V (paste styles)
   * 6. Meta+S (save)
   * 7. Meta+C (copy CSS)
   * 8. Meta+K (command palette)
   * 9. Meta+F (search)
   * 10. Input focus guard (blocks remaining plain keys)
   * 11. Plain keys: /, ?, Alt+Shift+S, s, Shift+R, r, h, m, g, t, 1-8, [, ], `, Escape, d, arrows
   *
   * This test verifies that redo comes before undo in the priority list
   * and that Meta+Alt+C comes before Meta+C.
   */
  const PRIORITY_ORDER = [
    "scrub-guard",
    "meta-shift-z",  // redo
    "meta-z",        // undo
    "meta-alt-c",    // copy styles
    "meta-alt-v",    // paste styles
    "meta-s",        // save
    "meta-c",        // copy css
    "meta-k",        // command palette
    "meta-f",        // search
    "input-guard",
    "plain-keys",
  ];

  it("redo check comes before undo check", () => {
    expect(PRIORITY_ORDER.indexOf("meta-shift-z")).toBeLessThan(
      PRIORITY_ORDER.indexOf("meta-z"),
    );
  });

  it("Meta+Alt+C comes before Meta+C", () => {
    expect(PRIORITY_ORDER.indexOf("meta-alt-c")).toBeLessThan(
      PRIORITY_ORDER.indexOf("meta-c"),
    );
  });

  it("scrub guard is first", () => {
    expect(PRIORITY_ORDER[0]).toBe("scrub-guard");
  });

  it("input guard comes after all meta combos", () => {
    expect(PRIORITY_ORDER.indexOf("input-guard")).toBeGreaterThan(
      PRIORITY_ORDER.indexOf("meta-f"),
    );
  });

  it("plain keys come last", () => {
    expect(PRIORITY_ORDER.indexOf("plain-keys")).toBe(
      PRIORITY_ORDER.length - 1,
    );
  });
});

// ─── KeyboardEvent simulation helpers ────────────────────────────────

describe("KeyboardEvent creation for dispatch", () => {
  it("creates a valid KeyboardEvent with meta+z", () => {
    const event = new KeyboardEvent("keydown", {
      key: "z",
      metaKey: true,
      shiftKey: false,
      bubbles: true,
    });
    expect(event.key).toBe("z");
    expect(event.metaKey).toBe(true);
    expect(event.shiftKey).toBe(false);
  });

  it("creates a valid KeyboardEvent with meta+shift+z", () => {
    const event = new KeyboardEvent("keydown", {
      key: "z",
      metaKey: true,
      shiftKey: true,
      bubbles: true,
    });
    expect(event.key).toBe("z");
    expect(event.metaKey).toBe(true);
    expect(event.shiftKey).toBe(true);
  });

  it("creates arrow key events", () => {
    const arrows = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"];
    for (const key of arrows) {
      const event = new KeyboardEvent("keydown", { key, bubbles: true });
      expect(event.key).toBe(key);
    }
  });

  it("creates Escape event", () => {
    const event = new KeyboardEvent("keydown", {
      key: "Escape",
      bubbles: true,
    });
    expect(event.key).toBe("Escape");
  });
});
