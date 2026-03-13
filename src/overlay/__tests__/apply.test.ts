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
  clearRedundantOverrides,
  stateKey,
  parseStateKey,
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

// ─── undo after save (clearRedundantOverrides) ────────────────────────

describe("undo after save / HMR reconciliation", () => {
  it("undo works after clearRedundantOverrides clears a saved override", () => {
    const el = makeEl();

    // User changes color via panel
    applyInlineStyle(el, "color", "red");
    expect(overrideCount(el)).toBe(1);

    // Simulate save + HMR: after commit.ts writes to CSS file and HMR fires,
    // the computed style now returns the saved value "red".
    // clearRedundantOverrides sees inline "red" == computed "red" → clears it.
    const spy = vi.spyOn(window, "getComputedStyle").mockImplementation(() => ({
      getPropertyValue: () => "red",
    } as any));

    const cleared = clearRedundantOverrides();
    spy.mockRestore();

    expect(cleared).toBe(1);
    expect(overrideCount(el)).toBe(0); // override gone — HMR reconciled

    // User presses Cmd+Z — should still undo (re-apply the pre-change value)
    const result = undo();
    expect(result).not.toBeNull();
    expect(result!.el).toBe(el);
    expect(result!.prop).toBe("color");
  });

  it("undo re-applies the original value as an inline override after save", () => {
    const el = makeEl();

    // Element starts with computed color "" (happy-dom default).
    // User changes to "red", saves, HMR clears it.
    applyInlineStyle(el, "color", "red");

    const spy = vi.spyOn(window, "getComputedStyle").mockImplementation(() => ({
      getPropertyValue: () => "red",
    } as any));
    clearRedundantOverrides();
    spy.mockRestore();

    // Undo should set the inline style to the PREVIOUS value (initial = "")
    undo();
    // The override should be tracked again with the initial value re-applied
    expect(el.style.getPropertyValue("color")).toBe("");
  });

  it("undo works for batch entries after HMR clears overrides", () => {
    const el = makeEl();

    // User pastes multiple styles (batch operation)
    beginBatch();
    applyInlineStyle(el, "color", "red");
    applyInlineStyle(el, "width", "100px");
    endBatch();

    expect(overrideCount(el)).toBe(2);

    // Simulate save + HMR clearing both overrides
    const spy = vi.spyOn(window, "getComputedStyle").mockImplementation(() => ({
      getPropertyValue: (prop: string) => {
        if (prop === "color") return "red";
        if (prop === "width") return "100px";
        return "";
      },
    } as any));
    clearRedundantOverrides();
    spy.mockRestore();

    expect(overrideCount(el)).toBe(0);

    // Single undo should revert the entire batch
    const result = undo();
    expect(result).not.toBeNull();
  });

  it("redo works after undo-after-save", () => {
    const el = makeEl();

    applyInlineStyle(el, "color", "red");

    // Save + HMR clears override
    const spy = vi.spyOn(window, "getComputedStyle").mockImplementation(() => ({
      getPropertyValue: () => "red",
    } as any));
    clearRedundantOverrides();
    spy.mockRestore();

    // Undo then redo
    undo();
    const result = redo();
    expect(result).not.toBeNull();
    expect(el.style.getPropertyValue("color")).toBe("red");
  });
});

// ─── stateKey / parseStateKey ─────────────────────────────────────────

describe("stateKey / parseStateKey", () => {
  it("returns bare prop for 'none' state", () => {
    expect(stateKey("none", "color")).toBe("color");
  });

  it("returns composite key for non-none state", () => {
    expect(stateKey("hover", "color")).toBe("hover::color");
  });

  it("parseStateKey roundtrips with stateKey for non-none state", () => {
    const key = stateKey("hover", "font-size");
    const { state, prop } = parseStateKey(key);
    expect(state).toBe("hover");
    expect(prop).toBe("font-size");
  });

  it("parseStateKey handles bare prop (no state)", () => {
    const { state, prop } = parseStateKey("color");
    expect(state).toBe("none");
    expect(prop).toBe("color");
  });

  it("parseStateKey handles focus state", () => {
    const { state, prop } = parseStateKey("focus::border-color");
    expect(state).toBe("focus");
    expect(prop).toBe("border-color");
  });
});

// ─── diff with state-keyed entries ────────────────────────────────────

describe("diff — state field", () => {
  it("returns state field for composite-keyed overrides", () => {
    const el = makeEl();
    applyInlineStyle(el, stateKey("hover", "color"), "red");
    const changes = diff(el);
    expect(changes).toHaveLength(1);
    expect(changes[0].prop).toBe("color");
    expect(changes[0].state).toBe("hover");
    expect(changes[0].to).toBe("red");
  });

  it("returns no state field for non-state overrides", () => {
    const el = makeEl();
    applyInlineStyle(el, "color", "blue");
    const changes = diff(el);
    expect(changes).toHaveLength(1);
    expect(changes[0].prop).toBe("color");
    expect(changes[0].state).toBeUndefined();
  });

  it("handles mixed state and non-state overrides on same element", () => {
    const el = makeEl();
    applyInlineStyle(el, "color", "blue");
    applyInlineStyle(el, stateKey("hover", "color"), "red");
    const changes = diff(el);
    expect(changes).toHaveLength(2);
    const baseChange = changes.find(c => !c.state);
    const stateChange = changes.find(c => c.state === "hover");
    expect(baseChange).toBeDefined();
    expect(baseChange!.to).toBe("blue");
    expect(stateChange).toBeDefined();
    expect(stateChange!.to).toBe("red");
  });
});

// ─── undo/redo with state-keyed entries ───────────────────────────────

describe("undo/redo — state-keyed entries", () => {
  it("state-keyed applyInlineStyle does NOT set inline style", () => {
    const el = makeEl();
    applyInlineStyle(el, stateKey("hover", "color"), "red");
    // Inline style should not be set for state-keyed props
    expect(el.style.getPropertyValue("color")).toBe("");
    expect(el.style.getPropertyValue("hover::color")).toBe("");
  });

  it("undo of state-keyed entry does NOT touch inline style", () => {
    const el = makeEl();
    applyInlineStyle(el, stateKey("hover", "color"), "red");
    undo();
    // Should not crash and inline style should remain untouched
    expect(el.style.getPropertyValue("color")).toBe("");
  });

  it("redo of state-keyed entry does NOT set inline style", () => {
    const el = makeEl();
    applyInlineStyle(el, stateKey("hover", "color"), "red");
    undo();
    redo();
    // Override is tracked but no inline style
    expect(el.style.getPropertyValue("color")).toBe("");
    const changes = diff(el);
    expect(changes).toHaveLength(1);
    expect(changes[0].state).toBe("hover");
  });
});
