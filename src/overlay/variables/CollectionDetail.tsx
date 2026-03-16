/**
 * CollectionDetail.tsx — Right pane of the master-detail variables panel.
 *
 * Renders a variable table grouped by inferred subgroups, with type icons,
 * reference pills, inline editing, per-subgroup add buttons, and a
 * right-click context menu.
 */

import React, { useState, useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { Copy, Trash2, Plus } from "lucide-react";
import { inferSubgroups, type Subgroup } from "./autoCollections";
import { VarTypeIcon } from "./VarTypeIcon";
import { VariableValue } from "./ReferencePill";
import type { CSSVariable } from "./discoverVariables";
import type { TokenCollection } from "./tokenCollections";
import type { InferredMode } from "./modeDiscovery";
import {
  applyCustomProperty,
  isCustomPropertyDirty,
} from "../core/apply";
import {
  applyModeOverride,
  getModeOverrides,
  isModeOverrideDirty,
  subscribeModeOverrides,
  getModeOverrideSnapshot,
  beginModeCoalesce,
  endModeCoalesce,
} from "./modeOverrides";
import { ColorPickerEnhanced } from "../controls/ColorPickerEnhanced";
import { VariableLinkDot } from "../controls/VariableLinkDot";
import { VariableField } from "../controls/VariableField";
import { cssColorToHex, hexToRgba } from "../colorUtils";
import { parseVarRef } from "./colorVariables";
import { useFocusTrap } from "../hooks/useFocusTrap";
import {
  text,
  border,
  surface,
  font,
  color,
  shadow,
  zIndex,
  labelIndicator,
  labelHighlight,
  type IndicatorType,
} from "../theme";
import { ms } from "../timing";

// ─── Props ──────────────────────────────────────────────────────────

export interface CollectionDetailProps {
  /** Collection name to display as title */
  name: string;
  /** Variables in this collection */
  variables: CSSVariable[];
  /** All variables (for alias resolution) */
  allVariables: CSSVariable[];
  /** Available collections for "Move to..." menu */
  collections: TokenCollection[];
  /** Current collection ID (to exclude from move menu) */
  currentCollectionId: string | null;
  /** Handlers */
  onApply: (varName: string, value: string) => void;
  onAdd: (name: string, value: string) => void;
  onRemove: (varName: string) => void;
  onRename: (oldName: string, newName: string) => void;
  onDuplicate: (varName: string) => void;
  onMoveToCollection: (varName: string, collectionId: string) => void;
  onUnassign: (varName: string) => void;
  /** Discovered CSS variable modes (from modeDiscovery) */
  modes?: InferredMode[];
}

// ─── Display Name Logic ─────────────────────────────────────────────

/** Strip `--` prefix and optional subgroup prefix for cleaner display. */
function displayName(varName: string, subgroupName: string): string {
  let name = varName.startsWith("--") ? varName.slice(2) : varName;
  if (subgroupName && name.startsWith(subgroupName + "-")) {
    name = name.slice(subgroupName.length + 1);
  }
  return name;
}

// ─── Shared Styles ──────────────────────────────────────────────────

const INPUT_STYLE: React.CSSProperties = {
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

const RENAME_INPUT_STYLE: React.CSSProperties = {
  ...INPUT_STYLE,
  flex: "none",
  width: "100%",
  maxWidth: 160,
};

const COLUMN_HEADER_STYLE: React.CSSProperties = {
  fontSize: 10,
  fontFamily: font.sans,
  fontWeight: 500,
  color: text.hint,
  textTransform: "uppercase" as const,
  letterSpacing: "0.04em",
  userSelect: "none",
};

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

interface ContextMenuState {
  x: number;
  y: number;
  variable: CSSVariable;
}

function DetailContextMenu({
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

// ─── Inline Add Row ─────────────────────────────────────────────────

function SubgroupAddRow({
  subgroupPrefix,
  onAdd,
  onCancel,
}: {
  subgroupPrefix: string;
  onAdd: (name: string, value: string) => void;
  onCancel: () => void;
}) {
  const defaultName = subgroupPrefix ? `--${subgroupPrefix}-` : "--";
  const [name, setName] = useState(defaultName);
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

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 12px" }}>
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
        style={{ ...INPUT_STYLE, flex: 1.2 }}
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
        style={INPUT_STYLE}
      />
    </div>
  );
}

// ─── Mode Value Cell ─────────────────────────────────────────────────

function ModeValueCell({
  varName,
  mode,
  value,
  varType,
}: {
  varName: string;
  mode: InferredMode;
  value: string | undefined;
  varType: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [cellHovered, setCellHovered] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dotRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!editing) setDraft(value ?? "");
  }, [value, editing]);

  useEffect(() => {
    if (editing) {
      const id = setTimeout(() => inputRef.current?.select(), 0);
      return () => clearTimeout(id);
    }
  }, [editing]);

  const commit = useCallback(() => {
    const trimmed = draft.trim();
    if (trimmed && mode.selector) {
      applyModeOverride(mode.selector, varName, trimmed);
    }
    setEditing(false);
  }, [draft, mode.selector, varName]);

  const editable = mode.source !== "media" && mode.source !== "base";
  const isOverridden = isModeOverrideDirty(mode.selector ?? "", varName);
  const linkedVarName = value ? parseVarRef(value) : null;
  const isLinked = !!linkedVarName;

  const handleVarSelect = useCallback((varExpr: string) => {
    if (mode.selector) {
      applyModeOverride(mode.selector, varName, varExpr);
    }
  }, [mode.selector, varName]);

  const handleUnlink = useCallback(() => {
    if (!linkedVarName || !mode.selector) return;
    const resolved = getComputedStyle(document.documentElement)
      .getPropertyValue(linkedVarName).trim();
    if (resolved) {
      applyModeOverride(mode.selector, varName, resolved);
    }
  }, [linkedVarName, mode.selector, varName]);

  // ── Editing state ──
  if (editing) {
    return (
      <div style={{ flex: 1, minWidth: 120, overflow: "hidden" }}>
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") { setEditing(false); e.stopPropagation(); }
          }}
          onBlur={commit}
          data-tuner-portal
          style={{
            width: "100%",
            fontSize: 11,
            fontFamily: font.mono,
            background: surface.hover,
            border: `1px solid ${color.primary}`,
            borderRadius: 3,
            padding: "1px 4px",
            outline: "none",
            color: text.primary,
            textAlign: "right",
            boxSizing: "border-box" as const,
          }}
        />
      </div>
    );
  }

  // ── Linked state: VariableField purple pill ──
  if (isLinked && editable) {
    return (
      <div
        style={{
          flex: 1,
          minWidth: 120,
          display: "flex",
          alignItems: "center",
          overflow: "hidden",
          ...(isOverridden ? {
            borderRadius: 3,
            outline: `1px solid ${labelIndicator.modified.bg}`,
          } : {}),
        }}
      >
        <VariableField
          variableName={linkedVarName}
          variableType={varType === "color" ? "color" : "all"}
          onSelectVariable={handleVarSelect}
          onUnlink={handleUnlink}
        />
      </div>
    );
  }

  // ── Linked state but read-only (base/media) ──
  if (isLinked && !editable) {
    return (
      <div
        style={{
          flex: 1,
          minWidth: 120,
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          overflow: "hidden",
          borderRadius: 3,
          padding: "1px 3px",
        }}
      >
        {varType === "color" && value && (
          <div style={{
            width: 12, height: 12, borderRadius: 3, flexShrink: 0, marginRight: 4,
            background: value, border: `1px solid ${border.default}`,
          }} />
        )}
        <VariableValue value={value!} />
      </div>
    );
  }

  // ── Unlinked state: VariableLinkDot + raw value ──
  return (
    <div
      onMouseEnter={() => setCellHovered(true)}
      onMouseLeave={() => setCellHovered(false)}
      onClick={editable ? () => setEditing(true) : undefined}
      style={{
        flex: 1,
        minWidth: 120,
        display: "flex",
        alignItems: "center",
        justifyContent: "flex-end",
        cursor: editable ? "text" : "default",
        borderRadius: 3,
        padding: "1px 3px",
        position: "relative",
        ...(isOverridden ? {
          background: labelIndicator.modified.bg,
          color: labelIndicator.modified.text,
          ...labelHighlight,
        } : {}),
      }}
    >
      {/* VariableLinkDot at top-left corner (absolute, default mode) */}
      {editable && (
        <VariableLinkDot
          rowHovered={cellHovered}
          isLinked={false}
          variableType={varType === "color" ? "color" : "all"}
          onSelect={handleVarSelect}
          activeVariable={null}
        />
      )}

      {/* Color dot for color-type variables */}
      {varType === "color" && value && (
        <div
          ref={dotRef}
          onClick={(e) => {
            if (!editable) return;
            e.stopPropagation();
            setPickerOpen(true);
          }}
          style={{
            width: 12, height: 12, borderRadius: 3, flexShrink: 0, marginRight: 4,
            background: value, border: `1px solid ${border.default}`,
            cursor: editable ? "pointer" : "default",
          }}
        />
      )}

      {value !== undefined ? (
        <VariableValue value={value} />
      ) : (
        <span style={{ color: text.disabled, fontSize: 11, fontFamily: font.mono }}>
          {editable ? "+" : "\u2014"}
        </span>
      )}

      {/* Color picker portal */}
      {pickerOpen && dotRef.current && (() => {
        const rect = dotRef.current!.getBoundingClientRect();
        const pickerWidth = 264;
        const pickerHeight = 300;
        const gap = 4;
        const spaceBelow = window.innerHeight - rect.bottom;
        const top = spaceBelow < pickerHeight + gap
          ? rect.top - pickerHeight - gap : rect.bottom + gap;
        const left = Math.min(rect.left, window.innerWidth - pickerWidth - gap);
        return createPortal(
          <div data-tuner-portal style={{ position: "fixed", top, left, zIndex: zIndex.max }}>
            <ColorPickerEnhanced
              color={value ? cssColorToHex(value) : "#000000"}
              onChange={(hex, opacity) => {
                if (mode.selector) {
                  beginModeCoalesce();
                  const final = opacity < 1 ? hexToRgba(hex, opacity) : hex;
                  applyModeOverride(mode.selector, varName, final);
                }
              }}
              onClose={() => { endModeCoalesce(); setPickerOpen(false); }}
            />
          </div>,
          document.body,
        );
      })()}
    </div>
  );
}

