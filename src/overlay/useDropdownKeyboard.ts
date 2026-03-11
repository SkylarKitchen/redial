/**
 * useDropdownKeyboard.ts — Shared keyboard navigation for dropdown components
 *
 * Provides ArrowUp/Down, Home/End, Enter/Escape handling plus
 * a highlighted-index tracker for any listbox-style dropdown.
 * Opt-in type-ahead via `labels` prop.
 */

import React, { useState, useCallback, useEffect, useRef } from "react";

export interface UseDropdownKeyboardOptions {
  open: boolean;
  setOpen: (v: boolean) => void;
  optionCount: number;
  selectedIndex: number;
  onSelect: (index: number) => void;
  /** Opt-in type-ahead: pass option labels to enable single-key search */
  labels?: string[];
}

export interface UseDropdownKeyboardResult {
  highlightedIndex: number;
  onTriggerKeyDown: (e: React.KeyboardEvent) => void;
  onListKeyDown: (e: React.KeyboardEvent) => void;
  /** Attach to the highlighted option to auto-scroll it into view */
  optionRefCallback: (el: HTMLElement | null) => void;
}

export function useDropdownKeyboard({
  open,
  setOpen,
  optionCount,
  selectedIndex,
  onSelect,
  labels,
}: UseDropdownKeyboardOptions): UseDropdownKeyboardResult {
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  // Ref that mirrors highlightedIndex to avoid stale closures in Enter handler
  const highlightedRef = useRef(highlightedIndex);
  highlightedRef.current = highlightedIndex;

  // Type-ahead state
  const typeBuffer = useRef("");
  const typeTimer = useRef<ReturnType<typeof setTimeout>>();

  // Cleanup type-ahead timer on unmount
  useEffect(() => {
    return () => clearTimeout(typeTimer.current);
  }, []);

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
          if (highlightedRef.current >= 0 && highlightedRef.current < optionCount) {
            onSelect(highlightedRef.current);
          }
          break;
        case "Escape":
          e.preventDefault();
          setOpen(false);
          break;
        default:
          if (labels && e.key.length === 1) {
            typeBuffer.current += e.key.toLowerCase();
            clearTimeout(typeTimer.current);
            typeTimer.current = setTimeout(() => { typeBuffer.current = ""; }, 500);
            const match = labels.findIndex(l => l.toLowerCase().startsWith(typeBuffer.current));
            if (match >= 0) setHighlightedIndex(match);
          }
      }
    },
    [open, optionCount, onSelect, setOpen, labels]
  );

  const optionRefCallback = useCallback((el: HTMLElement | null) => {
    el?.scrollIntoView({ block: "nearest" });
  }, []);

  return { highlightedIndex, onTriggerKeyDown, onListKeyDown, optionRefCallback };
}
