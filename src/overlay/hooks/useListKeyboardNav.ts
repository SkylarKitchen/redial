/**
 * useListKeyboardNav.ts — keyboard navigation over a flat list of items.
 *
 * This is the keyboard behavior the shadcn `Command` (cmdk) component gave us
 * for free: a highlighted item that moves with ArrowUp/ArrowDown (wrapping),
 * Home/End to jump to the ends, and Enter to select the highlight. It is the
 * shared kernel behind both `SearchableMenu` (flat searchable dropdowns) and
 * `CommandPalette` (grouped results indexed into a flat array).
 *
 * The hook owns only the highlighted index + the keydown handler — rendering,
 * filtering, and scrolling-into-view stay with the caller, so it composes with
 * either a flat list or a grouped one.
 */

import { useCallback, useEffect, useState } from "react";

export interface UseListKeyboardNavOptions {
  /** Number of currently-navigable items (e.g. after filtering). */
  itemCount: number;
  /** Called when the user presses Enter on the highlighted item. */
  onSelect: (index: number) => void;
  /** When false, the keydown handler is a no-op (e.g. dropdown closed). Default true. */
  enabled?: boolean;
  /** Wrap around at the ends (cmdk-style). Default true. */
  loop?: boolean;
}

export interface ListKeyboardNav {
  /** Index of the highlighted item, or -1 when the list is empty. */
  activeIndex: number;
  setActiveIndex: (index: number) => void;
  /** Attach to the search input / list container's onKeyDown. */
  handleKeyDown: (e: React.KeyboardEvent) => void;
}

export function useListKeyboardNav({
  itemCount,
  onSelect,
  enabled = true,
  loop = true,
}: UseListKeyboardNavOptions): ListKeyboardNav {
  const [activeIndex, setActiveIndex] = useState(0);

  // Auto-highlight the first item, and re-clamp whenever the list changes size
  // (e.g. a filter narrows the results). Mirrors cmdk, which keeps the highlight
  // on the first match after each keystroke.
  useEffect(() => {
    setActiveIndex(itemCount > 0 ? 0 : -1);
  }, [itemCount]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!enabled || itemCount === 0) return;
      switch (e.key) {
        case "ArrowDown": {
          e.preventDefault();
          setActiveIndex((i) => {
            const next = i + 1;
            return next >= itemCount ? (loop ? 0 : itemCount - 1) : next;
          });
          break;
        }
        case "ArrowUp": {
          e.preventDefault();
          setActiveIndex((i) => {
            const prev = i - 1;
            return prev < 0 ? (loop ? itemCount - 1 : 0) : prev;
          });
          break;
        }
        case "Home":
          e.preventDefault();
          setActiveIndex(0);
          break;
        case "End":
          e.preventDefault();
          setActiveIndex(itemCount - 1);
          break;
        case "Enter":
          if (activeIndex >= 0 && activeIndex < itemCount) {
            e.preventDefault();
            onSelect(activeIndex);
          }
          break;
      }
    },
    [enabled, itemCount, loop, activeIndex, onSelect],
  );

  return { activeIndex, setActiveIndex, handleKeyDown };
}
