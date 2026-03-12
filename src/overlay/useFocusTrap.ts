/**
 * useFocusTrap.ts — Traps keyboard focus within a container element
 *
 * Used for modals (ShortcutsHelp, CommandPalette, PropertyContextMenu)
 * to ensure Tab/Shift+Tab cycles within the modal boundary.
 */

import { useEffect, type RefObject } from "react";

const FOCUSABLE_SELECTOR =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

export function useFocusTrap(
  ref: RefObject<HTMLElement | null>,
  isOpen: boolean,
): void {
  useEffect(() => {
    if (!isOpen || !ref.current) return;
    const container = ref.current;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const focusable = Array.from(
        container.querySelectorAll(FOCUSABLE_SELECTOR),
      ) as HTMLElement[];
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    container.addEventListener("keydown", handleKeyDown);

    // Focus first focusable element on open
    const focusable = container.querySelectorAll(FOCUSABLE_SELECTOR);
    if (focusable.length > 0) (focusable[0] as HTMLElement).focus();

    return () => container.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, ref]);
}
