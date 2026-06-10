/**
 * useFocusTrap.ts — Traps keyboard focus within a container element
 *
 * Used for modals (ShortcutsHelp, CommandPalette, PropertyContextMenu)
 * to ensure Tab/Shift+Tab cycles within the modal boundary.
 */

import { useEffect, type RefObject } from "react";
import { shadowAwareActiveElement } from "../core/shadowRoot";

/** Exported for testing */
export const FOCUSABLE_SELECTOR =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

/** Pure logic: get the next focused element when Tab is pressed at a boundary */
export function getNextFocusTarget(
  focusable: HTMLElement[],
  activeElement: Element | null,
  shiftKey: boolean,
): HTMLElement | null {
  if (focusable.length === 0) return null;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];

  if (shiftKey && activeElement === first) return last;
  if (!shiftKey && activeElement === last) return first;
  return null; // no wrapping needed
}

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
      const target = getNextFocusTarget(focusable, shadowAwareActiveElement(), e.shiftKey);
      if (target) {
        e.preventDefault();
        target.focus();
      }
    };

    container.addEventListener("keydown", handleKeyDown);

    // Focus first focusable element on open
    const focusable = container.querySelectorAll(FOCUSABLE_SELECTOR);
    if (focusable.length > 0) (focusable[0] as HTMLElement).focus();

    return () => container.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, ref]);
}
