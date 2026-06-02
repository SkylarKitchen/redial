/**
 * DetailVariableRow.tsx — Inline add row, variable row, and subgroup section
 * for the variables detail pane.
 */

import React, { useState, useCallback, useEffect, useRef } from "react";
import { Copy, Trash2, Plus } from "lucide-react";
import { type Subgroup } from "./autoCollections";
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
  getModeOverrides,
} from "../core/modeOverrides";
import { VariableField } from "../controls/VariableField";
import {
  text,
  surface,
  font,
  labelIndicator,
  labelHighlight,
  type IndicatorType,
} from "../theme";
import { ms } from "../timing";
import { displayName, INPUT_STYLE, RENAME_INPUT_STYLE } from "./collectionDetailShared";
import { ModeValueCell } from "./ModeValueCell";

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
          ) : variable.aliasOf ? (
            /* Alias value → purple VariableField pill */
            <VariableField
              variableName={variable.aliasOf}
              variableType={variable.type === "color" ? "color" : "all"}
              onSelectVariable={(varExpr) => {
                const m = varExpr.match(/^var\(\s*(--[\w-]+)/);
                if (m) {
                  applyCustomProperty(document.documentElement, variable.name, varExpr);
                  onApply(variable.name, varExpr);
                }
              }}
              onUnlink={() => {
                const resolved = getComputedStyle(document.documentElement)
                  .getPropertyValue(variable.aliasOf!).trim();
                if (resolved) {
                  applyCustomProperty(document.documentElement, variable.name, resolved);
                  onApply(variable.name, resolved);
                }
              }}
            />
          ) : (
            <span
              onClick={() => setEditing(true)}
              style={{ cursor: "text", maxWidth: "100%", overflow: "hidden" }}
            >
              <VariableValue
                value={variable.value}
                resolvedColor={resolvedColor}
              />
            </span>
          )}
        </div>
      )}

      {/* Action spacer — always reserves space to keep columns aligned with header */}
      <div style={{ width: 38, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 2 }}>
      {hovered && !renaming && !editing && (
        <>
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
        </>
      )}
      </div>
    </div>
  );
}

// ─── Subgroup Section ───────────────────────────────────────────────

export function SubgroupSection({
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
