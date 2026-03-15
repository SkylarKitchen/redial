/**
 * WebflowPanel.tsx — Orchestrator for the CSS property panel.
 *
 * Owns cross-section state (display, columnGap, derived flags) and
 * renders 8 section components + CSSVariablesSection. Each section
 * receives a SectionCtx prop bundle for element/apply/indicator access.
 */

import { useState, useCallback, useEffect, useMemo } from "react";
import type { SpacingValues } from "./core/infer";
import { applyInlineStyle, stateKey } from "./core/apply";
import { applyClassStyle, isTailwindElement, type Scope } from "./core/scope";
import { applyStateStyle } from "./core/statePreview";
import { buildConversionContext } from "./unitConversion";
import type { IndicatorType } from "./theme";
import { parseNum } from "./cssParsers";
import { getIndicatorType, detectUnit, isTextBearing, type SectionCtx } from "./panelUtils";
import { sectionMatchesQuery } from "./PropertySearch";
import { PropertyContextMenu, type ContextMenuState } from "./PropertyContextMenu";
import { SectionMemoryProvider } from "./controls";

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
  onSpacingReset?: (prop: string, value: number) => void;
  showGridOverlay?: boolean;
  onToggleGridOverlay?: () => void;
  searchQuery?: string;
  focusMode?: boolean;
  scope?: Scope;
  activeClassName?: string | null;
  /** Active pseudo-class state ("none" = base styles, "hover", "focus", etc.) */
  activeState?: string;
  /** Controlled expanded section (from Overlay keyboard navigation) */
  expandedSection?: string | null;
  /** Callback when section is toggled (for controlled mode) */
  onExpandSection?: (section: string | null) => void;
  /** Persisted section open/closed state (survives element re-selection) */
  sectionMemory?: Record<string, boolean>;
  /** Callback to update section memory */
  onSectionMemoryChange?: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
}

// ─── Main Component ──────────────────────────────────────────────────

export function WebflowPanel({ element, spacing, onSpacingChange, onSpacingReset, showGridOverlay, onToggleGridOverlay, searchQuery = "", focusMode = false, scope = "element", activeClassName, activeState = "none", expandedSection: controlledSection, onExpandSection, sectionMemory, onSectionMemoryChange }: WebflowPanelProps) {
  // Read computed styles once on mount
  const [cs] = useState(() => getComputedStyle(element));
  const [parentCs] = useState(() => element.parentElement ? getComputedStyle(element.parentElement) : null);

  // ── Focus mode: only one section open at a time ──
  // Controlled mode (props) or uncontrolled (local state)
  const [localSection, setLocalSection] = useState<string | null>(null);
  const expandedSection = controlledSection !== undefined ? controlledSection : localSection;
  const setExpandedSection = onExpandSection ?? setLocalSection;
  const handleSectionToggle = useCallback((title: string) => {
    setExpandedSection(expandedSection === title ? null : title);
  }, [expandedSection, setExpandedSection]);

  /** Build fresh conversion context on demand */
  const getConversionCtx = useCallback(() => buildConversionContext(element), [element]);

  // Inject :focus-visible styles for keyboard navigation
  useEffect(() => {
    const id = 'tuner-focus-styles';
    if (!document.getElementById(id)) {
      const style = document.createElement('style');
      style.id = id;
      style.textContent = `.tuner-focusable:focus-visible { outline: none; box-shadow: 0 0 0 2px rgba(59,130,246,0.3); }`;
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
      return props.some((p) => ind(p) === "modified") ? "modified" : "none";
    },
    [ind],
  );

  // ── Apply helper (scope-aware + state-aware) ──
  const apply = useCallback(
    (prop: string, value: string) => {
      if (activeState && activeState !== "none") {
        // Pseudo-class state: inject via <style> tag for immediate preview
        applyStateStyle(element, activeState, prop, value);
        // Also track in apply.ts overrides map using composite key (for undo/diff)
        applyInlineStyle(element, stateKey(activeState, prop), value);
        return;
      }
      if (scope === "class" && activeClassName) {
        applyClassStyle(activeClassName, prop, value);
      }
      applyInlineStyle(element, prop, value, scope === "class" ? activeClassName ?? undefined : undefined);
    },
    [element, scope, activeClassName, activeState]
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
  const isBlockContainer = ["div", "section", "article", "main", "nav", "aside", "header", "footer"].includes(element.tagName.toLowerCase());
  const showTypography = isTextBearing(element);

  // ── Tailwind detection ──
  const isTailwind = useMemo(() => isTailwindElement(element), [element]);

  // ── SectionCtx bundle ──
  const ctx: SectionCtx = useMemo(() => ({
    element, apply, ind, sectionInd, cs, parentCs, getConversionCtx, ctxMenu, isTailwind,
  }), [element, apply, ind, sectionInd, cs, parentCs, getConversionCtx, ctxMenu, isTailwind]);

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
    <SectionMemoryProvider
      memory={sectionMemory ?? {}}
      onUpdate={(name, open) => onSectionMemoryChange?.(prev => ({ ...prev, [name]: open }))}
    >
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
          isBlockContainer={isBlockContainer}
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
          onSpacingReset={onSpacingReset}
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
    </SectionMemoryProvider>
  );
}
