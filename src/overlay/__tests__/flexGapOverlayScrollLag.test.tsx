// @vitest-environment happy-dom
/**
 * Regression (sibling of boxModelOverlayScrollLag / gridOverlayScrollLag): the
 * flex-gap overlay lags the content one frame during scroll while it relies on a
 * perpetual requestAnimationFrame poll with no scroll listener.
 *
 * FlexGapOverlay draws pink hatched gap rectangles in viewport coordinates
 * derived from the flex container's DIRECT CHILDREN getBoundingClientRect()s. On
 * scroll it must re-read layout in the SAME frame the content scrolled — the
 * scroll event fires after layout and before paint, so a synchronous
 * getBoundingClientRect lands in that frame. The old perpetual-rAF overlay has
 * NO scroll listener, so a dispatched scroll triggers nothing synchronous and
 * the overlay trails the GPU-composited scroll by a frame.
 *
 * This test fails on the perpetual-poll implementation (scroll does not cause a
 * synchronous gbcr on the children) and passes once FlexGapOverlay is migrated
 * onto useTrackedOverlay, which installs a synchronous capture-phase scroll
 * listener. resize stays rAF-coalesced.
 *
 * GOTCHA: computeMetrics returns null unless getComputedStyle(container).display
 * is "flex"/"inline-flex", and it needs >=2 visible children whose computed
 * style is not display:none / position:absolute|fixed. It then reads each child's
 * getBoundingClientRect(). happy-dom reports a div's computed display as "block",
 * so we stub getComputedStyle to branch on the node: the container looks like a
 * row flex container, the children look like static blocks. Children get
 * non-overlapping rects so a gap > 0.5 exists.
 */
import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { FlexGapOverlay } from "../overlays/FlexGapOverlay";

// No-op ResizeObserver so the tracker can construct one without happy-dom's
// (which may not exist / may fire) interfering with the scroll-path assertion.
class NoopRO {
  observe() {}
  unobserve() {}
  disconnect() {}
}

beforeEach(() => {
  globalThis.ResizeObserver = NoopRO as unknown as typeof ResizeObserver;
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/**
 * Build a flex container with two children, stub getComputedStyle so
 * computeMetrics sees a real row flex container, and stub each child's
 * getBoundingClientRect to two non-overlapping rects (gap of 10px between them).
 * Returns the container plus the two children for spying.
 */
function makeFlexContainer() {
  const container = document.createElement("div");
  const a = document.createElement("div");
  const b = document.createElement("div");
  container.append(a, b);
  document.body.appendChild(container);

  vi.spyOn(window, "getComputedStyle").mockImplementation((target: Element) => {
    if (target === container) {
      return { display: "flex", flexDirection: "row" } as unknown as CSSStyleDeclaration;
    }
    return { display: "block", position: "static" } as unknown as CSSStyleDeclaration;
  });

  // child A: x [0,100], child B: x [110,210] → 10px gap between them.
  a.getBoundingClientRect = () =>
    ({ left: 0, right: 100, top: 0, bottom: 50, width: 100, height: 50 }) as DOMRect;
  b.getBoundingClientRect = () =>
    ({ left: 110, right: 210, top: 0, bottom: 50, width: 100, height: 50 }) as DOMRect;

  return { container, a, b };
}

describe("FlexGapOverlay — no frame lag on scroll", () => {
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

    const { container, a } = makeFlexContainer();

    render(<FlexGapOverlay element={container} />);

    // Drain any rAF scheduled during mount so the baseline is post-mount.
    flushRaf();

    // Spy on a child's gbcr — computeMetrics reads the CHILDREN, not the container.
    const childGbcr = vi.spyOn(a, "getBoundingClientRect");
    const before = childGbcr.mock.calls.length;

    // Dispatch a scroll. The shared useElementTracker registers its capture-phase
    // scroll listener on `document`, so this synchronous handler must re-measure.
    document.dispatchEvent(new Event("scroll"));

    // Must have re-read the child's layout synchronously — WITHOUT a frame flush.
    expect(childGbcr.mock.calls.length).toBeGreaterThan(before);

    rafSpy.mockRestore();
    cafSpy.mockRestore();
  });

  it("still coalesces resize-driven updates via rAF (size changes need not be synchronous)", () => {
    // Guard: the fix should only make the *scroll* path synchronous. A window
    // resize should NOT trigger a synchronous layout read — it stays rAF-coalesced.
    const rafSpy = vi.spyOn(window, "requestAnimationFrame").mockImplementation(() => 1);
    const cafSpy = vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});

    const { container, a } = makeFlexContainer();

    render(<FlexGapOverlay element={container} />);

    const childGbcr = vi.spyOn(a, "getBoundingClientRect");
    const before = childGbcr.mock.calls.length;

    window.dispatchEvent(new Event("resize"));

    expect(childGbcr.mock.calls.length).toBe(before);

    rafSpy.mockRestore();
    cafSpy.mockRestore();
  });
});
