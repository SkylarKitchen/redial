/**
 * useSwatches.ts — Shared swatch palette with localStorage persistence
 *
 * Module-level store with useSyncExternalStore. Shared across all
 * ColorPickerEnhanced instances without React context.
 */

import { useSyncExternalStore } from "react";

type HexColor = `#${string}`;

export interface Swatch {
  hex: HexColor;
  opacity: number;
}

const STORAGE_KEY = "__tuner_swatches";
const MAX_SWATCHES = 24;

// ─── Module-level store ──────────────────────────────────────
function readFromStorage(): Swatch[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

let swatches: Swatch[] = readFromStorage();
let cachedSnapshot: Swatch[] = [...swatches];
const listeners = new Set<() => void>();

function persist() {
  cachedSnapshot = [...swatches];
  listeners.forEach((fn) => fn());
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(swatches));
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

function getServerSnapshot(): Swatch[] {
  return [];
}

// ─── Mutations ───────────────────────────────────────────────
function addSwatch(hex: string, opacity: number) {
  const normalized = hex.toLowerCase() as HexColor;
  // Duplicate prevention
  if (swatches.some((s) => s.hex === normalized && s.opacity === opacity)) return;
  swatches = [{ hex: normalized, opacity }, ...swatches].slice(0, MAX_SWATCHES);
  persist();
}

function removeSwatch(index: number) {
  swatches = swatches.filter((_, i) => i !== index);
  persist();
}

// ─── Hook ────────────────────────────────────────────────────
export function useSwatches() {
  const list = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return { swatches: list, addSwatch, removeSwatch };
}
