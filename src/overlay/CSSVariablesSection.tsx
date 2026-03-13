/**
 * CSSVariablesSection.tsx — Discovers CSS custom properties (--*) on a selected
 * element and renders type-aware controls for live editing.
 *
 * Groups variables by source: Element, Inherited, Root.
 * Detects value types (color, length, number, string) and renders
 * appropriate controls for each.
 */

import React, { useState, useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";
import { applyCustomProperty, isCustomPropertyDirty, subscribeOverrides, getOverrideSnapshot } from "./apply";
import { StyleIndicator, type IndicatorType } from "./StyleIndicator";
import { Section, ColorRow, SliderRow } from "./controls";
import { discoverVariables, type CSSVariable } from "./discoverVariables";

// ─── Variable Row ────────────────────────────────────────────────────

// MONO constant removed — using Tailwind font-mono class instead

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
    <div className="flex items-center gap-1.5 px-3 py-0.5">
      {/* Variable name */}
      <span
        title={variable.name}
        className="w-[100px] text-[11px] font-mono text-[var(--muted-foreground)] shrink-0 truncate inline-flex items-center gap-1"
      >
        <StyleIndicator type={indicator} />
        {variable.name}
      </span>

      {/* Value input */}
      <input
        ref={inputRef}
        type="text"
        className={cn(
          "tuner-focusable flex-1 h-6 bg-[var(--input)] border border-[var(--border)] rounded px-1.5 text-[10px] font-mono text-[var(--foreground)] outline-none",
          focused && "border-[var(--ring)] ring-2 ring-[var(--ring)]"
        )}
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
    <div className="px-3 pt-2 pb-1 text-[10px] text-[var(--muted-foreground)] uppercase tracking-wider font-medium">
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
        <div className="px-3 py-2 text-[11px] text-[var(--muted-foreground)] italic">
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
