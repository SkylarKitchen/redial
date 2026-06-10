/**
 * CollectionSidebar.tsx — Left pane of the master-detail variables panel
 *
 * Shows user-defined collections + auto-collections, with create/rename/delete
 * and a collapsible sidebar that persists state to localStorage.
 */

import React, { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { Plus, ChevronLeft, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import type { TokenCollection } from "./tokenCollections";
import type { AutoCollection } from "./autoCollections";
import { useFocusTrap } from "../hooks/useFocusTrap";
import { usePortalTarget } from "../hooks/usePortalTarget";
import { composedTarget } from "../core/shadowRoot";
import { text, border, surface, font, color, shadow, zIndex } from "../theme";
import { ms } from "../timing";

// ─── Constants ────────────────────────────────────────────────────────

export const SIDEBAR_WIDTH = 170;
const COLLAPSED_WIDTH = 32;
const STORAGE_KEY = "__tuner_vars_sidebar_collapsed";

// ─── Props ────────────────────────────────────────────────────────────

export interface CollectionSidebarProps {
  collections: TokenCollection[];
  autoCollections: AutoCollection[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAddCollection: (name: string) => void;
  onRenameCollection: (id: string, name: string) => void;
  onDeleteCollection: (id: string) => void;
  onClose: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────

function loadCollapsed(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function saveCollapsed(v: boolean) {
  try {
    localStorage.setItem(STORAGE_KEY, String(v));
  } catch {
    // localStorage full — silently ignore
  }
}

// ─── Styles ───────────────────────────────────────────────────────────

const headerStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "8px 8px 6px",
  borderBottom: `1px solid ${border.subtle}`,
  flexShrink: 0,
};

const headerLabelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  fontFamily: font.sans,
  color: text.primary,
  userSelect: "none",
};

const headerButtonStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: 22,
  height: 22,
  border: "none",
  background: "transparent",
  color: text.label,
  cursor: "pointer",
  borderRadius: 3,
  outline: "none",
  transition: `background ${ms("fast")} ease`,
};

const listStyle: React.CSSProperties = {
  flex: 1,
  overflowY: "auto",
  overflowX: "hidden",
  padding: "4px 0",
};

const collectionRowStyle = (
  selected: boolean,
  hovered: boolean,
): React.CSSProperties => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "4px 8px",
  cursor: "pointer",
  borderRadius: 3,
  margin: "0 4px",
  transition: `background ${ms("fast")} ease`,
  background: selected
    ? surface.hover
    : hovered
      ? surface.subtle
      : "transparent",
});

const collectionNameStyle: React.CSSProperties = {
  fontSize: 11,
  fontFamily: font.sans,
  color: text.primary,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  flex: 1,
  lineHeight: "20px",
};

const autoLabelStyle: React.CSSProperties = {
  fontSize: 9,
  fontFamily: font.sans,
  color: text.hint,
  marginLeft: 4,
  flexShrink: 0,
  userSelect: "none",
};

const dividerStyle: React.CSSProperties = {
  height: 1,
  background: border.subtle,
  margin: "4px 8px",
};

const inlineInputStyle: React.CSSProperties = {
  width: "100%",
  fontSize: 11,
  fontFamily: font.sans,
  border: `1px solid ${color.primary}`,
  background: surface.subtle,
  borderRadius: 3,
  padding: "2px 6px",
  outline: "none",
  boxSizing: "border-box",
  height: 22,
  color: text.primary,
};

const moreButtonStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: 18,
  height: 18,
  border: "none",
  background: "transparent",
  color: text.hint,
  cursor: "pointer",
  borderRadius: 3,
  outline: "none",
  flexShrink: 0,
  transition: `background ${ms("fast")} ease`,
};

const menuStyle: React.CSSProperties = {
  position: "fixed",
  background: color.popover,
  border: `1px solid ${border.default}`,
  borderRadius: 6,
  boxShadow: shadow.dropdown,
  padding: "4px 0",
  zIndex: zIndex.max,
  minWidth: 120,
};

const menuItemStyle = (hovered: boolean): React.CSSProperties => ({
  display: "flex",
  alignItems: "center",
  gap: 6,
  padding: "5px 10px",
  fontSize: 11,
  fontFamily: font.sans,
  color: text.primary,
  cursor: "pointer",
  background: hovered ? surface.hover : "transparent",
  border: "none",
  width: "100%",
  outline: "none",
  transition: `background ${ms("fast")} ease`,
});

