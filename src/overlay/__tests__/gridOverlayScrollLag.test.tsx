// @vitest-environment happy-dom
/**
 * Regression (sibling of boxModelOverlayScrollLag): the grid overlay lags the
 * content one frame during scroll while it relies on a perpetual
 * requestAnimationFrame poll with no scroll listener.
 *
 * GridOverlay draws grid lines / gap bands / labels positioned in viewport
 * coordinates derived from the inspected element's getBoundingClientRect(). On
 * scroll it must re-read layout in the SAME frame the content scrolled — the
 * scroll event fires after layout and before paint, so a synchronous
 * getBoundingClientRect lands in that frame. The old perpetual-rAF overlay has
 * NO scroll listener, so a dispatched scroll triggers nothing synchronous and
 * the overlay trails the GPU-composited scroll by a frame.
 *
 * This test fails on the perpetual-poll implementation (scroll does not cause a
 * synchronous gbcr) and passes once GridOverlay is migrated onto
 * useTrackedOverlay, which installs a synchronous capture-phase scroll listener.
 * resize stays rAF-coalesced.
 *
 * GOTCHA: computeMetrics returns null unless getComputedStyle(el).display is
 * "grid"/"inline-grid", and it reads track sizes + gaps. happy-dom reports a
 * div's computed display as "block", so we stub getComputedStyle to look like a
 * real 2x1 grid — only then does computeMetrics run and call gbcr.
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { GridOverlay } from "../overlays/GridOverlay";

afterEach(cleanup);

/** Make getComputedStyle report `el` as a 2-column / 1-row grid so
 *  computeMetrics runs (instead of bailing out and never reading layout). */
function stubGridComputedStyle(el: Element) {
  return vi
    .spyOn(window, "getComputedStyle")
    .mockImplementation((target: Element) => {
      if (target === el) {
        return {
          display: "grid",
          gridTemplateColumns: "100px 100px",
          gridTemplateRows: "50px",
          columnGap: "10px",
          rowGap: "10px",
          paddingTop: "0px",
          paddingRight: "0px",
          paddingBottom: "0px",
          paddingLeft: "0px",
          borderTopWidth: "0px",
          borderRightWidth: "0px",
          borderBottomWidth: "0px",
          borderLeftWidth: "0px",
        } as unknown as CSSStyleDeclaration;
      }
      return {} as CSSStyleDeclaration;
    });
}

describe("GridOverlay — no frame lag on scroll", () => {
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
    const csSpy = stubGridComputedStyle(el);

    render(<GridOverlay element={el} />);

    // Drain any rAF scheduled during mount so the baseline is post-mount.
    flushRaf();

    const gbcr = vi.spyOn(el, "getBoundingClientRect");
    const before = gbcr.mock.calls.length;

    // Dispatch a scroll. Capture-phase listener on document catches it.
    document.dispatchEvent(new Event("scroll"));

    // Must have re-read layout synchronously — WITHOUT needing an animation frame.
    expect(gbcr.mock.calls.length).toBeGreaterThan(before);

    csSpy.mockRestore();
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
    const csSpy = stubGridComputedStyle(el);

    render(<GridOverlay element={el} />);

    const gbcr = vi.spyOn(el, "getBoundingClientRect");
    const before = gbcr.mock.calls.length;

    window.dispatchEvent(new Event("resize"));

    expect(gbcr.mock.calls.length).toBe(before);

    csSpy.mockRestore();
    rafSpy.mockRestore();
    cafSpy.mockRestore();
  });
});
