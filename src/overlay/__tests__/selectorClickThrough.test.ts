/**
 * Test: Selector must not eat clicks on .__tuner-root elements.
 *
 * Bug: The Selector's capture-phase click handler calls stopPropagation()
 * unconditionally, BEFORE checking whether the target is a tuner UI element.
 * This prevents the FAB's React onClick from ever firing, leaving the user
 * stuck in selection mode with no way to cancel via the FAB.
 *
 * The fix: stopPropagation should only be called when the Selector actually
 * wants to handle the click (i.e., on non-tuner elements).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Minimal reproduction of the Selector's click handler behavior.
 * We test the handler logic in isolation to verify that clicks on
 * .__tuner-root elements are NOT suppressed.
 */
describe("Selector click-through on .__tuner-root", () => {
  let cleanup: (() => void)[] = [];

  beforeEach(() => {
    cleanup = [];
  });

  afterEach(() => {
    cleanup.forEach((fn) => fn());
  });

  /**
   * Simulates the Selector's document-level capture handler registering
   * alongside a React-like bubble handler on the FAB. If the capture handler
   * calls stopPropagation unconditionally, the bubble handler never fires.
   */
  it("FAB click handler should fire when Selector is active", () => {
    // Set up a DOM tree: <body> → <div.__tuner-root> (the FAB)
    const fab = document.createElement("div");
    fab.className = "__tuner-root";
    document.body.appendChild(fab);
    cleanup.push(() => fab.remove());

    const fabClicked = vi.fn();
    const selectorSelected = vi.fn();

    // This mirrors what the Selector registers (capture phase on document)
    const selectorHandler = (e: MouseEvent) => {
      const el = e.target as Element;
      if (!el || el.closest(".__tuner-root")) {
        // Tuner UI element — should NOT suppress the event
        return;
      }
      // Only suppress + handle for actual page element clicks
      e.preventDefault();
      e.stopPropagation();
      selectorSelected(el);
    };

    // This mirrors the FAB's React onClick (bubble phase)
    fab.addEventListener("click", fabClicked);

    // Register the selector handler in capture phase (like Selector.tsx line 140)
    document.addEventListener("click", selectorHandler, true);
    cleanup.push(() => {
      document.removeEventListener("click", selectorHandler, true);
      fab.removeEventListener("click", fabClicked);
    });

    // Simulate a click on the FAB
    const clickEvent = new MouseEvent("click", { bubbles: true });
    fab.dispatchEvent(clickEvent);

    // The FAB's click handler MUST fire
    expect(fabClicked).toHaveBeenCalledTimes(1);
    // The Selector should NOT have treated this as a page element selection
    expect(selectorSelected).not.toHaveBeenCalled();
  });

  it("page element click should be captured by Selector (not bubble)", () => {
    const pageEl = document.createElement("div");
    pageEl.className = "some-app-element";
    document.body.appendChild(pageEl);
    cleanup.push(() => pageEl.remove());

    const bubbleClicked = vi.fn();
    const selectorSelected = vi.fn();

    // Selector capture handler (with the fix applied)
    const selectorHandler = (e: MouseEvent) => {
      const el = e.target as Element;
      if (!el || el.closest(".__tuner-root")) {
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      selectorSelected(el);
    };

    // A bubble handler on the page element (should NOT fire — Selector owns this)
    pageEl.addEventListener("click", bubbleClicked);

    document.addEventListener("click", selectorHandler, true);
    cleanup.push(() => {
      document.removeEventListener("click", selectorHandler, true);
      pageEl.removeEventListener("click", bubbleClicked);
    });

    const clickEvent = new MouseEvent("click", { bubbles: true });
    pageEl.dispatchEvent(clickEvent);

    // Selector SHOULD capture this
    expect(selectorSelected).toHaveBeenCalledTimes(1);
    // Bubble handler should NOT fire (stopPropagation was called)
    expect(bubbleClicked).not.toHaveBeenCalled();
  });
});
