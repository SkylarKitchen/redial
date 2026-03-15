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

    // Track scroll (capture phase catches nested scrollables)
    document.addEventListener("scroll", scheduleSync, { capture: true, passive: true });
    // Track window resize
    window.addEventListener("resize", scheduleSync, { passive: true });

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafRef.current);
      ro.disconnect();
      document.removeEventListener("scroll", scheduleSync, true);
      window.removeEventListener("resize", scheduleSync);
      // Hide outlines when tracking stops (element changed, disabled, or unmount)
      onDisconnectRef.current?.();
    };
  }, [element, enabled]);
}
