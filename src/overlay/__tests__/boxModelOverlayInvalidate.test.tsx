// @vitest-environment happy-dom
/**
 * New capability (gained by routing through useElementTracker): the box-model
 * overlay re-reads layout when the inspected element's `style` attribute mutates.
 *
 * A panel edit applied via `element.style.setProperty(...)` that moves or
 * reflows the element (e.g. margin-top) changes its box geometry but does NOT
 * necessarily change its border-box size, so ResizeObserver never fires. The
 * old bespoke tracking loop (scroll + resize + ResizeObserver only) had no
 * MutationObserver, so it never re-read layout on a style edit — the colored
 * boxes stayed on the element's stale position.
 *
 * After migrating to useElementTracker the overlay inherits the tracker's
 * MutationObserver on the element's style/class attributes, so every panel edit
 * re-syncs the boxes.
 *
 * This test FAILS on the pre-migration code (no MutationObserver) and PASSES
 * once BoxModelOverlay tracks via useElementTracker.
 */
import { describe, it, expect, afterEach, beforeAll, vi } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { BoxModelOverlay } from "../overlays/BoxModelOverlay";

beforeAll(() => {
  // happy-dom may not ship ResizeObserver; the overlay (via the tracker)
  // constructs one. Make it a no-op so it never drives updates — we are
  // specifically testing the path where ResizeObserver does NOT fire.
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

describe("BoxModelOverlay — re-syncs on inline-style edits (MutationObserver)", () => {
  it("re-reads layout when the inspected element's style attribute mutates", async () => {
    // Control rAF so the test is deterministic regardless of whether the sync
    // runs synchronously or is coalesced via rAF.
    const rafQueue: FrameRequestCallback[] = [];
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
      rafQueue.push(cb);
      return rafQueue.length;
    });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
    const flushRaf = () => rafQueue.splice(0).forEach((cb) => cb(0));

    const el = document.createElement("div");
    document.body.appendChild(el);

    render(<BoxModelOverlay element={el} />);

    // Drain the mount-time rAF (initial paint).
    flushRaf();

    const gbcr = vi.spyOn(el, "getBoundingClientRect");
    const before = gbcr.mock.calls.length;

    // Simulate a panel edit that reflows the element. ResizeObserver (stubbed
    // no-op) won't fire and we don't scroll.
    el.style.setProperty("margin-top", "40px");

    // MutationObserver delivers records on a microtask; drain it, then any rAF.
    await new Promise((r) => setTimeout(r, 0));
    flushRaf();

    expect(gbcr.mock.calls.length).toBeGreaterThan(before);
  });
});
