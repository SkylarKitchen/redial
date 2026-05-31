/**
 * DetailContextMenu.tsx — Right-click context menu for the variables detail pane.
 */

import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import type { CSSVariable } from "./discoverVariables";
import type { TokenCollection } from "./tokenCollections";
import { useFocusTrap } from "../hooks/useFocusTrap";
import {
  text,
  border,
  surface,
  color,
  shadow,
  zIndex,
} from "../theme";
import { ms } from "../timing";

// ─── Context Menu Item ──────────────────────────────────────────────

function ContextMenuItem({ label, onClick }: { label: string; onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      role="menuitem"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); }
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
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

// ─── Context Menu ───────────────────────────────────────────────────

export interface ContextMenuState {
  x: number;
  y: number;
  variable: CSSVariable;
}

export function DetailContextMenu({
  x,
  y,
  variable,
  onClose,
  onRename,
  onDuplicate,
  onDelete,
  collections,
  currentCollectionId,
  onMoveToCollection,
  onUnassign,
}: {
  x: number;
  y: number;
  variable: CSSVariable;
  onClose: () => void;
  onRename: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  collections: TokenCollection[];
  currentCollectionId: string | null;
  onMoveToCollection: (collectionId: string) => void;
  onUnassign: () => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  useFocusTrap(menuRef, true);

  // Viewport-clamp
  useEffect(() => {
    const el = menuRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    let nx = x, ny = y;
    if (rect.right > window.innerWidth - 8) nx = window.innerWidth - rect.width - 8;
    if (rect.bottom > window.innerHeight - 8) ny = window.innerHeight - rect.height - 8;
    if (nx < 8) nx = 8;
    if (ny < 8) ny = 8;
    if (nx !== x || ny !== y) {
      el.style.left = `${nx}px`;
      el.style.top = `${ny}px`;
    }
  }, [x, y]);

  // Click-outside close
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler, true);
    return () => document.removeEventListener("mousedown", handler, true);
  }, [onClose]);

  // Escape close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.stopPropagation(); onClose(); }
    };
    document.addEventListener("keydown", handler, true);
    return () => document.removeEventListener("keydown", handler, true);
  }, [onClose]);

  const items: Array<{ label: string; action: () => void; separator?: boolean }> = [
    { label: "Rename", action: () => { onRename(); onClose(); } },
    { label: "Duplicate", action: () => { onDuplicate(); onClose(); } },
    { label: "Delete", action: () => { onDelete(); onClose(); } },
    { label: "", action: () => {}, separator: true },
    { label: "Copy Name", action: () => { navigator.clipboard.writeText(variable.name); onClose(); } },
    { label: "Copy Value", action: () => { navigator.clipboard.writeText(variable.value); onClose(); } },
    { label: "Copy Declaration", action: () => { navigator.clipboard.writeText(`${variable.name}: ${variable.value};`); onClose(); } },
  ];

  // Collection move items
  if (collections.length > 0) {
    items.push({ label: "", action: () => {}, separator: true });
    for (const c of collections) {
      if (c.id === currentCollectionId) continue;
      items.push({
        label: `Move to ${c.name}`,
        action: () => { onMoveToCollection(c.id); onClose(); },
      });
    }
    if (currentCollectionId) {
      items.push({
        label: "Remove from collection",
        action: () => { onUnassign(); onClose(); },
      });
    }
  }

  return createPortal(
    <div
      ref={menuRef}
      data-tuner-portal
      style={{
        position: "fixed",
        zIndex: zIndex.max,
        minWidth: 170,
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
      {items.map((item, i) =>
        item.separator ? (
          <div key={i} style={{ height: 1, background: border.default, margin: "4px 0" }} />
        ) : (
          <ContextMenuItem key={item.label} label={item.label} onClick={item.action} />
        ),
      )}
    </div>,
    document.body,
  );
}
