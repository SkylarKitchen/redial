/**
 * CollectionDetail.tsx — Right pane of the master-detail variables panel.
 *
 * Renders a variable table grouped by inferred subgroups, with type icons,
 * reference pills, inline editing, per-subgroup add buttons, and a
 * right-click context menu.
 */

import React, { useState, useCallback, useMemo, useRef, useSyncExternalStore } from "react";
import { inferSubgroups } from "./autoCollections";
import type { CSSVariable } from "./discoverVariables";
import type { TokenCollection } from "./tokenCollections";
import type { InferredMode } from "./modeDiscovery";
import {
  subscribeModeOverrides,
  getModeOverrideSnapshot,
} from "../core/modeOverrides";
import {
  text,
  border,
  font,
} from "../theme";
import { COLUMN_HEADER_STYLE } from "./collectionDetailShared";
import { DetailContextMenu, type ContextMenuState } from "./DetailContextMenu";
import { SubgroupSection } from "./DetailVariableRow";

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

        {/* Column headers — no icon spacer; NAME aligns with row padding, not icon */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {relevantModes ? (
            <>
              <div style={{ width: 120, flexShrink: 0, ...COLUMN_HEADER_STYLE }}>Name</div>
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
                    style={{ flex: 1, minWidth: 120, textAlign: "left", ...COLUMN_HEADER_STYLE }}
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
          {/* Action spacer — matches hover button area in data rows */}
          <div style={{ width: 38, flexShrink: 0 }} />
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
