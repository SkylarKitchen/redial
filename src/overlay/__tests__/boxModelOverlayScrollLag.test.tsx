// @vitest-environment happy-dom
/**
 * Regression (sibling of elementTrackerScrollLag): the box-model overlay
 * (margin/padding/content boxes) lags the content one frame during scroll.
 *
 * BoxModelOverlay positions three fixed-position boxes over the inspected
 * element. Like the selection outline, on scroll it must re-read layout in the
 * SAME frame the content scrolled — the scroll event fires after layout and
 * before paint, so a synchronous getBoundingClientRect + style write lands in
 * that frame. Deferring the reposition to requestAnimationFrame puts the boxes
 * one frame behind the natively-scrolled (GPU-composited) content (the lag).
 *
 * This test fails while the scroll handler defers to rAF (no synchronous layout
 * read during the scroll event) and passes once it re-reads layout synchronously
 * on scroll. resize / ResizeObserver updates may still be rAF-coalesced.
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { BoxModelOverlay } from "../overlays/BoxModelOverlay";

afterEach(cleanup);

describe("BoxModelOverlay — no frame lag on scroll", () => {
  it("re-reads layout synchronously during the scroll event (not deferred to the next frame)", () => {
    // Control rAF manually so we can tell what runs synchronously vs. deferred.
    const rafQueue: FrameRequestCallback[] = [];
    const rafSpy = vi
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation((cb) => {
        rafQueue.push(cb);
        return rafQueue.length;
      });
    const cafSpy = vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
    const flushRaf = () => rafQueue.splice(0).forEach((cb) => cb(0));

    const el = document.createElement("div");
    document.body.appendChild(el);

    render(<BoxModelOverlay element={el} />);

    // The initial paint is scheduled via rAF on mount — flush it first.
    flushRaf();

    const gbcr = vi.spyOn(el, "getBoundingClientRect");
    const before = gbcr.mock.calls.length;

    // Dispatch a scroll. The shared useElementTracker registers its
    // capture-phase scroll listener on `document` (a window-targeted event does
    // not propagate to a document-capturing listener), matching the sibling
    // elementTrackerScrollLag / gridOverlayScrollLag tests.
    document.dispatchEvent(new Event("scroll"));

    // Must have re-read layout synchronously — WITHOUT needing an animation frame.
    expect(gbcr.mock.calls.length).toBeGreaterThan(before);

    rafSpy.mockRestore();
    cafSpy.mockRestore();
  });

  it("still coalesces resize-driven updates via rAF (size changes need not be synchronous)", () => {
    // Guard: the fix should only make the *scroll* path synchronous. A resize
    // should NOT trigger a synchronous layout read — it stays rAF-coalesced.
    const rafSpy = vi.spyOn(window, "requestAnimationFrame").mockImplementation(() => 1);
    const cafSpy = vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});

    const el = document.createElement("div");
    document.body.appendChild(el);

    render(<BoxModelOverlay element={el} />);

    const gbcr = vi.spyOn(el, "getBoundingClientRect");
    const before = gbcr.mock.calls.length;

    window.dispatchEvent(new Event("resize"));

    expect(gbcr.mock.calls.length).toBe(before);

    rafSpy.mockRestore();
    cafSpy.mockRestore();
  });
});
