// @vitest-environment happy-dom
/**
 * Regression (sibling of boxModelOverlayScrollLag): the spacing-guides overlay
 * (margin/padding boundary boxes + per-side hatched zones) must not lag the
 * content one frame during scroll.
 *
 * Before this migration, SpacingGuidesOverlay ran its own perpetual
 * requestAnimationFrame loop, so a scroll only repositioned the guides on the
 * NEXT frame — one frame behind the natively-scrolled (GPU-composited) content.
 * After moving onto the shared useTrackedOverlay (which uses useElementTracker),
 * the scroll handler re-reads layout SYNCHRONOUSLY in the same frame the content
 * scrolled, while resize / ResizeObserver updates stay rAF-coalesced.
 *
 * GOTCHA: SpacingGuidesOverlay's `measure` returns null unless getScrubGroup()
 * is set, so the tracker never re-reads layout otherwise. We setScrubGroup
 * before rendering (reset to null in afterEach). parseBoxModel reads
 * getComputedStyle, which happy-dom returns sparsely, so we stub it to return
 * all twelve box fields. ResizeObserver is stubbed to a no-op.
 *
 * This test FAILS on the perpetual-poll implementation (no scroll listener) and
 * PASSES once the overlay is migrated onto the shared tracker.
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { SpacingGuidesOverlay } from "../overlays/SpacingGuidesOverlay";
import { setScrubGroup } from "../core/scrubState";

// happy-dom has no ResizeObserver — provide a no-op class so the tracker mounts.
class NoopResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
(globalThis as unknown as { ResizeObserver: typeof NoopResizeObserver }).ResizeObserver =
  NoopResizeObserver;

function stubComputedStyle() {
  return vi.spyOn(window, "getComputedStyle").mockImplementation(
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
}

afterEach(() => {
  cleanup();
  setScrubGroup(null);
  vi.restoreAllMocks();
});

describe("SpacingGuidesOverlay — no frame lag on scroll", () => {
  it("re-reads layout synchronously during the scroll event (not deferred to the next frame)", () => {
    setScrubGroup("margin");
    stubComputedStyle();

    // Control rAF manually so we can tell what runs synchronously vs. deferred.
    const rafQueue: FrameRequestCallback[] = [];
    const rafSpy = vi
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation((cb) => {
        rafQueue.push(cb);
        return rafQueue.length;
      });
    const cafSpy = vi
      .spyOn(window, "cancelAnimationFrame")
      .mockImplementation(() => {});
    const flushRaf = () => rafQueue.splice(0).forEach((cb) => cb(0));

    const el = document.createElement("div");
    document.body.appendChild(el);

    render(<SpacingGuidesOverlay element={el} />);

    // Any initial measure scheduled via rAF on mount — flush it first.
    flushRaf();

    const gbcr = vi.spyOn(el, "getBoundingClientRect");
    const before = gbcr.mock.calls.length;

    // Dispatch a scroll. The shared useElementTracker registers its
    // capture-phase scroll listener on `document` (a window-targeted event does
    // not propagate to a document-capturing listener), matching the sibling
    // boxModelOverlayScrollLag test.
    document.dispatchEvent(new Event("scroll"));

    // Must have re-read layout synchronously — WITHOUT needing an animation frame.
    expect(gbcr.mock.calls.length).toBeGreaterThan(before);

    rafSpy.mockRestore();
    cafSpy.mockRestore();
  });

  it("still coalesces resize-driven updates via rAF (size changes need not be synchronous)", () => {
    setScrubGroup("margin");
    stubComputedStyle();

    // Guard: the fix should only make the *scroll* path synchronous. A resize
    // should NOT trigger a synchronous layout read — it stays rAF-coalesced.
    const rafSpy = vi
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation(() => 1);
    const cafSpy = vi
      .spyOn(window, "cancelAnimationFrame")
      .mockImplementation(() => {});

    const el = document.createElement("div");
    document.body.appendChild(el);

    render(<SpacingGuidesOverlay element={el} />);

    const gbcr = vi.spyOn(el, "getBoundingClientRect");
    const before = gbcr.mock.calls.length;

    window.dispatchEvent(new Event("resize"));

    expect(gbcr.mock.calls.length).toBe(before);

    rafSpy.mockRestore();
    cafSpy.mockRestore();
  });
});
