/**
 * PropertyContextMenu.tsx — Right-click context menu for CSS property rows
 *
 * Rendered via createPortal to document.body. Provides:
 * - Reset to Default
 * - Copy Value
 * - Copy CSS Declaration
 */

import React, { useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { resetProp } from "./apply";

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

const MENU_MIN_WIDTH = 160;
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
      style={{
        position: "fixed",
        left: x,
        top: y,
        minWidth: MENU_MIN_WIDTH,
        background: "#252525",
        border: "1px solid rgba(255,255,255,0.12)",
        borderRadius: "6px",
        boxShadow: "0 4px 16px rgba(0,0,0,0.5), 0 1px 4px rgba(0,0,0,0.3)",
        zIndex: 999999,
        padding: "4px 0",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}
    >
      {items.map((item) => (
        <MenuItem key={item.label} label={item.label} onClick={item.action} />
      ))}
    </div>,
    document.body
  );
}

function MenuItem({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <div
      role="menuitem"
      tabIndex={-1}
      onClick={onClick}
      style={{
        padding: "6px 12px",
        fontSize: "12px",
        color: "rgba(255,255,255,0.8)",
        cursor: "pointer",
        userSelect: "none",
        transition: "background 60ms",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.08)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.background = "transparent";
      }}
    >
      {label}
    </div>
  );
}
