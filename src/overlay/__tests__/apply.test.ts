// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  applyInlineStyle,
  undo,
  redo,
  reset,
  resetAll,
  diff,
  diffAll,
  isDirty,
  getInitial,
  overrideCount,
  hasOverrides,
  totalOverrideCount,
  touchedElementCount,
  beginBatch,
  endBatch,
  stripAllOverrides,
  restoreAllOverrides,
  resetProp,
  copyStyles,
  pasteStyles,
  hasClipboardStyles,
} from "../apply";

// ─── Setup ────────────────────────────────────────────────────────────

function makeEl(tag = "div"): HTMLElement {
  const el = document.createElement(tag);
  document.body.appendChild(el);
  return el;
}

beforeEach(() => {
  resetAll();
  document.body.innerHTML = "";
});

// ─── applyInlineStyle ─────────────────────────────────────────────────

describe("applyInlineStyle", () => {
  it("sets the inline style with !important", () => {
    const el = makeEl();
    applyInlineStyle(el, "color", "red");
    expect(el.style.getPropertyValue("color")).toBe("red");
    expect(el.style.getPropertyPriority("color")).toBe("important");
  });

  it("tracks initial value on first touch", () => {
    const el = makeEl();
    applyInlineStyle(el, "color", "red");
    expect(getInitial(el, "color")).toBeDefined();
  });

  it("updates current on subsequent applies", () => {
    const el = makeEl();
    applyInlineStyle(el, "color", "red");
    applyInlineStyle(el, "color", "blue");
    const changes = diff(el);
    expect(changes).toHaveLength(1);
    expect(changes[0].to).toBe("blue");
  });
});

// ─── diff ─────────────────────────────────────────────────────────────

describe("diff", () => {
  it("returns empty for untouched elements", () => {
    const el = makeEl();
    expect(diff(el)).toEqual([]);
  });

  it("returns changes with prop, from, to", () => {
    const el = makeEl();
    applyInlineStyle(el, "width", "100px");
    const changes = diff(el);
    expect(changes).toHaveLength(1);
    expect(changes[0].prop).toBe("width");
    expect(changes[0].to).toBe("100px");
  });

  it("omits properties reverted to initial", () => {
    const el = makeEl();
    applyInlineStyle(el, "width", "100px");
    // Undo to revert
    undo();
    expect(diff(el)).toEqual([]);
  });
});

describe("diffAll", () => {
  it("returns diffs across multiple elements", () => {
    const a = makeEl();
    const b = makeEl();
    applyInlineStyle(a, "width", "100px");
    applyInlineStyle(b, "height", "50px");
    const all = diffAll();
    expect(all).toHaveLength(2);
  });
});

// ─── undo / redo ──────────────────────────────────────────────────────

describe("undo", () => {
  it("returns null on empty stack", () => {
    expect(undo()).toBeNull();
  });

  it("reverts a single apply", () => {
    const el = makeEl();
    applyInlineStyle(el, "color", "red");
    expect(el.style.getPropertyValue("color")).toBe("red");

    undo();
    // After undo, the property should be removed (reverted to initial)
    expect(el.style.getPropertyValue("color")).toBe("");
  });

  it("reverts multiple properties in order", () => {
    const el = makeEl();
    applyInlineStyle(el, "color", "red");
    applyInlineStyle(el, "width", "100px");

    undo(); // reverts width
    expect(el.style.getPropertyValue("width")).toBe("");
    expect(el.style.getPropertyValue("color")).toBe("red");

    undo(); // reverts color
    expect(el.style.getPropertyValue("color")).toBe("");
  });
});

describe("redo", () => {
  it("returns null on empty redo stack", () => {
    expect(redo()).toBeNull();
  });

  it("re-applies an undone change", () => {
    const el = makeEl();
    applyInlineStyle(el, "color", "red");
    undo();
    expect(el.style.getPropertyValue("color")).toBe("");

    redo();
    expect(el.style.getPropertyValue("color")).toBe("red");
  });

  it("clears redo stack on new action", () => {
    const el = makeEl();
    applyInlineStyle(el, "color", "red");
    undo();

    // New action after undo should clear redo
    applyInlineStyle(el, "color", "blue");
    expect(redo()).toBeNull();
  });
});

// ─── reset ────────────────────────────────────────────────────────────

describe("reset", () => {
  it("removes all overrides for an element", () => {
    const el = makeEl();
    applyInlineStyle(el, "color", "red");
    applyInlineStyle(el, "width", "100px");

    reset(el);
    expect(el.style.getPropertyValue("color")).toBe("");
    expect(el.style.getPropertyValue("width")).toBe("");
    expect(overrideCount(el)).toBe(0);
  });

  it("does not affect other elements", () => {
    const a = makeEl();
    const b = makeEl();
    applyInlineStyle(a, "color", "red");
    applyInlineStyle(b, "color", "blue");

    reset(a);
    expect(overrideCount(a)).toBe(0);
    expect(overrideCount(b)).toBe(1);
  });
});

describe("resetAll", () => {
  it("clears everything", () => {
    const a = makeEl();
    const b = makeEl();
    applyInlineStyle(a, "color", "red");
    applyInlineStyle(b, "width", "100px");

    resetAll();
    expect(hasOverrides()).toBe(false);
    expect(a.style.getPropertyValue("color")).toBe("");
    expect(b.style.getPropertyValue("width")).toBe("");
  });
});

