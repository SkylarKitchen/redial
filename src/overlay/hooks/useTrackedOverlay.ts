/**
 * useTrackedOverlay.ts — state-returning element tracking for the declarative
 * on-page overlays (grid, flex-gap, spacing preview/guides).
 *
 * Each of those overlays used to run its own perpetual requestAnimationFrame
 * loop + ResizeObserver, plus a `prevRef` string key to avoid re-rendering at
 * 60fps. This hook is the single home for that pattern, layered on the deep
 * `useElementTracker`:
 *   - it owns the React state and the change-key skip-render,
 *   - it routes measurement through the tracker, so every overlay inherits the
 *     synchronous scroll path, the style/class MutationObserver, child
 *     observation, and the engine-invalidate signal for free,
 *   - it auto-wires the style engine's `subscribeOverrides`, and accepts one
 *     extra invalidate source (the spacing overlays pass `subscribeScrubState`
 *     so they re-measure on hover/scrub changes that fire no DOM event).
 *
 * `measure` may read anything (getComputedStyle, children) and returns the
 * overlay's metrics, or null to hide. `changeKey` collapses metrics to a string
 * so identical layout doesn't trigger a render.
 */

import { useCallback, useRef, useState } from "react";
import { useElementTracker } from "./useElementTracker";
import { subscribeOverrides } from "../core/apply";

type InvalidateSource = (callback: () => void) => () => void;

export interface TrackedOverlayOptions {
  /** Also observe the element's direct children (for measurements between them). */
  observeChildren?: boolean;
  /** An additional change signal merged into the tracker's invalidate (e.g. scrub state). */
  extraInvalidate?: InvalidateSource;
}

export function useTrackedOverlay<M>(
  element: Element | null,
  enabled: boolean,
  measure: (el: Element) => M | null,
  changeKey: (m: M) => string,
  opts: TrackedOverlayOptions = {},
): M | null {
  const { observeChildren = false, extraInvalidate } = opts;

  const [metrics, setMetrics] = useState<M | null>(null);
  const prevKeyRef = useRef("");

  // Keep the latest measure/changeKey without re-subscribing the tracker.
  const measureRef = useRef(measure);
  const changeKeyRef = useRef(changeKey);
  measureRef.current = measure;
  changeKeyRef.current = changeKey;

  const onUpdate = useCallback(() => {
    if (!element) return;
    const m = measureRef.current(element);
    const key = m ? changeKeyRef.current(m) : "";
    if (key !== prevKeyRef.current) {
      prevKeyRef.current = key;
      setMetrics(m);
    }
  }, [element]);

  const onDisconnect = useCallback(() => {
    prevKeyRef.current = "";
    setMetrics(null);
  }, []);

  // Merge the engine's override signal with the optional extra source into the
  // tracker's single onInvalidate slot.
  const invalidate = useCallback<InvalidateSource>(
    (cb) => {
      const unsubs = [subscribeOverrides(cb)];
      if (extraInvalidate) unsubs.push(extraInvalidate(cb));
      return () => unsubs.forEach((u) => u());
    },
    [extraInvalidate],
  );

  useElementTracker(element, enabled, onUpdate, onDisconnect, invalidate, observeChildren);

  return metrics;
}
