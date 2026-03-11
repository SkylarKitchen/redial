/**
 * Selector.tsx — click-to-inspect element selection
 *
 * Activated by backtick hotkey. Shows an indigo outline on hover.
 * Click captures the element and passes it up via onSelect callback.
 */

import { useState, useEffect, useCallback, useRef } from "react";

interface SelectorProps {
  active: boolean;
  onSelect: (el: Element) => void;
  onCancel: () => void;
}

export function Selector({ active, onSelect, onCancel }: SelectorProps) {
  const [hovered, setHovered] = useState<Element | null>(null);
  const outlineRef = useRef<HTMLDivElement>(null);

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
    };

    updatePosition();
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);

    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
      outline.style.display = "none";
    };
  }, [active, hovered]);

  // Mouse tracking
  useEffect(() => {
    if (!active) return;

    const handleMouseMove = (e: MouseEvent) => {
      const el = document.elementFromPoint(e.clientX, e.clientY);
      if (!el) return;

      // Don't select our own UI elements
      if (
        el.closest(".__tuner-root") ||
        el.closest(".__tuner-selector-outline")
      ) {
        return;
      }

      setHovered(el);
    };

    const handleClick = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const el = document.elementFromPoint(e.clientX, e.clientY);
      if (!el || el.closest(".__tuner-root")) return;

      onSelect(el);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onCancel();
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
    <div
      ref={outlineRef}
      className="__tuner-selector-outline"
      style={{
        position: "fixed",
        display: "none",
        pointerEvents: "none",
        zIndex: 2147483646,
        border: "1.5px solid #6366f1",
        borderRadius: "2px",
        boxShadow: "0 0 0 1px rgba(99, 102, 241, 0.3)",
        transition: "all 50ms ease-out",
      }}
    />
  );
}
