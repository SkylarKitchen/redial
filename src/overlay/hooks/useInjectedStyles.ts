/**
 * useInjectedStyles.ts — one-time global style injection
 *
 * Injects two document-level style sheets the overlay relies on:
 *   1. Taming the Next.js dev-overlay z-index so it can't cover the panel.
 *   2. Focus-ring + drag-handle + selected-outline-pulse styles, scoped to
 *      the .__tuner-root tree.
 *
 * Both go through `managedSheet` (ADR-0009) so they're CSP-safe and idempotent
 * by key — no per-call DOM lookups.
 */

import { useEffect } from "react";
import { color, gridAlpha } from "../theme";
import { managedSheet } from "../core/managedSheet";

export function useInjectedStyles() {
  // --- Tame Next.js dev overlay z-index so it doesn't cover the panel ---
  useEffect(() => {
    const key = "next-overlay-z-index";
    managedSheet(key).replace(
      `nextjs-portal { z-index: 2147483640 !important; }`,
    );
    return () => { managedSheet(key).dispose(); };
  }, []);

  // --- Focus ring styles (global, scoped to tuner root) ---
  useEffect(() => {
    const key = "focus-rings-and-pulse";
    managedSheet(key).replace(
      `.__tuner-root *:focus-visible { outline: none; box-shadow: 0 0 0 2px ${color.ring}; } .__tuner-root *:focus:not(:focus-visible) { outline: none; } .__tuner-root *:hover > .__tuner-drag-handle { opacity: 0.4; } @keyframes tuner-outline-pulse { 0% { box-shadow: 0 0 0 0 ${gridAlpha(0.4)}; } 50% { box-shadow: 0 0 0 4px ${gridAlpha(0.15)}; } 100% { box-shadow: 0 0 0 0 ${gridAlpha(0)}; } } .__tuner-selected-outline.--pulse { animation: tuner-outline-pulse 400ms ease-out; }`,
    );
    return () => { managedSheet(key).dispose(); };
  }, []);
}
