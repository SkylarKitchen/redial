// @vitest-environment happy-dom
/**
 * useElementTracker — observeChildren option.
 *
 * FlexGapOverlay measures the gaps between a flex container's direct children,
 * not the container itself. A child can resize without resizing the container,
 * so observing only the container (the default) would leave the gaps stale.
 * With observeChildren the tracker's ResizeObserver also watches each direct
 * child, and re-observes when children are added or removed.
 */
import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { renderHook, cleanup } from "@testing-library/react";
import { useElementTracker } from "../hooks/useElementTracker";

// Recording ResizeObserver: captures which elements each instance observes.
let instances: RecordingRO[] = [];
class RecordingRO {
  targets = new Set<Element>();
  constructor(public cb: ResizeObserverCallback) {
    instances.push(this);
  }
  observe(t: Element) {
    this.targets.add(t);
  }
  unobserve(t: Element) {
    this.targets.delete(t);
  }
  disconnect() {
    this.targets.clear();
  }
}

beforeEach(() => {
  instances = [];
  globalThis.ResizeObserver = RecordingRO as unknown as typeof ResizeObserver;
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/** The single ResizeObserver the tracker constructs. */
function tracker() {
  return instances[instances.length - 1];
}

describe("useElementTracker — observeChildren", () => {
  it("observes the element and each direct child when observeChildren is true", () => {
    const el = document.createElement("div");
    const a = document.createElement("span");
    const b = document.createElement("span");
    el.append(a, b);
    document.body.appendChild(el);

    renderHook(() =>
      useElementTracker(el, true, vi.fn(), undefined, undefined, true),
    );

    const ro = tracker();
    expect(ro.targets.has(el)).toBe(true);
    expect(ro.targets.has(a)).toBe(true);
    expect(ro.targets.has(b)).toBe(true);
  });

  it("observes only the element by default (observeChildren omitted)", () => {
    const el = document.createElement("div");
    const a = document.createElement("span");
    el.append(a);
    document.body.appendChild(el);

    renderHook(() => useElementTracker(el, true, vi.fn()));

    const ro = tracker();
    expect(ro.targets.has(el)).toBe(true);
    expect(ro.targets.has(a)).toBe(false);
  });

  it("re-observes children added after mount when observeChildren is true", async () => {
    const el = document.createElement("div");
    el.append(document.createElement("span"));
    document.body.appendChild(el);

    renderHook(() =>
      useElementTracker(el, true, vi.fn(), undefined, undefined, true),
    );

    // A child appears later (e.g. a flex item rendered after first paint).
    const late = document.createElement("span");
    el.appendChild(late);

    // MutationObserver childList records deliver on a microtask.
    await new Promise((r) => setTimeout(r, 0));

    expect(tracker().targets.has(late)).toBe(true);
  });
});
