/**
 * GlobalVariablesPanel.tsx — Master-detail shell for the variables panel.
 *
 * Thin orchestrator that wires CollectionSidebar (left) + CollectionDetail (right)
 * in a horizontal flexbox. All rendering logic lives in the sub-components;
 * this file owns data fetching, filtering, collection selection, and CRUD wiring.
 */

import React, { useState, useMemo, useEffect, useSyncExternalStore } from "react";
import { CollectionSidebar } from "./CollectionSidebar";
import { CollectionDetail } from "./CollectionDetail";
import { useTokenCollections } from "./tokenCollections";
import { discoverAllVariables, buildAliasGraph, replaceVarReferences } from "./discoverVariables";
import { inferAutoCollections } from "./autoCollections";
import { discoverModeDeclarations, inferModes } from "./modeDiscovery";
import {
  applyCustomProperty,
  addCustomProperty,
  removeCustomProperty,
  renameCustomProperty,
  subscribeOverrides,
  getOverrideSnapshot,
} from "../core/apply";

// ─── Main Component ────────────────────────────────────────────────────

export function GlobalVariablesPanel({
  onClose,
  onModeCount,
}: {
  onClose: () => void;
  onModeCount?: (count: number) => void;
}) {
  // ─── State ─────────────────────────────────────────────────
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  // ─── Data ──────────────────────────────────────────────────
  const {
    collections,
    addCollection,
    removeCollection,
    renameCollection,
    assignVariable,
    unassignVariable,
    getManuallyAssignedNames,
  } = useTokenCollections();

  const overrideSnapshot = useSyncExternalStore(subscribeOverrides, getOverrideSnapshot);
  const allVars = useMemo(() => discoverAllVariables(), [overrideSnapshot]);
  const _aliasGraph = useMemo(() => buildAliasGraph(allVars), [allVars]);
  const modes = useMemo(() => inferModes(discoverModeDeclarations()), [overrideSnapshot]);

  useEffect(() => {
    onModeCount?.(modes.length);
  }, [modes.length, onModeCount]);

  // Filter by search
  const filtered = useMemo(() => {
    if (!search.trim()) return allVars;
    const q = search.toLowerCase();
    return allVars.filter(
      (v) => v.name.toLowerCase().includes(q) || v.value.toLowerCase().includes(q),
    );
  }, [allVars, search]);

  // Auto-collections (from unassigned variables)
  const autoColls = useMemo(() => {
    const manualNames = getManuallyAssignedNames();
    return inferAutoCollections(filtered, manualNames);
  }, [filtered, collections]);

  // Auto-select first collection if none selected
  useEffect(() => {
    if (selectedId) return;
    if (collections.length > 0) {
      setSelectedId(collections[0].id);
      return;
    }
    if (autoColls.length > 0) {
      setSelectedId(autoColls[0].id);
    }
  }, [selectedId, collections, autoColls]);

  // Variables for selected collection
  const selectedVars = useMemo(() => {
    if (!selectedId) return [];
    // Check manual collections first
    const manual = collections.find((c) => c.id === selectedId);
    if (manual) {
      return filtered.filter((v) => manual.variableNames.includes(v.name));
    }
    // Check auto collections
    const auto = autoColls.find((c) => c.id === selectedId);
    if (auto) {
      return filtered.filter((v) => auto.variableNames.includes(v.name));
    }
    return [];
  }, [selectedId, collections, autoColls, filtered]);

  // Selected collection name
  const selectedName = useMemo(() => {
    const manual = collections.find((c) => c.id === selectedId);
    if (manual) return manual.name;
    const auto = autoColls.find((c) => c.id === selectedId);
    if (auto) return auto.name;
    return "";
  }, [selectedId, collections, autoColls]);

  // ─── Render ────────────────────────────────────────────────
  return (
    <div style={{ display: "flex", height: "100%", overflow: "hidden" }}>
      <CollectionSidebar
        collections={collections}
        autoCollections={autoColls}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onAddCollection={(name) => {
          const c = addCollection(name);
          setSelectedId(c.id);
        }}
        onRenameCollection={renameCollection}
        onDeleteCollection={(id) => {
          removeCollection(id);
          if (selectedId === id) setSelectedId(null);
        }}
        onClose={onClose}
      />
      <CollectionDetail
        name={selectedName}
        variables={selectedVars}
        allVariables={allVars}
        collections={collections}
        currentCollectionId={selectedId}
        modes={modes}
        onApply={(name, value) =>
          applyCustomProperty(document.documentElement, name, value)
        }
        onAdd={(name, value) =>
          addCustomProperty(document.documentElement, name, value)
        }
        onRemove={(name) =>
          removeCustomProperty(document.documentElement, name)
        }
        onRename={(oldName, newName) => {
          renameCustomProperty(document.documentElement, oldName, newName);
          replaceVarReferences(oldName, newName);
        }}
        onDuplicate={(name) => {
          const v = allVars.find((vr) => vr.name === name);
          if (v) {
            const newName = name + "-copy";
            addCustomProperty(document.documentElement, newName, v.value);
          }
        }}
        onMoveToCollection={(varName, collId) => assignVariable(collId, varName)}
        onUnassign={unassignVariable}
      />
    </div>
  );
}
