/**
 * LayoutSection.tsx — Layout section extracted from WebflowPanel.tsx
 *
 * Manages display mode, flex/grid properties, gap, and flex/grid child controls.
 */

import { useState, useCallback, memo, useRef } from "react";
import { ms } from "./timing";
import { Section, SliderRow, SelectRow, TextRow, ValueInput, useResetPopover } from "./controls";
import { AlignBox } from "./AlignBox";
import { IconButtonGroup } from "./IconButtonGroup";
import { SegmentedControl } from "./SegmentedControl";
import { LabelScrub } from "./LabelScrub";
import { UnitSelector } from "./UnitSelector";
import type { IndicatorType } from "./theme";
import { convertUnit } from "./unitConversion";
import { useConversionHint } from "./useConversionHint";
import { parseNum } from "./cssParsers";
import { resetProp, resetAndReadNum, resetAndReadStr } from "./apply";
import { detectUnit, type SectionCtx } from "./panelUtils";
import { RowLabel, DisplayTabs, GridTrackRow, MiniDropdown, FlexDirectionRow } from "./layoutControls";
import { LAYOUT_UNITS, ALIGN_SELF_OPTIONS, GRID_ALIGN_OPTIONS, JUSTIFY_OPTIONS, ALIGN_ITEMS_OPTIONS } from "./panelConstants";
import { GridRowDirectionIcon, GridColumnDirectionIcon } from "./webflowIcons";
import { parseGridTemplate, serializeGridTemplate } from "./GridSettingsPopup";
import { Link, Grid3x3 } from "lucide-react";
import { cssToTwClass } from "./tailwind";
import { color, text, border, surface, font, blackAlpha, primaryAlpha, layout, labelIndicator, labelHighlight } from "./theme";
import { ROW, LABEL, COMPACT_INPUT, COMPACT_INPUT_LABEL, SUB_LABEL, PILL_BUTTON } from "./panelStyles";

// ─── Compact label with highlight ─────────────────────────────────────

function CompactLabel({ label, indicator, onReset }: { label: string; indicator: IndicatorType; onReset?: () => void }) {
  const m = indicator !== "none";
  const resetPopover = useResetPopover(indicator, onReset);
  return (
    <>
      <span ref={resetPopover.anchorRef} style={{ ...COMPACT_INPUT_LABEL, cursor: m && onReset ? "pointer" : undefined }}
        onClick={(e) => { if (e.altKey && onReset) { e.stopPropagation(); onReset(); return; } resetPopover.triggerOpen(); }}
      >
        <span style={{
          background: m ? labelIndicator.modified.bg : "transparent",
          color: m ? labelIndicator.modified.text : text.label,
          ...(m ? labelHighlight : {}),
        }}>{label}</span>
      </span>
      {resetPopover.node}
    </>
  );
}

// ─── Grid helpers ─────────────────────────────────────────────────────

