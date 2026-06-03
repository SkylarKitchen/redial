/**
 * useElementTracker.ts — event-driven element position/size tracking
 *
 * Replaces infinite requestAnimationFrame loops with targeted listeners:
 * - ResizeObserver for element size changes
 * - scroll listener (capture, passive) for viewport position changes
 * - resize listener for window dimension changes
 *
 * Uses a single RAF to coalesce multiple events in the same frame,
 * so we call getBoundingClientRect() at most once per animation frame.
 */

import { useEffect, useRef } from "react";

type TrackerCallback = (rect: DOMRect) => void;

/**
 * Track an element's bounding rect efficiently, calling `onUpdate`
 * only when the element moves or resizes. Calls `onDisconnect`
 * if the element is removed from the DOM.
 */
export function useElementTracker(
  element: Element | null,
  enabled: boolean,
  onUpdate: TrackerCallback,
  onDisconnect?: () => void,
) {
  const rafRef = useRef(0);
  const onUpdateRef = useRef(onUpdate);
  const onDisconnectRef = useRef(onDisconnect);

  // Keep refs current without causing effect re-runs
  onUpdateRef.current = onUpdate;
  onDisconnectRef.current = onDisconnect;

  useEffect(() => {
    if (!element || !enabled) return;

    let cancelled = false;

    const sync = () => {
      if (cancelled) return;
      if (!element.isConnected) {
        onDisconnectRef.current?.();
        return;
      }
      onUpdateRef.current(element.getBoundingClientRect());
    };

    // Coalesce: schedule at most one RAF per frame
    const scheduleSync = () => {
      if (cancelled) return;
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(sync);
    };

    // Initial sync
    sync();

    // Track element size changes
    const ro = new ResizeObserver(scheduleSync);
    ro.observe(element);

    // Track inline-style / class edits applied by the panel. A panel edit that
    // MOVES the element without changing its border-box size (e.g. margin-top or
    // a position/top/left offset) never triggers ResizeObserver, so without this
    // the outline would stay on the element's stale position. We watch the PAGE
    // element (not our outline) and the tracker never mutates its style/class, so
    // there is no feedback loop. Coalesce via scheduleSync — a slider drag fires
    // many mutations and must read the rect at most once per frame.
    const mo = new MutationObserver(scheduleSync);
    mo.observe(element, { attributes: true, attributeFilter: ["style", "class"] });

    // Track scroll synchronously — scroll fires after layout and before paint,
    // so reading rect + writing outline position here lands in the SAME frame
    // the content scrolled, eliminating the one-frame visual lag.
    document.addEventListener("scroll", sync, { capture: true, passive: true });
    // Track window resize
    window.addEventListener("resize", scheduleSync, { passive: true });

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafRef.current);
      ro.disconnect();
      mo.disconnect();
      document.removeEventListener("scroll", sync, true);
      window.removeEventListener("resize", scheduleSync);
      // Hide outlines when tracking stops (element changed, disabled, or unmount)
      onDisconnectRef.current?.();
    };
  }, [element, enabled]);
}
