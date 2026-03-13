// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  _addCollection as addCollection,
  _removeCollection as removeCollection,
  _renameCollection as renameCollection,
  _assignVariable as assignVariable,
  _unassignVariable as unassignVariable,
  _getCollectionForVariable as getCollectionForVariable,
  _getManuallyAssignedNames as getManuallyAssignedNames,
  _bulkAssign as bulkAssign,
  _getSnapshot as getSnapshot,
  _subscribe as subscribe,
  _resetStore as resetStore,
} from "../tokenCollections";

beforeEach(() => {
  resetStore();
});

// ─── CRUD: Collections ────────────────────────────────────────────────

describe("addCollection", () => {
  it("creates a collection with a generated id and empty variableNames", () => {
    const c = addCollection("Primitives");
    expect(c.name).toBe("Primitives");
    expect(c.id).toBeTruthy();
    expect(c.variableNames).toEqual([]);
    expect(getSnapshot()).toHaveLength(1);
  });

  it("creates multiple collections", () => {
    addCollection("Primitives");
    addCollection("Semantic");
    expect(getSnapshot()).toHaveLength(2);
  });

  it("generates unique ids", () => {
    const a = addCollection("A");
    const b = addCollection("B");
    expect(a.id).not.toBe(b.id);
  });
});

describe("removeCollection", () => {
  it("removes by id", () => {
    const c = addCollection("Primitives");
    removeCollection(c.id);
    expect(getSnapshot()).toHaveLength(0);
  });

  it("no-op for unknown id", () => {
    addCollection("Primitives");
    removeCollection("nonexistent");
    expect(getSnapshot()).toHaveLength(1);
  });

  it("clears variable assignments when collection is removed", () => {
    const c = addCollection("Primitives");
    assignVariable(c.id, "--color-red");
    removeCollection(c.id);
    expect(getCollectionForVariable("--color-red")).toBeNull();
  });
});

describe("renameCollection", () => {
  it("renames by id", () => {
    const c = addCollection("Old");
    renameCollection(c.id, "New");
    expect(getSnapshot()[0].name).toBe("New");
  });

  it("no-op for unknown id", () => {
    addCollection("Keep");
    renameCollection("nonexistent", "Whatever");
    expect(getSnapshot()[0].name).toBe("Keep");
  });
});

// ─── Variable Assignment ──────────────────────────────────────────────

describe("assignVariable", () => {
  it("assigns a variable to a collection", () => {
    const c = addCollection("Colors");
    assignVariable(c.id, "--brand-primary");
    expect(getSnapshot()[0].variableNames).toEqual(["--brand-primary"]);
  });

  it("enforces single-collection constraint", () => {
    const a = addCollection("A");
    const b = addCollection("B");
    assignVariable(a.id, "--color");
    assignVariable(b.id, "--color");
    // Should be in B only
    const snap = getSnapshot();
    expect(snap.find((c) => c.id === a.id)!.variableNames).toEqual([]);
    expect(snap.find((c) => c.id === b.id)!.variableNames).toEqual(["--color"]);
  });

  it("does not duplicate if already in the target collection", () => {
    const c = addCollection("Colors");
    assignVariable(c.id, "--brand");
    assignVariable(c.id, "--brand");
    expect(getSnapshot()[0].variableNames).toEqual(["--brand"]);
  });
});

describe("unassignVariable", () => {
  it("removes variable from its collection", () => {
    const c = addCollection("Colors");
    assignVariable(c.id, "--brand");
    unassignVariable("--brand");
    expect(getSnapshot()[0].variableNames).toEqual([]);
  });

  it("no-op if variable is not assigned", () => {
    addCollection("Colors");
    unassignVariable("--nonexistent");
    expect(getSnapshot()[0].variableNames).toEqual([]);
  });
});

describe("getCollectionForVariable", () => {
  it("returns the collection containing the variable", () => {
    const c = addCollection("Colors");
    assignVariable(c.id, "--brand");
    const found = getCollectionForVariable("--brand");
    expect(found).not.toBeNull();
    expect(found!.id).toBe(c.id);
  });

  it("returns null for unassigned variable", () => {
    expect(getCollectionForVariable("--nope")).toBeNull();
  });
});

// ─── localStorage Persistence ─────────────────────────────────────────

