/**
 * useInjectedStyles.ts — one-time global <style> tag injection
 *
 * Injects two document-level <style> tags the overlay relies on:
 *   1. Taming the Next.js dev-overlay z-index so it can't cover the panel.
 *   2. Focus-ring + drag-handle + selected-outline-pulse styles, scoped to
 *      the .__tuner-root tree.
 *
 * Extracted verbatim from Overlay.tsx — both effects are self-contained with
 * empty dependency arrays, so behavior is identical. Each guards against
 * double-injection by id and removes its tag on cleanup.
 */

import { useEffect } from "react";

export function useInjectedStyles() {
  // --- Tame Next.js dev overlay z-index so it doesn't cover the panel ---
  useEffect(() => {
    const STYLE_ID = "__tuner-nextjs-fix";
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `nextjs-portal { z-index: 2147483640 !important; }`;
    document.head.appendChild(style);

    return () => { document.getElementById(STYLE_ID)?.remove(); };
  }, []);

  // --- Focus ring styles (global, scoped to tuner root) ---
  useEffect(() => {
    const STYLE_ID = "__tuner-focus-ring";
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = ".__tuner-root *:focus-visible { outline: none; box-shadow: 0 0 0 2px rgba(59,130,246,0.3); } .__tuner-root *:focus:not(:focus-visible) { outline: none; } .__tuner-root *:hover > .__tuner-drag-handle { opacity: 0.4; } @keyframes tuner-outline-pulse { 0% { box-shadow: 0 0 0 0 rgba(217,119,87,0.4); } 50% { box-shadow: 0 0 0 4px rgba(217,119,87,0.15); } 100% { box-shadow: 0 0 0 0 rgba(217,119,87,0); } } .__tuner-selected-outline.--pulse { animation: tuner-outline-pulse 400ms ease-out; }";
    document.head.appendChild(style);

    return () => { document.getElementById(STYLE_ID)?.remove(); };
  }, []);
}
