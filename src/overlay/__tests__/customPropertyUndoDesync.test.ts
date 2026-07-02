// @vitest-environment happy-dom
/**
 * Issue #71 — custom-property edits desync the undo system.
 *
 * Three related desyncs between applyCustomProperty and the undo core:
 *  1. applyCustomProperty never clears the redo stack, so after
 *     edit → undo → custom-property edit, Redo re-applies a stale value.
 *  2. undo()/redo() only mutate the `overrides` map — the parallel
 *     `customPropertyOverrides` shadow map is untouched, so
 *     isCustomPropertyDirty keeps reporting dirty after Cmd+Z.
 *  3. undo/redo re-apply with "important" priority while applyCustomProperty
 *     sets without, flipping the effective cascade on undo/redo cycles.
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
  applyInlineStyle,
  applyCustomProperty,
  isCustomPropertyDirty,
  undo,
  redo,
  resetAll,
} from "../core/apply";

function makeEl(tag = "div"): HTMLElement {
  const el = document.createElement(tag);
  document.body.appendChild(el);
  return el;
}

const root = () => document.documentElement;

beforeEach(() => {
  resetAll();
  document.body.innerHTML = "";
});

describe("applyCustomProperty clears the redo stack (issue #71.1)", () => {
  it("redo is a no-op after a custom-property edit lands post-undo", () => {
    const el = makeEl();

    // 1. Normal edit
    applyInlineStyle(el, "color", "red");
    expect(el.style.getPropertyValue("color")).toBe("red");

    // 2. Undo it — entry moves to the redo stack
    undo();
    expect(el.style.getPropertyValue("color")).toBe("");

    // 3. A NEW action (custom-property edit) must invalidate redo history
    applyCustomProperty(root(), "--brand", "blue");

    // 4. Redo must now be a no-op — the stale "red" must NOT come back
    expect(redo()).toBeNull();
    expect(el.style.getPropertyValue("color")).toBe("");
  });
});

describe("undo/redo keep the custom-property shadow map in sync (issue #71.2)", () => {
  it("isCustomPropertyDirty clears after undo and re-lights after redo", () => {
    applyCustomProperty(root(), "--brand", "blue");
    expect(isCustomPropertyDirty("--brand")).toBe(true);

    // Cmd+Z reverted the variable — the dirty dot must go out
    undo();
    expect(isCustomPropertyDirty("--brand")).toBe(false);

    // Redo re-applies the edit — dirty again
    redo();
    expect(isCustomPropertyDirty("--brand")).toBe(true);
  });

  it("undo of the second edit keeps dirty; undo of the first clears it", () => {
    applyCustomProperty(root(), "--x", "4px");
    applyCustomProperty(root(), "--x", "8px");

    undo(); // back to "4px" — still differs from initial ("")
    expect(isCustomPropertyDirty("--x")).toBe(true);

    undo(); // back to initial
    expect(isCustomPropertyDirty("--x")).toBe(false);
  });
});

describe("undo/redo use the same priority as applyCustomProperty (issue #71.3)", () => {
  it("applyCustomProperty sets without important (baseline)", () => {
    applyCustomProperty(root(), "--x", "a");
    expect(root().style.getPropertyValue("--x")).toBe("a");
    expect(root().style.getPropertyPriority("--x")).toBe("");
  });

  it("undo re-applies a custom property without important", () => {
    applyCustomProperty(root(), "--x", "a");
    applyCustomProperty(root(), "--x", "b");

    undo(); // back to "a"
    expect(root().style.getPropertyValue("--x")).toBe("a");
    expect(root().style.getPropertyPriority("--x")).toBe("");
  });

  it("redo re-applies a custom property without important", () => {
    applyCustomProperty(root(), "--x", "a");
    applyCustomProperty(root(), "--x", "b");
    undo();

    redo(); // forward to "b"
    expect(root().style.getPropertyValue("--x")).toBe("b");
    expect(root().style.getPropertyPriority("--x")).toBe("");
  });

  it("still re-applies NON-custom properties with important", () => {
    const el = makeEl();
    applyInlineStyle(el, "color", "red");
    applyInlineStyle(el, "color", "blue");

    undo();
    expect(el.style.getPropertyValue("color")).toBe("red");
    expect(el.style.getPropertyPriority("color")).toBe("important");

    redo();
    expect(el.style.getPropertyValue("color")).toBe("blue");
    expect(el.style.getPropertyPriority("color")).toBe("important");
  });
});
