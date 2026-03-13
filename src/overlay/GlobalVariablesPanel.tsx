/**
 * GlobalVariablesPanel.tsx — Global design system variables panel
 *
 * Shows ALL CSS custom properties from :root/html with:
 * - Category or Prefix grouping (toggle)
 * - Add / Duplicate / Delete / Rename via CRUD APIs
 * - Right-click context menu
 * - Drag-to-reorder within groups
 */

import React, { useState, useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { X, Plus, Copy, Trash2, FolderPlus } from "lucide-react";
import { useTokenCollections, type TokenCollection } from "./tokenCollections";
import {
  discoverAllVariables,
  groupByCategory,
  groupByPrefix,
  parseLength,
  replaceVarReferences,
  type CSSVariable,
  type VarCategory,
  type PrefixGroup,
} from "./discoverVariables";
import {
  applyCustomProperty,
  addCustomProperty,
  removeCustomProperty,
  renameCustomProperty,
  isCustomPropertyDirty,
  subscribeOverrides,
  getOverrideSnapshot,
} from "./apply";
import { Section, ColorRow } from "./controls";
import { UnitSelector } from "./UnitSelector";
import { WebflowSegmentedControl } from "./WebflowSegmentedControl";
import { DragHandle } from "./DragHandle";
import { useDragReorder } from "./useDragReorder";
import { useFocusTrap } from "./useFocusTrap";
import { ROW, MINI_ACTION_BUTTON } from "./panelStyles";
import { text, border, surface, font, color, shadow, labelIndicator, labelHighlight } from "./theme";
import { ms } from "./timing";
import type { IndicatorType } from "./theme";

// ─── Constants ────────────────────────────────────────────────────────

const UNIT_OPTIONS = ["px", "%", "em", "rem", "vw", "vh"];
const STORAGE_VIEW_KEY = "__tuner_vars_view";
const STORAGE_ORDER_KEY = "__tuner_vars_order";

const CATEGORY_LABELS: Record<VarCategory, string> = {
  colors: "Colors",
  spacing: "Spacing",
  typography: "Typography",
  other: "Other",
};

const VAR_LABEL_STYLE: React.CSSProperties = {
  width: 120,
  fontSize: 11,
  fontFamily: font.mono,
  flexShrink: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  display: "inline-flex",
  alignItems: "center",
};

type ViewMode = "category" | "prefix" | "collection";

// ─── Ordering Persistence ─────────────────────────────────────────────

function loadOrder(): Map<string, number> {
  try {
    const raw = localStorage.getItem(STORAGE_ORDER_KEY);
    if (!raw) return new Map();
    return new Map(Object.entries(JSON.parse(raw)) as [string, number][]);
  } catch { return new Map(); }
}

function saveOrder(order: Map<string, number>) {
  try {
    localStorage.setItem(STORAGE_ORDER_KEY, JSON.stringify(Object.fromEntries(order)));
  } catch { /* quota exceeded */ }
}

function applyOrder(vars: CSSVariable[], order: Map<string, number>): CSSVariable[] {
  if (order.size === 0) return vars;
  return [...vars].sort((a, b) => {
    const oa = order.get(a.name) ?? Infinity;
    const ob = order.get(b.name) ?? Infinity;
    if (oa !== Infinity || ob !== Infinity) return oa - ob;
    return a.name.localeCompare(b.name);
  });
}

// ─── Inline Add Row ───────────────────────────────────────────────────

function InlineAddRow({
  prefix,
  onAdd,
  onCancel,
}: {
  prefix?: string;
  onAdd: (name: string, value: string) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(prefix ? `--${prefix}-` : "--");
  const [value, setValue] = useState("");
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    nameRef.current?.focus();
    const len = name.length;
    nameRef.current?.setSelectionRange(len, len);
  }, []);

  const handleSubmit = useCallback(() => {
    const trimName = name.trim();
    const trimVal = value.trim();
    if (!trimName || !trimVal) return;
    onAdd(trimName, trimVal);
  }, [name, value, onAdd]);

  const inputStyle: React.CSSProperties = {
    flex: 1,
    minWidth: 0,
    height: 22,
    background: surface.subtle,
    border: `1px solid ${color.primary}`,
    borderRadius: 3,
    padding: "0 6px",
    fontSize: 10,
    fontFamily: font.mono,
    color: text.primary,
    outline: "none",
    boxSizing: "border-box",
  };

  return (
    <div style={{ ...ROW, gap: 4, padding: "4px 12px" }}>
      <input
        ref={nameRef}
        type="text"
        placeholder="--name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleSubmit();
          if (e.key === "Escape") { e.stopPropagation(); onCancel(); }
        }}
        style={{ ...inputStyle, flex: 1.2 }}
      />
      <input
        type="text"
        placeholder="value"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleSubmit();
          if (e.key === "Escape") { e.stopPropagation(); onCancel(); }
        }}
        style={inputStyle}
      />
    </div>
  );
}

