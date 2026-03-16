/**
 * VariablePicker.tsx — Portal-rendered popover for linking a value to a CSS variable
 *
 * Shows discovered CSS variables grouped by user-defined token collections,
 * with search filtering. Portal-rendered via createPortal to escape overflow.
 * Follows ResetPopover.tsx positioning and dismiss patterns.
 */

import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import { discoverVariables, discoverAllVariables, buildAliasGraph, type CSSVariable, type VarType, type AliasTier } from "../variables/discoverVariables";
import { inferAutoCollections } from "../variables/autoCollections";
import { useTokenCollections } from "../variables/tokenCollections";
import { X } from "lucide-react";
import { color, text, border, surface, font, shadow, primaryAlpha, zIndex } from "../theme";
import { ms } from "../timing";

export interface VariablePickerProps {
  anchor: HTMLElement;
  type: "color" | "length" | "all";
  /** Element for scoped discovery. If omitted, discovers all root variables. */
  element?: Element;
  onSelect: (varExpr: string) => void;
  onClose: () => void;
  activeVariable?: string | null;
  onUnlink?: () => void;
}

// ─── Type indicator ──────────────────────────────────────────────────

function TypeIndicator({ variable }: { variable: CSSVariable }) {
  if (variable.type === "color") {
    return (
      <span
        style={{
          width: 14,
          height: 14,
          borderRadius: 2,
          background: variable.value,
          border: `1px solid ${border.hover}`,
          flexShrink: 0,
        }}
      />
    );
  }
  return (
    <span
      style={{
        fontSize: 9,
        fontFamily: font.mono,
        color: text.hint,
        width: 14,
        textAlign: "center",
        flexShrink: 0,
      }}
    >
      {variable.type === "length" ? "px" : "#"}
    </span>
  );
}

// ─── Variable Row ────────────────────────────────────────────────────

