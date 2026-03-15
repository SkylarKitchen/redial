/**
 * Selector.tsx — click-to-inspect element selection
 *
 * Activated by backtick hotkey. Shows an indigo outline on hover.
 * Click captures the element and passes it up via onSelect callback.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { ms } from "../timing";
import { isNavigableElement, getDisplayClass } from "../util";
import { color, primaryAlpha, font, zIndex } from "../theme";

interface SelectorProps {
  active: boolean;
  onSelect: (el: Element) => void;
  onCancel: () => void;
}

export function Selector({ active, onSelect, onCancel }: SelectorProps) {
  const [hovered, setHovered] = useState<Element | null>(null);
  const outlineRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLDivElement>(null);
  const candidatesRef = useRef<Element[]>([]);
  const focusIdxRef = useRef(-1);

  // Position the outline over the hovered element (updates on scroll/resize)
  useEffect(() => {
    if (!active || !hovered || !outlineRef.current) return;

    const outline = outlineRef.current;

    const updatePosition = () => {
      const rect = hovered.getBoundingClientRect();
      outline.style.top = `${rect.top}px`;
      outline.style.left = `${rect.left}px`;
      outline.style.width = `${rect.width}px`;
      outline.style.height = `${rect.height}px`;
      outline.style.display = "block";

      if (labelRef.current) {
        const tag = hovered.tagName.toLowerCase();
        const cls = getDisplayClass(hovered);
        const dims = `${Math.round(rect.width)}\u00d7${Math.round(rect.height)}`;
        const label = labelRef.current;
        label.textContent = cls ? `${tag}.${cls}  ${dims}` : `${tag}  ${dims}`;
        // Position above element, flip below when near top
        if (rect.top < 28) {
          label.style.top = `${rect.bottom + 4}px`;
        } else {
          label.style.top = `${rect.top - 22}px`;
        }
        label.style.left = `${rect.left}px`;
        label.style.display = "block";
      }
    };

    updatePosition();
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);

    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
      outline.style.display = "none";
      if (labelRef.current) labelRef.current.style.display = "none";
    };
  }, [active, hovered]);

  // Build candidate list for keyboard selection when active
  useEffect(() => {
    if (!active) {
      candidatesRef.current = [];
      focusIdxRef.current = -1;
      return;
    }
    const all = document.querySelectorAll("*");
    candidatesRef.current = Array.from(all).filter(
      (el) => isNavigableElement(el) && el instanceof HTMLElement,
    );
  }, [active]);

  // Mouse tracking + keyboard selection
  useEffect(() => {
    if (!active) return;

    const handleMouseMove = (e: MouseEvent) => {
      const el = document.elementFromPoint(e.clientX, e.clientY);
      if (!el) return;

      // Don't select our own UI elements or third-party tool overlays
      if (
        el.closest(".__tuner-root") ||
        el.closest(".__tuner-selector-outline") ||
        el.closest("[data-agentation-root]") ||
        el.closest("[data-feedback-toolbar]") ||
        el.closest("[data-annotation-marker]")
      ) {
        return;
      }

      setHovered(el);
    };

    const handleClick = (e: MouseEvent) => {
      const el = document.elementFromPoint(e.clientX, e.clientY);
      if (!el || el.closest(".__tuner-root") || el.closest("[data-agentation-root]") || el.closest("[data-feedback-toolbar]") || el.closest("[data-annotation-marker]")) return;

      // Only suppress propagation for actual page element clicks —
      // tuner UI clicks (FAB, panel) must bubble through to React handlers
      e.preventDefault();
      e.stopPropagation();
      onSelect(el);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onCancel();
        return;
      }

      // Tab / Shift+Tab cycles through page elements (keyboard-only selection)
      if (e.key === "Tab") {
        e.preventDefault();
        const list = candidatesRef.current;
        if (list.length === 0) return;
        const idx = focusIdxRef.current;
        const next = e.shiftKey
          ? (idx - 1 + list.length) % list.length
          : (idx + 1) % list.length;
        focusIdxRef.current = next;
        setHovered(list[next]);
        return;
      }

      // Enter selects the currently focused candidate
      if (e.key === "Enter" && focusIdxRef.current >= 0) {
        e.preventDefault();
        const el = candidatesRef.current[focusIdxRef.current];
        if (el) onSelect(el);
        return;
      }
    };

    document.addEventListener("mousemove", handleMouseMove, true);
    document.addEventListener("click", handleClick, true);
    document.addEventListener("keydown", handleKeyDown, true);

    // Set cursor (save original to restore later)
    const prevCursor = document.body.style.cursor;
    document.body.style.cursor = "crosshair";

    return () => {
      document.removeEventListener("mousemove", handleMouseMove, true);
      document.removeEventListener("click", handleClick, true);
      document.removeEventListener("keydown", handleKeyDown, true);
      document.body.style.cursor = prevCursor;
      setHovered(null);
    };
  }, [active, onSelect, onCancel]);

  if (!active) return null;

  return (
    // Indigo outline that follows the hovered element.
    // No full-viewport overlay — document-level capture listeners handle events.
    // The overlay div was removed because elementFromPoint() was returning it
    // instead of the actual app elements underneath.
    <>
      <div
        ref={outlineRef}
        className="__tuner-selector-outline"
        style={{
          position: "fixed",
          display: "none",
          pointerEvents: "none",
          zIndex: zIndex.overlay,
          border: `1.5px solid ${color.primary}`,
          borderRadius: "2px",
          boxShadow: `0 0 0 1px ${primaryAlpha(0.3)}`,
          transition: `all ${ms("instant")} ease-out`,
        }}
      />
      <div
        ref={labelRef}
        style={{
          position: "fixed",
          display: "none",
          pointerEvents: "none",
          zIndex: zIndex.max,
          background: color.primary,
          color: color.primaryForeground,
          fontSize: "10px",
          fontFamily: font.sans,
          padding: "2px 6px",
          borderRadius: "2px",
          whiteSpace: "nowrap",
          maxWidth: "200px",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      />
    </>
  );
}
