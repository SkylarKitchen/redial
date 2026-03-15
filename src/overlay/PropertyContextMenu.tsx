/**
 * PropertyContextMenu.tsx — Right-click context menu for CSS property rows
 *
 * Rendered via createPortal to document.body. Provides:
 * - Reset to Default
 * - Copy Value
 * - Copy CSS Declaration
 */

import React, { useEffect, useRef, useCallback, useState } from "react";
import { createPortal } from "react-dom";
import { resetProp } from "./core/apply";
import { useFocusTrap } from "./useFocusTrap";
import { color, border, surface, shadow, text, font, zIndex } from "./theme";
import { ms } from "./timing";

export interface ContextMenuState {
  x: number;
  y: number;
  property: string;
  value: string;
}

export interface PropertyContextMenuProps {
  x: number;
  y: number;
  property: string;
  value: string;
  element: Element;
  onClose: () => void;
  onReset?: () => void;
}

const MENU_PAD = 8;

export function PropertyContextMenu({
  x,
  y,
  property,
  value,
  element,
  onClose,
  onReset,
}: PropertyContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  useFocusTrap(menuRef, true);

  // Clamp position to viewport after mount
  useEffect(() => {
    const el = menuRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    let nx = x;
    let ny = y;
    if (rect.right > window.innerWidth - MENU_PAD) {
      nx = window.innerWidth - rect.width - MENU_PAD;
    }
    if (rect.bottom > window.innerHeight - MENU_PAD) {
      ny = window.innerHeight - rect.height - MENU_PAD;
    }
    if (nx < MENU_PAD) nx = MENU_PAD;
    if (ny < MENU_PAD) ny = MENU_PAD;
    if (nx !== x || ny !== y) {
      el.style.left = `${nx}px`;
      el.style.top = `${ny}px`;
    }
  }, [x, y]);

  // Close on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler, true);
    return () => document.removeEventListener("mousedown", handler, true);
  }, [onClose]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("keydown", handler, true);
    return () => document.removeEventListener("keydown", handler, true);
  }, [onClose]);

  const handleReset = useCallback(() => {
    resetProp(element, property);
    onReset?.();
    onClose();
  }, [element, property, onReset, onClose]);

  const handleCopyValue = useCallback(() => {
    navigator.clipboard.writeText(value);
    onClose();
  }, [value, onClose]);

  const handleCopyDeclaration = useCallback(() => {
    navigator.clipboard.writeText(`${property}: ${value};`);
    onClose();
  }, [property, value, onClose]);

  const items: Array<{ label: string; action: () => void }> = [
    { label: "Reset to Default", action: handleReset },
    { label: "Copy Value", action: handleCopyValue },
    { label: "Copy Declaration", action: handleCopyDeclaration },
  ];

  return createPortal(
    <div
      ref={menuRef}
      data-tuner-portal
      style={{
        position: "fixed",
        zIndex: zIndex.max,
        minWidth: 160,
        background: color.popover,
        color: text.primary,
        border: `1px solid ${border.default}`,
        borderRadius: 6,
        boxShadow: shadow.dropdown,
        padding: "4px 0",
        overflow: "hidden",
        left: x,
        top: y,
      }}
    >
      {items.map((item) => (
        <PropertyMenuItem key={item.label} label={item.label} onClick={item.action} />
      ))}
    </div>,
    document.body
  );
}

function PropertyMenuItem({ label, onClick }: { label: string; onClick: () => void }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      role="menuitem"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "6px 12px",
        fontSize: 12,
        cursor: "pointer",
        background: hovered ? surface.hover : "transparent",
        outline: "none",
        userSelect: "none",
        transition: `background ${ms("fast")}`,
      }}
    >
      {label}
    </div>
  );
}
