/**
 * CSSVariablesSection.tsx — Discovers CSS custom properties (--*) on a selected
 * element and renders type-aware controls for live editing.
 *
 * Groups variables by source: Element, Inherited, Root.
 * Detects value types (color, length, number, string) and renders
 * appropriate controls for each.
 */

import React, { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { applyCustomProperty, isCustomPropertyDirty } from "./apply";
import { StyleIndicator, type IndicatorType } from "./StyleIndicator";
import { Section, ColorRow, SliderRow } from "./controls";

// ─── Types ───────────────────────────────────────────────────────────

type VarSource = "element" | "inherited" | "root";
type VarType = "color" | "length" | "number" | "string";
interface CSSVariable {
  name: string;
  value: string;
  source: VarSource;
  type: VarType;
  /** For length values, the numeric part */
  numericValue?: number;
  /** For length values, the unit (px, em, rem, %, etc.) */
  unit?: string;
}

// ─── Color Detection ─────────────────────────────────────────────────

const HEX_RE = /^#([0-9a-f]{3,8})$/i;
const COMMON_COLOR_NAMES = new Set(["transparent", "currentcolor", "black", "white", "red", "blue", "green"]);

function isColorValue(value: string): boolean {
  const v = value.trim();
  if (!v) return false;
  if (HEX_RE.test(v)) return true;
  if (/^(rgb|rgba|hsl|hsla|oklch|oklab|lch|lab|color)\s*\(/i.test(v)) return true;
  if (COMMON_COLOR_NAMES.has(v.toLowerCase())) return true;
  return false;
}

// ─── Length / Number Detection ───────────────────────────────────────

const LENGTH_RE = /^(-?[\d.]+)(px|em|rem|%|vw|vh|vmin|vmax|ch|ex|lh|cap|ic|svw|svh|lvw|lvh|dvw|dvh|cm|mm|in|pt|pc|Q)$/;
const NUMBER_RE = /^-?[\d.]+$/;

function parseLength(value: string): { num: number; unit: string } | null {
  const m = value.trim().match(LENGTH_RE);
  if (!m) return null;
  const num = parseFloat(m[1]);
  return isNaN(num) ? null : { num, unit: m[2] };
}

function detectVarType(value: string): { type: VarType; numericValue?: number; unit?: string } {
  if (isColorValue(value)) return { type: "color" };
  const len = parseLength(value);
  if (len) return { type: "length", numericValue: len.num, unit: len.unit };
  if (NUMBER_RE.test(value.trim())) return { type: "number", numericValue: parseFloat(value) };
  return { type: "string" };
}

// ─── Recursive Rule Walker ──────────────────────────────────────────

function walkRules(rules: CSSRuleList, callback: (rule: CSSStyleRule) => void) {
  for (let i = 0; i < rules.length; i++) {
    const rule = rules[i];
    if (rule instanceof CSSStyleRule) {
      callback(rule);
    } else if ('cssRules' in rule) {
      // Handles CSSMediaRule, CSSSupportsRule, CSSLayerBlockRule
      walkRules((rule as CSSGroupingRule).cssRules, callback);
    }
  }
}

// ─── Variable Discovery ──────────────────────────────────────────────

function discoverVariables(element: Element): CSSVariable[] {
  const found = new Map<string, CSSVariable>();
  const rootStyles = getComputedStyle(document.documentElement);
  const elStyles = getComputedStyle(element);

  // 1. Walk stylesheets once — collect :root vars and element-matching vars
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      walkRules(sheet.cssRules, (rule) => {
        const isRoot = rule.selectorText === ":root" || rule.selectorText === "html";
        let matchesEl = false;
        if (!isRoot) {
          try { matchesEl = element.matches(rule.selectorText); } catch { /* invalid selector */ }
        }
        if (!isRoot && !matchesEl) return;

        for (let i = 0; i < rule.style.length; i++) {
          const prop = rule.style[i];
          if (!prop.startsWith("--")) continue;
          const value = (isRoot ? rootStyles : elStyles).getPropertyValue(prop).trim();
          if (value) {
            const detected = detectVarType(value);
            found.set(prop, {
              name: prop,
              value,
              source: matchesEl ? "element" : "root",
              ...detected,
            });
          }
        }
      });
    } catch {
      // Cross-origin stylesheets throw SecurityError — skip silently
    }
  }

  // 2. Check inline styles on the element itself
  const htmlEl = element as HTMLElement;
  if (htmlEl.style) {
    for (let i = 0; i < htmlEl.style.length; i++) {
      const prop = htmlEl.style[i];
      if (prop.startsWith("--")) {
        const value = htmlEl.style.getPropertyValue(prop).trim();
        if (value) {
          found.set(prop, { name: prop, value, source: "element", ...detectVarType(value) });
        }
      }
    }
  }

  // 3. Check ancestors for inherited variables (walk up the DOM)
  let ancestor = element.parentElement;
  while (ancestor && ancestor !== document.documentElement) {
    if (ancestor.style) {
      for (let i = 0; i < ancestor.style.length; i++) {
        const prop = ancestor.style[i];
        if (prop.startsWith("--") && !found.has(prop)) {
          const value = elStyles.getPropertyValue(prop).trim();
          if (value) {
            found.set(prop, { name: prop, value, source: "inherited", ...detectVarType(value) });
          }
        }
      }
    }
    ancestor = ancestor.parentElement;
  }

  return Array.from(found.values()).sort((a, b) => a.name.localeCompare(b.name));
}