function VarRow({
  variable,
  isActive,
  onSelect,
  aliasOf,
}: {
  variable: CSSVariable;
  isActive: boolean;
  onSelect: () => void;
  aliasOf?: string;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(); } }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 8px",
        borderRadius: 3,
        cursor: "pointer",
        background: isActive ? primaryAlpha(0.1) : hovered ? surface.hover : "transparent",
        transition: `background ${ms("fast")}`,
      }}
    >
      <TypeIndicator variable={variable} />
      <span
        style={{
          fontSize: 10,
          fontFamily: font.mono,
          color: isActive ? color.primary : text.primary,
          flex: 1,
          minWidth: 0,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
        title={variable.name}
      >
        {variable.name.replace(/^--/, "")}
      </span>
      {aliasOf ? (
        <span
          style={{
            fontSize: 9,
            fontFamily: font.mono,
            color: text.disabled,
            flexShrink: 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            maxWidth: 70,
          }}
          title={`Aliases ${aliasOf}`}
        >
          → {aliasOf.replace(/^--/, "")}
        </span>
      ) : (
        <span
          style={{
            fontSize: 9,
            fontFamily: font.mono,
            color: text.hint,
            flexShrink: 0,
            maxWidth: 60,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {variable.value}
        </span>
      )}
    </div>
  );
}

// ─── Group Header ────────────────────────────────────────────────────

function GroupHeader({ label }: { label: string }) {
  return (
    <div
      style={{
        fontSize: 9,
        fontWeight: 600,
        textTransform: "uppercase",
        letterSpacing: "0.04em",
        color: text.disabled,
        padding: "6px 8px 2px",
      }}
    >
      {label}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────

export function VariablePicker({
  anchor,
  type,
  element,
  onSelect,
  onClose,
  activeVariable,
  onUnlink,
}: VariablePickerProps) {
  const ref = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [search, setSearch] = useState("");
  const { collections, getCollectionForVariable, getManuallyAssignedNames } = useTokenCollections();

  // Discover variables
  const allVars = useMemo(() => {
    const vars = element ? discoverVariables(element) : discoverAllVariables();
    if (type === "all") return vars;
    return vars.filter((v) => v.type === type);
  }, [element, type]);

  // Build alias graph for alias-arrow display
  const aliasGraph = useMemo(() => buildAliasGraph(allVars), [allVars]);

  // Filter by search
  const filtered = useMemo(() => {
    if (!search.trim()) return allVars;
    const q = search.toLowerCase();
    return allVars.filter(
      (v) => v.name.toLowerCase().includes(q) || v.value.toLowerCase().includes(q),
    );
  }, [allVars, search]);

  // Group by collection
  const grouped = useMemo(() => {
    const groups = new Map<string, { label: string; vars: CSSVariable[] }>();
    const uncategorized: CSSVariable[] = [];

    for (const v of filtered) {
      const coll = getCollectionForVariable(v.name);
      if (coll) {
        let g = groups.get(coll.id);
        if (!g) {
          g = { label: coll.name, vars: [] };
          groups.set(coll.id, g);
        }
        g.vars.push(v);
      } else {
        uncategorized.push(v);
      }
    }

    // Order groups by collection order
    const ordered: { label: string; vars: CSSVariable[] }[] = [];
    for (const c of collections) {
      const g = groups.get(c.id);
      if (g && g.vars.length > 0) ordered.push(g);
    }
    return { ordered, uncategorized };
  }, [filtered, collections, getCollectionForVariable]);

  // Auto-group uncategorized variables by prefix
  const autoGrouped = useMemo(() => {
    if (grouped.uncategorized.length === 0) return [];
    return inferAutoCollections(grouped.uncategorized, new Set());
  }, [grouped.uncategorized]);

  // Position below anchor, clamped to viewport
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ar = anchor.getBoundingClientRect();
    const mr = el.getBoundingClientRect();
    let top = ar.bottom + 4;
    let left = ar.left;
    if (left + mr.width > window.innerWidth - 8) left = window.innerWidth - mr.width - 8;
    if (top + mr.height > window.innerHeight - 8) top = ar.top - mr.height - 4;
    if (left < 8) left = 8;
    if (top < 8) top = 8;
    setPos({ top, left });
  }, [anchor]);

  // Auto-focus search
  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  // Click-outside → close
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler, true);
    return () => document.removeEventListener("mousedown", handler, true);
  }, [onClose]);

  // Escape → close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.stopPropagation(); onClose(); }
    };
    document.addEventListener("keydown", handler, true);
    return () => document.removeEventListener("keydown", handler, true);
  }, [onClose]);

  const handleSelect = useCallback(
    (varName: string) => {
      onSelect(`var(${varName})`);
      onClose();
    },
    [onSelect, onClose],
  );

  const hasResults = grouped.ordered.length > 0 || grouped.uncategorized.length > 0;

  return createPortal(
    <div
      ref={ref}
      data-tuner-portal
      style={{
        position: "fixed",
        zIndex: zIndex.max,
        top: pos?.top ?? 0,
        left: pos?.left ?? 0,
        visibility: pos ? "visible" : "hidden",
        width: 240,
        maxHeight: 300,
        background: color.background,
        border: `1px solid ${border.default}`,
        borderRadius: 6,
        boxShadow: shadow.dropdown,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* Header with Connect title + optional unlink X */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "8px 8px 4px",
        flexShrink: 0,
      }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: text.primary }}>
          Connect
        </span>
        {onUnlink && (
          <button
            type="button"
            title="Unlink variable"
            onClick={(e) => { e.stopPropagation(); onUnlink(); onClose(); }}
            style={{
              background: "none",
              border: "none",
              padding: 0,
              cursor: "pointer",
              color: text.hint,
              display: "flex",
              alignItems: "center",
            }}
          >
            <X size={12} strokeWidth={2} />
          </button>
        )}
      </div>

      {/* Search */}
      <div style={{ padding: "6px 6px 4px", borderBottom: `1px solid ${border.subtle}`, flexShrink: 0 }}>
        <input
          ref={searchRef}
          type="text"
          placeholder="Search variables..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            width: "100%",
            height: 24,
            background: surface.subtle,
            border: `1px solid ${border.default}`,
            borderRadius: 4,
            padding: "0 6px",
            fontSize: 10,
            fontFamily: font.mono,
            color: text.primary,
            outline: "none",
            boxSizing: "border-box",
          }}
        />
      </div>

      {/* Scrollable list */}
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "2px 0" }}>
        {!hasResults ? (
          <div style={{ padding: "12px 8px", fontSize: 10, color: text.hint, textAlign: "center", fontStyle: "italic" }}>
            No variables found
          </div>
        ) : (
          <>
            {grouped.ordered.map((g, i) => (
              <div key={i}>
                <GroupHeader label={g.label} />
                {g.vars.map((v) => (
                  <VarRow
                    key={v.name}
                    variable={v}
                    isActive={activeVariable === v.name}
                    onSelect={() => handleSelect(v.name)}
                    aliasOf={v.aliasOf}
                  />
                ))}
              </div>
            ))}
            {grouped.uncategorized.length > 0 && (
              autoGrouped.length > 0 ? (
                autoGrouped.map((ac) => (
                  <div key={ac.id}>
                    <GroupHeader label={ac.name} />
                    {ac.variableNames.map((name) => {
                      const v = filtered.find((fv) => fv.name === name);
                      if (!v) return null;
                      return (
                        <VarRow
                          key={v.name}
                          variable={v}
                          isActive={activeVariable === v.name}
                          onSelect={() => handleSelect(v.name)}
                          aliasOf={v.aliasOf}
                        />
                      );
                    })}
                  </div>
                ))
              ) : (
                <div>
                  {grouped.ordered.length > 0 && <GroupHeader label="Uncategorized" />}
                  {grouped.uncategorized.map((v) => (
                    <VarRow
                      key={v.name}
                      variable={v}
                      isActive={activeVariable === v.name}
                      onSelect={() => handleSelect(v.name)}
                      aliasOf={v.aliasOf}
                    />
                  ))}
                </div>
              )
            )}
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