describe("localStorage persistence", () => {
  const key = `__tuner_collections:${location.origin}`;

  it("persists on add", () => {
    addCollection("Test");
    const stored = JSON.parse(localStorage.getItem(key)!);
    expect(stored).toHaveLength(1);
    expect(stored[0].name).toBe("Test");
  });

  it("persists variable assignments", () => {
    const c = addCollection("Test");
    assignVariable(c.id, "--foo");
    const stored = JSON.parse(localStorage.getItem(key)!);
    expect(stored[0].variableNames).toEqual(["--foo"]);
  });

  it("clears on resetStore", () => {
    addCollection("Test");
    resetStore();
    expect(localStorage.getItem(key)).toBeNull();
  });
});

// ─── Subscribe / Notify ───────────────────────────────────────────────

describe("subscribe/notify", () => {
  it("notifies on addCollection", () => {
    const fn = vi.fn();
    subscribe(fn);
    addCollection("A");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("notifies on assignVariable", () => {
    const c = addCollection("A");
    const fn = vi.fn();
    subscribe(fn);
    assignVariable(c.id, "--x");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("unsubscribe stops notifications", () => {
    const fn = vi.fn();
    const unsub = subscribe(fn);
    addCollection("A");
    expect(fn).toHaveBeenCalledTimes(1);
    unsub();
    addCollection("B");
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

// ─── Snapshot Identity ────────────────────────────────────────────────

describe("snapshot identity", () => {
  it("returns a new reference after mutations", () => {
    const before = getSnapshot();
    addCollection("X");
    const after = getSnapshot();
    expect(before).not.toBe(after);
  });
});

// ─── getManuallyAssignedNames ─────────────────────────────────────────

describe("getManuallyAssignedNames", () => {
  it("returns empty set when no collections", () => {
    const names = getManuallyAssignedNames();
    expect(names.size).toBe(0);
  });

  it("returns empty set when collections have no variables", () => {
    addCollection("Empty");
    const names = getManuallyAssignedNames();
    expect(names.size).toBe(0);
  });

  it("returns correct set after assigning variables", () => {
    const a = addCollection("A");
    const b = addCollection("B");
    assignVariable(a.id, "--color-red");
    assignVariable(a.id, "--color-blue");
    assignVariable(b.id, "--spacing-sm");
    const names = getManuallyAssignedNames();
    expect(names.size).toBe(3);
    expect(names.has("--color-red")).toBe(true);
    expect(names.has("--color-blue")).toBe(true);
    expect(names.has("--spacing-sm")).toBe(true);
  });

  it("does not include unassigned variables", () => {
    const c = addCollection("Colors");
    assignVariable(c.id, "--color-red");
    unassignVariable("--color-red");
    const names = getManuallyAssignedNames();
    expect(names.has("--color-red")).toBe(false);
  });
});

// ─── bulkAssign ───────────────────────────────────────────────────────

describe("bulkAssign", () => {
  it("assigns multiple variables to a collection", () => {
    const c = addCollection("Colors");
    bulkAssign(c.id, ["--red", "--blue", "--green"]);
    const snap = getSnapshot();
    expect(snap[0].variableNames).toEqual(["--red", "--blue", "--green"]);
  });

  it("removes variables from other collections", () => {
    const a = addCollection("A");
    const b = addCollection("B");
    assignVariable(a.id, "--red");
    assignVariable(a.id, "--blue");
    bulkAssign(b.id, ["--red", "--blue"]);
    const snap = getSnapshot();
    expect(snap.find((c) => c.id === a.id)!.variableNames).toEqual([]);
    expect(snap.find((c) => c.id === b.id)!.variableNames).toEqual(["--red", "--blue"]);
  });

  it("does not duplicate if already in target collection", () => {
    const c = addCollection("Colors");
    assignVariable(c.id, "--red");
    bulkAssign(c.id, ["--red", "--blue"]);
    const snap = getSnapshot();
    expect(snap[0].variableNames).toEqual(["--red", "--blue"]);
  });

  it("only persists once", () => {
    const c = addCollection("Colors");
    const fn = vi.fn();
    subscribe(fn);
    bulkAssign(c.id, ["--a", "--b", "--c", "--d"]);
    // bulkAssign should call persist exactly once → 1 notification
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("works with empty array", () => {
    const c = addCollection("Colors");
    bulkAssign(c.id, []);
    expect(getSnapshot()[0].variableNames).toEqual([]);
  });
});
