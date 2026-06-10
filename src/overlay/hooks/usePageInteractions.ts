/**
 * usePageInteractions.ts — page-level pointer interactions while the panel is open
 *
 * Owns the three document-level listeners that respond to interactions with the
 * underlying page (not the panel) while an element is selected:
 *   1. Click-to-switch — clicking another page element re-selects it (with the
 *      Radix popper-dismiss guards from issue #23).
 *   2. Hover highlight — previews which element a click would re-select.
 *   3. Right-click context menu — opens the tuner context menu on page elements.
 *
 * Extracted verbatim from Overlay.tsx — each effect's body and dependency array
 * are preserved exactly. Dependencies are passed in so the hook never reaches
 * back into Overlay's scope.
 */

import { useEffect } from "react";
import type { ActiveModal } from "../shell/overlayTypes";
import { isInsideTunerUI } from "../util";
import { composedTarget } from "../core/shadowRoot";

export interface PageInteractionsDeps {
  selectedEl: Element | null;
  selecting: boolean;
  pinned: boolean;
  handleSelect: (el: Element) => void;
  hoverHighlightRef: React.RefObject<HTMLDivElement | null>;
  setActiveModal: React.Dispatch<React.SetStateAction<ActiveModal>>;
}

export function usePageInteractions({
  selectedEl,
  selecting,
  pinned,
  handleSelect,
  hoverHighlightRef,
  setActiveModal,
}: PageInteractionsDeps) {
  // --- Click-to-switch: clicking a page element while panel is open re-selects ---
  useEffect(() => {
    if (!selectedEl || selecting || pinned) return;

    // Issue #23: Radix Select / Popover dismiss on pointerdown, then unmount
    // the portal synchronously. The follow-up click is delivered to <html>
    // (or whatever is now under the cursor), which would otherwise be picked
    // up here as a fresh element selection. Mirror Radix's own pattern:
    // remember when pointerdown happened while a popper was open, and skip
    // the immediately-following click.
    let radixDismissPending = false;

    const handlePointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      if (document.querySelector("[data-radix-popper-content-wrapper]")) {
        radixDismissPending = true;
      }
    };

    const handlePageClick = (e: MouseEvent) => {
      if (e.button !== 0) return; // Only handle left clicks
      if (radixDismissPending) {
        // This click closes a Radix popper that was open at pointerdown
        // time — not a fresh page selection.
        radixDismissPending = false;
        return;
      }
      // Issue #23 (follow-up): Radix opens its popper synchronously *during*
      // the trigger's pointerdown (between capture and bubble phases). The
      // capture-phase pointerdown listener above sees `radixPopperMounted=false`
      // and never sets the flag, but by the time `click` fires the popper is
      // mounted AND Radix has retargeted the click event to <html> via its
      // pointer-capture release. If any Radix popper is currently mounted at
      // click time, this click is part of a Radix interaction — never a fresh
      // page selection.
      if (document.querySelector("[data-radix-popper-content-wrapper]")) {
        return;
      }
      const target = composedTarget(e);
      if (isInsideTunerUI(target)) return;

      const el = document.elementFromPoint(e.clientX, e.clientY);
      if (!el || isInsideTunerUI(el)) return;

      e.preventDefault();
      e.stopPropagation();
      handleSelect(el);
    };

    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("click", handlePageClick, true);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("click", handlePageClick, true);
    };
  }, [selectedEl, selecting, pinned, handleSelect]);

  // --- Hover highlight: preview which element you'd re-select on click ---
  useEffect(() => {
    if (!selectedEl || selecting || pinned || !hoverHighlightRef.current) return;
    const highlight = hoverHighlightRef.current;

    const handleMouseMove = (e: MouseEvent) => {
      const el = document.elementFromPoint(e.clientX, e.clientY);
      if (
        !el ||
        el === selectedEl ||
        el.contains(selectedEl) ||
        selectedEl.contains(el) ||
        isInsideTunerUI(el)
      ) {
        highlight.style.display = "none";
        return;
      }
      const rect = el.getBoundingClientRect();
      highlight.style.top = `${rect.top}px`;
      highlight.style.left = `${rect.left}px`;
      highlight.style.width = `${rect.width}px`;
      highlight.style.height = `${rect.height}px`;
      highlight.style.display = "block";
    };

    const handleMouseLeave = () => {
      highlight.style.display = "none";
    };

    document.addEventListener("mousemove", handleMouseMove, true);
    document.addEventListener("mouseleave", handleMouseLeave);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove, true);
      document.removeEventListener("mouseleave", handleMouseLeave);
      highlight.style.display = "none";
    };
  }, [selectedEl, selecting, pinned]);

  // --- Right-click context menu on page elements ---
  useEffect(() => {
    if (!selectedEl || selecting) return;

    const handleContextMenu = (e: MouseEvent) => {
      const target = composedTarget(e);
      if (isInsideTunerUI(target)) return;

      e.preventDefault();
      setActiveModal({ type: "contextMenu", x: e.clientX, y: e.clientY });
    };

    document.addEventListener("contextmenu", handleContextMenu, true);
    return () => document.removeEventListener("contextmenu", handleContextMenu, true);
  }, [selectedEl, selecting]);
}