const menuItemDeleteStyle = (hovered: boolean): React.CSSProperties => ({
  ...menuItemStyle(hovered),
  color: color.destructive,
});

const collapsedStyle: React.CSSProperties = {
  width: COLLAPSED_WIDTH,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  paddingTop: 8,
  borderRight: `1px solid ${border.subtle}`,
  flexShrink: 0,
};

const expandButtonStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: 22,
  height: 22,
  border: "none",
  background: "transparent",
  color: text.label,
  cursor: "pointer",
  borderRadius: 3,
  outline: "none",
  transition: `background ${ms("fast")} ease`,
};

// ─── Context Menu (portal) ────────────────────────────────────────────

interface ContextMenuProps {
  x: number;
  y: number;
  onRename: () => void;
  onDelete: () => void;
  onClose: () => void;
}

function ContextMenu({ x, y, onRename, onDelete, onClose }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const portalTarget = usePortalTarget();
  useFocusTrap(ref, true);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = composedTarget(e);
      if (ref.current && target && !ref.current.contains(target)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  // Adjust position to stay within viewport
  const adjustedY = Math.min(y, window.innerHeight - 80);
  const adjustedX = Math.min(x, window.innerWidth - 140);

  return createPortal(
    <div
      ref={ref}
      data-tuner-portal
      style={{ ...menuStyle, left: adjustedX, top: adjustedY }}
      role="menu"
    >
      <button
        role="menuitem"
        style={menuItemStyle(hoveredItem === "rename")}
        onMouseEnter={() => setHoveredItem("rename")}
        onMouseLeave={() => setHoveredItem(null)}
        onClick={() => {
          onRename();
          onClose();
        }}
      >
        <Pencil size={12} />
        Rename
      </button>
      <button
        role="menuitem"
        style={menuItemDeleteStyle(hoveredItem === "delete")}
        onMouseEnter={() => setHoveredItem("delete")}
        onMouseLeave={() => setHoveredItem(null)}
        onClick={() => {
          onDelete();
          onClose();
        }}
      >
        <Trash2 size={12} />
        Delete
      </button>
    </div>,
    portalTarget,
  );
}

// ─── Inline Input ─────────────────────────────────────────────────────

interface InlineInputProps {
  initialValue: string;
  onCommit: (value: string) => void;
  onCancel: () => void;
}

function InlineInput({ initialValue, onCommit, onCancel }: InlineInputProps) {
  const ref = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);

  const commit = useCallback(() => {
    const trimmed = value.trim();
    if (trimmed && trimmed !== initialValue) {
      onCommit(trimmed);
    } else {
      onCancel();
    }
  }, [value, initialValue, onCommit, onCancel]);

  return (
    <input
      ref={ref}
      style={inlineInputStyle}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") commit();
        if (e.key === "Escape") onCancel();
        e.stopPropagation();
      }}
      onBlur={commit}
    />
  );
}

// ─── Collection Row ───────────────────────────────────────────────────

interface CollectionRowProps {
  id: string;
  name: string;
  selected: boolean;
  isAuto: boolean;
  isRenaming: boolean;
  onSelect: () => void;
  onRename: (name: string) => void;
  onCancelRename: () => void;
  onOpenMenu: (id: string, x: number, y: number) => void;
}

