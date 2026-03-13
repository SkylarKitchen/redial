/**
 * GlobalVariablesPanel.tsx — Global design system variables panel
 *
 * Shows ALL CSS custom properties from :root/html, grouped by category
 * (Colors, Spacing, Typography, Other) with type-aware editing controls.
 * Renders inside the same panel shell as the inspector.
 */

import React, { useState, useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { X } from "lucide-react";
import { discoverAllVariables, groupByCategory, type CSSVariable, type VarCategory } from "./discoverVariables";
import { applyCustomProperty, isCustomPropertyDirty, subscribeOverrides, getOverrideSnapshot } from "./apply";
import { Section, ColorRow } from "./controls";
import { ROW } from "./panelStyles";
import { text, border, surface, font, color, labelIndicator, labelHighlight } from "./theme";
import { ms } from "./timing";
import type { IndicatorType } from "./theme";

// ─── Helpers ─────────────────────────────────────────────────────────

function varLabel(name: string): string {
  return name.replace(/^--/, "");
}

const CATEGORY_LABELS: Record<VarCategory, string> = {
  colors: "Colors",
  spacing: "Spacing",
  typography: "Typography",
  other: "Other",
};

// ─── Variable Row (global scope) ─────────────────────────────────────

function GlobalVariableRow({ variable }: { variable: CSSVariable }) {
  const [draft, setDraft] = useState(variable.value);
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dirty = isCustomPropertyDirty(variable.name);

  useEffect(() => {
    if (!focused) setDraft(variable.value);
  }, [variable.value, focused]);

  const commit = useCallback(
    (newValue: string) => {
      const trimmed = newValue.trim();
      if (!trimmed) return;
      applyCustomProperty(document.documentElement, variable.name, trimmed);
    },
    [variable.name]
  );

  const handleBlur = useCallback(() => {
    setFocused(false);
    commit(draft);
  }, [draft, commit]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        commit(draft);
        (e.target as HTMLInputElement).blur();
      } else if (e.key === "Escape") {
        e.stopPropagation();
        setDraft(variable.value);
        setFocused(false);
        (e.target as HTMLInputElement).blur();
      }
    },
    [draft, commit, variable.value]
  );

  const indicator: IndicatorType = dirty ? "modified" : "none";
  const label = varLabel(variable.name);

  // Color → ColorRow
  if (variable.type === "color") {
    return (
      <ColorRow
        label={label}
        value={draft}
        onChange={(c) => { setDraft(c); commit(c); }}
        indicator={indicator}
      />
    );
  }

  // Non-color → text input
  return (
    <div style={ROW}>
      <span
        title={variable.name}
        style={{
          width: 140,
          fontSize: 11,
          fontFamily: font.mono,
          flexShrink: 0,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          display: "inline-flex",
          alignItems: "center",
        }}
      >
        <span style={{
          ...(indicator !== "none"
            ? { background: labelIndicator.modified.bg, color: labelIndicator.modified.text, ...labelHighlight }
            : { color: text.label }),
        }}>
          {label}
        </span>
      </span>
      <input
        ref={inputRef}
        type="text"
        className="tuner-focusable"
        style={{
          flex: 1,
          height: 24,
          background: surface.subtle,
          border: focused ? `1px solid ${color.primary}` : `1px solid ${border.default}`,
          borderRadius: 4,
          padding: "0 6px",
          fontSize: 10,
          fontFamily: font.mono,
          color: text.primary,
          outline: "none",
          boxShadow: focused ? `0 0 0 2px ${color.primary}33` : "none",
        }}
        tabIndex={0}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        onDoubleClick={(e) => e.currentTarget.select()}
      />
    </div>
  );
}

// ─── Main Panel ──────────────────────────────────────────────────────

export function GlobalVariablesPanel({ onClose }: { onClose: () => void }) {
  const [search, setSearch] = useState("");
  const overrideSnapshot = useSyncExternalStore(subscribeOverrides, getOverrideSnapshot);

  const allVars = useMemo(() => discoverAllVariables(), [overrideSnapshot]);

  const filtered = useMemo(() => {
    if (!search.trim()) return allVars;
    const q = search.toLowerCase();
    return allVars.filter((v) => v.name.toLowerCase().includes(q) || v.value.toLowerCase().includes(q));
  }, [allVars, search]);

  const grouped = useMemo(() => groupByCategory(filtered), [filtered]);

  return (
    <>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 12px 8px",
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
        <button
          onClick={onClose}
          style={{
            width: 24,
            height: 24,
            border: "none",
            background: "transparent",
            borderRadius: 4,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: text.label,
          }}
          title="Close"
        >
          <X size={14} strokeWidth={1.5} />
        </button>
      </div>

      {/* Search */}
      <div style={{ padding: "6px 12px", borderBottom: `1px solid ${border.subtle}`, flexShrink: 0 }}>
        <input
          type="text"
          placeholder="Filter variables..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            width: "100%",
            height: 26,
            background: surface.subtle,
            border: `1px solid ${border.default}`,
            borderRadius: 4,
            padding: "0 8px",
            fontSize: 11,
            fontFamily: font.mono,
            color: text.primary,
            outline: "none",
            boxSizing: "border-box",
          }}
        />
      </div>

      {/* Scrollable content */}
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", paddingTop: 4, paddingBottom: 4 }}>
        {filtered.length === 0 ? (
          <div style={{ padding: "16px 12px", fontSize: 11, color: text.label, fontStyle: "italic", textAlign: "center" }}>
            {search ? "No matching variables" : "No CSS custom properties found"}
          </div>
        ) : (
          (Object.keys(CATEGORY_LABELS) as VarCategory[]).map((cat) => {
            const vars = grouped[cat];
            if (vars.length === 0) return null;
            return (
              <Section key={cat} title={`${CATEGORY_LABELS[cat]} (${vars.length})`}>
                {vars.map((v) => (
                  <GlobalVariableRow key={v.name} variable={v} />
                ))}
              </Section>
            );
          })
        )}
      </div>
    </>
  );
}
