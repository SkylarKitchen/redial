/**
 * Panel.tsx — useDialKit()-powered control panel
 *
 * Takes a DialConfig from infer() and uses useDialKit() for state management.
 * DialRoot renders the controls inline. An effect watches resolved values
 * and applies changes to the DOM element via apply.ts.
 *
 * This replaces the manual Section[] → Folder/Slider/Color/Select mapping
 * with dialkit's native rendering, gaining presets, copy, and spring controls
 * for free.
 */

import { useEffect, useRef, useCallback, useMemo } from "react";
import { useDialKit, DialRoot } from "dialkit";
import type { DialConfig } from "dialkit";
import {
  applyInlineStyle,
  applyCustomProperty,
  applyTransition,
  resetProp,
} from "./apply";
import { applyClassStyle, getCustomProperties } from "./scope";
import type { Scope } from "./scope";
import { toCSSValue, flattenValues, SPACING_PROPS } from "./infer";

/** Properties that change the panel structure when modified (show/hide sub-controls) */
const STRUCTURAL_PROPS = new Set(["display", "position"]);

interface PanelProps {
  config: DialConfig;
  name: string;
  element: Element;
  varUnits: Record<string, string>;
  onDirtyChange?: () => void;
  /** Called when display or position changes — triggers panel re-inference */
  onStructuralChange?: () => void;
  scope?: Scope;
  activeClassName?: string | null;
  /** Custom spacing box model, rendered between Layout and Size sections */
  spacingSlot?: React.ReactNode;
}

export function Panel({
  config,
  name,
  element,
  varUnits,
  onDirtyChange,
  onStructuralChange,
  scope = "element",
  activeClassName,
  spacingSlot,
}: PanelProps) {
  const prevRef = useRef<Record<string, unknown> | null>(null);

  // Cache custom property scopes so we know where to apply --var changes
  const customPropScopes = useMemo(() => {
    const map = new Map<string, Element>();
    for (const cp of getCustomProperties(element)) {
      map.set(cp.name, cp.scope);
    }
    return map;
  }, [element]);

  // --- Action handler ---
  const handleAction = useCallback(
    (action: string) => {
      const actionKey = action.split(".").pop()!;
      switch (actionKey) {
        case "reset-spacing":
          for (const prop of SPACING_PROPS) {
            resetProp(element, prop);
          }
          break;
        case "center":
          applyInlineStyle(element, "justify-content", "center");
          applyInlineStyle(element, "align-items", "center");
          break;
        case "fill":
          applyInlineStyle(element, "width", "100%");
          applyInlineStyle(element, "height", "100%");
          break;
      }
      onDirtyChange?.();
    },
    [element, onDirtyChange]
  );

  // --- useDialKit: registers panel, returns resolved values ---
  const values = useDialKit(name, config, { onAction: handleAction });

  // --- Apply resolved values to the element ---
  useEffect(() => {
    const flat = flattenValues(values as Record<string, unknown>);
    const prev = prevRef.current;

    if (!prev) {
      // First render — snapshot defaults, don't apply anything
      prevRef.current = flat;
      return;
    }

    let changed = false;
    let needsReinfer = false;

    for (const [prop, value] of Object.entries(flat)) {
      if (value === prev[prop]) continue;

      // Spring/transition configs → convert to CSS transition
      if (
        prop === "transition" &&
        typeof value === "object" &&
        value !== null &&
        "type" in value
      ) {
        applyTransition(
          element,
          value as {
            type: string;
            visualDuration?: number;
            bounce?: number;
            duration?: number;
            ease?: number[];
          }
        );
        changed = true;
        continue;
      }

      // Compute CSS value (with unit handling for custom properties)
      let cssValue: string | null;
      if (prop.startsWith("--") && typeof value === "number") {
        const unit = varUnits[prop] ?? "";
        cssValue = `${value}${unit}`;
      } else {
        cssValue = toCSSValue(prop, value);
      }
      if (cssValue === null) continue;

      // Route through appropriate scope
      if (prop.startsWith("--")) {
        const scopeEl = customPropScopes.get(prop) ?? document.documentElement;
        applyCustomProperty(scopeEl, prop, cssValue);
      } else if (scope === "class" && activeClassName) {
        applyClassStyle(activeClassName, prop, cssValue);
      } else {
        applyInlineStyle(element, prop, cssValue);
      }
      changed = true;

      // Structural properties change the panel layout — schedule re-inference
      if (STRUCTURAL_PROPS.has(prop)) {
        needsReinfer = true;
      }
    }

    prevRef.current = flat;
    if (changed) onDirtyChange?.();

    // Defer re-inference so the style change is applied before we re-read computed styles
    if (needsReinfer && onStructuralChange) {
      requestAnimationFrame(() => onStructuralChange());
    }
  }, [values, element, scope, activeClassName, varUnits, customPropScopes, onDirtyChange, onStructuralChange]);

  // Spacing box model is rendered before DialKit sections since we can't inject
  // between DialRoot's rendered folders. Visual order: Spacing → Layout → Size → ...
  return (
    <>
      {spacingSlot && (
        <div style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div
            style={{
              padding: "10px 12px 2px",
              fontSize: "13px",
              fontWeight: 500,
              color: "rgba(255,255,255,0.85)",
            }}
          >
            Spacing
          </div>
          {spacingSlot}
        </div>
      )}
      <DialRoot mode="inline" defaultOpen />
    </>
  );
}
