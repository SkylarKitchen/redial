/**
 * WebflowPanel.tsx — Orchestrator for the CSS property panel.
 *
 * Owns cross-section state (display, columnGap, derived flags) and
 * renders 8 section components + CSSVariablesSection. Each section
 * receives a SectionCtx prop bundle for element/apply/indicator access.
 */

import { useState, useCallback, useEffect, useMemo } from "react";
import type { SpacingValues } from "./infer";
import { applyInlineStyle } from "./apply";
import { buildConversionContext } from "./unitConversion";
import type { IndicatorType } from "./StyleIndicator";
import { parseNum } from "./cssParsers";
import { getIndicatorType, detectUnit, isTextBearing, type SectionCtx } from "./panelUtils";
import { sectionMatchesQuery } from "./PropertySearch";
import { PropertyContextMenu, type ContextMenuState } from "./PropertyContextMenu";

import { LayoutSection } from "./LayoutSection";
import { SpacingSection } from "./SpacingSection";
import { SizeSection } from "./SizeSection";
import { PositionSection } from "./PositionSection";
import { TypographySection } from "./TypographySection";
import { BackgroundsSection } from "./BackgroundsSection";
import { BordersSection } from "./BordersSection";
import { EffectsSection } from "./EffectsSection";
import { CSSVariablesSection } from "./CSSVariablesSection";

// ─── Props ───────────────────────────────────────────────────────────

export interface WebflowPanelProps {
  element: Element;
  spacing: SpacingValues;
  onSpacingChange: (prop: string, value: number, unit: string) => void;
  showGridOverlay?: boolean;
  onToggleGridOverlay?: () => void;
  showBoxModel?: boolean;
  onToggleBoxModel?: () => void;
  searchQuery?: string;
}

// ─── Main Component ──────────────────────────────────────────────────