// ─── Context Menu ─────────────────────────────────────────────────────

interface VarContextMenuState {
  x: number;
  y: number;
  variable: CSSVariable;
}

function VariableContextMenu({
  x,
  y,
  variable,
  onClose,
  onRename,
  onDuplicate,
  onDelete,
}: {
  x: number;
  y: number;
  variable: CSSVariable;
  onClose: () => void;
  onRename: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  useFocusTrap(menuRef, true);

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

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler, true);
    return () => document.removeEventListener("mousedown", handler, true);
  }, [onClose]);

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

  return createPortal(
    <div
      ref={menuRef}
      data-tuner-portal
      style={{
        position: "fixed",
        zIndex: 2147483647,
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
        )
      )}
    </div>,
    document.body,
  );
}

function ContextMenuItem({ label, onClick }: { label: string; onClick: () => void }) {
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

// ─── Variable Row ─────────────────────────────────────────────────────

function GlobalVariableRow({
  variable,
  hovered,
  renaming,
  onHoverChange,
  onContextMenu,
  onDuplicate,
  onDelete,
  onRenameCommit,
  onRenameCancel,
  dragHandleProps,
  isDragging,
  showDragHandle,
}: {
  variable: CSSVariable;
  hovered: boolean;
  renaming: boolean;
  onHoverChange: (h: boolean) => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onRenameCommit: (newName: string) => void;
  onRenameCancel: () => void;
  dragHandleProps?: { onPointerDown: (e: React.PointerEvent) => void; style: React.CSSProperties };
  isDragging?: boolean;
  showDragHandle: boolean;
}) {
  const [draft, setDraft] = useState(variable.value);
  const [focused, setFocused] = useState(false);
  const [renameDraft, setRenameDraft] = useState(variable.name);
  const inputRef = useRef<HTMLInputElement>(null);
  const renameRef = useRef<HTMLInputElement>(null);
  const dirty = isCustomPropertyDirty(variable.name);

  useEffect(() => {
    if (!focused) setDraft(variable.value);
  }, [variable.value, focused]);

  useEffect(() => {
    if (renaming) {
      setRenameDraft(variable.name);
      setTimeout(() => renameRef.current?.select(), 0);
    }
  }, [renaming, variable.name]);

  const commit = useCallback(
    (newValue: string) => {
      const trimmed = newValue.trim();
      if (!trimmed) return;
      applyCustomProperty(document.documentElement, variable.name, trimmed);
    },
    [variable.name],
  );

  const indicator: IndicatorType = dirty ? "modified" : "none";
  const label = variable.name.replace(/^--/, "");
  const indicatorStyle = indicator !== "none"
    ? { background: labelIndicator.modified.bg, color: labelIndicator.modified.text, ...labelHighlight }
    : { color: text.label };

  const hoverActions = hovered && !renaming ? (
    <div style={{ ...VAR_LABEL_STYLE, justifyContent: "flex-end", gap: 2 }}>
      <button
        onClick={(e) => { e.stopPropagation(); onDuplicate(); }}
        title="Duplicate"
        style={{
          width: 18, height: 18, border: "none", background: "transparent",
          borderRadius: 3, cursor: "pointer", display: "flex",
          alignItems: "center", justifyContent: "center", color: text.hint,
          opacity: 0.7, transition: `opacity ${ms("fast")}`,
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = "1"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = "0.7"; }}
      >
        <Copy size={11} />
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        title="Delete"
        style={{
          width: 18, height: 18, border: "none", background: "transparent",
          borderRadius: 3, cursor: "pointer", display: "flex",
          alignItems: "center", justifyContent: "center", color: text.hint,
          opacity: 0.7, transition: `opacity ${ms("fast")}`,
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = "1"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = "0.7"; }}
      >
        <Trash2 size={11} />
      </button>
    </div>
  ) : null;

  // Rename mode
  if (renaming) {
    return (
      <div
        style={ROW}
        onMouseEnter={() => onHoverChange(true)}
        onMouseLeave={() => onHoverChange(false)}
      >
        <input
          ref={renameRef}
          type="text"
          value={renameDraft}
          onChange={(e) => setRenameDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onRenameCommit(renameDraft.trim());
            if (e.key === "Escape") { e.stopPropagation(); onRenameCancel(); }
          }}
          onBlur={() => onRenameCancel()}
          style={{
            flex: 1, height: 22, background: surface.subtle,
            border: `1px solid ${color.primary}`, borderRadius: 3,
            padding: "0 6px", fontSize: 10, fontFamily: font.mono,
            color: text.primary, outline: "none", boxSizing: "border-box",
          }}
        />
      </div>
    );
  }

  const rowContent = (labelNode: React.ReactNode, controlNode: React.ReactNode) => (
    <div
      style={ROW}
      onMouseEnter={() => onHoverChange(true)}
      onMouseLeave={() => onHoverChange(false)}
      onContextMenu={onContextMenu}
    >
      {showDragHandle && dragHandleProps && (
        <DragHandle isDragging={isDragging} onPointerDown={dragHandleProps.onPointerDown} />
      )}
      {hoverActions || labelNode}
      {controlNode}
    </div>
  );

  // Color → ColorRow (wrapped for hover/context)
  if (variable.type === "color") {
    const colorActions = hovered && !renaming ? (
      <div style={{ display: "flex", alignItems: "center", gap: 2, flexShrink: 0 }}>
        <button
          onClick={(e) => { e.stopPropagation(); onDuplicate(); }}
          title="Duplicate"
          style={{
            width: 18, height: 18, border: "none", background: "transparent",
            borderRadius: 3, cursor: "pointer", display: "flex",
            alignItems: "center", justifyContent: "center", color: text.hint,
            opacity: 0.7, transition: `opacity ${ms("fast")}`,
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = "1"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = "0.7"; }}
        >
          <Copy size={11} />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          title="Delete"
          style={{
            width: 18, height: 18, border: "none", background: "transparent",
            borderRadius: 3, cursor: "pointer", display: "flex",
            alignItems: "center", justifyContent: "center", color: text.hint,
            opacity: 0.7, transition: `opacity ${ms("fast")}`,
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = "1"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = "0.7"; }}
        >
          <Trash2 size={11} />
        </button>
      </div>
    ) : undefined;

    return (
      <div
        onMouseEnter={() => onHoverChange(true)}
        onMouseLeave={() => onHoverChange(false)}
        onContextMenu={onContextMenu}
        style={{ position: "relative" }}
      >
        {showDragHandle && dragHandleProps && (
          <div style={{ position: "absolute", left: -2, top: "50%", transform: "translateY(-50%)", zIndex: 1 }}>
            <DragHandle isDragging={isDragging} onPointerDown={dragHandleProps.onPointerDown} />
          </div>
        )}
        <ColorRow
          label={label}
          value={draft}
          onChange={(c) => { setDraft(c); commit(c); }}
          indicator={indicator}
          labelWidth={120}
          actions={colorActions}
        />
      </div>
    );
  }

  // Length → composite input
  const parsed = parseLength(draft);
  if (parsed) {
    const { num, unit } = parsed;
    return rowContent(
      <span title={variable.name} style={VAR_LABEL_STYLE}>
        <span style={indicatorStyle}>{label}</span>
      </span>,
      <div style={{
        flex: 1, minWidth: 0, display: "flex", alignItems: "center", height: 24,
        borderRadius: 4,
        border: focused ? `1px solid ${color.primary}` : `1px solid ${border.default}`,
        background: surface.subtle,
        boxShadow: focused ? `0 0 0 2px ${color.primary}33` : "none",
      }}>
        <input
          ref={inputRef}
          type="text"
          className="tuner-focusable"
          style={{
            flex: 1, minWidth: 0, height: "100%", background: "transparent",
            border: "none", padding: "0 6px", fontSize: 10, fontFamily: font.mono,
            color: text.primary, outline: "none", boxSizing: "border-box",
          }}
          tabIndex={0}
          value={String(num)}
          onChange={(e) => setDraft(`${e.target.value}${unit}`)}
          onFocus={() => setFocused(true)}
          onBlur={() => { setFocused(false); commit(draft); }}
          onKeyDown={(e) => {
            if (e.key === "Enter") { commit(draft); (e.target as HTMLInputElement).blur(); }
            if (e.key === "Escape") { e.stopPropagation(); setDraft(variable.value); setFocused(false); (e.target as HTMLInputElement).blur(); }
          }}
          onDoubleClick={(e) => e.currentTarget.select()}
        />
        <div style={{
          borderLeft: `1px solid ${border.default}`, alignSelf: "stretch",
          display: "flex", alignItems: "center", justifyContent: "center",
          width: 32, flexShrink: 0,
        }}>
          <UnitSelector
            value={unit}
            options={UNIT_OPTIONS}
            onChange={(newUnit) => { const v = `${num}${newUnit}`; setDraft(v); commit(v); }}
            embedded
          />
        </div>
      </div>,
    );
  }

  // String / number fallback
  return rowContent(
    <span title={variable.name} style={VAR_LABEL_STYLE}>
      <span style={indicatorStyle}>{label}</span>
    </span>,
    <input
      ref={inputRef}
      type="text"
      className="tuner-focusable"
      style={{
        flex: 1, minWidth: 0, height: 24, background: surface.subtle,
        border: focused ? `1px solid ${color.primary}` : `1px solid ${border.default}`,
        borderRadius: 4, padding: "0 6px", fontSize: 10, fontFamily: font.mono,
        color: text.primary, outline: "none", boxSizing: "border-box",
        boxShadow: focused ? `0 0 0 2px ${color.primary}33` : "none",
      }}
      tabIndex={0}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onFocus={() => setFocused(true)}
      onBlur={() => { setFocused(false); commit(draft); }}
      onKeyDown={(e) => {
        if (e.key === "Enter") { commit(draft); (e.target as HTMLInputElement).blur(); }
        if (e.key === "Escape") { e.stopPropagation(); setDraft(variable.value); setFocused(false); (e.target as HTMLInputElement).blur(); }
      }}
      onDoubleClick={(e) => e.currentTarget.select()}
    />,
  );
}

