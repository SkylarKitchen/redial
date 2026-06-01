// @vitest-environment happy-dom
/**
 * Regression: the selection outline lags the content during scroll.
 *
 * useElementTracker positions a fixed-position outline over the tracked element.
 * On scroll it must reposition in the SAME frame the content scrolled — the
 * scroll event fires after layout and before paint, so a synchronous
 * getBoundingClientRect + style write lands in that frame. Deferring the
 * reposition to requestAnimationFrame puts it one frame behind the
 * natively-scrolled (GPU-composited) content, which is the visible lag.
 *
 * This test fails while the scroll handler defers to rAF (onUpdate is NOT called
 * synchronously during the scroll event) and passes once it repositions
 * synchronously on scroll.
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import { renderHook, cleanup } from "@testing-library/react";
import { useElementTracker } from "../hooks/useElementTracker";

afterEach(cleanup);

describe("useElementTracker — no frame lag on scroll", () => {
  it("repositions synchronously during the scroll event (not deferred to the next frame)", () => {
    const el = document.createElement("div");
    document.body.appendChild(el);
    const onUpdate = vi.fn();

    renderHook(() => useElementTracker(el, true, onUpdate));

    const callsAfterMount = onUpdate.mock.calls.length;

    // Dispatch a scroll. Capture-phase listener on document catches it.
    document.dispatchEvent(new Event("scroll"));

    // Must have repositioned synchronously — before any animation frame runs.
    expect(onUpdate.mock.calls.length).toBeGreaterThan(callsAfterMount);
  });

  it("still coalesces ResizeObserver-driven updates via rAF (size changes need not be synchronous)", () => {
    // Guard: the fix should only make the *scroll* path synchronous, not turn
    // every update synchronous. ResizeObserver updates may still be rAF-coalesced.
    // (Documents intent; ResizeObserver isn't reliably driven in happy-dom, so we
    // only assert the hook mounts and does an initial sync without throwing.)
    const el = document.createElement("div");
    document.body.appendChild(el);
    const onUpdate = vi.fn();

    expect(() => renderHook(() => useElementTracker(el, true, onUpdate))).not.toThrow();
    expect(onUpdate).toHaveBeenCalled(); // initial sync on mount
  });
});
