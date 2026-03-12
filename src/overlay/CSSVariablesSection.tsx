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
import { Section } from "./controls";

// ─── Types ───────────────────────────────────────────────────────────

type VarSource = "element" | "inherited" | "root";
type VarType = "color" | "length" | "number" | "string";

interface CSSVariable {
  name: string;
  value: string;
  source: VarSource;
  type: VarType;
}

// ─── CSS Named Colors (subset for fast detection) ────────────────────

const CSS_NAMED_COLORS = new Set([
  "aliceblue", "antiquewhite", "aqua", "aquamarine", "azure",
  "beige", "bisque", "black", "blanchedalmond", "blue",
  "blueviolet", "brown", "burlywood", "cadetblue", "chartreuse",
  "chocolate", "coral", "cornflowerblue", "cornsilk", "crimson",
  "cyan", "darkblue", "darkcyan", "darkgoldenrod", "darkgray",
  "darkgreen", "darkgrey", "darkkhaki", "darkmagenta", "darkolivegreen",
  "darkorange", "darkorchid", "darkred", "darksalmon", "darkseagreen",
  "darkslateblue", "darkslategray", "darkslategrey", "darkturquoise",
  "darkviolet", "deeppink", "deepskyblue", "dimgray", "dimgrey",
  "dodgerblue", "firebrick", "floralwhite", "forestgreen", "fuchsia",
  "gainsboro", "ghostwhite", "gold", "goldenrod", "gray", "green",
  "greenyellow", "grey", "honeydew", "hotpink", "indianred", "indigo",
  "ivory", "khaki", "lavender", "lavenderblush", "lawngreen",
  "lemonchiffon", "lightblue", "lightcoral", "lightcyan",
  "lightgoldenrodyellow", "lightgray", "lightgreen", "lightgrey",
  "lightpink", "lightsalmon", "lightseagreen", "lightskyblue",
  "lightslategray", "lightslategrey", "lightsteelblue", "lightyellow",
  "lime", "limegreen", "linen", "magenta", "maroon", "mediumaquamarine",
  "mediumblue", "mediumorchid", "mediumpurple", "mediumseagreen",
  "mediumslateblue", "mediumspringgreen", "mediumturquoise",
  "mediumvioletred", "midnightblue", "mintcream", "mistyrose",
  "moccasin", "navajowhite", "navy", "oldlace", "olive", "olivedrab",
  "orange", "orangered", "orchid", "palegoldenrod", "palegreen",
  "paleturquoise", "palevioletred", "papayawhip", "peachpuff", "peru",
  "pink", "plum", "powderblue", "purple", "rebeccapurple", "red",
  "rosybrown", "royalblue", "saddlebrown", "salmon", "sandybrown",
  "seagreen", "seashell", "sienna", "silver", "skyblue", "slateblue",
  "slategray", "slategrey", "snow", "springgreen", "steelblue", "tan",
  "teal", "thistle", "tomato", "turquoise", "violet", "wheat", "white",
  "whitesmoke", "yellow", "yellowgreen", "transparent", "currentcolor",
]);

// ─── Value Type Detection ────────────────────────────────────────────

const HEX_RE = /^#([0-9a-f]{3,8})$/i;
const LENGTH_RE = /^-?[\d.]+\s*(px|em|rem|%|vw|vh|vmin|vmax|ch|ex|cm|mm|in|pt|pc|svw|svh|dvw|dvh|lvw|lvh|cqw|cqh)$/i;
const NUMBER_RE = /^-?[\d.]+$/;