// ─── Variable Row ────────────────────────────────────────────────────

const MONO = "ui-monospace, 'SF Mono', monospace";

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

  const indicator: IndicatorType = dirty
    ? "element"
    : variable.source === "element"
      ? "direct"
      : variable.source === "inherited"
        ? "inherited"
        : "none";

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
    return (
      <SliderRow
        label={label}
        value={variable.numericValue}
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
    return (
      <SliderRow
        label={label}
        value={variable.numericValue}
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
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "6px",
        padding: "2px 12px",
      }}
    >
      {/* Variable name */}
      <span
        title={variable.name}
        style={{
          width: "100px",
          fontSize: "11px",
          fontFamily: MONO,
          color: "rgba(255,255,255,0.6)",
          flexShrink: 0,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          display: "inline-flex",
          alignItems: "center",
          gap: "4px",
        }}
      >
        <StyleIndicator type={indicator} />
        {variable.name}
      </span>

      {/* Value input */}
      <input
        ref={inputRef}
        type="text"
        className="tuner-focusable"
        tabIndex={0}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        onDoubleClick={(e) => e.currentTarget.select()}
        style={{
          flex: 1,
          height: "22px",
          background: "rgba(255,255,255,0.06)",
          border: focused
            ? "1px solid rgba(99,102,241,0.5)"
            : "1px solid rgba(255,255,255,0.1)",
          borderRadius: "3px",
          color: "rgba(255,255,255,0.8)",
          fontSize: "10px",
          fontFamily: MONO,
          padding: "0 6px",
          outline: "none",
          boxShadow: focused ? "0 0 0 2px rgba(99,102,241,0.3)" : "none",
          boxSizing: "border-box",
        }}
      />
    </div>
  );
}

// ─── Group Header ────────────────────────────────────────────────────

function GroupHeader({ label, count }: { label: string; count: number }) {
  return (
    <div
      style={{
        padding: "6px 12px 2px",
        fontSize: "10px",
        color: "rgba(255,255,255,0.4)",
        fontWeight: 500,
        letterSpacing: "0.02em",
      }}
    >
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
  const variables = useMemo(() => discoverVariables(element), [element]);

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
        <div
          style={{
            padding: "8px 12px",
            fontSize: "11px",
            color: "rgba(255,255,255,0.3)",
            fontStyle: "italic",
          }}
        >
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