export function WebflowPanel({ element, spacing, onSpacingChange, showGridOverlay, onToggleGridOverlay, showBoxModel, onToggleBoxModel, searchQuery = "" }: WebflowPanelProps) {
  // Read computed styles once on mount
  const [cs] = useState(() => getComputedStyle(element));
  const [parentCs] = useState(() => element.parentElement ? getComputedStyle(element.parentElement) : null);

  /** Build fresh conversion context on demand */
  const getConversionCtx = useCallback(() => buildConversionContext(element), [element]);

  // Inject :focus-visible styles for keyboard navigation
  useEffect(() => {
    const id = 'tuner-focus-styles';
    if (!document.getElementById(id)) {
      const style = document.createElement('style');
      style.id = id;
      style.textContent = `.tuner-focusable:focus-visible { outline: 1px solid rgba(99,102,241,0.5); outline-offset: 1px; }`;
      document.head.appendChild(style);
    }
    return () => { document.getElementById(id)?.remove(); };
  }, []);

  // ── Indicator helpers ──
  const ind = useCallback(
    (prop: string) => getIndicatorType(element, prop, cs, parentCs),
    [element, cs, parentCs]
  );

  const sectionInd = useCallback(
    (props: string[]): IndicatorType => {
      const PRIORITY: IndicatorType[] = ["element", "direct", "state", "inherited"];
      for (const p of PRIORITY) {
        if (props.some(prop => ind(prop) === p)) return p;
      }
      return "none";
    },
    [ind],
  );

  // ── Apply helper ──
  const apply = useCallback(
    (prop: string, value: string) => { applyInlineStyle(element, prop, value); },
    [element]
  );

  // ── Context menu state (right-click property menu) ──
  const [ctxMenuState, setCtxMenuState] = useState<ContextMenuState | null>(null);

  /** Creates an onContextMenu handler for a given CSS property + current value */
  const ctxMenu = useCallback(
    (prop: string, value: string) => (e: React.MouseEvent) => {
      e.preventDefault();
      setCtxMenuState({ x: e.clientX, y: e.clientY, property: prop, value });
    },
    [],
  );
  const closeCtxMenu = useCallback(() => setCtxMenuState(null), []);

  // ── Cross-section state ──
  const [display, setDisplay] = useState(() => cs.display);
  const [columnGap, setColumnGap] = useState(() => parseNum(cs.columnGap));
  const [columnGapUnit, setColumnGapUnit] = useState(() => detectUnit(element, "column-gap"));

  // ── Derived flags ──
  const isFlex = display === "flex" || display === "inline-flex";
  const isGrid = display === "grid" || display === "inline-grid";
  const parentIsFlex = parentCs != null && (parentCs.display === "flex" || parentCs.display === "inline-flex");
  const parentIsGrid = parentCs != null && (parentCs.display === "grid" || parentCs.display === "inline-grid");
  const isMedia = ["img", "video", "canvas"].includes(element.tagName.toLowerCase());
  const showTypography = isTextBearing(element);

  // ── SectionCtx bundle ──
  const ctx: SectionCtx = useMemo(() => ({
    element, apply, ind, sectionInd, cs, parentCs, getConversionCtx,
  }), [element, apply, ind, sectionInd, cs, parentCs, getConversionCtx]);

  // ── Search helpers ──
  const isSearching = searchQuery.length > 0;
  const showSection = (name: string) => sectionMatchesQuery(name, searchQuery);
  const forceOpen = isSearching;
  const noResults = isSearching && !["Layout", "Spacing", "Size", "Position", "Typography", "Backgrounds", "Borders", "Effects"].some(s => showSection(s));

  // ── Render ──
  return (
    <div style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}>
      {noResults && (
        <div style={{ textAlign: "center", color: "rgba(255,255,255,0.3)", padding: "40px 20px", fontSize: "12px" }}>
          No matching properties
        </div>
      )}

      {/* 1. Layout */}
      {showSection("Layout") && (
        <LayoutSection
          ctx={ctx}
          display={display}
          onDisplayChange={setDisplay}
          columnGap={columnGap}
          columnGapUnit={columnGapUnit}
          onColumnGapChange={setColumnGap}
          onColumnGapUnitChange={setColumnGapUnit}
          isFlex={isFlex}
          isGrid={isGrid}
          parentIsFlex={parentIsFlex}
          parentIsGrid={parentIsGrid}
          showGridOverlay={showGridOverlay}
          onToggleGridOverlay={onToggleGridOverlay}
          forceOpen={forceOpen}
        />
      )}

      {/* 2. Spacing */}
      {showSection("Spacing") && (
        <SpacingSection
          ctx={ctx}
          spacing={spacing}
          onSpacingChange={onSpacingChange}
          showBoxModel={showBoxModel}
          onToggleBoxModel={onToggleBoxModel}
          forceOpen={forceOpen}
        />
      )}

      {/* 3. Size */}
      {showSection("Size") && (
        <SizeSection
          ctx={ctx}
          display={display}
          isMedia={isMedia}
          forceOpen={forceOpen}
        />
      )}

      {/* 4. Position */}
      {showSection("Position") && (
        <PositionSection ctx={ctx} forceOpen={forceOpen} />
      )}

      {/* 5. Typography */}
      {showTypography && showSection("Typography") && (
        <TypographySection
          ctx={ctx}
          columnGap={columnGap}
          columnGapUnit={columnGapUnit}
          onColumnGapChange={setColumnGap}
          onColumnGapUnitChange={setColumnGapUnit}
          forceOpen={forceOpen}
        />
      )}

      {/* 6. Backgrounds */}
      {showSection("Backgrounds") && (
        <BackgroundsSection ctx={ctx} forceOpen={forceOpen} />
      )}

      {/* 7. Borders */}
      {showSection("Borders") && (
        <BordersSection ctx={ctx} forceOpen={forceOpen} />
      )}

      {/* 8. Effects */}
      {showSection("Effects") && (
        <EffectsSection ctx={ctx} forceOpen={forceOpen} />
      )}

      {/* 9. CSS Variables */}
      <CSSVariablesSection element={element} />
    </div>
  );
}
