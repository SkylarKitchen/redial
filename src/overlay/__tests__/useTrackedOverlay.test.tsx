// @vitest-environment happy-dom
/**
 * useTrackedOverlay — the state-returning wrapper the declarative overlays use.
 *
 * It owns the React state + the change-key skip-render that each overlay used to
 * re-implement, and routes all measurement through the deep element tracker so
 * every overlay inherits its scroll-sync, style-mutation and engine-invalidate
 * signals for free. It also accepts an extra invalidate source (for the spacing
 * overlays' scrub/hover signal) and forwards observeChildren (for flex-gap).
 */
import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { renderHook, cleanup, act } from "@testing-library/react";
import { useTrackedOverlay } from "../hooks/useTrackedOverlay";
import { applyCustomProperty, resetAll } from "../core/apply";

function mockRaf() {
  const queue: FrameRequestCallback[] = [];
  vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
    queue.push(cb);
    return queue.length;
  });
  vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
  return () => act(() => queue.splice(0).forEach((cb) => cb(0)));
}

beforeEach(() => {
  if (typeof globalThis.ResizeObserver === "undefined") {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
  }
});

afterEach(() => {
  cleanup();
  resetAll();
  vi.restoreAllMocks();
});

const keyOf = (m: { v: number }) => String(m.v);

describe("useTrackedOverlay", () => {
  it("returns the measured metrics after mount (initial sync)", () => {
    const el = document.createElement("div");
    document.body.appendChild(el);

    const { result } = renderHook(() =>
      useTrackedOverlay(el, true, () => ({ v: 1 }), keyOf),
    );

    expect(result.current).toEqual({ v: 1 });
  });

  it("returns null when measure returns null (overlay self-hides)", () => {
    const el = document.createElement("div");
    document.body.appendChild(el);

    const { result } = renderHook(() =>
      useTrackedOverlay(el, true, () => null, keyOf),
    );

    expect(result.current).toBeNull();
  });

  it("re-measures when the element's style attribute mutates", async () => {
    const flushRaf = mockRaf();
    const el = document.createElement("div");
    document.body.appendChild(el);
    let value = 1;

    const { result } = renderHook(() =>
      useTrackedOverlay(el, true, () => ({ v: value }), keyOf),
    );
    expect(result.current).toEqual({ v: 1 });

    value = 2;
    el.style.setProperty("margin-top", "10px"); // triggers the tracker's MO
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0)); // drain MutationObserver
    });
    flushRaf();

    expect(result.current).toEqual({ v: 2 });
  });

  it("does not replace the metrics object when the change-key is unchanged", () => {
    const flushRaf = mockRaf();
    const el = document.createElement("div");
    document.body.appendChild(el);
    // Same key ("1") every time, but a fresh object each call.
    const subs = new Set<() => void>();
    const extraInvalidate = (cb: () => void) => {
      subs.add(cb);
      return () => subs.delete(cb);
    };

    const { result } = renderHook(() =>
      useTrackedOverlay(el, true, () => ({ v: 1 }), keyOf, { extraInvalidate }),
    );
    const first = result.current;

    act(() => subs.forEach((cb) => cb())); // fire invalidate -> schedules sync
    flushRaf();

    expect(result.current).toBe(first); // unchanged key -> no new object
  });

  it("re-measures when an extra invalidate source fires (scrub/hover)", () => {
    const flushRaf = mockRaf();
    const el = document.createElement("div");
    document.body.appendChild(el);
    let value = 1;
    const subs = new Set<() => void>();
    const extraInvalidate = (cb: () => void) => {
      subs.add(cb);
      return () => subs.delete(cb);
    };

    const { result } = renderHook(() =>
      useTrackedOverlay(el, true, () => ({ v: value }), keyOf, { extraInvalidate }),
    );
    expect(result.current).toEqual({ v: 1 });

    value = 5;
    act(() => subs.forEach((cb) => cb()));
    flushRaf();

    expect(result.current).toEqual({ v: 5 });
  });

  it("re-measures on an engine override edit (subscribeOverrides auto-wired)", () => {
    const flushRaf = mockRaf();
    const el = document.createElement("div");
    document.body.appendChild(el);
    let value = 1;

    const { result } = renderHook(() =>
      useTrackedOverlay(el, true, () => ({ v: value }), keyOf),
    );
    expect(result.current).toEqual({ v: 1 });

    value = 9;
    // A :root variable edit does not touch el's attrs — only the engine's
    // override-change signal can drive the re-measure.
    act(() => applyCustomProperty(document.documentElement, "--gap", "4px"));
    flushRaf();

    expect(result.current).toEqual({ v: 9 });
    document.documentElement.style.removeProperty("--gap");
  });
});
