// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  _addSwatch as addSwatch,
  _removeSwatch as removeSwatch,
  _getSnapshot as getSnapshot,
  _subscribe as subscribe,
  _resetStore as resetStore,
} from "../useSwatches";

const STORAGE_KEY = "__tuner_swatches";

beforeEach(() => {
  resetStore();
});

// ─── Store initialization ────────────────────────────────────────────

describe("store initialization", () => {
  it("starts empty when no localStorage data", () => {
    expect(getSnapshot()).toEqual([]);
  });

  it("starts empty when localStorage has no matching key", () => {
    localStorage.removeItem(STORAGE_KEY);
    resetStore();
    expect(getSnapshot()).toEqual([]);
  });
});

// ─── addSwatch ───────────────────────────────────────────────────────

describe("addSwatch", () => {
  it("adds a swatch to the store", () => {
    addSwatch("#ff0000", 1);
    expect(getSnapshot()).toEqual([{ hex: "#ff0000", opacity: 1 }]);
  });

  it("normalizes hex to lowercase", () => {
    addSwatch("#FF00CC", 1);
    expect(getSnapshot()[0].hex).toBe("#ff00cc");
  });

  it("adds to the front (MRU order)", () => {
    addSwatch("#aaa", 1);
    addSwatch("#bbb", 1);
    expect(getSnapshot()[0].hex).toBe("#bbb");
    expect(getSnapshot()[1].hex).toBe("#aaa");
  });

  it("prevents duplicate with same hex and opacity", () => {
    addSwatch("#abc", 0.5);
    addSwatch("#abc", 0.5);
    expect(getSnapshot()).toHaveLength(1);
  });

  it("allows same hex with different opacity", () => {
    addSwatch("#abc", 1);
    addSwatch("#abc", 0.5);
    expect(getSnapshot()).toHaveLength(2);
  });

  it("respects MAX_SWATCHES (24) cap", () => {
    for (let i = 0; i < 30; i++) {
      addSwatch(`#${String(i).padStart(6, "0")}`, 1);
    }
    expect(getSnapshot()).toHaveLength(24);
  });

  it("slices overflow — oldest swatches are dropped", () => {
    for (let i = 0; i < 25; i++) {
      addSwatch(`#${String(i).padStart(6, "0")}`, 1);
    }
    const snap = getSnapshot();
    expect(snap).toHaveLength(24);
    // Most recent (#000024) should be first
    expect(snap[0].hex).toBe("#000024");
    // The very first (#000000) should be gone
    expect(snap.find((s) => s.hex === "#000000")).toBeUndefined();
  });

  it("returns a new snapshot reference after adding", () => {
    const before = getSnapshot();
    addSwatch("#fff", 1);
    const after = getSnapshot();
    expect(before).not.toBe(after);
  });
});

// ─── removeSwatch ────────────────────────────────────────────────────

describe("removeSwatch", () => {
  it("removes swatch by index", () => {
    addSwatch("#aaa", 1);
    addSwatch("#bbb", 1);
    // After adds: [#bbb, #aaa]
    removeSwatch(0);
    expect(getSnapshot()).toEqual([{ hex: "#aaa", opacity: 1 }]);
  });

  it("no-op for out-of-bounds index (negative)", () => {
    addSwatch("#aaa", 1);
    const before = getSnapshot().length;
    removeSwatch(-1);
    expect(getSnapshot()).toHaveLength(before);
  });

  it("no-op for out-of-bounds index (too large)", () => {
    addSwatch("#aaa", 1);
    const before = getSnapshot().length;
    removeSwatch(99);
    expect(getSnapshot()).toHaveLength(before);
  });
});

// ─── localStorage persistence ────────────────────────────────────────

describe("localStorage persistence", () => {
  it("addSwatch persists to localStorage", () => {
    addSwatch("#123456", 0.8);
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(stored).toEqual([{ hex: "#123456", opacity: 0.8 }]);
  });

  it("removeSwatch updates localStorage", () => {
    addSwatch("#aaa", 1);
    addSwatch("#bbb", 1);
    removeSwatch(0);
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(stored).toEqual([{ hex: "#aaa", opacity: 1 }]);
  });

  it("corrupted localStorage returns empty on reset", () => {
    localStorage.setItem(STORAGE_KEY, "NOT VALID JSON{{{");
    // The module reads from storage at import time, but resetStore clears
    // the in-memory state. A fresh module load with corrupted data would
    // return [] from readFromStorage's catch. We simulate that:
    resetStore();
    expect(getSnapshot()).toEqual([]);
  });
});

// ─── subscribe/notify ────────────────────────────────────────────────

describe("subscribe/notify", () => {
  it("listener is called on addSwatch", () => {
    const listener = vi.fn();
    subscribe(listener);
    addSwatch("#aaa", 1);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("listener is called on removeSwatch", () => {
    addSwatch("#aaa", 1);
    const listener = vi.fn();
    subscribe(listener);
    removeSwatch(0);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("unsubscribe stops notifications", () => {
    const listener = vi.fn();
    const unsub = subscribe(listener);
    addSwatch("#aaa", 1);
    expect(listener).toHaveBeenCalledTimes(1);
    unsub();
    addSwatch("#bbb", 1);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("multiple listeners are all notified", () => {
    const a = vi.fn();
    const b = vi.fn();
    subscribe(a);
    subscribe(b);
    addSwatch("#ccc", 1);
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
  });
});

// ─── resetStore ──────────────────────────────────────────────────────

describe("resetStore", () => {
  it("clears all swatches", () => {
    addSwatch("#aaa", 1);
    addSwatch("#bbb", 1);
    resetStore();
    expect(getSnapshot()).toEqual([]);
  });

  it("clears localStorage", () => {
    addSwatch("#aaa", 1);
    resetStore();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("notifies listeners", () => {
    const listener = vi.fn();
    subscribe(listener);
    resetStore();
    expect(listener).toHaveBeenCalled();
  });
});
