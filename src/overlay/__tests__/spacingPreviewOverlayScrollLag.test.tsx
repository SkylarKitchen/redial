// @vitest-environment happy-dom
/**
 * Regression (sibling of boxModelOverlayScrollLag): the spacing-preview overlay
 * (ghosted margin/padding zones) lags the content one frame during scroll.
 *
 * SpacingPreviewOverlay paints fixed-position margin (blue) + padding (green)
 * zones over the inspected element. Like the selection outline and box-model
 * overlay, on scroll it must re-read layout in the SAME frame the content
 * scrolled — the scroll event fires after layout and before paint, so a
 * synchronous getBoundingClientRect lands in that frame. The old version ran a
 * perpetual requestAnimationFrame poll and had no scroll listener at all, so a
 * scroll triggered no synchronous layout read.
 *
 * This test fails while the overlay polls via rAF (no document scroll listener)
 * and passes once it tracks via the shared useTrackedOverlay hook, whose
 * useElementTracker registers a capture-phase scroll listener on `document` and
 * re-reads layout synchronously. resize / ResizeObserver updates may still be
 * rAF-coalesced.
 */
import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { SpacingPreviewOverlay } from "../overlays/SpacingPreviewOverlay";

afterEach(cleanup);

// parseBoxModel reads twelve computed box-model fields; stub getComputedStyle so
// the element measures as having a margin (so the overlay renders at least one
// zone) and the rest zero.
beforeEach(() => {
  vi.stubGlobal(
    "getComputedStyle",
    () =>
      ({
        marginTop: "10px",
        marginRight: "0px",
        marginBottom: "0px",
        marginLeft: "0px",
        paddingTop: "0px",
        paddingRight: "0px",
        paddingBottom: "0px",
        paddingLeft: "0px",
        borderTopWidth: "0px",
        borderRightWidth: "0px",
        borderBottomWidth: "0px",
        borderLeftWidth: "0px",
      }) as unknown as CSSStyleDeclaration,
  );

  // Stub ResizeObserver to a no-op so the overlay's tracker can construct one.
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("SpacingPreviewOverlay — no frame lag on scroll", () => {
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

    render(<SpacingPreviewOverlay element={el} />);

    // The shared tracker syncs once on mount synchronously; flush any rAF too.
    flushRaf();

    const gbcr = vi.spyOn(el, "getBoundingClientRect");
    const before = gbcr.mock.calls.length;

    // Dispatch a scroll. The shared useElementTracker registers its capture-phase
    // scroll listener on `document` (a window-targeted event does not propagate to
    // a document-capturing listener), matching the sibling box-model test.
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

    render(<SpacingPreviewOverlay element={el} />);

    const gbcr = vi.spyOn(el, "getBoundingClientRect");
    const before = gbcr.mock.calls.length;

    window.dispatchEvent(new Event("resize"));

    expect(gbcr.mock.calls.length).toBe(before);

    rafSpy.mockRestore();
    cafSpy.mockRestore();
  });
});
