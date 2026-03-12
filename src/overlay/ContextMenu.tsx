/**
 * ContextMenu.tsx — Right-click context menu for selected elements
 *
 * Provides element-level actions: copy/paste styles, copy CSS/Tailwind,
 * select parent, reset styles, open in editor.
 * Rendered via createPortal to document.body.
 */

import React, { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { ms } from "./timing";

export interface ContextMenuProps {
  x: number;
  y: number;
  element: Element;
  onAction: (action: string) => void;
  onClose: () => void;
}

interface MenuItem {
  id: string;
  label?: string;
  shortcut?: string;
  separator?: boolean;
  disabled?: boolean;
}

const MENU_ITEMS: MenuItem[] = [
  { id: "copy-styles", label: "Copy Styles", shortcut: "\u2318\u2325C" },
  { id: "paste-styles", label: "Paste Styles", shortcut: "\u2318\u2325V" },
  { id: "copy-css", label: "Copy CSS", shortcut: "\u2318C" },
  { id: "copy-tailwind", label: "Copy Tailwind" },
  { id: "separator-1", separator: true },
  { id: "select-parent", label: "Select Parent" },
  { id: "reset-styles", label: "Reset Styles", shortcut: "R" },
  { id: "separator-2", separator: true },
  { id: "open-editor", label: "Open in Editor", disabled: true },
];

const MENU_PAD = 8;

export function ContextMenu({ x, y, element, onAction, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x, y });

  // Build dynamic label for "Select Parent"
  const parentLabel = (() => {
    const parent = element.parentElement;
    if (!parent) return "Select Parent";
    const tag = parent.tagName.toLowerCase();
    const cls = parent.classList[0];
    return cls ? `Select Parent (${tag}.${cls})` : `Select Parent (${tag})`;
  })();

  // Clamp position to viewport after mount
  useEffect(() => {
    const el = menuRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    let nx = x;
    let ny = y;
    if (rect.right > window.innerWidth - MENU_PAD) {
      nx = x - rect.width;
    }
    if (rect.bottom > window.innerHeight - MENU_PAD) {
      ny = y - rect.height;
    }
    if (nx < MENU_PAD) nx = MENU_PAD;
    if (ny < MENU_PAD) ny = MENU_PAD;
    if (nx !== pos.x || ny !== pos.y) {
      setPos({ x: nx, y: ny });
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
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("keydown", handler, true);
    return () => document.removeEventListener("keydown", handler, true);
  }, [onClose]);

  const handleItemClick = useCallback(
    (id: string) => {
      onAction(id);
      onClose();
    },
    [onAction, onClose],
  );

  return createPortal(
    <div
      ref={menuRef}
      role="menu"
      style={{
        position: "fixed",
        left: pos.x,
        top: pos.y,
        minWidth: 180,
        background: "#1e1e1e",
        border: "1px solid rgba(255,255,255,0.12)",
        borderRadius: "8px",
        boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
        zIndex: 2147483647,
        padding: "4px 0",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}
    >
      {MENU_ITEMS.map((item) => {
        if (item.separator) {
          return (
            <div
              key={item.id}
              style={{
                height: 1,
                background: "rgba(255,255,255,0.08)",
                margin: "4px 8px",
              }}
            />
          );
        }

        const label = item.id === "select-parent" ? parentLabel : item.label ?? "";
        const disabled = item.disabled ?? false;

        return (
          <div
            key={item.id}
            role="menuitem"
            aria-disabled={disabled || undefined}
            tabIndex={-1}
            onClick={disabled ? undefined : () => handleItemClick(item.id)}
            style={{
              padding: "6px 12px",
              fontSize: "12px",
              color: disabled ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.8)",
              cursor: disabled ? "default" : "pointer",
              userSelect: "none",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 16,
              transition: `background ${ms("micro")}`,
            }}
            onMouseEnter={disabled ? undefined : (e) => {
              (e.currentTarget as HTMLElement).style.background =
                "rgba(255,255,255,0.08)";
            }}
            onMouseLeave={disabled ? undefined : (e) => {
              (e.currentTarget as HTMLElement).style.background = "transparent";
            }}
          >
            <span>{label}</span>
            {item.shortcut && (
              <span
                style={{
                  color: "rgba(255,255,255,0.3)",
                  fontFamily: "ui-monospace, 'SF Mono', monospace",
                  fontSize: "10px",
                  flexShrink: 0,
                }}
              >
                {item.shortcut}
              </span>
            )}
          </div>
        );
      })}
    </div>,
    document.body,
  );
}
