/**
 * CSSVariablesSection.tsx — Discovers CSS custom properties (--*) on a selected
 * element and renders type-aware controls for live editing.
 *
 * Groups variables by source: Element, Inherited, Root.
 * Detects value types (color, length, number, string) and renders
 * appropriate controls for each.
 */

import React, { useState, useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { applyCustomProperty, isCustomPropertyDirty, subscribeOverrides, getOverrideSnapshot } from "../core/apply";
import type { IndicatorType } from "../theme";
import { Section, ColorRow, SliderRow } from "../controls";
import { discoverVariables, type CSSVariable } from "../variables/discoverVariables";
import { ROW, SUB_LABEL } from "../panelStyles";
import { text, border, surface, font, color, focusRing, labelIndicator, labelHighlight } from "../theme";

// ─── Variable Row ────────────────────────────────────────────────────

// MONO constant removed — using theme.font.mono token instead

/** Trim "--" prefix and truncate for display as a label. */
function varLabel(name: string): string {
  return name.replace(/^--/, "");
}

/** Sensible slider bounds based on CSS unit. */
function boundsForUnit(unit: string): { min: number; max: number; step: number } {
  switch (unit) {
    case "%":
    case "vw":
    case "vh":
    case "vmin":
    case "vmax":
    case "svw":
    case "svh":
    case "lvw":
    case "lvh":
    case "dvw":
    case "dvh":
      return { min: 0, max: 100, step: 1 };
    case "em":
    case "rem":
    case "lh":
    case "ch":
    case "ex":
    case "cap":
    case "ic":
      return { min: 0, max: 10, step: 0.1 };
    default: // px, cm, mm, in, pt, pc, Q
      return { min: 0, max: 500, step: 1 };
  }
}

function VariableRow({
  variable,
  element,
}: {
  variable: CSSVariable;
  element: Element;
}) {
  const [draft, setDraft] = useState(variable.value);
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dirty = isCustomPropertyDirty(variable.name);

  // Sync draft with external value when not focused
  useEffect(() => {
    if (!focused) setDraft(variable.value);
  }, [variable.value, focused]);

  const commit = useCallback(
    (newValue: string) => {
      const trimmed = newValue.trim();
      if (!trimmed) return;

      const scope =
        variable.source === "element" ? element : document.documentElement;
      applyCustomProperty(scope, variable.name, trimmed);
    },
    [variable.name, variable.source, element]
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

  // ── Color type → ColorRow ──────────────────────────────────────────
  if (variable.type === "color") {
    return (
      <ColorRow
        label={label}
        value={draft}
        onChange={(color) => {
          setDraft(color);
          commit(color);
        }}
        indicator={indicator}
      />
    );
  }

  // ── Length type → SliderRow ────────────────────────────────────────
  if (variable.type === "length" && variable.numericValue != null && variable.unit) {
    const bounds = boundsForUnit(variable.unit);
    const draftNum = parseFloat(draft) ?? variable.numericValue;
    return (
      <SliderRow
        label={label}
        value={isNaN(draftNum) ? variable.numericValue : draftNum}
        min={bounds.min}
        max={bounds.max}
        step={bounds.step}
        unit={variable.unit}
        onChange={(num) => {
          const newValue = `${num}${variable.unit}`;
          setDraft(newValue);
          commit(newValue);
        }}
        indicator={indicator}
      />
    );
  }

  // ── Number type → SliderRow (unitless) ─────────────────────────────
  if (variable.type === "number" && variable.numericValue != null) {
    const draftNum = parseFloat(draft) ?? variable.numericValue;
    return (
      <SliderRow
        label={label}
        value={isNaN(draftNum) ? variable.numericValue : draftNum}
        min={0}
        max={100}
        step={1}
        unit=""
        onChange={(num) => {
          const newValue = String(num);
          setDraft(newValue);
          commit(newValue);
        }}
        indicator={indicator}
      />
    );
  }

  // ── String / fallback → plain text input ──────────────────────────
  return (
    <div style={ROW}>
      {/* Variable name */}
      <span
        title={`${variable.name}${indicator !== "none" ? " — Option+Click to reset" : ""}`}
        style={{
          width: 100,
          fontSize: 11,
          fontFamily: font.mono,
          flexShrink: 0,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          display: "inline-flex",
          alignItems: "center",
          cursor: indicator !== "none" ? "default" : undefined,
        }}
        onClick={(e) => {
          if (e.altKey && indicator !== "none") {
            const scope = variable.source === "element" ? element : document.documentElement;
            (scope as HTMLElement).style.removeProperty(variable.name);
            setDraft(variable.value);
          }
        }}
      >
        <span style={{
          ...(indicator !== "none"
            ? { background: labelIndicator.modified.bg, color: labelIndicator.modified.text, ...labelHighlight }
            : { color: text.label }),
        }}>
          {variable.name}
        </span>
      </span>

      {/* Value input */}
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
          boxShadow: focused ? focusRing : "none",
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

// ─── Group Header ────────────────────────────────────────────────────

function GroupHeader({ label, count }: { label: string; count: number }) {
  return (
    <div style={{
      padding: "8px 12px 4px",
      fontSize: 10,
      color: text.label,
      textTransform: "uppercase" as const,
      letterSpacing: "0.05em",
      fontWeight: 500,
    }}>
      {label} ({count})
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────

export function CSSVariablesSection({
  element,
}: {
  element: Element;
}) {
  // Re-discover variables when overrides change (e.g. after applyCustomProperty)
  const overrideSnapshot = useSyncExternalStore(subscribeOverrides, getOverrideSnapshot);
  const variables = useMemo(() => discoverVariables(element), [element, overrideSnapshot]);

  const grouped = useMemo(() => {
    const elementVars: CSSVariable[] = [];
    const inheritedVars: CSSVariable[] = [];
    const rootVars: CSSVariable[] = [];

    for (const v of variables) {
      if (v.source === "element") elementVars.push(v);
      else if (v.source === "inherited") inheritedVars.push(v);
      else rootVars.push(v);
    }

    return { elementVars, inheritedVars, rootVars };
  }, [variables]);

  if (variables.length === 0) {
    return (
      <Section title="CSS Variables" collapsed>
        <div style={{ padding: "8px 12px", fontSize: 11, color: text.label, fontStyle: "italic" }}>
          No custom properties
        </div>
      </Section>
    );
  }

  return (
    <Section title="CSS Variables" collapsed>
      {grouped.elementVars.length > 0 && (
        <>
          <GroupHeader label="Element" count={grouped.elementVars.length} />
          {grouped.elementVars.map((v) => (
            <VariableRow
              key={v.name}
              variable={v}
              element={element}

            />
          ))}
        </>
      )}

      {grouped.inheritedVars.length > 0 && (
        <>
          <GroupHeader label="Inherited" count={grouped.inheritedVars.length} />
          {grouped.inheritedVars.map((v) => (
            <VariableRow
              key={v.name}
              variable={v}
              element={element}

            />
          ))}
        </>
      )}

      {grouped.rootVars.length > 0 && (
        <>
          <GroupHeader label="Root" count={grouped.rootVars.length} />
          {grouped.rootVars.map((v) => (
            <VariableRow
              key={v.name}
              variable={v}
              element={element}

            />
          ))}
        </>
      )}
    </Section>
  );
}
