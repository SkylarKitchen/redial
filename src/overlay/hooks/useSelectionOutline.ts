/**
 * useSelectionOutline.ts — selected-element outline + badge + tag label tracking
 *
 * Drives the visual chrome drawn around the selected element and the breadcrumb
 * ancestor hover outline:
 *   - keeps the tag-label text in sync with the selected element,
 *   - positions the selection outline, dimensions badge and tag label via an
 *     event-driven element tracker,
 *   - replays the outline pulse animation on each new selection,
 *   - positions the ancestor-hover outline via a second tracker.
 *
 * Extracted verbatim from Overlay.tsx — every effect body, useCallback and
 * dependency array is preserved exactly. The outline/badge/label DOM nodes
 * stay owned by Overlay (rendered in its JSX); their refs are passed in so this
 * hook writes to the same nodes.
 */

import { useCallback, useEffect } from "react";
import { useElementTracker } from "./useElementTracker";
import { timing } from "../timing";

export interface SelectionOutlineDeps {
  selectedEl: Element | null;
  selecting: boolean;
  hoveredAncestor: Element | null;
  panelKey: number;
  selectedOutlineRef: React.RefObject<HTMLDivElement | null>;
  dimensionsBadgeRef: React.RefObject<HTMLDivElement | null>;
  tagLabelRef: React.RefObject<HTMLDivElement | null>;
  ancestorOutlineRef: React.RefObject<HTMLDivElement | null>;
}

export function useSelectionOutline({
  selectedEl,
  selecting,
  hoveredAncestor,
  panelKey,
  selectedOutlineRef,
  dimensionsBadgeRef,
  tagLabelRef,
  ancestorOutlineRef,
}: SelectionOutlineDeps) {
  // --- Persistent outline for selected element (Phase 2) ---
  // Event-driven tracking via ResizeObserver + scroll/resize listeners
  // (replaces infinite RAF loop — only recalculates when something changes)

  // Build tag label text when element changes
  useEffect(() => {
    if (!selectedEl || selecting || !tagLabelRef.current) return;
    const elTag = selectedEl.tagName.toLowerCase();
    const firstClass = selectedEl.classList.length > 0 ? selectedEl.classList[0] : null;
    tagLabelRef.current.textContent = firstClass ? `${elTag}.${firstClass}` : elTag;
  }, [selectedEl, selecting]);

  useElementTracker(
    selectedEl,
    !selecting && !!selectedEl,
    useCallback((rect: DOMRect) => {
      const outline = selectedOutlineRef.current;
      if (!outline) return;
      outline.style.top = `${rect.top}px`;
      outline.style.left = `${rect.left}px`;
      outline.style.width = `${rect.width}px`;
      outline.style.height = `${rect.height}px`;
      outline.style.display = "block";

      const badge = dimensionsBadgeRef.current;
      if (badge) {
        const w = Math.round(rect.width);
        const h = Math.round(rect.height);
        badge.textContent = `${w} × ${h}`;
        badge.style.top = `${rect.bottom + 4}px`;
        badge.style.left = `${rect.right}px`;
        badge.style.transform = "translateX(-100%)";
        badge.style.display = "block";
      }

      const tagEl = tagLabelRef.current;
      if (tagEl) {
        tagEl.style.top = `${rect.top - 4}px`;
        tagEl.style.left = `${rect.left}px`;
        tagEl.style.transform = "translateY(-100%)";
        tagEl.style.display = "block";
      }
    }, []),
    useCallback(() => {
      // Element disconnected (HMR, navigation)
      const outline = selectedOutlineRef.current;
      if (outline) outline.style.display = "none";
      if (dimensionsBadgeRef.current) dimensionsBadgeRef.current.style.display = "none";
      if (tagLabelRef.current) tagLabelRef.current.style.display = "none";
    }, []),
  );

  // --- Outline pulse on new element selection ---
  useEffect(() => {
    const outline = selectedOutlineRef.current;
    if (!outline || !selectedEl || selecting) return;
    outline.classList.remove("--pulse");
    // Force reflow so re-adding triggers animation restart
    void outline.offsetWidth;
    outline.classList.add("--pulse");
    const timer = setTimeout(() => outline.classList.remove("--pulse"), timing.toolbar);
    return () => { clearTimeout(timer); outline.classList.remove("--pulse"); };
  }, [panelKey, selectedEl, selecting]);

  // --- Breadcrumb ancestor hover outline ---
  // Event-driven tracking (replaces infinite RAF loop)
  useElementTracker(
    hoveredAncestor,
    !!hoveredAncestor,
    useCallback((rect: DOMRect) => {
      const outline = ancestorOutlineRef.current;
      if (!outline) return;
      outline.style.display = "block";
      outline.style.top = `${rect.top}px`;
      outline.style.left = `${rect.left}px`;
      outline.style.width = `${rect.width}px`;
      outline.style.height = `${rect.height}px`;
    }, []),
    useCallback(() => {
      if (ancestorOutlineRef.current) ancestorOutlineRef.current.style.display = "none";
    }, []),
  );
}
