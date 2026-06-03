// @vitest-environment happy-dom
/**
 * Regression: the selection outline does not move when a panel edit changes the
 * element's POSITION without changing its border-box size.
 *
 * useElementTracker re-reads layout on three triggers: ResizeObserver (size),
 * document scroll, and window resize. A panel edit applied via
 * `element.style.setProperty(...)` that moves the element — e.g. margin-top, or
 * a position/top/left offset — changes getBoundingClientRect().top but NOT the
 * border-box size, so ResizeObserver never fires and (absent a scroll) the
 * outline stays on the element's stale position. This is the "blue border is
 * not updating in real time when making UI changes" report.
 *
 * The fix observes the tracked element's `style`/`class` attributes
 * (MutationObserver) so every panel edit re-syncs the outline.
 *
 * This test fails while the tracker ignores style-attribute mutations and
 * passes once it re-reads layout on them.
 */
import { describe, it, expect, afterEach, beforeAll, vi } from "vitest";
import { renderHook, cleanup } from "@testing-library/react";
import { useElementTracker } from "../hooks/useElementTracker";

beforeAll(() => {
  // happy-dom may not ship ResizeObserver; the tracker constructs one. Make it
  // a no-op so it never drives updates — we are specifically testing the path
  // where ResizeObserver does NOT fire.
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("useElementTracker — repositions on inline-style edits (not just size changes)", () => {
  it("re-reads layout when the tracked element's style attribute mutates", async () => {
    // Control rAF so the test is deterministic regardless of whether the fix
    // syncs synchronously or coalesces the mutation via rAF.
    const rafQueue: FrameRequestCallback[] = [];
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
      rafQueue.push(cb);
      return rafQueue.length;
    });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
    const flushRaf = () => rafQueue.splice(0).forEach((cb) => cb(0));

    const el = document.createElement("div");
    document.body.appendChild(el);
    const onUpdate = vi.fn();

    renderHook(() => useElementTracker(el, true, onUpdate));
    flushRaf(); // drain any mount-time rAF
    const before = onUpdate.mock.calls.length;

    // Simulate a panel edit that MOVES the element without resizing it.
    // ResizeObserver (stubbed no-op) won't fire and we don't scroll.
    el.style.setProperty("margin-top", "40px");

    // MutationObserver delivers records on a microtask; drain it, then any rAF.
    await new Promise((r) => setTimeout(r, 0));
    flushRaf();

    expect(onUpdate.mock.calls.length).toBeGreaterThan(before);
  });
});
