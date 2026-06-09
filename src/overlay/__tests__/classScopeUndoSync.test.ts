// @vitest-environment happy-dom
/**
 * classScopeUndoSync.test.ts — class-scope <style> stays in sync through
 * undo/redo (issue #29 regression).
 *
 * A class-scope edit writes BOTH an inline preview (apply.ts, undoable) and the
 * persisted class rule (scope.ts's <style data-tuner-scope="class">). apply.ts
 * fires onClassChange on every class-scoped undo/redo step; scope.ts must
 * subscribe — via syncWithApplyUndoRedo(), mirroring statePreview.ts — so the
 * <style> rule tracks the temporal stack. Without that subscriber the inline
 * preview reverts but the !important class rule stays (inline-!important beats
 * stylesheet-!important, so the stale rule wins), making undo a visual no-op for
 * class scope. This test calls syncWithApplyUndoRedo() exactly as Overlay.tsx
 * wires it on mount.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { styleEngine } from "../core/engine";
import { syncWithApplyUndoRedo, destroyClassStyles } from "../core/scope";
import { resetAll } from "../core/apply";

const CLASS = "Card_box__h2k";

function classStyleText(): string {
  return (
    document.querySelector('style[data-tuner-scope="class"]')?.textContent ?? ""
  );
}

let el: HTMLElement;
let unsub: () => void;

beforeEach(() => {
  resetAll();
  destroyClassStyles();
  unsub = syncWithApplyUndoRedo(); // what Overlay.tsx wires on mount
  el = document.createElement("div");
  el.className = CLASS;
  document.body.appendChild(el);
});

afterEach(() => {
  unsub?.();
  resetAll();
  destroyClassStyles();
  el.remove();
});

describe("class-scope <style> sync through undo/redo (issue #29)", () => {
  it("undo removes the class rule the edit added", () => {
    styleEngine.apply({ scope: "class", el, className: CLASS }, "color", "red");
    expect(classStyleText()).toContain("red");

    styleEngine.undo();
    // The rule the edit introduced must be gone — not left winning via !important.
    expect(classStyleText()).not.toContain("red");
  });

  it("redo re-applies the class rule the undo removed", () => {
    styleEngine.apply({ scope: "class", el, className: CLASS }, "color", "red");
    styleEngine.undo();
    expect(classStyleText()).not.toContain("red");

    styleEngine.redo();
    expect(classStyleText()).toContain("red");
  });
});
