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
  focusMode?: boolean;
}

// ─── Main Component ──────────────────────────────────────────────────

export function WebflowPanel({ element, spacing, onSpacingChange, showGridOverlay, onToggleGridOverlay, showBoxModel, onToggleBoxModel, searchQuery = "", focusMode = false }: WebflowPanelProps) {
  // Read computed styles once on mount
  const [cs] = useState(() => getComputedStyle(element));
  const [parentCs] = useState(() => element.parentElement ? getComputedStyle(element.parentElement) : null);

  // ── Focus mode: only one section open at a time ──
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const handleSectionToggle = useCallback((title: string) => {
    setExpandedSection(prev => prev === title ? null : title);
  }, []);

  /** Build fresh conversion context on demand */
  const getConversionCtx = useCallback(() => buildConversionContext(element), [element]);

  // Inject :focus-visible styles for keyboard navigation
  useEffect(() => {
    const id = 'tuner-focus-styles';
    if (!document.getElementById(id)) {
      const style = document.createElement('style');
      style.id = id;
      style.textContent = `.tuner-focusable:focus-visible { outline: 1px solid rgba(193,122,80,0.5); outline-offset: 1px; }`;
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
    element, apply, ind, sectionInd, cs, parentCs, getConversionCtx, ctxMenu,
  }), [element, apply, ind, sectionInd, cs, parentCs, getConversionCtx, ctxMenu]);

  // ── Search helpers ──
  const isSearching = searchQuery.length > 0;
  const showSection = (name: string) => sectionMatchesQuery(name, searchQuery);
  const forceOpen = isSearching;
  const noResults = isSearching && !["Layout", "Spacing", "Size", "Position", "Typography", "Backgrounds", "Borders", "Effects"].some(s => showSection(s));

  /** Focus-mode props for a named section */
  const focusProps = (name: string) => focusMode && !isSearching ? {
    focusOpen: expandedSection === name,
    onToggle: handleSectionToggle,
  } : {};

  // ── Render ──
  return (
    <div className="font-sans">
      {noResults && (
        <div className="text-center text-[rgba(0,0,0,0.25)] px-5 py-10 text-xs">
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
          {...focusProps("Layout")}
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
          {...focusProps("Spacing")}
        />
      )}

      {/* 3. Size */}
      {showSection("Size") && (
        <SizeSection
          ctx={ctx}
          display={display}
          isMedia={isMedia}
          forceOpen={forceOpen}
          {...focusProps("Size")}
        />
      )}

      {/* 4. Position */}
      {showSection("Position") && (
        <PositionSection ctx={ctx} forceOpen={forceOpen} {...focusProps("Position")} />
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
          {...focusProps("Typography")}
        />
      )}

      {/* 6. Backgrounds */}
      {showSection("Backgrounds") && (
        <BackgroundsSection ctx={ctx} forceOpen={forceOpen} {...focusProps("Backgrounds")} />
      )}

      {/* 7. Borders */}
      {showSection("Borders") && (
        <BordersSection ctx={ctx} forceOpen={forceOpen} {...focusProps("Borders")} />
      )}

      {/* 8. Effects */}
      {showSection("Effects") && (
        <EffectsSection ctx={ctx} forceOpen={forceOpen} {...focusProps("Effects")} />
      )}

      {/* 9. CSS Variables — hide during search to avoid leaking below "No results" */}
      {!isSearching && <CSSVariablesSection element={element} />}

      {/* Right-click property context menu */}
      {ctxMenuState && (
        <PropertyContextMenu
          x={ctxMenuState.x}
          y={ctxMenuState.y}
          property={ctxMenuState.property}
          value={ctxMenuState.value}
          element={element}
          onClose={closeCtxMenu}
        />
      )}
    </div>
  );
}
