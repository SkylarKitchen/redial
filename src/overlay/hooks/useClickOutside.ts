import { useEffect, type RefObject } from "react";
import { composedTarget } from "../core/shadowRoot";

/** Close a dropdown/popover when clicking outside the ref container. */
export function useClickOutside(ref: RefObject<HTMLElement | null>, open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = composedTarget(e);
      if (ref.current && target && !ref.current.contains(target)) onClose();
    };
    document.addEventListener("mousedown", handler, true);
    return () => document.removeEventListener("mousedown", handler, true);
  }, [open, ref, onClose]);
}
