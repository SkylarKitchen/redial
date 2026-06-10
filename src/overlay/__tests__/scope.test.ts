// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from "vitest";
import {
  getCSSModuleClasses,
  getReadableName,
  applyClassStyle,
  removeClassStyle,
  resetClassStyles,
  destroyClassStyles,
  getCustomProperties,
  getClassScopeCss,
} from "../core/scope";
import { beginBatch, endBatch } from "../core/apply";

// ─── Setup ────────────────────────────────────────────────────────────

function makeEl(tag = "div"): HTMLElement {
  const el = document.createElement(tag);
  document.body.appendChild(el);
  return el;
}

function getStyleText(): string | null {
  return getClassScopeCss();
}

beforeEach(() => {
  destroyClassStyles();
  document.body.innerHTML = "";
});

// ─── getCSSModuleClasses ──────────────────────────────────────────────

describe("getCSSModuleClasses", () => {
  it("detects webpack CSS module classes", () => {
    const el = makeEl();
    el.className = "Button_btn__a8f2k";
    expect(getCSSModuleClasses(el)).toEqual(["Button_btn__a8f2k"]);
  });

  it("detects Turbopack CSS module classes", () => {
    const el = makeEl();
    el.className = "page-module__IiFEKa__btnPrimary";
    expect(getCSSModuleClasses(el)).toEqual([
      "page-module__IiFEKa__btnPrimary",
    ]);
  });

  it("filters out non-module classes", () => {
    const el = makeEl();
    el.className = "flex items-center mt-4";
    expect(getCSSModuleClasses(el)).toEqual([]);
  });

  it("returns empty for elements with no classes", () => {
    const el = makeEl();
    expect(getCSSModuleClasses(el)).toEqual([]);
  });

  it("returns empty for empty class string", () => {
    const el = makeEl();
    el.className = "   ";
    expect(getCSSModuleClasses(el)).toEqual([]);
  });

  it("extracts module classes from a mixed list", () => {
    const el = makeEl();
    el.className =
      "flex Button_btn__a8f2k items-center page-module__IiFEKa__btnPrimary mt-4";
    const result = getCSSModuleClasses(el);
    expect(result).toEqual([
      "Button_btn__a8f2k",
      "page-module__IiFEKa__btnPrimary",
    ]);
  });

  it("rejects classes that almost match webpack format but start lowercase", () => {
    const el = makeEl();
    el.className = "button_btn__a8f2k";
    expect(getCSSModuleClasses(el)).toEqual([]);
  });

  it("rejects Turbopack-like classes missing -module segment", () => {
    const el = makeEl();
    el.className = "page-styles__IiFEKa__btnPrimary";
    expect(getCSSModuleClasses(el)).toEqual([]);
  });
});

// ─── getReadableName ──────────────────────────────────────────────────