function detectType(value: string): VarType {
  const v = value.trim();
  if (!v) return "string";

  // Color detection
  if (HEX_RE.test(v)) return "color";
  if (/^(rgb|rgba|hsl|hsla|oklch|oklab|lch|lab|color)\s*\(/i.test(v)) return "color";
  if (CSS_NAMED_COLORS.has(v.toLowerCase())) return "color";

  // Length detection
  if (LENGTH_RE.test(v)) return "length";

  // Number detection
  if (NUMBER_RE.test(v)) return "number";

  return "string";
}

// ─── Variable Discovery ──────────────────────────────────────────────

function discoverVariables(element: Element): CSSVariable[] {
  const found = new Map<string, CSSVariable>();

  // 1. Collect :root variables
  try {
    const rootStyles = getComputedStyle(document.documentElement);
    for (const sheet of Array.from(document.styleSheets)) {
      try {
        for (const rule of Array.from(sheet.cssRules)) {
          if (
            rule instanceof CSSStyleRule &&
            (rule.selectorText === ":root" || rule.selectorText === "html")
          ) {
            for (let i = 0; i < rule.style.length; i++) {
              const prop = rule.style[i];
              if (prop.startsWith("--")) {
                const value = rootStyles.getPropertyValue(prop).trim();
                if (value) {
                  found.set(prop, {
                    name: prop,
                    value,
                    source: "root",
                    type: detectType(value),
                  });
                }
              }
            }
          }
        }
      } catch {
        // Cross-origin stylesheets throw SecurityError — skip silently
      }
    }
  } catch {
    // Stylesheet access may fail in some environments
  }

  // 2. Collect variables from rules matching this element
  try {
    for (const sheet of Array.from(document.styleSheets)) {
      try {
        for (const rule of Array.from(sheet.cssRules)) {
          if (rule instanceof CSSStyleRule) {
            // Skip :root — already handled
            if (rule.selectorText === ":root" || rule.selectorText === "html") continue;
            try {
              if (element.matches(rule.selectorText)) {
                for (let i = 0; i < rule.style.length; i++) {
                  const prop = rule.style[i];
                  if (prop.startsWith("--")) {
                    const value = getComputedStyle(element).getPropertyValue(prop).trim();
                    if (value) {
                      found.set(prop, {
                        name: prop,
                        value,
                        source: "element",
                        type: detectType(value),
                      });
                    }
                  }
                }
              }
            } catch {
              // Invalid selectors can cause matches() to throw
            }
          }
        }
      } catch {
        // Cross-origin stylesheets
      }
    }
  } catch {
    // Stylesheet access may fail
  }

  // 3. Check inline styles on the element itself
  const htmlEl = element as HTMLElement;
  if (htmlEl.style) {
    for (let i = 0; i < htmlEl.style.length; i++) {
      const prop = htmlEl.style[i];
      if (prop.startsWith("--")) {
        const value = htmlEl.style.getPropertyValue(prop).trim();
        if (value) {
          found.set(prop, {
            name: prop,
            value,
            source: "element",
            type: detectType(value),
          });
        }
      }
    }
  }

  // 4. Check ancestors for inherited variables (walk up the DOM)
  let ancestor = element.parentElement;
  while (ancestor && ancestor !== document.documentElement) {
    if (ancestor.style) {
      for (let i = 0; i < ancestor.style.length; i++) {
        const prop = ancestor.style[i];
        if (prop.startsWith("--") && !found.has(prop)) {
          const value = getComputedStyle(element).getPropertyValue(prop).trim();
          if (value) {
            found.set(prop, {
              name: prop,
              value,
              source: "inherited",
              type: detectType(value),
            });
          }
        }
      }
    }
    ancestor = ancestor.parentElement;
  }

  // Sort alphabetically within groups
  return Array.from(found.values()).sort((a, b) => a.name.localeCompare(b.name));
}

// ─── Inline Color Swatch ─────────────────────────────────────────────

function ColorSwatch({ color }: { color: string }) {
  return (
    <div
      style={{
        width: "16px",
        height: "16px",
        borderRadius: "3px",
        background: color || "transparent",
        border: "1px solid rgba(255,255,255,0.15)",
        flexShrink: 0,
      }}
    />
  );
}

// ─── Variable Row ────────────────────────────────────────────────────

const MONO = "ui-monospace, 'SF Mono', monospace";

function VariableRow({
  variable,
  element,
  onDirtyChange,
}: {
  variable: CSSVariable;
  element: Element;
  onDirtyChange?: () => void;
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
      onDirtyChange?.();
    },
    [variable.name, variable.source, element, onDirtyChange]
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

      {/* Color swatch (for color-type variables) */}
      {variable.type === "color" && <ColorSwatch color={draft} />}

      {/* Value input */}
      <input
        ref={inputRef}
        type="text"
        className="tuner-focusable"
        tabIndex={0}
        value={focused ? draft : draft}
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
  onDirtyChange,
}: {
  element: Element;
  onDirtyChange?: () => void;
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
              onDirtyChange={onDirtyChange}
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
              onDirtyChange={onDirtyChange}
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
              onDirtyChange={onDirtyChange}
            />
          ))}
        </>
      )}
    </Section>
  );
}
