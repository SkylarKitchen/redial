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

/** A subscribe function (e.g. apply.ts's subscribeOverrides) that invokes the
 *  callback whenever something external changes, returning an unsubscribe. */
type InvalidateSource = (callback: () => void) => () => void;

/**
 * Track an element's bounding rect efficiently, calling `onUpdate`
 * only when the element moves or resizes. Calls `onDisconnect`
 * if the element is removed from the DOM.
 *
 * `onInvalidate` lets a caller plug in an external change signal — e.g. the
 * style engine's `subscribeOverrides` — so the rect is re-read after edits that
 * neither ResizeObserver nor the element's own MutationObserver can see (a CSS
 * variable on :root, a stylesheet-rule/class edit, undo/redo). Coalesced via
 * the same rAF as every other non-scroll trigger.
 *
 * `observeChildren` extends the ResizeObserver to also watch the element's
 * direct children, and the MutationObserver to watch `childList`. A caller that
 * measures something *between* children (e.g. flex-gap hatching) needs this:
 * a child can resize without resizing the container, so container-only
 * observation would leave its measurement stale.
 */
export function useElementTracker(
  element: Element | null,
  enabled: boolean,
  onUpdate: TrackerCallback,
  onDisconnect?: () => void,
  onInvalidate?: InvalidateSource,
  observeChildren = false,
) {
  const rafRef = useRef(0);
  const onUpdateRef = useRef(onUpdate);
  const onDisconnectRef = useRef(onDisconnect);
  const onInvalidateRef = useRef(onInvalidate);

  // Keep refs current without causing effect re-runs
  onUpdateRef.current = onUpdate;
  onDisconnectRef.current = onDisconnect;
  onInvalidateRef.current = onInvalidate;

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

    // Track element size changes. When observeChildren is set, also watch each
    // direct child so a child resizing (without resizing the container) still
    // triggers a re-measure. observeTargets() is re-runnable so we can refresh
    // the child set when children are added/removed.
    const ro = new ResizeObserver(scheduleSync);
    const observeTargets = () => {
      ro.disconnect();
      ro.observe(element);
      if (observeChildren) {
        for (const child of element.children) ro.observe(child);
      }
    };
    observeTargets();

    // Track inline-style / class edits applied by the panel. A panel edit that
    // MOVES the element without changing its border-box size (e.g. margin-top or
    // a position/top/left offset) never triggers ResizeObserver, so without this
    // the outline would stay on the element's stale position. We watch the PAGE
    // element (not our outline) and the tracker never mutates its style/class, so
    // there is no feedback loop. Coalesce via scheduleSync — a slider drag fires
    // many mutations and must read the rect at most once per frame.
    //
    // With observeChildren we also watch childList: when a child is added or
    // removed we re-run observeTargets() so the new child set is observed, then
    // re-measure.
    const mo = new MutationObserver((records) => {
      if (observeChildren && records.some((r) => r.type === "childList")) {
        observeTargets();
      }
      scheduleSync();
    });
    mo.observe(element, {
      attributes: true,
      attributeFilter: ["style", "class"],
      childList: observeChildren,
    });

    // Re-sync on engine edits the observers above can't see: a CSS variable on
    // :root, a stylesheet-rule/class edit, or undo/redo all change the element's
    // geometry without mutating its own style/class attribute (and CSSOM edits
    // are not DOM mutations at all). The style engine fires this signal on every
    // override mutation; coalesce via scheduleSync.
    const unsubscribe = onInvalidateRef.current?.(scheduleSync);

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
      unsubscribe?.();
      document.removeEventListener("scroll", sync, true);
      window.removeEventListener("resize", scheduleSync);
      // Hide outlines when tracking stops (element changed, disabled, or unmount)
      onDisconnectRef.current?.();
    };
  }, [element, enabled, observeChildren]);
}