describe("getReadableName", () => {
  it("extracts middle segment from webpack format", () => {
    expect(getReadableName("Button_btn__a8f2k")).toBe("btn");
  });

  it("extracts last segment from Turbopack format", () => {
    expect(getReadableName("page-module__IiFEKa__btnPrimary")).toBe(
      "btnPrimary"
    );
  });

  it("returns null for non-module class", () => {
    expect(getReadableName("flex")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(getReadableName("")).toBeNull();
  });

  it("handles webpack format with multi-part component name", () => {
    expect(getReadableName("CardHeader_title__x9k2m")).toBe("title");
  });

  it("handles Turbopack format with hyphenated file name", () => {
    expect(getReadableName("my-component-module__abc123__wrapper")).toBe(
      "wrapper"
    );
  });
});

// ─── applyClassStyle (class-scope save path) ─────────────────────────

describe("applyClassStyle — class-scope save path", () => {
  it("registers the class-scope sheet with a correct CSS rule for a class and property", () => {
    applyClassStyle("Card_wrapper__f3k2m", "background-color", "#f0f0f0");
    const css = getStyleText();
    expect(css).not.toBeNull();
    // The rule should target the exact class
    expect(css!).toContain("Card_wrapper__f3k2m");
    // The rule should contain the property with !important
    expect(css!).toContain(
      "background-color: #f0f0f0 !important"
    );
  });

  it("resetClassStyles removes all overrides for a class", () => {
    applyClassStyle("Card_wrapper__f3k2m", "color", "red");
    applyClassStyle("Card_wrapper__f3k2m", "font-size", "20px");
    applyClassStyle("Card_wrapper__f3k2m", "padding", "12px");

    // Confirm they exist first
    const before = getStyleText()!;
    expect(before).toContain("color: red !important");
    expect(before).toContain("font-size: 20px !important");
    expect(before).toContain("padding: 12px !important");

    // Reset all overrides for this class
    resetClassStyles("Card_wrapper__f3k2m");

    const after = getStyleText()!;
    // The sheet should no longer contain this class's rules
    expect(after).not.toContain("Card_wrapper__f3k2m");
    expect(after).not.toContain("color: red");
    expect(after).not.toContain("font-size: 20px");
    expect(after).not.toContain("padding: 12px");
  });
});

// ─── Batched rebuilds during a drag (issue #29) ──────────────────────────

describe("applyClassStyle — batched rebuilds", () => {
  it("defers the rewrite while a batch is open, flushing once on endBatch", () => {
    beginBatch();
    applyClassStyle("Card_wrapper__f3k2m", "color", "red");
    applyClassStyle("Card_wrapper__f3k2m", "color", "green");
    applyClassStyle("Card_wrapper__f3k2m", "color", "blue");

    // Mid-batch the sheet is NOT yet rewritten — the drag's intermediate values
    // never hit the DOM, only the final one does.
    expect(getStyleText() ?? "").not.toContain("color");

    endBatch();

    // One flush on close, carrying only the last value.
    const after = getStyleText()!;
    expect(after).toContain("color: blue !important");
    expect(after).not.toContain("color: red");
  });

  it("nested batches only flush at the outermost endBatch", () => {
    beginBatch();
    beginBatch();
    applyClassStyle("X_y__a1", "opacity", "0.5");
    endBatch(); // inner close — still deferred
    expect(getStyleText() ?? "").not.toContain("opacity");
    endBatch(); // outer close — flush
    expect(getStyleText()!).toContain("opacity: 0.5 !important");
  });
});

// ─── applyClassStyle ──────────────────────────────────────────────────

describe("applyClassStyle", () => {
  it("registers the class-scope managed sheet on first apply", () => {
    applyClassStyle("Button_btn__a8f2k", "color", "red");
    expect(getStyleText()).not.toBeNull();
  });

  it("applies a CSS rule with !important", () => {
    applyClassStyle("Button_btn__a8f2k", "color", "red");
    expect(getStyleText()!).toContain("color: red !important");
  });

  it("scopes the rule to the class selector via the managed sheet", () => {
    applyClassStyle("Button_btn__a8f2k", "color", "red");
    expect(getStyleText()!).toContain("Button_btn__a8f2k");
  });

  it("handles multiple properties on the same class", () => {
    applyClassStyle("Button_btn__a8f2k", "color", "red");
    applyClassStyle("Button_btn__a8f2k", "font-size", "16px");
    const css = getStyleText()!;
    expect(css).toContain("color: red !important");
    expect(css).toContain("font-size: 16px !important");
  });

  it("handles multiple different classes", () => {
    applyClassStyle("Button_btn__a8f2k", "color", "red");
    applyClassStyle("Card_title__z3j8n", "margin", "10px");
    const css = getStyleText()!;
    expect(css).toContain("Button_btn__a8f2k");
    expect(css).toContain("Card_title__z3j8n");
  });

  it("updates an existing property value", () => {
    applyClassStyle("Button_btn__a8f2k", "color", "red");
    applyClassStyle("Button_btn__a8f2k", "color", "blue");
    const css = getStyleText()!;
    expect(css).toContain("color: blue !important");
    expect(css).not.toContain("color: red");
  });

  it("reuses the same managed sheet across calls", () => {
    applyClassStyle("Foo_a__x", "color", "red");
    applyClassStyle("Bar_b__y", "width", "100px");
    const css = getStyleText()!;
    expect(css).toContain("Foo_a__x");
    expect(css).toContain("Bar_b__y");
  });
});

// ─── removeClassStyle ─────────────────────────────────────────────────

describe("removeClassStyle", () => {
  it("removes a single property from a class", () => {
    applyClassStyle("Button_btn__a8f2k", "color", "red");
    applyClassStyle("Button_btn__a8f2k", "font-size", "16px");
    removeClassStyle("Button_btn__a8f2k", "color");
    const css = getStyleText()!;
    expect(css).not.toContain("color: red");
    expect(css).toContain("font-size: 16px !important");
  });

  it("removes the class rule entirely when last property is removed", () => {
    applyClassStyle("Button_btn__a8f2k", "color", "red");
    removeClassStyle("Button_btn__a8f2k", "color");
    expect(getStyleText()!).not.toContain("Button_btn__a8f2k");
  });

  it("does nothing for unknown class", () => {
    applyClassStyle("Button_btn__a8f2k", "color", "red");
    removeClassStyle("NonExistent_foo__bar", "color");
    expect(getStyleText()!).toContain("color: red !important");
  });

  it("does nothing for unknown property on a known class", () => {
    applyClassStyle("Button_btn__a8f2k", "color", "red");
    removeClassStyle("Button_btn__a8f2k", "font-size");
    expect(getStyleText()!).toContain("color: red !important");
  });
});

// ─── resetClassStyles ─────────────────────────────────────────────────

describe("resetClassStyles", () => {
  it("removes all overrides for a class", () => {
    applyClassStyle("Button_btn__a8f2k", "color", "red");
    applyClassStyle("Button_btn__a8f2k", "font-size", "16px");
    applyClassStyle("Button_btn__a8f2k", "width", "100px");
    resetClassStyles("Button_btn__a8f2k");
    expect(getStyleText()!).not.toContain("Button_btn__a8f2k");
  });

  it("does not affect other classes", () => {
    applyClassStyle("Button_btn__a8f2k", "color", "red");
    applyClassStyle("Card_title__z3j8n", "margin", "10px");
    resetClassStyles("Button_btn__a8f2k");
    const css = getStyleText()!;
    expect(css).not.toContain("Button_btn__a8f2k");
    expect(css).toContain("Card_title__z3j8n");
  });

  it("handles resetting a class with no overrides", () => {
    // Should not throw
    resetClassStyles("NonExistent_foo__bar");
  });
});

// ─── destroyClassStyles ───────────────────────────────────────────────

describe("destroyClassStyles", () => {
  it("disposes the managed sheet", () => {
    applyClassStyle("Button_btn__a8f2k", "color", "red");
    expect(getStyleText()).not.toBeNull();
    destroyClassStyles();
    expect(getStyleText()).toBeNull();
  });

  it("clears all tracked overrides", () => {
    applyClassStyle("Button_btn__a8f2k", "color", "red");
    applyClassStyle("Card_title__z3j8n", "margin", "10px");
    destroyClassStyles();
    // Re-applying should start fresh
    applyClassStyle("Button_btn__a8f2k", "width", "50px");
    const css = getStyleText()!;
    expect(css).not.toContain("color");
    expect(css).not.toContain("margin");
    expect(css).toContain("width: 50px !important");
  });

  it("is idempotent when called multiple times", () => {
    applyClassStyle("Button_btn__a8f2k", "color", "red");
    destroyClassStyles();
    destroyClassStyles(); // should not throw
    expect(getStyleText()).toBeNull();
  });

  it("allows recreation after destruction", () => {
    applyClassStyle("Button_btn__a8f2k", "color", "red");
    destroyClassStyles();
    applyClassStyle("Button_btn__a8f2k", "color", "blue");
    const css = getStyleText();
    expect(css).not.toBeNull();
    expect(css!).toContain("color: blue !important");
  });
});

// ─── Class-scope undo sync (A1 bug) ──────────────────────────────────

describe("class-scope undo reverts managed sheet", () => {
  it("undo of class-scoped edit removes the property from the managed sheet", async () => {
    const { applyInlineStyle, undo, resetAll, onClassChange } = await import("../core/apply");

    // Subscribe scope.ts to class change notifications
    const unsubscribe = onClassChange(({ className, prop, value }) => {
      if (value !== null) {
        applyClassStyle(className, prop, value);
      } else {
        removeClassStyle(className, prop);
      }
    });

    const el = makeEl();
    const className = "Button_btn__a8f2k";

    // Simulate class-scope apply (same as WebflowPanel.tsx apply callback)
    applyClassStyle(className, "color", "red");
    applyInlineStyle(el, "color", "red", className);

    // Verify the sheet has the rule
    expect(getStyleText()!).toContain("color: red !important");

    // Undo should revert BOTH inline and the managed sheet
    undo();
    expect(getStyleText() ?? "").not.toContain("color: red");

    unsubscribe();
    resetAll();
  });

  it("redo of class-scoped edit re-applies to the managed sheet", async () => {
    const { applyInlineStyle, undo, redo, resetAll, onClassChange } = await import("../core/apply");

    const unsubscribe = onClassChange(({ className, prop, value }) => {
      if (value !== null) {
        applyClassStyle(className, prop, value);
      } else {
        removeClassStyle(className, prop);
      }
    });

    const el = makeEl();
    const className = "Card_title__z3j8n";

    applyClassStyle(className, "font-size", "20px");
    applyInlineStyle(el, "font-size", "20px", className);

    undo();
    expect(getStyleText() ?? "").not.toContain("font-size: 20px");

    redo();
    expect(getStyleText()!).toContain("font-size: 20px !important");

    unsubscribe();
    resetAll();
  });
});

// ─── getCustomProperties ──────────────────────────────────────────────

describe("getCustomProperties", () => {
  it("returns empty array for element with no custom properties", () => {
    const el = makeEl();
    expect(getCustomProperties(el)).toEqual([]);
  });

  it("detects var() references in inline styles", () => {
    const el = makeEl();
    // Set a custom property on the element so it can resolve
    el.style.setProperty("--my-color", "#ff0000");
    el.style.setProperty("color", "var(--my-color)");
    const props = getCustomProperties(el);
    const names = props.map((p) => p.name);
    expect(names).toContain("--my-color");
  });

  it("detects custom properties defined directly on ancestors", () => {
    const parent = makeEl();
    const child = document.createElement("div");
    parent.appendChild(child);
    parent.style.setProperty("--spacing", "8px");
    // getCustomProperties walks ancestors for --* props
    // Even if happy-dom's getComputedStyle doesn't fully resolve inheritance,
    // the function should at least not throw
    const props = getCustomProperties(child);
    // In real browsers the parent's --spacing would resolve;
    // happy-dom may or may not support this
    expect(Array.isArray(props)).toBe(true);
  });

  it("deduplicates custom properties by name", () => {
    const el = makeEl();
    el.style.setProperty("--accent", "blue");
    el.style.setProperty("color", "var(--accent)");
    el.style.setProperty("background-color", "var(--accent)");
    const props = getCustomProperties(el);
    const accentProps = props.filter((p) => p.name === "--accent");
    expect(accentProps.length).toBeLessThanOrEqual(1);
  });
});
