/**
 * useDropdownKeyboard.ts — Shared keyboard navigation for dropdown components
 *
 * Provides ArrowUp/Down, Home/End, Enter/Escape handling plus
 * a highlighted-index tracker for any listbox-style dropdown.
 */

import { useState, useCallback, useEffect } from "react";

export interface UseDropdownKeyboardOptions {
  open: boolean;
  setOpen: (v: boolean) => void;
  optionCount: number;
  selectedIndex: number;
  onSelect: (index: number) => void;
}

export interface UseDropdownKeyboardResult {
  highlightedIndex: number;
  onTriggerKeyDown: (e: React.KeyboardEvent) => void;
  onListKeyDown: (e: React.KeyboardEvent) => void;
}

export function useDropdownKeyboard({
  open,
  setOpen,
  optionCount,
  selectedIndex,
  onSelect,
}: UseDropdownKeyboardOptions): UseDropdownKeyboardResult {
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  // Reset highlight when dropdown opens/closes
  useEffect(() => {
    if (open) {
      setHighlightedIndex(selectedIndex);
    } else {
      setHighlightedIndex(-1);
    }
  }, [open, selectedIndex]);

  const onTriggerKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
        e.preventDefault();
        setOpen(true);
      }
    },
    [open, setOpen]
  );

  const onListKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!open || optionCount === 0) return;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setHighlightedIndex((prev) =>
            prev < optionCount - 1 ? prev + 1 : 0
          );
          break;
        case "ArrowUp":
          e.preventDefault();
          setHighlightedIndex((prev) =>
            prev > 0 ? prev - 1 : optionCount - 1
          );
          break;
        case "Home":
          e.preventDefault();
          setHighlightedIndex(0);
          break;
        case "End":
          e.preventDefault();
          setHighlightedIndex(optionCount - 1);
          break;
        case "Enter":
          e.preventDefault();
          if (highlightedIndex >= 0 && highlightedIndex < optionCount) {
            onSelect(highlightedIndex);
          }
          break;
        case "Escape":
          e.preventDefault();
          setOpen(false);
          break;
      }
    },
    [open, optionCount, highlightedIndex, onSelect, setOpen]
  );

  return { highlightedIndex, onTriggerKeyDown, onListKeyDown };
}
