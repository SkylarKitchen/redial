/**
 * usePortalDropdown.ts — Shared hook for portal-based dropdown positioning
 *
 * Encapsulates the common pattern used by UnitSelector, PositionSelector,
 * SelectRowCustom, and TextStyleRow:
 *   1. dropdownPos state + updateDropdownPos() with flip-above logic
 *   2. Ref-based click-outside (instance-safe, no querySelector)
 *   3. Dynamic height measurement via useLayoutEffect (corrects flip if estimate was wrong)
 */

import { useState, useRef, useEffect, useCallback, useLayoutEffect } from "react";

export interface PortalDropdownPos {
  top: number;
  left: number;
  width: number;
  up: boolean;
}

export interface UsePortalDropdownOptions {
  open: boolean;
  setOpen: (v: boolean) => void;
  triggerRef: React.RefObject<HTMLElement | null>;
  containerRef: React.RefObject<HTMLElement | null>;
  /** Estimated dropdown height for initial flip calculation (default: 220) */
  estimatedHeight?: number;
  /** Estimated dropdown width for initial horizontal clamping (default: 60) */
  estimatedWidth?: number;
}

/** Clamp a left value so the dropdown stays within viewport with 8px margin */
function clampLeft(left: number, width: number): number {
  const maxLeft = window.innerWidth - width - 8;
  return Math.max(8, Math.min(left, maxLeft));
}

export function usePortalDropdown({
  open,
  setOpen,
  triggerRef,
  containerRef,
  estimatedHeight = 220,
  estimatedWidth = 60,
}: UsePortalDropdownOptions) {
  const [dropdownPos, setDropdownPos] = useState<PortalDropdownPos | null>(null);
  const portalRef = useRef<HTMLDivElement>(null);
  const correctedRef = useRef(false);

  const updateDropdownPos = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const up = spaceBelow < estimatedHeight;
    correctedRef.current = false;
    setDropdownPos({
      top: up ? rect.top - estimatedHeight - 2 : rect.bottom + 2,
      left: clampLeft(rect.left, Math.max(rect.width, estimatedWidth)),
      width: rect.width,
      up,
    });
  }, [triggerRef, estimatedHeight, estimatedWidth]);

  // Ref-based click-outside: instance-safe, no querySelector
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (containerRef.current?.contains(target)) return;
      if (portalRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", handler, true);
    return () => document.removeEventListener("mousedown", handler, true);
  }, [open, setOpen, containerRef]);

  // Dynamic height measurement: correct flip direction after portal mounts
  useLayoutEffect(() => {
    if (!open || !dropdownPos || !portalRef.current || correctedRef.current) return;
    correctedRef.current = true;

    const portalRect = portalRef.current.getBoundingClientRect();
    const actualHeight = portalRect.height;
    const actualWidth = portalRect.width;
    if (actualHeight <= 0 || !triggerRef.current) return;

    const rect = triggerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const shouldFlipUp = spaceBelow < actualHeight;
    const clampedLeft = clampLeft(rect.left, Math.max(rect.width, actualWidth));

    if (shouldFlipUp !== dropdownPos.up || clampedLeft !== dropdownPos.left) {
      setDropdownPos({
        top: shouldFlipUp ? rect.top - actualHeight - 2 : rect.bottom + 2,
        left: clampedLeft,
        width: rect.width,
        up: shouldFlipUp,
      });
    }
  }, [open, dropdownPos, triggerRef]);

  return { dropdownPos, updateDropdownPos, portalRef };
}
