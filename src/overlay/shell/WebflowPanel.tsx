/**
 * WebflowPanel.tsx — Orchestrator for the CSS property panel.
 *
 * Owns cross-section state (display, columnGap, derived flags) and
 * renders 8 section components. Each section
 * receives a SectionCtx prop bundle for element/apply/indicator access.
 */

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { X } from "lucide-react";
import type { SpacingValues } from "../core/infer";
import { isTailwindElement } from "../core/scope";
import { classifyStylingSystem } from "../core/stylingSystem";
import { styleEngine, resolveTarget, type ScopeContext } from "../core/engine";
import { resetProp, resetAndReadNum, resetAndReadStr } from "../core/apply";
import { buildConversionContext } from "../unitConversion";
import { type IndicatorType, focusRing, text, border, warningAlpha } from "../theme";
import { parseNum } from "../cssParsers";
import { getIndicatorType, detectUnit, isTextBearing, type SectionCtx } from "../panelUtils";
import { sectionMatchesQuery } from "./PropertySearch";
import { PropertyContextMenu, type ContextMenuState } from "./PropertyContextMenu";
import { SectionMemoryProvider } from "../controls";
import { managedSheet } from "../core/managedSheet";

import { LayoutSection } from "../sections/LayoutSection";
import { SpacingSection } from "../sections/SpacingSection";
import { SizeSection } from "../sections/SizeSection";
import { PositionSection } from "../sections/PositionSection";
import { TypographySection } from "../sections/TypographySection";
import { BackgroundsSection } from "../sections/BackgroundsSection";
import { BordersSection } from "../sections/BordersSection";
import { EffectsSection } from "../sections/EffectsSection";
import { CustomPropertiesSection } from "../sections/CustomPropertiesSection";


const EMPTY_MEMORY: Record<string, boolean> = {};

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
  /** The panel's active scoping bundle (scope ▸ class ▸ state ▸ breakpoint) —
   *  Overlay's ONE memoized `scopeCtx`, never drilled per-dimension. */
  scopeCtx?: ScopeContext;
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

const DEFAULT_SCOPE_CTX: ScopeContext = {
  scope: "element",
  activeClassName: null,
  activeState: "none",
};