function CollectionRow({
  id,
  name,
  selected,
  isAuto,
  isRenaming,
  onSelect,
  onRename,
  onCancelRename,
  onOpenMenu,
}: CollectionRowProps) {
  const [hovered, setHovered] = useState(false);

  if (isRenaming) {
    return (
      <div style={{ ...collectionRowStyle(selected, false), padding: "2px 8px" }}>
        <InlineInput
          initialValue={name}
          onCommit={onRename}
          onCancel={onCancelRename}
        />
      </div>
    );
  }

  return (
    <div
      style={collectionRowStyle(selected, hovered)}
      onClick={onSelect}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <span style={collectionNameStyle}>{name}</span>
      {isAuto && <span style={autoLabelStyle}>auto</span>}
      {!isAuto && hovered && (
        <button
          style={moreButtonStyle}
          onClick={(e) => {
            e.stopPropagation();
            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
            onOpenMenu(id, rect.right, rect.bottom);
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background = surface.hover;
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = "transparent";
          }}
        >
          <MoreHorizontal size={14} />
        </button>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────

export function CollectionSidebar({
  collections,
  autoCollections,
  selectedId,
  onSelect,
  onAddCollection,
  onRenameCollection,
  onDeleteCollection,
  onClose,
}: CollectionSidebarProps) {
  const [collapsed, setCollapsed] = useState(loadCollapsed);
  const [adding, setAdding] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [menu, setMenu] = useState<{ id: string; x: number; y: number } | null>(null);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      saveCollapsed(next);
      return next;
    });
  }, []);

  const handleAdd = useCallback(
    (name: string) => {
      onAddCollection(name);
      setAdding(false);
    },
    [onAddCollection],
  );

  const handleRename = useCallback(
    (name: string) => {
      if (renamingId) {
        onRenameCollection(renamingId, name);
        setRenamingId(null);
      }
    },
    [renamingId, onRenameCollection],
  );

  const handleOpenMenu = useCallback((id: string, x: number, y: number) => {
    setMenu({ id, x, y });
  }, []);

  const handleCloseMenu = useCallback(() => {
    setMenu(null);
  }, []);

  // ── Collapsed state ──

  if (collapsed) {
    return (
      <div style={collapsedStyle}>
        <button
          style={expandButtonStyle}
          onClick={toggleCollapsed}
          title="Expand sidebar"
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background = surface.hover;
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = "transparent";
          }}
        >
          <ChevronLeft size={14} style={{ transform: "rotate(180deg)" }} />
        </button>
      </div>
    );
  }

  // ── Expanded state ──

  const hasManual = collections.length > 0;
  const hasAuto = autoCollections.length > 0;

  return (
    <div
      style={{
        width: SIDEBAR_WIDTH,
        display: "flex",
        flexDirection: "column",
        borderRight: `1px solid ${border.subtle}`,
        flexShrink: 0,
        height: "100%",
      }}
    >
      {/* Header */}
      <div style={headerStyle}>
        <span style={headerLabelStyle}>Variables</span>
        <div style={{ display: "flex", gap: 2 }}>
          <button
            style={headerButtonStyle}
            title="New collection"
            onClick={() => setAdding(true)}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = surface.hover;
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = "transparent";
            }}
          >
            <Plus size={14} />
          </button>
          <button
            style={headerButtonStyle}
            title="Collapse sidebar"
            onClick={toggleCollapsed}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = surface.hover;
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = "transparent";
            }}
          >
            <ChevronLeft size={14} />
          </button>
        </div>
      </div>

      {/* Collection list */}
      <div style={listStyle}>
        {/* Inline add input */}
        {adding && (
          <div style={{ padding: "2px 8px", margin: "0 4px" }}>
            <InlineInput
              initialValue=""
              onCommit={handleAdd}
              onCancel={() => setAdding(false)}
            />
          </div>
        )}

        {/* User-defined collections */}
        {collections.map((c) => (
          <CollectionRow
            key={c.id}
            id={c.id}
            name={c.name}
            selected={selectedId === c.id}
            isAuto={false}
            isRenaming={renamingId === c.id}
            onSelect={() => onSelect(c.id)}
            onRename={handleRename}
            onCancelRename={() => setRenamingId(null)}
            onOpenMenu={handleOpenMenu}
          />
        ))}

        {/* Divider between manual and auto */}
        {hasManual && hasAuto && <div style={dividerStyle} />}

        {/* Auto-collections */}
        {autoCollections.map((c) => (
          <CollectionRow
            key={c.id}
            id={c.id}
            name={c.name}
            selected={selectedId === c.id}
            isAuto={true}
            isRenaming={false}
            onSelect={() => onSelect(c.id)}
            onRename={() => {}}
            onCancelRename={() => {}}
            onOpenMenu={() => {}}
          />
        ))}
      </div>

      {/* Context menu */}
      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          onRename={() => setRenamingId(menu.id)}
          onDelete={() => {
            onDeleteCollection(menu.id);
            handleCloseMenu();
          }}
          onClose={handleCloseMenu}
        />
      )}
    </div>
  );
}
