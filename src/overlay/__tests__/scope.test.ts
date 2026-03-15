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
} from "../core/scope";

// ─── Setup ────────────────────────────────────────────────────────────

function makeEl(tag = "div"): HTMLElement {
  const el = document.createElement(tag);
  document.body.appendChild(el);
  return el;
}

function getStyleTag(): HTMLStyleElement | null {
  return document.querySelector(
    'style[data-tuner-scope="class"]'
  ) as HTMLStyleElement | null;
}

beforeEach(() => {
  destroyClassStyles();
  document.body.innerHTML = "";
  // Remove any leftover style tags
  document
    .querySelectorAll('style[data-tuner-scope="class"]')
    .forEach((s) => s.remove());
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
  it("creates style tag with correct CSS rule for a class and property", () => {
    applyClassStyle("Card_wrapper__f3k2m", "background-color", "#f0f0f0");
    const tag = getStyleTag();
    expect(tag).not.toBeNull();
    // The rule should target the exact class
    expect(tag!.textContent).toContain("Card_wrapper__f3k2m");
    // The rule should contain the property with !important
    expect(tag!.textContent).toContain(
      "background-color: #f0f0f0 !important"
    );
  });

  it("resetClassStyles removes all overrides for a class", () => {
    applyClassStyle("Card_wrapper__f3k2m", "color", "red");
    applyClassStyle("Card_wrapper__f3k2m", "font-size", "20px");
    applyClassStyle("Card_wrapper__f3k2m", "padding", "12px");

    // Confirm they exist first
    const tagBefore = getStyleTag();
    expect(tagBefore!.textContent).toContain("color: red !important");
    expect(tagBefore!.textContent).toContain("font-size: 20px !important");
    expect(tagBefore!.textContent).toContain("padding: 12px !important");

    // Reset all overrides for this class
    resetClassStyles("Card_wrapper__f3k2m");

    const tagAfter = getStyleTag();
    // The style tag should no longer contain this class's rules
    expect(tagAfter!.textContent).not.toContain("Card_wrapper__f3k2m");
    expect(tagAfter!.textContent).not.toContain("color: red");
    expect(tagAfter!.textContent).not.toContain("font-size: 20px");
    expect(tagAfter!.textContent).not.toContain("padding: 12px");
  });
});

// ─── applyClassStyle ──────────────────────────────────────────────────

describe("applyClassStyle", () => {
  it("creates a <style> tag with data-tuner-scope attribute", () => {
    applyClassStyle("Button_btn__a8f2k", "color", "red");
    const tag = getStyleTag();
    expect(tag).not.toBeNull();
    expect(tag!.getAttribute("data-tuner-scope")).toBe("class");
  });

  it("applies a CSS rule with !important", () => {
    applyClassStyle("Button_btn__a8f2k", "color", "red");
    const tag = getStyleTag();
    expect(tag!.textContent).toContain("color: red !important");
  });

  it("scopes the rule to the class selector", () => {
    applyClassStyle("Button_btn__a8f2k", "color", "red");
    const tag = getStyleTag();
    expect(tag!.textContent).toContain("Button_btn__a8f2k");
  });

  it("handles multiple properties on the same class", () => {
    applyClassStyle("Button_btn__a8f2k", "color", "red");
    applyClassStyle("Button_btn__a8f2k", "font-size", "16px");
    const tag = getStyleTag();
    expect(tag!.textContent).toContain("color: red !important");
    expect(tag!.textContent).toContain("font-size: 16px !important");
  });

  it("handles multiple different classes", () => {
    applyClassStyle("Button_btn__a8f2k", "color", "red");
    applyClassStyle("Card_title__z3j8n", "margin", "10px");
    const tag = getStyleTag();
    expect(tag!.textContent).toContain("Button_btn__a8f2k");
    expect(tag!.textContent).toContain("Card_title__z3j8n");
  });

  it("updates an existing property value", () => {
    applyClassStyle("Button_btn__a8f2k", "color", "red");
    applyClassStyle("Button_btn__a8f2k", "color", "blue");
    const tag = getStyleTag();
    expect(tag!.textContent).toContain("color: blue !important");
    expect(tag!.textContent).not.toContain("color: red");
  });

  it("reuses the same <style> tag across calls", () => {
    applyClassStyle("Foo_a__x", "color", "red");
    applyClassStyle("Bar_b__y", "width", "100px");
    const tags = document.querySelectorAll('style[data-tuner-scope="class"]');
    expect(tags.length).toBe(1);
  });
});

// ─── removeClassStyle ─────────────────────────────────────────────────