// ─── Variable Row ───────────────────────────────────────────────────

function DetailVariableRow({
  variable,
  subgroupName,
  allVariables,
  onApply,
  onContextMenu,
  onRename,
  onDuplicate,
  onRemove,
  renaming,
  onRenameCommit,
  onRenameCancel,
  modeValues,
  registerModeScroll,
  onModeScroll,
}: {
  variable: CSSVariable;
  subgroupName: string;
  allVariables: CSSVariable[];
  onApply: (varName: string, value: string) => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onRename: () => void;
  onDuplicate: () => void;
  onRemove: () => void;
  renaming: boolean;
  onRenameCommit: (newName: string) => void;
  onRenameCancel: () => void;
  /** When multi-mode is active, per-mode values for this variable */
  modeValues?: Array<{ modeName: string; mode: InferredMode; value: string | undefined }>;
  /** Register this row's mode container for scroll sync */
  registerModeScroll?: (el: HTMLDivElement | null) => void;
  /** Scroll handler for mode container sync */
  onModeScroll?: (e: React.UIEvent<HTMLDivElement>) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(variable.value);
  const [renameDraft, setRenameDraft] = useState(variable.name);
  const valueRef = useRef<HTMLInputElement>(null);
  const renameRef = useRef<HTMLInputElement>(null);
  const cancelledRef = useRef(false);

  const dirty = isCustomPropertyDirty(variable.name);
  const label = displayName(variable.name, subgroupName);

  // Sync draft when variable changes externally
  useEffect(() => {
    if (!editing) setDraft(variable.value);
  }, [variable.value, editing]);

  // Focus rename input
  useEffect(() => {
    if (renaming) {
      cancelledRef.current = false;
      setRenameDraft(variable.name);
      const id = setTimeout(() => renameRef.current?.select(), 0);
      return () => clearTimeout(id);
    }
  }, [renaming, variable.name]);

  // Focus value input
  useEffect(() => {
    if (editing) {
      const id = setTimeout(() => valueRef.current?.select(), 0);
      return () => clearTimeout(id);
    }
  }, [editing]);

  const commitValue = useCallback((newValue: string) => {
    const trimmed = newValue.trim();
    if (!trimmed) return;
    applyCustomProperty(document.documentElement, variable.name, trimmed);
    onApply(variable.name, trimmed);
    setEditing(false);
  }, [variable.name, onApply]);

  // Resolved color for alias pills
  const resolvedColor = variable.type === "color" ? variable.value : undefined;

  const indicator: IndicatorType = dirty ? "modified" : "none";
  const indicatorSt = indicator !== "none"
    ? { background: labelIndicator.modified.bg, color: labelIndicator.modified.text, ...labelHighlight }
    : {};

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onContextMenu={onContextMenu}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "8px 12px",
        minHeight: 26,
        background: hovered ? surface.hover : "transparent",
        transition: `background ${ms("fast")}`,
        cursor: "default",
      }}
    >
      {/* Type icon */}
      <VarTypeIcon
        type={variable.type}
        varName={variable.name}
        colorValue={variable.type === "color" ? variable.value : undefined}
      />

      {/* Name cell */}
      <div style={{ ...(modeValues ? { width: 100, flexShrink: 0 } : { width: 120, flexShrink: 0 }), minWidth: 0, display: "flex", alignItems: "center" }}>
        {renaming ? (
          <input
            ref={renameRef}
            type="text"
            value={renameDraft}
            onChange={(e) => setRenameDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") { cancelledRef.current = true; onRenameCommit(renameDraft.trim()); }
              if (e.key === "Escape") { e.stopPropagation(); cancelledRef.current = true; onRenameCancel(); }
            }}
            onBlur={() => { if (!cancelledRef.current) onRenameCommit(renameDraft.trim()); }}
            style={RENAME_INPUT_STYLE}
          />
        ) : (
          <span
            title={variable.name}
            onClick={(e) => { if (!e.altKey) onRename(); }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = surface.hover; (e.currentTarget as HTMLElement).style.borderRadius = "3px"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
            style={{
              fontSize: 11,
              fontFamily: font.mono,
              color: text.primary,
              overflow: "hidden",
              whiteSpace: "nowrap",
              textOverflow: "ellipsis",
              cursor: "text",
              padding: "1px 3px",
              borderRadius: 3,
              ...indicatorSt,
            }}
          >
            {label}
          </span>
        )}
      </div>

      {/* Value cell(s) */}
      {modeValues ? (
        /* Multi-mode: one editable cell per mode */
        <div
          ref={registerModeScroll}
          onScroll={onModeScroll}
          style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 4 }}
        >
          {modeValues.map((mv) => (
            <ModeValueCell
              key={mv.modeName}
              varName={variable.name}
              mode={mv.mode}
              value={mv.value}
              varType={variable.type}
            />
          ))}
        </div>
      ) : (
        /* Single-mode: editable value cell */
        <div
          style={{
            flex: 1,
            minWidth: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
          }}
        >
          {editing ? (
            <input
              ref={valueRef}
              type="text"
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value);
                // Live preview while typing
                applyCustomProperty(document.documentElement, variable.name, e.target.value);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitValue(draft);
                if (e.key === "Escape") { e.stopPropagation(); setDraft(variable.value); setEditing(false); }
              }}
              onBlur={() => commitValue(draft)}
              style={{ ...INPUT_STYLE, flex: 1, textAlign: "right" }}
            />
          ) : (
            <span
              onClick={() => setEditing(true)}
              style={{ cursor: "text", maxWidth: "100%", overflow: "hidden" }}
            >
              <VariableValue
                value={variable.value}
                aliasOf={variable.aliasOf}
                resolvedColor={resolvedColor}
              />
            </span>
          )}
        </div>
      )}

      {/* Hover action buttons */}
      {hovered && !renaming && !editing && (
        <div style={{ display: "flex", alignItems: "center", gap: 2, flexShrink: 0 }}>
          <button
            onClick={(e) => { e.stopPropagation(); onDuplicate(); }}
            title="Duplicate"
            style={{
              width: 18, height: 18, border: "none", background: "transparent",
              borderRadius: 3, cursor: "pointer", display: "flex",
              alignItems: "center", justifyContent: "center", color: text.hint,
              opacity: 0.7, transition: `opacity ${ms("fast")}`, padding: 0,
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = "1"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = "0.7"; }}
          >
            <Copy size={11} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
            title="Delete"
            style={{
              width: 18, height: 18, border: "none", background: "transparent",
              borderRadius: 3, cursor: "pointer", display: "flex",
              alignItems: "center", justifyContent: "center", color: text.hint,
              opacity: 0.7, transition: `opacity ${ms("fast")}`, padding: 0,
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = "1"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = "0.7"; }}
          >
            <Trash2 size={11} />
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Subgroup Section ───────────────────────────────────────────────

function SubgroupSection({
  subgroup,
  allVariables,
  collections,
  currentCollectionId,
  renamingVar,
  onApply,
  onAdd,
  onRemove,
  onRename,
  onDuplicate,
  onMoveToCollection,
  onUnassign,
  onContextMenu,
  onRenameStart,
  onRenameCommit,
  onRenameCancel,
  modes,
  registerModeScroll,
  onModeScroll,
}: {
  subgroup: Subgroup;
  allVariables: CSSVariable[];
  collections: TokenCollection[];
  currentCollectionId: string | null;
  renamingVar: string | null;
  onApply: (varName: string, value: string) => void;
  onAdd: (name: string, value: string) => void;
  onRemove: (varName: string) => void;
  onRename: (oldName: string, newName: string) => void;
  onDuplicate: (varName: string) => void;
  onMoveToCollection: (varName: string, collectionId: string) => void;
  onUnassign: (varName: string) => void;
  onContextMenu: (e: React.MouseEvent, variable: CSSVariable) => void;
  onRenameStart: (varName: string) => void;
  onRenameCommit: (oldName: string, newName: string) => void;
  onRenameCancel: () => void;
  /** When multi-mode is active, the relevant inferred modes */
  modes?: InferredMode[];
  /** Register a row's mode container for scroll sync */
  registerModeScroll?: (el: HTMLDivElement | null) => void;
  /** Scroll handler for mode container sync */
  onModeScroll?: (e: React.UIEvent<HTMLDivElement>) => void;
}) {
  const [adding, setAdding] = useState(false);

  return (
    <div style={{ marginBottom: 4 }}>
      {/* Subgroup header */}
      {subgroup.name && (
        <div
          style={{
            padding: "6px 12px 2px",
            fontSize: 11,
            fontFamily: font.sans,
            fontWeight: 600,
            color: text.primary,
            textTransform: "lowercase",
            userSelect: "none",
          }}
        >
          {subgroup.name}
        </div>
      )}

      {/* Variable rows */}
      {subgroup.variables.map((v) => {
        const modeValues = modes?.map((m) => {
          const overrides = getModeOverrides(m.selector ?? "");
          const overrideVal = overrides?.[v.name];
          return {
            modeName: m.name,
            mode: m,
            value: overrideVal ?? m.values[v.name],
          };
        });
        return (
          <DetailVariableRow
            key={v.name}
            variable={v}
            subgroupName={subgroup.name}
            allVariables={allVariables}
            onApply={onApply}
            onContextMenu={(e) => onContextMenu(e, v)}
            onRename={() => onRenameStart(v.name)}
            onDuplicate={() => onDuplicate(v.name)}
            onRemove={() => onRemove(v.name)}
            renaming={renamingVar === v.name}
            onRenameCommit={(newName) => onRenameCommit(v.name, newName)}
            onRenameCancel={onRenameCancel}
            modeValues={modeValues}
            registerModeScroll={registerModeScroll}
            onModeScroll={onModeScroll}
          />
        );
      })}

      {/* Per-subgroup add row */}
      {adding ? (
        <SubgroupAddRow
          subgroupPrefix={subgroup.name}
          onAdd={(name, value) => {
            onAdd(name, value);
            setAdding(false);
          }}
          onCancel={() => setAdding(false)}
        />
      ) : (
        <button
          onClick={() => setAdding(true)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            padding: "4px 12px",
            border: "none",
            background: "transparent",
            cursor: "pointer",
            fontSize: 10,
            fontFamily: font.sans,
            color: text.hint,
            opacity: 0.7,
            transition: `opacity ${ms("fast")}`,
            width: "100%",
            textAlign: "left",
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = "1"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = "0.7"; }}
        >
          <Plus size={10} />
          New variable
        </button>
      )}
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────

export function CollectionDetail({
  name,
  variables,
  allVariables,
  collections,
  currentCollectionId,
  onApply,
  onAdd,
  onRemove,
  onRename,
  onDuplicate,
  onMoveToCollection,
  onUnassign,
  modes,
}: CollectionDetailProps) {
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [renamingVar, setRenamingVar] = useState<string | null>(null);

  // Subscribe to mode override changes so cells re-render with fresh data
  const _modeOverrideVersion = useSyncExternalStore(subscribeModeOverrides, getModeOverrideSnapshot);

  // Scroll sync refs for frozen-column mode layout
  const modeScrollRefs = useRef<HTMLDivElement[]>([]);

  const handleModeScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const scrollLeft = e.currentTarget.scrollLeft;
    for (const el of modeScrollRefs.current) {
      if (el && el !== e.currentTarget) {
        el.scrollLeft = scrollLeft;
      }
    }
  }, []);

  const registerModeScroll = useCallback((el: HTMLDivElement | null) => {
    if (el) {
      if (!modeScrollRefs.current.includes(el)) {
        modeScrollRefs.current.push(el);
      }
    } else {
      // React calls ref(null) on unmount — remove stale entries
      modeScrollRefs.current = modeScrollRefs.current.filter(
        (ref) => ref !== null && document.contains(ref),
      );
    }
  }, []);

  // Infer subgroups from the variables in this collection
  const subgroups = useMemo(() => inferSubgroups(variables), [variables]);

  // Filter modes to only those relevant to this collection's variables
  const relevantModes = useMemo(() => {
    if (!modes || modes.length <= 1) return null;
    const varNames = new Set(variables.map((v) => v.name));
    const filtered = modes.filter(
      (m) => m.source === "base" || Object.keys(m.values).some((k) => varNames.has(k)),
    );
    return filtered.length <= 1 ? null : filtered;
  }, [modes, variables]);

  const handleContextMenu = useCallback((e: React.MouseEvent, variable: CSSVariable) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, variable });
  }, []);

  const handleRenameStart = useCallback((varName: string) => {
    setRenamingVar(varName);
  }, []);

  const handleRenameCommit = useCallback((oldName: string, newName: string) => {
    setRenamingVar(null);
    if (newName && newName !== oldName) {
      onRename(oldName, newName);
    }
  }, [onRename]);

  const handleRenameCancel = useCallback(() => {
    setRenamingVar(null);
  }, []);

  if (variables.length === 0) {
    return (
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          padding: 24,
          color: text.hint,
          fontSize: 12,
          fontFamily: font.sans,
        }}
      >
        <span>No variables in this collection</span>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden" }}>
      {/* Header */}
      <div
        style={{
          padding: "10px 12px 6px",
          borderBottom: `1px solid ${border.subtle}`,
          flexShrink: 0,
        }}
      >
        {/* Collection title */}
        <div
          style={{
            fontSize: 13,
            fontWeight: 600,
            fontFamily: font.sans,
            color: text.primary,
            marginBottom: 6,
          }}
        >
          {name}
        </div>

        {/* Column headers */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "0 12px" }}>
          {/* Icon spacer */}
          <div style={{ width: 14, flexShrink: 0 }} />
          {relevantModes ? (
            <>
              <div style={{ width: 100, flexShrink: 0, ...COLUMN_HEADER_STYLE }}>Name</div>
              <div
                ref={registerModeScroll}
                onScroll={handleModeScroll}
                style={{
                  flex: 1,
                  minWidth: 0,
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                {relevantModes.map((m) => (
                  <div
                    key={m.name}
                    style={{ flex: 1, minWidth: 120, textAlign: "right", ...COLUMN_HEADER_STYLE }}
                  >
                    {m.name}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <>
              <div style={{ width: 120, flexShrink: 0, ...COLUMN_HEADER_STYLE }}>Name</div>
              <div style={{ flex: 1, textAlign: "right", ...COLUMN_HEADER_STYLE }}>Value</div>
            </>
          )}
          {/* Action spacer for hover buttons */}
          <div style={{ width: 20, flexShrink: 0 }} />
        </div>
      </div>

      {/* Scrollable content */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          overflowX: "hidden",
          padding: "4px 0",
        }}
      >
        {subgroups.map((sg) => (
          <SubgroupSection
            key={sg.name || "__ungrouped"}
            subgroup={sg}
            allVariables={allVariables}
            collections={collections}
            currentCollectionId={currentCollectionId}
            renamingVar={renamingVar}
            onApply={onApply}
            onAdd={onAdd}
            onRemove={onRemove}
            onRename={onRename}
            onDuplicate={onDuplicate}
            onMoveToCollection={onMoveToCollection}
            onUnassign={onUnassign}
            onContextMenu={handleContextMenu}
            onRenameStart={handleRenameStart}
            onRenameCommit={handleRenameCommit}
            onRenameCancel={handleRenameCancel}
            modes={relevantModes ?? undefined}
            registerModeScroll={relevantModes ? registerModeScroll : undefined}
            onModeScroll={relevantModes ? handleModeScroll : undefined}
          />
        ))}
      </div>

      {/* Context menu */}
      {contextMenu && (
        <DetailContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          variable={contextMenu.variable}
          onClose={() => setContextMenu(null)}
          onRename={() => setRenamingVar(contextMenu.variable.name)}
          onDuplicate={() => onDuplicate(contextMenu.variable.name)}
          onDelete={() => onRemove(contextMenu.variable.name)}
          collections={collections}
          currentCollectionId={currentCollectionId}
          onMoveToCollection={(cid) => onMoveToCollection(contextMenu.variable.name, cid)}
          onUnassign={() => onUnassign(contextMenu.variable.name)}
        />
      )}
    </div>
  );
}
