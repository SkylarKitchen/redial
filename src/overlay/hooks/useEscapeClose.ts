/**
 * hooks/useEscapeClose.ts — Close a popup layer on Escape.
 *
 * Document-level capture listener (same semantics as SwatchColorPicker's
 * inline handler): fires before React handlers and stops propagation so the
 * topmost layer closes without also dismissing whatever is underneath.
 * Active only while `open` is true.
 */
import { useEffect, useRef } from "react";

export function useEscapeClose(open: boolean, onClose: () => void): void {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onCloseRef.current();
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [open]);
}
