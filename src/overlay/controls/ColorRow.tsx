/**
 * controls/ColorRow.tsx — Color swatch row with picker, variable linking,
 * alias chain tooltip, and reset popover.
 */

import React, { useState, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { type IndicatorType } from "../theme";
import { getIndicatorTitle } from "../panelUtils";
import { ComputedTooltip } from "./ComputedTooltip";
import { ColorPickerEnhanced } from "./ColorPickerEnhanced";
import { hexToRgba } from "../colorUtils";
import { parseVarRef, resolveVarColor } from "../variables/colorVariables";
import { parseVarAlias } from "../variables/discoverVariables";
import { X } from "lucide-react";
import { VariableLinkDot } from "./VariableLinkDot";
import { VariableField } from "./VariableField";
import { ms } from "../timing";
import { color, text, font, layout, primaryAlpha, blackAlpha, checkerboard, zIndex } from "../theme";
import { labelStyle, rowStyle, actionsOverlayStyle, useResetPopover, usePressScale } from "./helpers";

/** Walk the alias chain for a CSS variable, returning all names in the chain. */
function resolveAliasChain(varName: string, maxDepth = 5): string[] {
  const chain = [varName];
  const visited = new Set([varName]);
  let current = varName;

  for (let i = 0; i < maxDepth; i++) {
    let raw: string | null = null;
    for (const sheet of Array.from(document.styleSheets)) {
      try {
        for (let j = 0; j < sheet.cssRules.length; j++) {
          const rule = sheet.cssRules[j];
          if (
            rule instanceof CSSStyleRule &&
            (rule.selectorText === ":root" || rule.selectorText === "html")
          ) {
            const val = rule.style.getPropertyValue(current).trim();
            if (val) { raw = val; break; }
          }
        }
      } catch { /* cross-origin */ }
      if (raw) break;
    }

    if (!raw) break;
    const alias = parseVarAlias(raw);
    if (!alias || visited.has(alias.target)) break;
    visited.add(alias.target);
    chain.push(alias.target);
    current = alias.target;
  }

  return chain;
}

export function ColorRow({
  label,
  value,
  onChange,
  onReset,
  indicator,
  onContextMenu,
  computedProp,
  computedElement,
  compact,
  labelWidth,
  actions,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** Called on alt+click label to reset property */
  onReset?: () => void;
  indicator?: IndicatorType;
  onContextMenu?: (e: React.MouseEvent) => void;
  /** CSS property name for computed tooltip (e.g. "color") */
  computedProp?: string;
  /** Target element for computed tooltip */
  computedElement?: Element;
  /** Compact mode: no horizontal padding, narrower label — for sub-layouts */
  compact?: boolean;
  /** Override default label width (e.g. for wider variable names) */
  labelWidth?: number;
  /** Optional action buttons rendered between label and swatch */
  actions?: React.ReactNode;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [rowHovered, setRowHovered] = useState(false);
  const swatchRef = useRef<HTMLDivElement>(null);
  const resetPopover = useResetPopover(indicator, onReset);
  const { pressHandlers: swatchPress, pressStyle: swatchPressStyle } = usePressScale(0.92);

  // Resolve var() references for display
  const varName = parseVarRef(value);
  const resolvedColor = varName ? resolveVarColor(value) : null;
  const displayColor = resolvedColor ?? value;
  const displayLabel = varName ? varName.replace(/^--/, "") : value;
  const pickerColor = resolvedColor ?? (value === "transparent" ? "#000000" : value);

  // Build alias chain tooltip (e.g. "button-bg -> primary-500 -> #3b82f6")
  const aliasChainTitle = useMemo(() => {
    if (!varName) return undefined;
    const chain = resolveAliasChain(varName);
    if (chain.length <= 1) return value; // no chain, just show raw var(--foo)
    return chain.map((n) => n.replace(/^--/, "")).join(" \u2192 ") + ` = ${displayColor}`;
  }, [varName, value, displayColor]);

  const colorLabelTitle = indicator ? getIndicatorTitle(indicator) : undefined;
  const compactLabelOverrides: React.CSSProperties = compact ? { width: layout.labelWidth, padding: 0, paddingLeft: 1 } : {};
  const widthOverrides: React.CSSProperties = labelWidth != null
    ? { width: labelWidth, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }
    : {};
  const labelContent = (
    <span
      ref={resetPopover.anchorRef}
      onClick={(e) => { if (e.altKey && onReset) { onReset(); return; } resetPopover.triggerOpen(); }}
      title={colorLabelTitle ?? label}
      style={{ ...labelStyle(indicator), ...compactLabelOverrides, ...widthOverrides }}
    >
      {label}
    </span>
  );

  const compactRowOverrides: React.CSSProperties = compact ? { padding: "4px 0", minHeight: 32, gap: 4 } : {};
  return (
    <div
      onContextMenu={onContextMenu}
      onClick={(e) => { if (e.altKey && onReset) { e.preventDefault(); onReset(); } }}
      onMouseEnter={() => setRowHovered(true)}
      onMouseLeave={() => setRowHovered(false)}
      style={{ ...rowStyle, position: "relative", ...compactRowOverrides }}
    >
      {computedProp && computedElement ? (
        <ComputedTooltip property={computedProp} element={computedElement}>
          {labelContent}
        </ComputedTooltip>
      ) : labelContent}
      {actions && (
        <div style={actionsOverlayStyle}>
          {actions}
        </div>
      )}
      <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 6, flex: varName ? undefined : 1, minWidth: 0 }}>
        {varName ? (
          <VariableField
            variableName={varName}
            variableType="color"
            element={computedElement}
            onSelectVariable={(varExpr) => onChange(varExpr)}
            onUnlink={() => {
              const fallback = resolvedColor
                ?? (computedElement ? getComputedStyle(computedElement).getPropertyValue(computedProp ?? "color").trim() : null);
              if (fallback) onChange(fallback);
            }}
          />
        ) : (
          <>
            <VariableLinkDot
              rowHovered={rowHovered}
              isLinked={false}
              variableType="color"
              onSelect={(varExpr) => onChange(varExpr)}
              activeVariable={null}
            />
            <div
              ref={swatchRef}
              className="tuner-focusable"
              tabIndex={0}
              role="button"
              onClick={() => setPickerOpen(!pickerOpen)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setPickerOpen(!pickerOpen);
                }
              }}
              onMouseDown={swatchPress.onMouseDown}
              onMouseUp={swatchPress.onMouseUp}
              onMouseLeave={swatchPress.onMouseLeave}
              style={{
                width: 20,
                height: 20,
                borderRadius: 2,
                cursor: "pointer",
                flexShrink: 0,
                background:
                  displayColor === "transparent"
                    ? checkerboard
                    : displayColor,
                border: `1px solid ${color.border}`,
                boxShadow: `inset 0 0 0 1px ${blackAlpha(0.06)}`,
                ...swatchPressStyle,
              }}
              title={aliasChainTitle}
            />
            <span
              title={aliasChainTitle}
              style={{
                fontSize: 10,
                fontFamily: font.mono,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap" as const,
                flex: 1,
                minWidth: 0,
                color: color.mutedForeground,
              }}
            >
              {displayLabel}
            </span>
          </>
        )}
      </div>
      {!varName && indicator === "modified" && onReset && (
        <button
          type="button"
          title="Reset to original value"
          onClick={(e) => {
            e.stopPropagation();
            onReset();
          }}
          onMouseDown={(e) => { (e.currentTarget as HTMLElement).style.transform = "scale(0.9)"; }}
          onMouseUp={(e) => { (e.currentTarget as HTMLElement).style.transform = ""; }}
          style={{
            background: "none",
            border: "none",
            padding: 0,
            cursor: "pointer",
            color: text.hint,
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            opacity: 0.5,
            transition: `opacity ${ms("fast")}, transform 80ms cubic-bezier(0.34, 1.56, 0.64, 1)`,
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = "1"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = "0.5"; }}
        >
          <X size={10} strokeWidth={2.5} />
        </button>
      )}
      {pickerOpen && swatchRef.current && (() => {
        const pickerWidth = 240 + 24; // width + padding
        const pickerHeight = 300;
        const gap = 4;
        const rect = swatchRef.current!.getBoundingClientRect();
        const spaceBelow = window.innerHeight - rect.bottom;
        const placeAbove = spaceBelow < pickerHeight + gap;
        const top = placeAbove
          ? rect.top - pickerHeight - gap
          : rect.bottom + gap;
        const left = Math.min(rect.left, window.innerWidth - pickerWidth - gap);
        return createPortal(
          <div data-tuner-portal style={{ position: "fixed", top, left, zIndex: zIndex.max }}>
            <ColorPickerEnhanced
              color={pickerColor}
              onChange={(hex, opacity) => {
                onChange(opacity < 1 ? hexToRgba(hex, opacity) : hex);
              }}
              onClose={() => setPickerOpen(false)}
              onSelectVariable={(varExpr) => {
                onChange(varExpr);
                setPickerOpen(false);
              }}
              activeVariable={varName}
            />
          </div>,
          document.body
        );
      })()}
      {resetPopover.node}
    </div>
  );
}