// ─── isDirty / getInitial ─────────────────────────────────────────────

describe("isDirty", () => {
  it("returns false for untouched props", () => {
    const el = makeEl();
    expect(isDirty(el, "color")).toBe(false);
  });

  it("returns true for modified props", () => {
    const el = makeEl();
    applyInlineStyle(el, "color", "red");
    expect(isDirty(el, "color")).toBe(true);
  });

  it("returns false after undo back to initial", () => {
    const el = makeEl();
    applyInlineStyle(el, "color", "red");
    undo();
    expect(isDirty(el, "color")).toBe(false);
  });
});

describe("getInitial", () => {
  it("returns null for untouched props", () => {
    const el = makeEl();
    expect(getInitial(el, "color")).toBeNull();
  });

  it("returns the initial value after apply", () => {
    const el = makeEl();
    applyInlineStyle(el, "color", "red");
    // Initial is whatever getComputedStyle returned before the apply
    expect(getInitial(el, "color")).toBeDefined();
  });
});

// ─── counting functions ───────────────────────────────────────────────

describe("overrideCount", () => {
  it("returns 0 for untouched elements", () => {
    const el = makeEl();
    expect(overrideCount(el)).toBe(0);
  });

  it("counts overrides per element", () => {
    const el = makeEl();
    applyInlineStyle(el, "color", "red");
    applyInlineStyle(el, "width", "100px");
    expect(overrideCount(el)).toBe(2);
  });
});

describe("totalOverrideCount", () => {
  it("counts across elements (only changed props)", () => {
    const a = makeEl();
    const b = makeEl();
    applyInlineStyle(a, "color", "red");
    applyInlineStyle(b, "width", "100px");
    expect(totalOverrideCount()).toBe(2);
  });
});

describe("touchedElementCount", () => {
  it("counts elements with at least one change", () => {
    const a = makeEl();
    const b = makeEl();
    const c = makeEl();
    applyInlineStyle(a, "color", "red");
    applyInlineStyle(b, "width", "100px");
    expect(touchedElementCount()).toBe(2);
  });
});

// ─── batch ────────────────────────────────────────────────────────────

describe("batch undo", () => {
  it("groups multiple applies into one undo entry", () => {
    const el = makeEl();
    beginBatch();
    applyInlineStyle(el, "color", "red");
    applyInlineStyle(el, "width", "100px");
    applyInlineStyle(el, "height", "50px");
    endBatch();

    // Single undo should revert all 3
    undo();
    expect(el.style.getPropertyValue("color")).toBe("");
    expect(el.style.getPropertyValue("width")).toBe("");
    expect(el.style.getPropertyValue("height")).toBe("");
  });

  it("can redo a batch", () => {
    const el = makeEl();
    beginBatch();
    applyInlineStyle(el, "color", "red");
    applyInlineStyle(el, "width", "100px");
    endBatch();

    undo();
    redo();
    expect(el.style.getPropertyValue("color")).toBe("red");
    expect(el.style.getPropertyValue("width")).toBe("100px");
  });
});

// ─── strip / restore (diff peek) ─────────────────────────────────────

describe("stripAllOverrides / restoreAllOverrides", () => {
  it("strips overrides from DOM but keeps tracking", () => {
    const el = makeEl();
    applyInlineStyle(el, "color", "red");

    stripAllOverrides();
    expect(el.style.getPropertyValue("color")).toBe("");
    // Tracking still has the override
    expect(overrideCount(el)).toBe(1);
  });

  it("restores stripped overrides", () => {
    const el = makeEl();
    applyInlineStyle(el, "color", "red");

    stripAllOverrides();
    restoreAllOverrides();
    expect(el.style.getPropertyValue("color")).toBe("red");
  });
});

// ─── resetProp ────────────────────────────────────────────────────────

describe("resetProp", () => {
  it("resets a single property", () => {
    const el = makeEl();
    applyInlineStyle(el, "color", "red");
    applyInlineStyle(el, "width", "100px");

    resetProp(el, "color");
    expect(el.style.getPropertyValue("color")).toBe("");
    expect(el.style.getPropertyValue("width")).toBe("100px");
    expect(overrideCount(el)).toBe(1);
  });
});

// ─── clipboard ────────────────────────────────────────────────────────

describe("style clipboard", () => {
  it("starts empty", () => {
    expect(hasClipboardStyles()).toBe(false);
  });

  it("copies and pastes styles between elements", () => {
    const src = makeEl();
    const dest = makeEl();

    applyInlineStyle(src, "color", "red");
    applyInlineStyle(src, "width", "100px");

    const copied = copyStyles(src);
    expect(copied).toBe(2);
    expect(hasClipboardStyles()).toBe(true);

    const pasted = pasteStyles(dest);
    expect(pasted).toBe(2);
    expect(dest.style.getPropertyValue("color")).toBe("red");
    expect(dest.style.getPropertyValue("width")).toBe("100px");
  });

  it("paste is undone as a single batch", () => {
    const src = makeEl();
    const dest = makeEl();

    applyInlineStyle(src, "color", "red");
    applyInlineStyle(src, "width", "100px");
    copyStyles(src);
    pasteStyles(dest);

    // Single undo should revert the entire paste
    undo();
    expect(dest.style.getPropertyValue("color")).toBe("");
    expect(dest.style.getPropertyValue("width")).toBe("");
  });
});