// ─── Drag-Reorderable Variable Group ──────────────────────────────────

function VariableGroup({
  title,
  variables,
  groupPrefix,
  searching,
  order,
  onOrderChange,
  onContextMenu,
}: {
  title: string;
  variables: CSSVariable[];
  groupPrefix?: string;
  searching: boolean;
  order: Map<string, number>;
  onOrderChange: (order: Map<string, number>) => void;
  onContextMenu: (e: React.MouseEvent, v: CSSVariable) => void;
}) {
  const [hoveredName, setHoveredName] = useState<string | null>(null);
  const [renamingName, setRenamingName] = useState<string | null>(null);
  const [renameMessage, setRenameMessage] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  const ordered = useMemo(() => applyOrder(variables, order), [variables, order]);

  const { registerRef, handleProps, itemStyle, dropLineStyle, isDragging } = useDragReorder(
    ordered,
    (reordered) => {
      const newOrder = new Map(order);
      reordered.forEach((v, i) => newOrder.set(v.name, i));
      onOrderChange(newOrder);
    },
  );

  const dropLine = dropLineStyle();

  const handleAdd = useCallback((name: string, value: string) => {
    try {
      addCustomProperty(document.documentElement, name, value);
      setShowAdd(false);
    } catch {
      // Invalid name — keep form open
    }
  }, []);

  const handleDuplicate = useCallback((v: CSSVariable) => {
    const copyName = `${v.name}-copy`;
    try {
      addCustomProperty(document.documentElement, copyName, v.value);
    } catch { /* ignore */ }
  }, []);

  const handleDelete = useCallback((v: CSSVariable) => {
    removeCustomProperty(document.documentElement, v.name);
  }, []);

  const handleRenameCommit = useCallback((oldName: string, newName: string) => {
    if (!newName || newName === oldName) {
      setRenamingName(null);
      return;
    }
    const count = renameCustomProperty(document.documentElement, oldName, newName, replaceVarReferences);
    setRenamingName(null);
    if (count > 0) {
      setRenameMessage(`Updated ${count} reference${count !== 1 ? "s" : ""}`);
      setTimeout(() => setRenameMessage(null), 2000);
    }
  }, []);

  const addButton = (
    <button
      onClick={(e) => { e.stopPropagation(); setShowAdd(true); }}
      style={MINI_ACTION_BUTTON}
      title="Add variable"
    >
      <Plus size={12} />
    </button>
  );

  return (
    <Section title={`${title} (${variables.length})`} headerAction={addButton}>
      <div style={{ position: "relative" }}>
        {ordered.map((v, i) => (
          <div key={v.name} ref={registerRef(i)} style={itemStyle(i)}>
            <GlobalVariableRow
              variable={v}
              hovered={hoveredName === v.name}
              renaming={renamingName === v.name}
              onHoverChange={(h) => setHoveredName(h ? v.name : null)}
              onContextMenu={(e) => onContextMenu(e, v)}
              onDuplicate={() => handleDuplicate(v)}
              onDelete={() => handleDelete(v)}
              onRenameCommit={(newName) => handleRenameCommit(v.name, newName)}
              onRenameCancel={() => setRenamingName(null)}
              dragHandleProps={!searching ? handleProps(i) : undefined}
              isDragging={isDragging}
              showDragHandle={!searching}
            />
          </div>
        ))}
        {dropLine && <div style={dropLine} />}
      </div>
      {showAdd && (
        <InlineAddRow
          prefix={groupPrefix}
          onAdd={handleAdd}
          onCancel={() => setShowAdd(false)}
        />
      )}
      {renameMessage && (
        <div style={{
          padding: "2px 12px", fontSize: 10, color: color.primary,
          fontFamily: font.mono, fontStyle: "italic",
        }}>
          {renameMessage}
        </div>
      )}
    </Section>
  );
}