export function WebflowPanel({ element, spacing, onSpacingChange, onSpacingReset, showGridOverlay, onToggleGridOverlay, searchQuery = "", focusMode = false, scopeCtx = DEFAULT_SCOPE_CTX, expandedSection: controlledSection, onExpandSection, sectionMemory, onSectionMemoryChange }: WebflowPanelProps) {
  const { activeState } = scopeCtx;
  // Read computed styles once on mount
  const [cs] = useState(() => getComputedStyle(element));
  const [parentCs] = useState(() => element.parentElement ? getComputedStyle(element.parentElement) : null);

  // ── Focus mode: only one section open at a time ──
  // Controlled mode (props) or uncontrolled (local state)
  const [localSection, setLocalSection] = useState<string | null>(null);
  const expandedSection = controlledSection !== undefined ? controlledSection : localSection;
  const setExpandedSection = onExpandSection ?? setLocalSection;
  // Use a ref so handleSectionToggle doesn't depend on expandedSection,
  // keeping a stable callback reference across renders (critical for memo).
  const expandedRef = useRef(expandedSection);
  expandedRef.current = expandedSection;
  const handleSectionToggle = useCallback((title: string) => {
    setExpandedSection(expandedRef.current === title ? null : title);
  }, [setExpandedSection]);

  /** Build fresh conversion context on demand */
  const getConversionCtx = useCallback(() => buildConversionContext(element), [element]);

  // Inject :focus-visible styles for keyboard navigation
  useEffect(() => {
    const key = 'tuner-focus-styles';
    managedSheet(key).replace(
      `.tuner-focusable:focus-visible { outline: none; box-shadow: ${focusRing}; }`,
    );
    return () => { managedSheet(key).dispose(); };
  }, []);

  // ── Indicator helpers ──
  const ind = useCallback(
    (prop: string) => getIndicatorType(element, prop, cs, parentCs, activeState),
    [element, cs, parentCs, activeState]
  );

  const sectionInd = useCallback(
    (props: string[]): IndicatorType => {
      // Roll the section header dot up to the highest-priority provenance/cue
      // present on any child property (mirrors getIndicatorType's own order).
      const types = new Set(props.map(ind));
      const priority: IndicatorType[] = [
        "state", "modified", "element-inline", "authored-here", "inherited",
      ];
      return priority.find((t) => types.has(t)) ?? "none";
    },
    [ind],
  );

  // ── Apply helper (scope-aware + state-aware) ──
  // Routes through the unified StyleEngine (RFC #14, Phase 2). The OverrideTarget
  // union folds the old (scope, activeClassName, activeState) triple into one typed
  // dispatch; the engine owns the per-scope side effects that used to live inline here.
  // Order matters: state takes priority, then class-with-name, else a plain element edit
  // (which also covers scope === "class" with no active class name — a bare inline write).
  const apply = useCallback(
    (prop: string, value: string) => {
      // resolveTarget is the engine's single source of truth for the
      // (scope, class, state, breakpoint) → OverrideTarget mapping. Passing
      // the whole scopeCtx (never a hand-built subset) is what keys an edit to
      // the chosen breakpoint (ADR-0005) so it renders media-gated instead of
      // as a base inline style.
      const target = resolveTarget(element, scopeCtx);
      styleEngine.apply(target, prop, value);
    },
    [element, scopeCtx]
  );

  // ── Reset helpers (mirror `apply` so sections don't reach into core/apply) ──
  // Resets are element-direct (not scope/state-routed) to preserve existing
  // section behavior; sections call ctx.reset / ctx.resetRead instead of
  // importing resetProp / resetAndRead* themselves.
  const reset = useCallback((prop: string) => resetProp(element, prop), [element]);
  const resetRead = useCallback((prop: string) => resetAndReadNum(element, prop), [element]);
  const resetReadStr = useCallback((prop: string) => resetAndReadStr(element, prop), [element]);

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

  // ── Styling-system capability notice ──
  // Classified once per selection; warns BEFORE the user invests edits when
  // the element's styling system has no save path (styled-components, Emotion,
  // runtime style tags, external stylesheets, inline-only). Dismissal is keyed
  // to the element so a new selection surfaces the notice again.
  const stylingInfo = useMemo(() => classifyStylingSystem(element), [element]);
  const [noticeDismissedFor, setNoticeDismissedFor] = useState<Element | null>(null);
  const showStylingNotice = !stylingInfo.saveable && noticeDismissedFor !== element;

  // ── SectionCtx bundle ──
  const ctx: SectionCtx = useMemo(() => ({
    element, apply, reset, resetRead, resetReadStr, ind, sectionInd, cs, parentCs, getConversionCtx, ctxMenu, isTailwind,
  }), [element, apply, reset, resetRead, resetReadStr, ind, sectionInd, cs, parentCs, getConversionCtx, ctxMenu, isTailwind]);

  // ── Search helpers ──
  const isSearching = searchQuery.length > 0;
  const showSection = (name: string) => sectionMatchesQuery(name, searchQuery);
  const forceOpen = isSearching;
  const noResults = isSearching && !["Layout", "Spacing", "Size", "Position", "Typography", "Backgrounds", "Borders", "Effects", "Custom properties"].some(s => showSection(s));

  /** Focus-mode props for a named section */
  const focusProps = (name: string) => focusMode && !isSearching ? {
    focusOpen: expandedSection === name,
    onToggle: handleSectionToggle,
  } : {};

  // ── Stable section memory props (avoid new refs every render) ──
  const stableMemory = sectionMemory ?? EMPTY_MEMORY;
  const handleMemoryUpdate = useCallback(
    (name: string, open: boolean) => onSectionMemoryChange?.(prev => ({ ...prev, [name]: open })),
    [onSectionMemoryChange],
  );

  // ── Render ──
  return (
    <SectionMemoryProvider
      memory={stableMemory}
      onUpdate={handleMemoryUpdate}
    >
    <div className="font-sans">
      {/* Styling-system capability notice — compact, non-blocking, dismissible */}
      {showStylingNotice && (
        <div
          role="status"
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 8,
            padding: "8px 12px",
            background: warningAlpha(0.12),
            borderBottom: `1px solid ${border.subtle}`,
            fontSize: 11,
            lineHeight: 1.45,
            color: text.secondary,
          }}
        >
          <span style={{ flex: 1, minWidth: 0 }}>{stylingInfo.reason}</span>
          <button
            type="button"
            aria-label="Dismiss styling notice"
            className="tuner-focusable"
            onClick={() => setNoticeDismissedFor(element)}
            style={{
              flexShrink: 0,
              border: "none",
              background: "transparent",
              padding: 2,
              margin: -2,
              cursor: "pointer",
              color: text.label,
              display: "flex",
              alignItems: "center",
              borderRadius: 3,
            }}
          >
            <X size={12} />
          </button>
        </div>
      )}

      {noResults && (
        <div className="text-center px-5 py-10 text-xs" style={{ color: text.disabled }}>
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

      {/* 9. Custom properties */}
      {showSection("Custom properties") && (
        <CustomPropertiesSection
          ctx={ctx}
          forceOpen={forceOpen}
          {...focusProps("Custom properties")}
        />
      )}

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
