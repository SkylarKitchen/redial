/**
 * LayoutSection.tsx — Layout section extracted from WebflowPanel.tsx
 *
 * Manages display mode, flex/grid properties, gap, and flex/grid child controls.
 */

import { useState, useCallback, memo } from "react";
import { Section, SliderRow, SelectRow, TextRow, ValueInput } from "./controls";
import { AlignBox } from "./AlignBox";
import { LabelScrub } from "./LabelScrub";
import { UnitSelector } from "./UnitSelector";
import { StyleIndicator } from "./StyleIndicator";
import { convertUnit } from "./unitConversion";
import { useConversionHint } from "./useConversionHint";
import { parseNum } from "./cssParsers";
import { resetProp, resetAndReadNum } from "./apply";
import { detectUnit, type SectionCtx } from "./panelUtils";
import { MiniDropdown, DirectionRow, GapRow, DisplayTabs } from "./layoutControls";
import { LAYOUT_UNITS, JUSTIFY_OPTIONS, ALIGN_ITEMS_OPTIONS, ALIGN_SELF_OPTIONS } from "./panelConstants";
import { Link, Grid3x3 } from "lucide-react";
import { cn } from "@/lib/utils";
import { color, text, border, surface, font, blackAlpha, primaryAlpha } from "./theme";

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
    parentIsFlex,
    parentIsGrid,
    showGridOverlay,
    onToggleGridOverlay,
    forceOpen,
    focusOpen,
    onToggle,
  } = props;

  const { apply, ind, sectionInd, cs, element, getConversionCtx, ctxMenu } = ctx;
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

  // Gap
  const [gap, setGap] = useState(() => parseNum(cs.gap));
  const [gapLocked, setGapLocked] = useState(true);
  const [rowGap, setRowGap] = useState(() => parseNum(cs.rowGap));

  // Grid tracks
  const [gridCols, setGridCols] = useState(() => cs.gridTemplateColumns === "none" ? "" : cs.gridTemplateColumns);
  const [gridRows, setGridRows] = useState(() => cs.gridTemplateRows === "none" ? "" : cs.gridTemplateRows);

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

  // ── Helpers ──

  const resetCss = (prop: string, setter: (v: number) => void) => setter(resetAndReadNum(element, prop));

  const resetCssStr = (prop: string, setter: (v: string) => void) => {
    resetProp(element, prop);
    setter(getComputedStyle(element).getPropertyValue(prop).trim());
  };

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

  const handleAlignChange = useCallback(
    (justify: string, align: string) => {
      setJustifyContent(justify);
      setAlignItems(align);
      apply("justify-content", justify);
      apply("align-items", align);
    },
    [apply],
  );

  const handleGridAlignChange = useCallback(
    (justify: string, align: string) => {
      setJustifyItems(justify);
      setAlignContent(align);
      apply("justify-items", justify);
      apply("align-content", align);
    },
    [apply],
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
    (v: string) => { setGridCols(v); if (v.trim()) apply("grid-template-columns", v); },
    [apply],
  );

  const handleGridRowsChange = useCallback(
    (v: string) => { setGridRows(v); if (v.trim()) apply("grid-template-rows", v); },
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
      <DisplayTabs value={display} onChange={handleDisplayChange} onReset={() => resetCssStr("display", onDisplayChange)} />

      {isFlex && (
        <>
          {/* Direction row: row/column/wrap icons + dropdown for reverse */}
          <DirectionRow
            direction={flexDirection}
            wrap={flexWrap}
            onDirectionChange={handleFlexDirectionChange}
            onWrapChange={handleFlexWrapChange}
            onReset={() => {
              resetCssStr("flex-direction", setFlexDirection);
              resetCssStr("flex-wrap", setFlexWrap);
            }}
          />

          {/* Align row: 3x3 grid + X/Y dropdowns side-by-side */}
          <div className="flex items-start gap-2 py-1 px-3">
            <span className="w-12 text-[11px] text-[var(--muted-foreground)] shrink-0 pt-1.5">Align</span>
            <div className="shrink-0">
              <AlignBox justify={justifyContent} align={alignItems} onChange={handleAlignChange} mode="flex" compact />
            </div>
            <div className="flex-1 flex flex-col gap-1 pt-0.5">
              <div className="flex items-center gap-1">
                <span className="text-[10px] w-3 text-right" style={{ color: text.disabled }}>x</span>
                <MiniDropdown
                  value={flexDirection.startsWith("column") ? alignItems : justifyContent}
                  options={flexDirection.startsWith("column") ? ALIGN_ITEMS_OPTIONS : JUSTIFY_OPTIONS}
                  onChange={(v) => {
                    if (flexDirection.startsWith("column")) {
                      setAlignItems(v); apply("align-items", v);
                    } else {
                      setJustifyContent(v); apply("justify-content", v);
                    }
                  }}
                />
              </div>
              <div className="flex items-center gap-1">
                <span className="text-[10px] w-3 text-right" style={{ color: text.disabled }}>y</span>
                <MiniDropdown
                  value={flexDirection.startsWith("column") ? justifyContent : alignItems}
                  options={flexDirection.startsWith("column") ? JUSTIFY_OPTIONS : ALIGN_ITEMS_OPTIONS}
                  onChange={(v) => {
                    if (flexDirection.startsWith("column")) {
                      setJustifyContent(v); apply("justify-content", v);
                    } else {
                      setAlignItems(v); apply("align-items", v);
                    }
                  }}
                />
              </div>
            </div>
          </div>

          {/* Gap row: swatch + slider + value + unit + lock */}
          <GapRow
            value={gap}
            unit={gapUnit}
            onChange={handleGapChange}
            onUnitChange={(u) => {
              const ctx = getConversionCtx();
              const c = convertUnit(gap, gapUnit, u, ctx);
              setGap(c);
              setGapUnit(u);
              apply("gap", `${c}${u}`);
            }}
            linked={gapLocked}
            onLinkedChange={(v) => {
              setGapLocked(v);
              if (v) {
                setRowGap(gap);
                onColumnGapChange(gap);
                setRowGapUnit(gapUnit);
                onColumnGapUnitChange(gapUnit);
                apply("row-gap", `${gap}${gapUnit}`);
                apply("column-gap", `${gap}${gapUnit}`);
              }
            }}
          />
        </>
      )}

      {isGrid && (
        <>
          {/* Grid overlay toggle */}
          {onToggleGridOverlay && (
            <div className="flex items-center gap-1.5 py-0.5 px-3">
              <span className="w-16 text-[11px] text-[var(--muted-foreground)] shrink-0">Overlay</span>
              <button
                onClick={onToggleGridOverlay}
                title={showGridOverlay ? "Hide grid overlay" : "Show grid overlay"}
                className={cn(
                  "flex items-center gap-1 py-[3px] px-2 text-[10px] font-mono rounded-[3px] cursor-pointer outline-none",
                  showGridOverlay
                    ? "border"
                    : "bg-[var(--input)] border border-[var(--border)] text-[var(--muted-foreground)]",
                )}
                style={showGridOverlay ? { background: primaryAlpha(0.2), borderColor: primaryAlpha(0.4), color: primaryAlpha(0.9) } : undefined}
              >
                <Grid3x3 size={12} strokeWidth={1.5} />
                {showGridOverlay ? "Hide" : "Show"}
              </button>
            </div>
          )}
          <TextRow label="Columns" value={gridCols} placeholder="1fr 1fr 1fr" onChange={handleGridColsChange} onContextMenu={ctxMenu("grid-template-columns", gridCols)} />
          <TextRow label="Rows" value={gridRows} placeholder="auto" onChange={handleGridRowsChange} onContextMenu={ctxMenu("grid-template-rows", gridRows)} />
          <div className="py-1.5 px-3">
            <AlignBox
              justify={justifyItems}
              align={alignContent}
              onChange={handleGridAlignChange}
              mode="grid"
            />
          </div>
          {gapLocked ? (
            <div className="flex items-center">
              <div className="flex-1">
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
                />
              </div>
              <button
                onClick={handleGapLockToggle}
                title="Unlock row/column gap"
                className="w-5 h-5 flex items-center justify-center bg-transparent border-none cursor-pointer text-[10px] mr-2 rounded-[3px] shrink-0"
                style={{ color: text.disabled }}
              >
                <Link size={12} strokeWidth={1.5} />
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-center">
                <div className="flex-1">
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
                  />
                </div>
                <button
                  onClick={handleGapLockToggle}
                  title="Lock gap"
                  className="w-5 h-5 flex items-center justify-center bg-transparent border-none cursor-pointer text-[10px] mr-2 rounded-[3px] shrink-0"
                  style={{ color: text.disabled }}
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
              />
            </>
          )}
        </>
      )}

      {parentIsFlexOrGrid && (
        <>
          <div className="pt-1.5 pb-0.5 px-3 text-[10px] uppercase tracking-[0.04em]" style={{ color: text.label }}>
            {parentIsFlex ? "Flex Child" : "Grid Child"}
          </div>

          {/* Grow / Shrink — compact inline inputs, flex children only */}
          {parentIsFlex && (
            <div className="flex gap-1.5 py-0.5 px-3">
              <div className="flex-1 flex items-center h-7 bg-[var(--input)] border border-[var(--border)] rounded">
                <LabelScrub value={flexGrow} onChange={handleFlexGrowChange} step={1} min={0} max={10} onAltClick={() => resetCss("flex-grow", setFlexGrow)}>
                  <span className="px-1.5 text-[10px] text-[var(--muted-foreground)] shrink-0 whitespace-nowrap inline-flex items-center gap-[3px]">
                    {ind("flex-grow") !== "none" && <StyleIndicator type={ind("flex-grow")} />}Grow
                  </span>
                </LabelScrub>
                <ValueInput value={flexGrow} onChange={handleFlexGrowChange} onAltClick={() => resetCss("flex-grow", setFlexGrow)} />
              </div>
              <div className="flex-1 flex items-center h-7 bg-[var(--input)] border border-[var(--border)] rounded">
                <LabelScrub value={flexShrink} onChange={handleFlexShrinkChange} step={1} min={0} max={10} onAltClick={() => resetCss("flex-shrink", setFlexShrink)}>
                  <span className="px-1.5 text-[10px] text-[var(--muted-foreground)] shrink-0 whitespace-nowrap inline-flex items-center gap-[3px]">
                    {ind("flex-shrink") !== "none" && <StyleIndicator type={ind("flex-shrink")} />}Shrink
                  </span>
                </LabelScrub>
                <ValueInput value={flexShrink} onChange={handleFlexShrinkChange} onAltClick={() => resetCss("flex-shrink", setFlexShrink)} />
              </div>
            </div>
          )}

          {/* Basis — compact input with unit selector, flex children only */}
          {parentIsFlex && (
            <div className="py-0.5 px-3">
              <div className="flex items-center h-7 bg-[var(--input)] border border-[var(--border)] rounded">
                <LabelScrub value={flexBasis} onChange={handleFlexBasisChange} step={1} min={0} max={500} onAltClick={() => resetCss("flex-basis", setFlexBasis)}>
                  <span className="px-1.5 text-[10px] text-[var(--muted-foreground)] shrink-0 whitespace-nowrap inline-flex items-center gap-[3px]">
                    {ind("flex-basis") !== "none" && <StyleIndicator type={ind("flex-basis")} />}Basis
                  </span>
                </LabelScrub>
                <div className="flex-1 flex justify-end pr-0.5">
                  <ValueInput value={flexBasis} onChange={handleFlexBasisChange} onAltClick={() => resetCss("flex-basis", setFlexBasis)} />
                </div>
                <div className="shrink-0 pr-[3px]">
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
                  />
                </div>
              </div>
            </div>
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

          {/* Order — simple number input, not a slider */}
          <div className="flex items-center gap-1.5 py-0.5 px-3">
            <span className="w-16 text-[11px] text-[var(--muted-foreground)] shrink-0 inline-flex items-center gap-1">
              {ind("order") !== "none" && <StyleIndicator type={ind("order")} />}
              Order
            </span>
            <ValueInput value={flexOrder} onChange={handleFlexOrderChange} onAltClick={() => resetCss("order", setFlexOrder)} />
          </div>
        </>
      )}
    </Section>
  );
});
