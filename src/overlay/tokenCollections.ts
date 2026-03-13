/**
 * tokenCollections.ts — User-defined variable collection store
 *
 * Module-level store with useSyncExternalStore + localStorage.
 * Follows the same pattern as useSwatches.ts.
 *
 * Collections group CSS custom properties (variables) into user-defined
 * buckets (e.g. "Primitives", "Semantic", "Components"). A variable
 * belongs to at most one collection.
 */

import { useSyncExternalStore } from "react";

// ─── Types ───────────────────────────────────────────────────────

export interface TokenCollection {
  id: string;
  name: string;
  variableNames: string[];
}

// ─── Storage ─────────────────────────────────────────────────────

const STORAGE_KEY = `__tuner_collections:${typeof location !== "undefined" ? location.origin : ""}`;

function readFromStorage(): TokenCollection[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

// ─── Module-level store ──────────────────────────────────────────

let collections: TokenCollection[] = readFromStorage();
let cachedSnapshot: TokenCollection[] = [...collections];
const listeners = new Set<() => void>();

function persist() {
  cachedSnapshot = [...collections];
  listeners.forEach((fn) => fn());
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(collections));
  } catch {
    // localStorage full — silently ignore
  }
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

function getSnapshot() {
  return cachedSnapshot;
}

function getServerSnapshot(): TokenCollection[] {
  return [];
}

// ─── Mutations ───────────────────────────────────────────────────

function addCollection(name: string): TokenCollection {
  const id = typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `c_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const collection: TokenCollection = { id, name, variableNames: [] };
  collections = [...collections, collection];
  persist();
  return collection;
}

function removeCollection(id: string) {
  collections = collections.filter((c) => c.id !== id);
  persist();
}

function renameCollection(id: string, name: string) {
  collections = collections.map((c) =>
    c.id === id ? { ...c, name } : c,
  );
  persist();
}

/**
 * Assign a variable to a collection. Auto-removes from any previous
 * collection (a variable belongs to at most one collection).
 */
function assignVariable(collectionId: string, variableName: string) {
  collections = collections.map((c) => {
    if (c.id === collectionId) {
      // Add if not already present
      if (c.variableNames.includes(variableName)) return c;
      return { ...c, variableNames: [...c.variableNames, variableName] };
    }
    // Remove from any other collection
    if (c.variableNames.includes(variableName)) {
      return { ...c, variableNames: c.variableNames.filter((n) => n !== variableName) };
    }
    return c;
  });
  persist();
}

function unassignVariable(variableName: string) {
  collections = collections.map((c) => {
    if (c.variableNames.includes(variableName)) {
      return { ...c, variableNames: c.variableNames.filter((n) => n !== variableName) };
    }
    return c;
  });
  persist();
}

function getCollectionForVariable(variableName: string): TokenCollection | null {
  return collections.find((c) => c.variableNames.includes(variableName)) ?? null;
}

// ─── Reset (for tests) ──────────────────────────────────────────

function resetStore() {
  collections = [];
  cachedSnapshot = [];
  listeners.forEach((fn) => fn());
  try { localStorage.removeItem(STORAGE_KEY); } catch {}
}

// ─── Hook ────────────────────────────────────────────────────────

export function useTokenCollections() {
  const list = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return {
    collections: list,
    addCollection,
    removeCollection,
    renameCollection,
    assignVariable,
    unassignVariable,
    getCollectionForVariable,
  };
}

// Exported for testing
export {
  addCollection as _addCollection,
  removeCollection as _removeCollection,
  renameCollection as _renameCollection,
  assignVariable as _assignVariable,
  unassignVariable as _unassignVariable,
  getCollectionForVariable as _getCollectionForVariable,
  getSnapshot as _getSnapshot,
  subscribe as _subscribe,
  resetStore as _resetStore,
};
