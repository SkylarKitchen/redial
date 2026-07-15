// @vitest-environment happy-dom
/**
 * undoToIndex.test.ts — history-row-aware undo scrubbing (RFC #14 Increment 4b)
 *
 * Tests the styleEngine.undoMultiple method that replaces handleUndoToIndex's
 * direct call to apply.ts's undo() loop. The new method handles mixed histories
 * (style edits + mode overrides + dom moves) via engine-mediated dispatch on
 * entry kind, removing the load-bearing document.body sentinel convention.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { styleEngine } from "../core/engine";
import { applyInlineStyle, pushDomMove, beginBatch, endBatch } from "../core/apply";
import { applyModeOverride } from "../core/modeOverrides";

function makeEl(): HTMLElement {
  const el = document.createElement("div");
  document.body.appendChild(el);
  return el;
}

describe("styleEngine.undoMultiple — history-row-aware scrub", () => {
  beforeEach(() => {
    styleEngine.resetAll();
    document.body.innerHTML = "";
  });

  it("undoes N style entries", () => {
    const el = makeEl();

    // Build a history with 3 style edits
    applyInlineStyle(el, "color", "red");
    applyInlineStyle(el, "width", "100px");
    applyInlineStyle(el, "height", "50px");

    // Undo 1 entry (remove the 3rd edit)
    const count = styleEngine.undoMultiple(1);

    expect(count).toBe(1);
    expect(el.style.getPropertyValue("color")).toBe("red");
    expect(el.style.getPropertyValue("width")).toBe("100px");
    expect(el.style.getPropertyValue("height")).toBe(""); // undone
  });

  it("handles mixed history with mode overrides", () => {
    const el = makeEl();

    // Interleave style edits and mode overrides
    applyInlineStyle(el, "color", "red");
    applyModeOverride(":root", "--primary", "#ff0000");
    applyInlineStyle(el, "width", "100px");

    // Undo 2 entries — should remove both mode override and width edit
    const count = styleEngine.undoMultiple(2);

    expect(count).toBe(2);
    expect(el.style.getPropertyValue("color")).toBe("red");
    expect(el.style.getPropertyValue("width")).toBe("");
    // Mode override should be cleared (can verify via dirtyCount)
    expect(styleEngine.dirtyCount()).toBe(1); // only the color override remains
  });

  it("handles DOM move entries in the history", () => {
    const el1 = makeEl();
    const el2 = makeEl();

    applyInlineStyle(el1, "color", "red");

    // Simulate a DOM move undo entry
    const initialParent = el2.parentNode;
    const initialNextSibling = el2.nextSibling;
    pushDomMove({
      undo: () => {
        if (initialParent) {
          initialParent.insertBefore(el2, initialNextSibling);
        }
      },
      redo: () => {
        document.body.appendChild(el2);
      }
    });

    applyInlineStyle(el1, "width", "100px");

    // Undo 2 entries — should step through dom-move without halting
    const count = styleEngine.undoMultiple(2);

    expect(count).toBe(2);
    expect(el1.style.getPropertyValue("color")).toBe("red");
    expect(el1.style.getPropertyValue("width")).toBe("");
  });

  it("handles batch entries", () => {
    const el = makeEl();

    applyInlineStyle(el, "color", "red");

    beginBatch();
    applyInlineStyle(el, "width", "100px");
    applyInlineStyle(el, "height", "50px");
    applyInlineStyle(el, "margin", "10px");
    endBatch(); // This creates 1 batch entry

    applyInlineStyle(el, "padding", "5px");

    // Undo 2 entries — should remove both the padding and the entire batch
    const count = styleEngine.undoMultiple(2);

    expect(count).toBe(2);
    expect(el.style.getPropertyValue("color")).toBe("red");
    expect(el.style.getPropertyValue("width")).toBe("");
    expect(el.style.getPropertyValue("height")).toBe("");
    expect(el.style.getPropertyValue("margin")).toBe("");
    expect(el.style.getPropertyValue("padding")).toBe("");
  });

  it("handles zero count (no-op)", () => {
    const el = makeEl();

    applyInlineStyle(el, "color", "red");
    applyInlineStyle(el, "width", "100px");

    // Undo 0 times should be a no-op
    const count = styleEngine.undoMultiple(0);

    expect(count).toBe(0);
    expect(el.style.getPropertyValue("color")).toBe("red");
    expect(el.style.getPropertyValue("width")).toBe("100px");
  });

  it("stops early when undo stack is exhausted", () => {
    const el = makeEl();

    applyInlineStyle(el, "color", "red");
    applyInlineStyle(el, "width", "100px");

    // Request to undo 10 times but only 2 entries exist
    const count = styleEngine.undoMultiple(10);

    expect(count).toBe(2); // only undid 2 (all available)
    expect(el.style.getPropertyValue("color")).toBe("");
    expect(el.style.getPropertyValue("width")).toBe("");
  });
});
