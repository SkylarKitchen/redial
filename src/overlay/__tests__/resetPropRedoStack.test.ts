// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from "vitest";
import {
  applyInlineStyle,
  resetProp,
  undo,
  redo,
  totalOverrideCount,
  resetAll,
} from "../core/apply";

function makeEl(tag = "div"): HTMLElement {
  const el = document.createElement(tag);
  document.body.appendChild(el);
  return el;
}

beforeEach(() => {
  resetAll();
  document.body.innerHTML = "";
});

describe("resetProp cleans up redoStack (Bug #15)", () => {
  it("redo after resetProp does not re-apply the reset property", () => {
    const el = makeEl();

    // 1. Apply a color change
    applyInlineStyle(el, "color", "red");
    expect(el.style.getPropertyValue("color")).toBe("red");

    // 2. Undo it — entry moves from undoStack to redoStack
    undo();
    expect(el.style.getPropertyValue("color")).toBe("");

    // 3. resetProp should also clear the redoStack entry for "color"
    resetProp(el, "color");

    // 4. Redo should now be a no-op for color
    redo();

    // After the reset+redo, color must not be re-applied and counts must be clean
    expect(el.style.getPropertyValue("color")).toBe("");
    expect(totalOverrideCount()).toBe(0);
  });
});