// ─── Prefix Group Section ─────────────────────────────────────────────

function PrefixGroupSection({
  group,
  searching,
  order,
  onOrderChange,
  onContextMenu,
}: {
  group: PrefixGroup;
  searching: boolean;
  order: Map<string, number>;
  onOrderChange: (order: Map<string, number>) => void;
  onContextMenu: (e: React.MouseEvent, v: CSSVariable) => void;
}) {
  return (
    <>
      {group.variables.length > 0 && (
        <VariableGroup
          title={group.label}
          variables={group.variables}
          groupPrefix={group.prefix}
          searching={searching}
          order={order}
          onOrderChange={onOrderChange}
          onContextMenu={onContextMenu}
        />
      )}
      {Array.from(group.subgroups.entries()).map(([sub, { label, variables }]) => (
        <div key={`${group.prefix}-${sub}`} style={{ paddingLeft: 8 }}>
          <VariableGroup
            title={`${group.label} / ${label}`}
            variables={variables}
            groupPrefix={`${group.prefix}-${sub}`}
            searching={searching}
            order={order}
            onOrderChange={onOrderChange}
            onContextMenu={onContextMenu}
          />
        </div>
      ))}
    </>
  );
}

// ─── Main Panel ───────────────────────────────────────────────────────

export function GlobalVariablesPanel({ onClose }: { onClose: () => void }) {
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    try { return (localStorage.getItem(STORAGE_VIEW_KEY) as ViewMode) || "category"; }
    catch { return "category"; }
  });
  const [order, setOrder] = useState(() => loadOrder());
  const [showTopAdd, setShowTopAdd] = useState(false);
  const [contextMenu, setContextMenu] = useState<VarContextMenuState | null>(null);
  const [contextRenameTarget, setContextRenameTarget] = useState<string | null>(null);

  const overrideSnapshot = useSyncExternalStore(subscribeOverrides, getOverrideSnapshot);
  const allVars = useMemo(() => discoverAllVariables(), [overrideSnapshot]);

  const filtered = useMemo(() => {
    if (!search.trim()) return allVars;
    const q = search.toLowerCase();
    return allVars.filter((v) => v.name.toLowerCase().includes(q) || v.value.toLowerCase().includes(q));
  }, [allVars, search]);

  const searching = search.trim().length > 0;

  useEffect(() => {
    try { localStorage.setItem(STORAGE_VIEW_KEY, viewMode); } catch { /* ignore */ }
  }, [viewMode]);

  const handleOrderChange = useCallback((newOrder: Map<string, number>) => {
    setOrder(newOrder);
    saveOrder(newOrder);
  }, []);

  const handleContextMenu = useCallback((e: React.MouseEvent, v: CSSVariable) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, variable: v });
  }, []);

  const handleTopAdd = useCallback((name: string, value: string) => {
    try {
      addCustomProperty(document.documentElement, name, value);
      setShowTopAdd(false);
    } catch { /* invalid name */ }
  }, []);

  const categoryGrouped = useMemo(() => groupByCategory(filtered), [filtered]);
  const prefixGrouped = useMemo(() => groupByPrefix(filtered), [filtered]);

  const viewOptions = [
    { value: "category", label: "Category" },
    { value: "prefix", label: "Prefix" },
    { value: "collection", label: "Collections" },
  ];

  return (
    <>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "6px 12px 8px",
          borderBottom: `1px solid ${border.subtle}`,
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: text.primary, fontFamily: font.sans }}>
            Design Variables
          </span>
          <span style={{ fontSize: 10, color: text.hint, fontFamily: font.mono }}>
            {filtered.length}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <button
            onClick={() => setShowTopAdd(true)}
            style={{
              width: 22, height: 22, border: `1px solid ${border.default}`,
              background: "transparent", borderRadius: 3, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: text.label,
            }}
            title="Add variable"
          >
            <Plus size={12} />
          </button>
          <button
            onClick={onClose}
            style={{
              width: 24, height: 24, border: "none", background: "transparent",
              borderRadius: 4, cursor: "pointer", display: "flex",
              alignItems: "center", justifyContent: "center", color: text.label,
            }}
            title="Close"
          >
            <X size={14} strokeWidth={1.5} />
          </button>
        </div>
      </div>

      {/* Search */}
      <div style={{ padding: "6px 12px", borderBottom: `1px solid ${border.subtle}`, flexShrink: 0 }}>
        <input
          type="text"
          placeholder="Filter variables..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            width: "100%", height: 26, background: surface.subtle,
            border: `1px solid ${border.default}`, borderRadius: 4,
            padding: "0 8px", fontSize: 11, fontFamily: font.mono,
            color: text.primary, outline: "none", boxSizing: "border-box",
          }}
        />
      </div>

      {/* View toggle */}
      <div style={{ padding: "6px 12px", borderBottom: `1px solid ${border.subtle}`, flexShrink: 0 }}>
        <WebflowSegmentedControl
          options={viewOptions}
          value={viewMode}
          onChange={(v) => setViewMode(v as ViewMode)}
          aria-label="Grouping mode"
        />
      </div>

      {/* Top-level add row */}
      {showTopAdd && (
        <div style={{ borderBottom: `1px solid ${border.subtle}` }}>
          <InlineAddRow onAdd={handleTopAdd} onCancel={() => setShowTopAdd(false)} />
        </div>
      )}

      {/* Scrollable content */}
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", paddingTop: 4, paddingBottom: 4 }}>
        {filtered.length === 0 ? (
          <div style={{
            padding: "16px 12px", fontSize: 11, color: text.label,
            fontStyle: "italic", textAlign: "center",
          }}>
            {search ? "No matching variables" : "No CSS custom properties found"}
          </div>
        ) : viewMode === "category" ? (
          (Object.keys(CATEGORY_LABELS) as VarCategory[]).map((cat) => {
            const vars = categoryGrouped[cat];
            if (vars.length === 0) return null;
            return (
              <VariableGroup
                key={cat}
                title={CATEGORY_LABELS[cat]}
                variables={vars}
                searching={searching}
                order={order}
                onOrderChange={handleOrderChange}
                onContextMenu={handleContextMenu}
              />
            );
          })
        ) : (
          <>
            {prefixGrouped.groups.map((group) => (
              <PrefixGroupSection
                key={group.prefix}
                group={group}
                searching={searching}
                order={order}
                onOrderChange={handleOrderChange}
                onContextMenu={handleContextMenu}
              />
            ))}
            {prefixGrouped.ungrouped.length > 0 && (
              <VariableGroup
                title="(Root)"
                variables={prefixGrouped.ungrouped}
                searching={searching}
                order={order}
                onOrderChange={handleOrderChange}
                onContextMenu={handleContextMenu}
              />
            )}
          </>
        )}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <VariableContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          variable={contextMenu.variable}
          onClose={() => setContextMenu(null)}
          onRename={() => setContextRenameTarget(contextMenu.variable.name)}
          onDuplicate={() => {
            const v = contextMenu.variable;
            try { addCustomProperty(document.documentElement, `${v.name}-copy`, v.value); } catch {}
          }}
          onDelete={() => {
            removeCustomProperty(document.documentElement, contextMenu.variable.name);
          }}
        />
      )}
    </>
  );
}