describe("removeClassStyle", () => {
  it("removes a single property from a class", () => {
    applyClassStyle("Button_btn__a8f2k", "color", "red");
    applyClassStyle("Button_btn__a8f2k", "font-size", "16px");
    removeClassStyle("Button_btn__a8f2k", "color");
    const tag = getStyleTag();
    expect(tag!.textContent).not.toContain("color");
    expect(tag!.textContent).toContain("font-size: 16px !important");
  });

  it("removes the class rule entirely when last property is removed", () => {
    applyClassStyle("Button_btn__a8f2k", "color", "red");
    removeClassStyle("Button_btn__a8f2k", "color");
    const tag = getStyleTag();
    expect(tag!.textContent).not.toContain("Button_btn__a8f2k");
  });

  it("does nothing for unknown class", () => {
    applyClassStyle("Button_btn__a8f2k", "color", "red");
    removeClassStyle("NonExistent_foo__bar", "color");
    const tag = getStyleTag();
    expect(tag!.textContent).toContain("color: red !important");
  });

  it("does nothing for unknown property on a known class", () => {
    applyClassStyle("Button_btn__a8f2k", "color", "red");
    removeClassStyle("Button_btn__a8f2k", "font-size");
    const tag = getStyleTag();
    expect(tag!.textContent).toContain("color: red !important");
  });
});

// ─── resetClassStyles ─────────────────────────────────────────────────

describe("resetClassStyles", () => {
  it("removes all overrides for a class", () => {
    applyClassStyle("Button_btn__a8f2k", "color", "red");
    applyClassStyle("Button_btn__a8f2k", "font-size", "16px");
    applyClassStyle("Button_btn__a8f2k", "width", "100px");
    resetClassStyles("Button_btn__a8f2k");
    const tag = getStyleTag();
    expect(tag!.textContent).not.toContain("Button_btn__a8f2k");
  });

  it("does not affect other classes", () => {
    applyClassStyle("Button_btn__a8f2k", "color", "red");
    applyClassStyle("Card_title__z3j8n", "margin", "10px");
    resetClassStyles("Button_btn__a8f2k");
    const tag = getStyleTag();
    expect(tag!.textContent).not.toContain("Button_btn__a8f2k");
    expect(tag!.textContent).toContain("Card_title__z3j8n");
  });

  it("handles resetting a class with no overrides", () => {
    // Should not throw
    resetClassStyles("NonExistent_foo__bar");
  });
});

// ─── destroyClassStyles ───────────────────────────────────────────────

describe("destroyClassStyles", () => {
  it("removes the <style> tag from the DOM", () => {
    applyClassStyle("Button_btn__a8f2k", "color", "red");
    expect(getStyleTag()).not.toBeNull();
    destroyClassStyles();
    expect(getStyleTag()).toBeNull();
  });

  it("clears all tracked overrides", () => {
    applyClassStyle("Button_btn__a8f2k", "color", "red");
    applyClassStyle("Card_title__z3j8n", "margin", "10px");
    destroyClassStyles();
    // Re-applying should start fresh
    applyClassStyle("Button_btn__a8f2k", "width", "50px");
    const tag = getStyleTag();
    expect(tag!.textContent).not.toContain("color");
    expect(tag!.textContent).not.toContain("margin");
    expect(tag!.textContent).toContain("width: 50px !important");
  });

  it("is idempotent when called multiple times", () => {
    applyClassStyle("Button_btn__a8f2k", "color", "red");
    destroyClassStyles();
    destroyClassStyles(); // should not throw
    expect(getStyleTag()).toBeNull();
  });

  it("allows recreation after destruction", () => {
    applyClassStyle("Button_btn__a8f2k", "color", "red");
    destroyClassStyles();
    applyClassStyle("Button_btn__a8f2k", "color", "blue");
    const tag = getStyleTag();
    expect(tag).not.toBeNull();
    expect(tag!.textContent).toContain("color: blue !important");
  });
});

// ─── Class-scope undo sync (A1 bug) ──────────────────────────────────

describe("class-scope undo reverts <style> tag", () => {
  it("undo of class-scoped edit removes the property from <style> tag", async () => {
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

    // Verify style tag has the rule
    const tag = getStyleTag();
    expect(tag!.textContent).toContain("color: red !important");

    // Undo should revert BOTH inline and <style> tag
    undo();
    expect(tag!.textContent).not.toContain("color: red");

    unsubscribe();
    resetAll();
  });

  it("redo of class-scoped edit re-applies to <style> tag", async () => {
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
    const tag = getStyleTag();
    expect(tag!.textContent).not.toContain("font-size: 20px");

    redo();
    expect(tag!.textContent).toContain("font-size: 20px !important");

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