/** Parse a grid template string into a track count (e.g. "1fr 1fr" → 2, "repeat(3, 1fr)" → 3) */
function parseTrackCount(template: string): number {
  if (!template || template === "none") return 1;
  const repeatMatch = template.match(/repeat\(\s*(\d+)/);
  if (repeatMatch) return parseInt(repeatMatch[1], 10);
  // Count space-separated tokens (rough — works for simple templates)
  return template.trim().split(/\s+/).length;
}

/** Convert a track count to a grid template string */
function countToTemplate(count: number): string {
  if (count <= 1) return "1fr";
  return `repeat(${count}, 1fr)`;
}

/** Resize an existing template to the target count, preserving custom tracks.
 *  Appends 1fr when growing, trims from the end when shrinking. */
function resizeTemplate(currentTemplate: string, targetCount: number): string {
  const tracks = parseGridTemplate(currentTemplate);
  if (tracks.length === targetCount) return serializeGridTemplate(tracks);
  if (targetCount <= 0) return "1fr";
  if (targetCount > tracks.length) {
    // Grow: append default 1fr tracks
    const extra = targetCount - tracks.length;
    for (let i = 0; i < extra; i++) {
      tracks.push({ type: "default", value: 1, unit: "fr", isAuto: false, minValue: 0, minUnit: "px", maxValue: 1, maxUnit: "fr" });
    }
  } else {
    // Shrink: remove from the end
    tracks.length = targetCount;
  }
  return serializeGridTemplate(tracks);
}

// ─── Props ───────────────────────────────────────────────────────────

export interface LayoutSectionProps {
  ctx: SectionCtx;
  display: string;
  onDisplayChange: (v: string) => void;
  columnGap: number;
  columnGapUnit: string;
  onColumnGapChange: (v: number) => void;
  onColumnGapUnitChange: (u: string) => void;
  isFlex: boolean;
  isGrid: boolean;
  /** True for div, section, article, etc. — shows flex controls proactively */
  isBlockContainer?: boolean;
  parentIsFlex: boolean;
  parentIsGrid: boolean;
  showGridOverlay?: boolean;
  onToggleGridOverlay?: () => void;
  forceOpen?: boolean;
  focusOpen?: boolean;
  onToggle?: (title: string) => void;
}

// ─── Component ───────────────────────────────────────────────────────

export const LayoutSection = memo(function LayoutSection(props: LayoutSectionProps) {
  const {
    ctx,
    display,
    onDisplayChange,
    columnGap,
    columnGapUnit,
    onColumnGapChange,
    onColumnGapUnitChange,
    isFlex,
    isGrid,
    isBlockContainer = false,
    parentIsFlex,
    parentIsGrid,
    showGridOverlay,
    onToggleGridOverlay,
    forceOpen,
    focusOpen,
    onToggle,
  } = props;

  const { apply, ind, sectionInd, cs, element, getConversionCtx, ctxMenu } = ctx;
  const twAnn = (prop: string, val: number, unit: string) =>
    ctx.isTailwind ? cssToTwClass(prop, `${val}${unit}`) ?? undefined : undefined;
  const parentIsFlexOrGrid = parentIsFlex || parentIsGrid;

  // ── Local state ──

  // Flex
  const [flexDirection, setFlexDirection] = useState(() => cs.flexDirection);
  const [justifyContent, setJustifyContent] = useState(() => cs.justifyContent);
  const [alignItems, setAlignItems] = useState(() => cs.alignItems);
  const [flexWrap, setFlexWrap] = useState(() => cs.flexWrap);

  // Grid
  const [justifyItems, setJustifyItems] = useState(() => cs.getPropertyValue("justify-items") || "stretch");
  const [alignContent, setAlignContent] = useState(() => cs.getPropertyValue("align-content") || "stretch");
  const [gridAlignItems, setGridAlignItems] = useState(() => cs.getPropertyValue("align-items") || "stretch");
  const [gridAutoFlow, setGridAutoFlow] = useState(() => cs.getPropertyValue("grid-auto-flow") || "row");

  // Gap
  const [gap, setGap] = useState(() => parseNum(cs.gap));
  const [gapLocked, setGapLocked] = useState(true);
  const [rowGap, setRowGap] = useState(() => parseNum(cs.rowGap));

  // Grid tracks
  const [gridCols, setGridCols] = useState(() => cs.gridTemplateColumns === "none" ? "" : cs.gridTemplateColumns);
  const [gridRows, setGridRows] = useState(() => cs.gridTemplateRows === "none" ? "" : cs.gridTemplateRows);
  const [gridColCount, setGridColCount] = useState(() => parseTrackCount(cs.gridTemplateColumns));
  const [gridRowCount, setGridRowCount] = useState(() => parseTrackCount(cs.gridTemplateRows));
  const [gridTrackLinked, setGridTrackLinked] = useState(false);

  // Flex child
  const [flexGrow, setFlexGrow] = useState(() => parseNum(cs.flexGrow));
  const [flexShrink, setFlexShrink] = useState(() => parseNum(cs.flexShrink));
  const [flexBasis, setFlexBasis] = useState(() => parseNum(cs.flexBasis));
  const [alignSelf, setAlignSelf] = useState(() => cs.alignSelf);
  const [flexOrder, setFlexOrder] = useState(() => parseNum(cs.order));

  // Layout units
  const [gapUnit, setGapUnit] = useState(() => detectUnit(element, "gap"));
  const [rowGapUnit, setRowGapUnit] = useState(() => detectUnit(element, "row-gap"));
  const [flexBasisUnit, setFlexBasisUnit] = useState(() => detectUnit(element, "flex-basis"));

  // Conversion hints
  const { conversionHint: gapHint, fireConversionHint: fireGapHint } = useConversionHint();
  const { conversionHint: rowGapHint, fireConversionHint: fireRowGapHint } = useConversionHint();
  const { conversionHint: colGapHint, fireConversionHint: fireColGapHint } = useConversionHint();
  const { conversionHint: basisHint, fireConversionHint: fireBasisHint } = useConversionHint();

  // Only show flex/grid child section when a property is actually overridden
  const hasFlexChildOverride = parentIsFlexOrGrid && (
    ind("flex-grow") !== "none" || ind("flex-shrink") !== "none" ||
    ind("flex-basis") !== "none" || ind("order") !== "none" ||
    ind("align-self") !== "none" ||
    flexGrow !== 0 || flexShrink !== 1 || flexOrder !== 0 ||
    (alignSelf !== "auto" && alignSelf !== "normal")
  );

  // ── Helpers ──

  const resetCss = (prop: string, setter: (v: number) => void) => setter(resetAndReadNum(element, prop));

  const resetCssStr = (prop: string, setter: (v: string) => void) => setter(resetAndReadStr(element, prop));

  // ── Handlers ──

  const handleDisplayChange = useCallback(
    (v: string) => {
      onDisplayChange(v);
      apply("display", v);
    },
    [apply, onDisplayChange],
  );

  const handleFlexDirectionChange = useCallback(
    (v: string) => {
      const dir = v === "none" ? "row" : v;
      setFlexDirection(dir);
      apply("flex-direction", dir);
    },
    [apply],
  );

  const handleGridAlignChange = useCallback(
    (justify: string, align: string) => {
      setJustifyItems(justify);
      setGridAlignItems(align);
      apply("justify-items", justify);
      apply("align-items", align);
    },
    [apply],
  );

  const handleGridAutoFlowChange = useCallback(
    (v: string) => {
      setGridAutoFlow(v);
      apply("grid-auto-flow", v);
    },
    [apply],
  );

  const handleGridColCountChange = useCallback(
    (count: number) => {
      setGridColCount(count);
      const template = resizeTemplate(gridCols, count);
      setGridCols(template);
      apply("grid-template-columns", template);
    },
    [apply, gridCols],
  );

  const handleGridRowCountChange = useCallback(
    (count: number) => {
      setGridRowCount(count);
      const template = resizeTemplate(gridRows, count);
      setGridRows(template);
      apply("grid-template-rows", template);
    },
    [apply, gridRows],
  );

  const handleFlexWrapChange = useCallback(
    (v: string) => {
      setFlexWrap(v);
      apply("flex-wrap", v);
    },
    [apply],
  );

  const handleGapChange = useCallback(
    (v: number) => {
      setGap(v);
      apply("gap", `${v}${gapUnit}`);
      if (gapLocked) {
        setRowGap(v);
        onColumnGapChange(v);
        onColumnGapUnitChange(gapUnit);
      }
    },
    [apply, gapUnit, gapLocked, onColumnGapChange, onColumnGapUnitChange],
  );

  const handleRowGapChange = useCallback(
    (v: number) => { setRowGap(v); apply("row-gap", `${v}${rowGapUnit}`); },
    [apply, rowGapUnit],
  );

  const handleColumnGapChange = useCallback(
    (v: number) => {
      onColumnGapChange(v);
      apply("column-gap", `${v}${columnGapUnit}`);
    },
    [apply, columnGapUnit, onColumnGapChange],
  );

  const handleGapLockToggle = useCallback(() => {
    setGapLocked(prev => {
      if (!prev) {
        setRowGap(gap);
        onColumnGapChange(gap);
        setRowGapUnit(gapUnit);
        onColumnGapUnitChange(gapUnit);
        apply("row-gap", `${gap}${gapUnit}`);
        apply("column-gap", `${gap}${gapUnit}`);
      }
      return !prev;
    });
  }, [gap, apply, gapUnit, onColumnGapChange, onColumnGapUnitChange]);

  const handleGridColsChange = useCallback(
    (v: string) => {
      setGridCols(v);
      if (v.trim()) apply("grid-template-columns", v);
      setGridColCount(parseTrackCount(v));
    },
    [apply],
  );

  const handleGridRowsChange = useCallback(
    (v: string) => {
      setGridRows(v);
      if (v.trim()) apply("grid-template-rows", v);
      setGridRowCount(parseTrackCount(v));
    },
    [apply],
  );

  const handleFlexGrowChange = useCallback(
    (v: number) => { setFlexGrow(v); apply("flex-grow", String(v)); },
    [apply],
  );

  const handleFlexShrinkChange = useCallback(
    (v: number) => { setFlexShrink(v); apply("flex-shrink", String(v)); },
    [apply],
  );

  const handleFlexBasisChange = useCallback(
    (v: number) => { setFlexBasis(v); apply("flex-basis", `${v}${flexBasisUnit}`); },
    [apply, flexBasisUnit],
  );

  const handleAlignSelfChange = useCallback(
    (v: string) => { setAlignSelf(v); apply("align-self", v); },
    [apply],
  );

  const handleFlexOrderChange = useCallback(
    (v: number) => { setFlexOrder(v); apply("order", String(v)); },
    [apply],
  );

  // ── JSX ──

  return (
    <Section
      title="Layout"
      indicator={sectionInd([
        "display", "flex-direction", "justify-content", "align-items",
        "justify-items", "align-content", "flex-wrap", "gap", "row-gap", "column-gap",
      ])}
      forceOpen={forceOpen}
      focusOpen={focusOpen}
      onToggle={onToggle}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: layout.controlGap }}>
      <DisplayTabs value={display} onChange={handleDisplayChange} onReset={() => resetCssStr("display", onDisplayChange)} indicator={ind("display")} />

      {isGrid && (
        <>
          {/* Grid track count: Columns / Rows numeric inputs */}
          <GridTrackRow
            columns={gridColCount}
            rows={gridRowCount}
            onColumnsChange={handleGridColCountChange}
            onRowsChange={handleGridRowCountChange}
            linked={gridTrackLinked}
            onLinkedChange={setGridTrackLinked}
            onReset={() => {
              const cols = resetAndReadStr(element, "grid-template-columns");
              const rows = resetAndReadStr(element, "grid-template-rows");
              setGridCols(cols);
              setGridRows(rows);
              setGridColCount(parseTrackCount(cols));
              setGridRowCount(parseTrackCount(rows));
            }}
            indicator={sectionInd(["grid-template-columns", "grid-template-rows"])}
            gridCols={gridCols}
            gridRows={gridRows}
            onGridColsChange={handleGridColsChange}
            onGridRowsChange={handleGridRowsChange}
          />

          {/* Direction: Row / Column toggle + grid overlay */}
          <div style={ROW}>
            <RowLabel label="Direction" indicator={ind("grid-auto-flow")} onReset={() => resetCssStr("grid-auto-flow", setGridAutoFlow)} />
            <SegmentedControl
              options={[
                { value: "row", icon: <GridRowDirectionIcon size={16} />, title: "Row" },
                { value: "column", icon: <GridColumnDirectionIcon size={16} />, title: "Column" },
              ]}
              value={gridAutoFlow.startsWith("column") ? "column" : "row"}
              onChange={handleGridAutoFlowChange}
              aria-label="Grid auto-flow direction"
            />
            {onToggleGridOverlay && (
              <button
                onClick={onToggleGridOverlay}
                title={showGridOverlay ? "Hide grid overlay" : "Show grid overlay"}
                style={{
                  width: 24,
                  height: 24,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 4,
                  border: "none",
                  outline: "none",
                  cursor: "pointer",
                  flexShrink: 0,
                  padding: 4,
                  background: showGridOverlay ? primaryAlpha(0.2) : "transparent",
                  color: showGridOverlay ? primaryAlpha(0.9) : text.label,
                  transition: `background ${ms("fast")} ease`,
                }}
              >
                <Grid3x3 size={14} strokeWidth={1.5} />
              </button>
            )}
          </div>

          {/* Align: AlignBox + X/Y dropdowns */}
          <div style={{ ...ROW, alignItems: "flex-start" }}>
            <RowLabel label="Align" indicator={sectionInd(["justify-items", "align-items"])} onReset={() => {
              resetCssStr("justify-items", setJustifyItems);
              resetCssStr("align-items", setGridAlignItems);
            }} />
            <AlignBox
              justify={justifyItems}
              align={gridAlignItems}
              onChange={handleGridAlignChange}
              mode="grid"
              compact
            />
            <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between", minWidth: 0, alignSelf: "stretch" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ fontSize: 10, color: text.label, fontFamily: font.sans, flexShrink: 0 }}>X</span>
                <MiniDropdown
                  value={justifyItems}
                  options={GRID_ALIGN_OPTIONS}
                  onChange={(v) => { setJustifyItems(v); apply("justify-items", v); }}
                />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ fontSize: 10, color: text.label, fontFamily: font.sans, flexShrink: 0 }}>Y</span>
                <MiniDropdown
                  value={gridAlignItems}
                  options={GRID_ALIGN_OPTIONS}
                  onChange={(v) => { setGridAlignItems(v); apply("align-items", v); }}
                />
              </div>
            </div>
          </div>

          {/* Gap: slider + lock */}
          {gapLocked ? (
            <div style={{ display: "flex", alignItems: "center" }}>
              <div style={{ flex: 1 }}>
                <SliderRow
                  label="Gap"
                  value={gap}
                  min={0}
                  max={200}
                  step={4}
                  unit={gapUnit}
                  units={LAYOUT_UNITS}
                  onUnitChange={(u) => {
                    const ctx = getConversionCtx();
                    const c = convertUnit(gap, gapUnit, u, ctx);
                    fireGapHint(gap, gapUnit, c, u, ctx);
                    setGap(c);
                    setGapUnit(u);
                    apply("gap", `${c}${u}`);
                  }}
                  onChange={handleGapChange}
                  onReset={() => resetCss("gap", setGap)}
                  indicator={ind("gap")}
                  conversionHint={gapHint}
                  onContextMenu={ctxMenu("gap", `${gap}${gapUnit}`)}
                  computedProp="gap"
                  computedElement={element}
                  property="gap"
                  annotation={twAnn("gap", gap, gapUnit)}
                />
              </div>
              <button
                onClick={handleGapLockToggle}
                title="Unlock row/column gap"
                style={{
                  width: 20,
                  height: 20,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  fontSize: 10,
                  marginRight: 8,
                  borderRadius: 3,
                  flexShrink: 0,
                  color: text.disabled,
                }}
              >
                <Link size={12} strokeWidth={1.5} />
              </button>
            </div>
          ) : (
            <>
              <div style={{ display: "flex", alignItems: "center" }}>
                <div style={{ flex: 1 }}>
                  <SliderRow
                    label="Row Gap"
                    value={rowGap}
                    min={0}
                    max={200}
                    step={4}
                    unit={rowGapUnit}
                    units={LAYOUT_UNITS}
                    onUnitChange={(u) => {
                      const ctx = getConversionCtx();
                      const c = convertUnit(rowGap, rowGapUnit, u, ctx);
                      fireRowGapHint(rowGap, rowGapUnit, c, u, ctx);
                      setRowGap(c);
                      setRowGapUnit(u);
                      apply("row-gap", `${c}${u}`);
                    }}
                    onChange={handleRowGapChange}
                    onReset={() => resetCss("row-gap", setRowGap)}
                    indicator={ind("row-gap")}
                    conversionHint={rowGapHint}
                    onContextMenu={ctxMenu("row-gap", `${rowGap}${rowGapUnit}`)}
                    computedProp="row-gap"
                    computedElement={element}
                    annotation={twAnn("row-gap", rowGap, rowGapUnit)}
                  />
                </div>
                <button
                  onClick={handleGapLockToggle}
                  title="Lock gap"
                  style={{
                    width: 20,
                    height: 20,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    fontSize: 10,
                    marginRight: 8,
                    borderRadius: 3,
                    flexShrink: 0,
                    color: text.disabled,
                  }}
                >
                  <Link size={12} strokeWidth={1.5} />
                </button>
              </div>
              <SliderRow
                label="Col Gap"
                value={columnGap}
                min={0}
                max={200}
                step={4}
                unit={columnGapUnit}
                units={LAYOUT_UNITS}
                onUnitChange={(u) => {
                  const ctx = getConversionCtx();
                  const c = convertUnit(columnGap, columnGapUnit, u, ctx);
                  fireColGapHint(columnGap, columnGapUnit, c, u, ctx);
                  onColumnGapChange(c);
                  onColumnGapUnitChange(u);
                  apply("column-gap", `${c}${u}`);
                }}
                onChange={handleColumnGapChange}
                onReset={() => resetCss("column-gap", (v) => onColumnGapChange(v))}
                indicator={ind("column-gap")}
                conversionHint={colGapHint}
                onContextMenu={ctxMenu("column-gap", `${columnGap}${columnGapUnit}`)}
                computedProp="column-gap"
                computedElement={element}
                annotation={twAnn("column-gap", columnGap, columnGapUnit)}
              />
            </>
          )}
        </>
      )}

      {(isFlex || (isBlockContainer && !isGrid)) && (
        <>
          {/* Direction: row/column icons + wrap toggle + reverse dropdown */}
          <FlexDirectionRow
            direction={flexDirection}
            onDirectionChange={handleFlexDirectionChange}
            wrap={flexWrap}
            onWrapChange={handleFlexWrapChange}
            onReset={() => { resetCssStr("flex-direction", setFlexDirection); resetCssStr("flex-wrap", setFlexWrap); }}
            indicator={ind("flex-direction")}
            wrapIndicator={ind("flex-wrap")}
          />

          {/* Align: AlignBox + X/Y dropdowns (matches grid pattern) */}
          <div style={{ ...ROW, alignItems: "flex-start" }}>
            <RowLabel label="Align" indicator={sectionInd(["justify-content", "align-items"])} onReset={() => {
              resetCssStr("justify-content", setJustifyContent);
              resetCssStr("align-items", setAlignItems);
            }} />
            <AlignBox
              justify={justifyContent}
              align={alignItems}
              onChange={(j, a) => { setJustifyContent(j); setAlignItems(a); apply("justify-content", j); apply("align-items", a); }}
              mode="flex"
              compact
            />
            <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between", minWidth: 0, alignSelf: "stretch" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ fontSize: 10, color: text.label, fontFamily: font.sans, flexShrink: 0 }}>X</span>
                <MiniDropdown
                  value={justifyContent}
                  options={JUSTIFY_OPTIONS}
                  onChange={(v) => { setJustifyContent(v); apply("justify-content", v); }}
                />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ fontSize: 10, color: text.label, fontFamily: font.sans, flexShrink: 0 }}>Y</span>
                <MiniDropdown
                  value={alignItems}
                  options={ALIGN_ITEMS_OPTIONS}
                  onChange={(v) => { setAlignItems(v); apply("align-items", v); }}
                />
              </div>
            </div>
          </div>

          {/* Gap: slider + lock (matches grid pattern) */}
          {gapLocked ? (
            <div style={{ display: "flex", alignItems: "center" }}>
              <div style={{ flex: 1 }}>
                <SliderRow
                  label="Gap"
                  value={gap}
                  min={0}
                  max={200}
                  step={4}
                  unit={gapUnit}
                  units={LAYOUT_UNITS}
                  onUnitChange={(u) => {
                    const ctx = getConversionCtx();
                    const c = convertUnit(gap, gapUnit, u, ctx);
                    fireGapHint(gap, gapUnit, c, u, ctx);
                    setGap(c);
                    setGapUnit(u);
                    apply("gap", `${c}${u}`);
                  }}
                  onChange={handleGapChange}
                  onReset={() => resetCss("gap", setGap)}
                  indicator={ind("gap")}
                  conversionHint={gapHint}
                  onContextMenu={ctxMenu("gap", `${gap}${gapUnit}`)}
                  computedProp="gap"
                  computedElement={element}
                  property="gap"
                  annotation={twAnn("gap", gap, gapUnit)}
                />
              </div>
              <button
                onClick={handleGapLockToggle}
                title="Unlock row/column gap"
                style={{
                  width: 20,
                  height: 20,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  fontSize: 10,
                  marginRight: 8,
                  borderRadius: 3,
                  flexShrink: 0,
                  color: text.disabled,
                }}
              >
                <Link size={12} strokeWidth={1.5} />
              </button>
            </div>
          ) : (
            <>
              <div style={{ display: "flex", alignItems: "center" }}>
                <div style={{ flex: 1 }}>
                  <SliderRow
                    label="Row Gap"
                    value={rowGap}
                    min={0}
                    max={200}
                    step={4}
                    unit={rowGapUnit}
                    units={LAYOUT_UNITS}
                    onUnitChange={(u) => {
                      const ctx = getConversionCtx();
                      const c = convertUnit(rowGap, rowGapUnit, u, ctx);
                      fireRowGapHint(rowGap, rowGapUnit, c, u, ctx);
                      setRowGap(c);
                      setRowGapUnit(u);
                      apply("row-gap", `${c}${u}`);
                    }}
                    onChange={handleRowGapChange}
                    onReset={() => resetCss("row-gap", setRowGap)}
                    indicator={ind("row-gap")}
                    conversionHint={rowGapHint}
                    onContextMenu={ctxMenu("row-gap", `${rowGap}${rowGapUnit}`)}
                    computedProp="row-gap"
                    computedElement={element}
                    annotation={twAnn("row-gap", rowGap, rowGapUnit)}
                  />
                </div>
                <button
                  onClick={handleGapLockToggle}
                  title="Lock gap"
                  style={{
                    width: 20,
                    height: 20,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    fontSize: 10,
                    marginRight: 8,
                    borderRadius: 3,
                    flexShrink: 0,
                    color: text.disabled,
                  }}
                >
                  <Link size={12} strokeWidth={1.5} />
                </button>
              </div>
              <SliderRow
                label="Col Gap"
                value={columnGap}
                min={0}
                max={200}
                step={4}
                unit={columnGapUnit}
                units={LAYOUT_UNITS}
                onUnitChange={(u) => {
                  const ctx = getConversionCtx();
                  const c = convertUnit(columnGap, columnGapUnit, u, ctx);
                  fireColGapHint(columnGap, columnGapUnit, c, u, ctx);
                  onColumnGapChange(c);
                  onColumnGapUnitChange(u);
                  apply("column-gap", `${c}${u}`);
                }}
                onChange={handleColumnGapChange}
                onReset={() => resetCss("column-gap", (v) => onColumnGapChange(v))}
                indicator={ind("column-gap")}
                conversionHint={colGapHint}
                onContextMenu={ctxMenu("column-gap", `${columnGap}${columnGapUnit}`)}
                computedProp="column-gap"
                computedElement={element}
                annotation={twAnn("column-gap", columnGap, columnGapUnit)}
              />
            </>
          )}
        </>
      )}

      {hasFlexChildOverride && (
        <>
          <div style={SUB_LABEL}>
            {parentIsFlex ? "Flex Child" : "Grid Child"}
          </div>

          {/* Grow / Shrink / Basis — compact inline inputs, flex children only */}
          {parentIsFlex && (
            <>
              <div style={{ display: "flex", gap: 6, padding: "2px 12px" }}>
                <div style={COMPACT_INPUT}>
                  <LabelScrub value={flexGrow} onChange={handleFlexGrowChange} step={1} min={0} max={10} onAltClick={() => resetCss("flex-grow", setFlexGrow)}>
                    <CompactLabel label="Grow" indicator={ind("flex-grow")} onReset={() => resetCss("flex-grow", setFlexGrow)} />
                  </LabelScrub>
                  <ValueInput embedded value={flexGrow} onChange={handleFlexGrowChange} onAltClick={() => resetCss("flex-grow", setFlexGrow)} />
                </div>
                <div style={COMPACT_INPUT}>
                  <LabelScrub value={flexShrink} onChange={handleFlexShrinkChange} step={1} min={0} max={10} onAltClick={() => resetCss("flex-shrink", setFlexShrink)}>
                    <CompactLabel label="Shrink" indicator={ind("flex-shrink")} onReset={() => resetCss("flex-shrink", setFlexShrink)} />
                  </LabelScrub>
                  <ValueInput embedded value={flexShrink} onChange={handleFlexShrinkChange} onAltClick={() => resetCss("flex-shrink", setFlexShrink)} />
                </div>
              </div>

              <div style={{ display: "flex", gap: 6, padding: "2px 12px" }}>
                <div style={COMPACT_INPUT}>
                  <LabelScrub value={flexBasis} onChange={handleFlexBasisChange} step={ctx.isTailwind ? 4 : 1} min={0} max={500} onAltClick={() => resetCss("flex-basis", setFlexBasis)}>
                    <CompactLabel label="Basis" indicator={ind("flex-basis")} onReset={() => resetCss("flex-basis", setFlexBasis)} />
                  </LabelScrub>
                  <ValueInput embedded value={flexBasis} onChange={handleFlexBasisChange} onAltClick={() => resetCss("flex-basis", setFlexBasis)} />
                  <div style={{ flexShrink: 0, paddingRight: 3, borderLeft: `1px solid ${border.default}`, alignSelf: "stretch", display: "flex", alignItems: "center" }}>
                    <UnitSelector
                      value={flexBasisUnit}
                      options={LAYOUT_UNITS}
                      onChange={(u) => {
                        const ctx = getConversionCtx();
                        const c = convertUnit(flexBasis, flexBasisUnit, u, ctx);
                        fireBasisHint(flexBasis, flexBasisUnit, c, u, ctx);
                        setFlexBasis(c);
                        setFlexBasisUnit(u);
                        apply("flex-basis", `${c}${u}`);
                      }}
                      conversionHint={basisHint}
                      embedded
                    />
                  </div>
                </div>
                <div style={COMPACT_INPUT}>
                  <LabelScrub value={flexOrder} onChange={handleFlexOrderChange} step={1} min={-99} max={99} onAltClick={() => resetCss("order", setFlexOrder)}>
                    <CompactLabel label="Order" indicator={ind("order")} onReset={() => resetCss("order", setFlexOrder)} />
                  </LabelScrub>
                  <ValueInput embedded value={flexOrder} onChange={handleFlexOrderChange} onAltClick={() => resetCss("order", setFlexOrder)} />
                </div>
              </div>
            </>
          )}

          <SelectRow
            label="Align Self"
            value={alignSelf}
            options={ALIGN_SELF_OPTIONS}
            onChange={handleAlignSelfChange}
            onReset={() => resetCssStr("align-self", setAlignSelf)}
            indicator={ind("align-self")}
            onContextMenu={ctxMenu("align-self", alignSelf)}
            computedProp="align-self"
            computedElement={element}
          />
        </>
      )}
      </div>
    </Section>
  );
});
