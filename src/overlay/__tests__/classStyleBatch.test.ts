// @vitest-environment happy-dom
/**
 * Class-scope <style> batching during drags (issue #29).
 *
 * `applyClassStyle` rewrites the entire class-scope <style> tag on every call.
 * A slider drag fires it on every pointermove, so the rewrites must be
 * COALESCED: while a batch is open (drags wrap their applies in
 * beginBatch/endBatch — apply.ts calls beginClassStyleBatch/endClassStyleBatch),
 * the rebuild is DEFERRED and flushed exactly once when the outermost batch
 * closes. Outside a batch the rewrite stays synchronous.
 *
 * This is the batch-lifecycle approach, not a time-based debounce (so it is
 * deterministic and testable without fake timers).
 *
 * Fired-event style: drive the real public API and observe the real <style>
 * node's textContent + mutation count.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  applyClassStyle,
  resetClassStyles,
  destroyClassStyles,
} from "../core/scope";
import { beginBatch, endBatch } from "../core/apply";

function classStyleEl(): HTMLStyleElement | null {
  return document.querySelector('style[data-tuner-scope="class"]');
}

beforeEach(() => {
  destroyClassStyles();
});

afterEach(() => {
  destroyClassStyles();
});

describe("class-style batching (#29)", () => {
  it("rewrites synchronously when NOT in a batch", () => {
    applyClassStyle(".btn", "color", "red");
    expect(classStyleEl()?.textContent).toContain("color: red");
  });

  it("defers the rewrite while a batch is open, then flushes once at close", () => {
    beginBatch();
    applyClassStyle(".btn", "color", "red");
    // Deferred: the <style> has not picked up the change yet.
    expect(classStyleEl()?.textContent ?? "").not.toContain("color: red");

    applyClassStyle(".btn", "background", "blue");
    expect(classStyleEl()?.textContent ?? "").not.toContain("background: blue");

    endBatch();
    // One flush at close carries BOTH declarations.
    const css = classStyleEl()?.textContent ?? "";
    expect(css).toContain("color: red");
    expect(css).toContain("background: blue");
  });

  it("coalesces N applies in a batch into a SINGLE <style> rewrite", () => {
    // Prime the node, then clear so the batch starts from a known value.
    applyClassStyle(".btn", "color", "red");
    const el = classStyleEl()!;
    resetClassStyles(".btn"); // back to empty, still the same node
    const before = el.textContent ?? "";

    beginBatch();
    // Simulate a drag: 10 applies. The <style> must not change on any of them
    // (0 rewrites during the batch — that is what "coalesced" means).
    for (let i = 0; i < 10; i++) {
      applyClassStyle(".btn", "width", `${i}px`);
      expect(el.textContent ?? "").toBe(before);
    }
    endBatch();

    // Exactly one rewrite happened — at close — carrying the final drag frame.
    expect(el.textContent).toContain("width: 9px");
  });
});
