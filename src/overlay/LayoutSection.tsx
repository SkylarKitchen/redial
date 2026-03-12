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
import { resetProp } from "./apply";
import { detectUnit, type SectionCtx } from "./panelUtils";
import { MiniDropdown, DirectionRow, GapRow, DisplayTabs } from "./layoutControls";
import { LAYOUT_UNITS, JUSTIFY_OPTIONS, ALIGN_ITEMS_OPTIONS, ALIGN_SELF_OPTIONS } from "./panelConstants";
import { Link, Grid3x3 } from "lucide-react";

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
  } = props;

  const { apply, ind, sectionInd, cs, element, getConversionCtx } = ctx;
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
  const [flexBasisUnit, setFlexBasisUnit] = useState(() => detectUnit(element, "flex-basis"));

  // Conversion hints
  const { conversionHint: gapHint, fireConversionHint: fireGapHint } = useConversionHint();
  const { conversionHint: colGapHint, fireConversionHint: fireColGapHint } = useConversionHint();
  const { conversionHint: basisHint, fireConversionHint: fireBasisHint } = useConversionHint();

  // ── Helpers ──

  const resetCss = useCallback(
    (prop: string, setter: (v: number) => void) => {
      resetProp(element, prop);
      const fresh = getComputedStyle(element).getPropertyValue(prop).trim();
      setter(parseFloat(fresh) || 0);
    },
    [element],
  );

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
    (v: number) => { setRowGap(v); apply("row-gap", `${v}px`); },
    [apply],
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
        apply("row-gap", `${gap}${gapUnit}`);
        apply("column-gap", `${gap}${gapUnit}`);
        onColumnGapUnitChange(gapUnit);
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
    >
      <DisplayTabs value={display} onChange={handleDisplayChange} />

      {isFlex && (
        <>
          {/* Direction row: row/column/wrap icons + dropdown for reverse */}
          <DirectionRow
            direction={flexDirection}
            wrap={flexWrap}
            onDirectionChange={handleFlexDirectionChange}
            onWrapChange={handleFlexWrapChange}
          />

          {/* Align row: 3x3 grid + X/Y dropdowns side-by-side */}
          <div style={{ padding: "4px 12px", display: "flex", alignItems: "flex-start", gap: "8px" }}>
            <span style={{ width: "48px", fontSize: "11px", color: "rgba(255,255,255,0.5)", flexShrink: 0, paddingTop: "6px" }}>Align</span>
            <div style={{ flexShrink: 0 }}>
              <AlignBox justify={justifyContent} align={alignItems} onChange={handleAlignChange} mode="flex" compact />
            </div>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "4px", paddingTop: "2px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.35)", width: "12px", textAlign: "right" }}>X</span>
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
              <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.35)", width: "12px", textAlign: "right" }}>Y</span>
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
            }
            linked={gapLocked}
            onLinkedChange={(v) => {
              setGapLocked(v);
              if (v) {
                setRowGap(gap);
                onColumnGapChange(gap);
                apply("row-gap", `${gap}px`);
                apply("column-gap", `${gap}px`);
              }
            }}
          />
        </>
      )}

      {isGrid && (
        <>
          {/* Grid overlay toggle */}
          {onToggleGridOverlay && (
            <div style={{ padding: "2px 12px", display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ width: "64px", fontSize: "11px", color: "rgba(255,255,255,0.5)", flexShrink: 0 }}>Overlay</span>
              <button
                onClick={onToggleGridOverlay}
                title={showGridOverlay ? "Hide grid overlay" : "Show grid overlay"}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  padding: "3px 8px",
                  fontSize: "10px",
                  fontFamily: "ui-monospace, 'SF Mono', monospace",
                  background: showGridOverlay ? "rgba(99,102,241,0.2)" : "rgba(255,255,255,0.06)",
                  border: showGridOverlay ? "1px solid rgba(99,102,241,0.4)" : "1px solid rgba(255,255,255,0.1)",
                  borderRadius: "3px",
                  color: showGridOverlay ? "rgba(99,102,241,0.9)" : "rgba(255,255,255,0.5)",
                  cursor: "pointer",
                  outline: "none",
                }}
              >
                <Grid3x3 size={12} strokeWidth={1.5} />
                {showGridOverlay ? "Hide" : "Show"}
              </button>
            </div>
          )}
          <TextRow label="Columns" value={gridCols} placeholder="1fr 1fr 1fr" onChange={handleGridColsChange} />
          <TextRow label="Rows" value={gridRows} placeholder="auto" onChange={handleGridRowsChange} />
          <div style={{ padding: "6px 12px" }}>
            <AlignBox
              justify={justifyItems}
              align={alignContent}
              onChange={handleGridAlignChange}
              mode="grid"
            />
          </div>
          {gapLocked ? (
            <div style={{ display: "flex", alignItems: "center" }}>
              <div style={{ flex: 1 }}>
                <SliderRow
                  label="Gap"
                  value={gap}
                  min={0}
                  max={200}
                  step={1}
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
                />
              </div>
              <button
                onClick={handleGapLockToggle}
                title="Unlock row/column gap"
                style={{
                  width: "20px", height: "20px", display: "flex", alignItems: "center",
                  justifyContent: "center", background: "transparent", border: "none",
                  cursor: "pointer", color: "rgba(255,255,255,0.4)", fontSize: "10px",
                  marginRight: "8px", borderRadius: "3px", flexShrink: 0,
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
                    step={1}
                    unit="px"
                    onChange={handleRowGapChange}
                    onReset={() => resetCss("row-gap", setRowGap)}
                    indicator={ind("row-gap")}
                  />
                </div>
                <button
                  onClick={handleGapLockToggle}
                  title="Lock gap"
                  style={{
                    width: "20px", height: "20px", display: "flex", alignItems: "center",
                    justifyContent: "center", background: "transparent", border: "none",
                    cursor: "pointer", color: "rgba(255,255,255,0.25)", fontSize: "10px",
                    marginRight: "8px", borderRadius: "3px", flexShrink: 0,
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
                step={1}
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
              />
            </>
          )}
        </>
      )}

      {parentIsFlexOrGrid && (
        <>
          <div style={{
            padding: "6px 12px 2px",
            fontSize: "10px",
            color: "rgba(255,255,255,0.35)",
            textTransform: "uppercase",
            letterSpacing: "0.04em",
          }}>
            {parentIsFlex ? "Flex Child" : "Grid Child"}
          </div>

          {/* Grow / Shrink — compact inline inputs, flex children only */}
          {parentIsFlex && (
            <div style={{ display: "flex", gap: "6px", padding: "2px 12px" }}>
              <div style={{
                flex: 1, display: "flex", alignItems: "center", height: "28px",
                background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: "4px", overflow: "hidden",
              }}>
                <LabelScrub value={flexGrow} onChange={handleFlexGrowChange} step={1} min={0} max={10}>
                  <span style={{
                    padding: "0 6px", fontSize: "10px", color: "rgba(255,255,255,0.5)",
                    flexShrink: 0, whiteSpace: "nowrap", display: "inline-flex",
                    alignItems: "center", gap: "3px",
                  }}>
                    {ind("flex-grow") !== "none" && <StyleIndicator type={ind("flex-grow")} />}Grow
                  </span>
                </LabelScrub>
                <ValueInput value={flexGrow} onChange={handleFlexGrowChange} />
              </div>
              <div style={{
                flex: 1, display: "flex", alignItems: "center", height: "28px",
                background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: "4px", overflow: "hidden",
              }}>
                <LabelScrub value={flexShrink} onChange={handleFlexShrinkChange} step={1} min={0} max={10}>
                  <span style={{
                    padding: "0 6px", fontSize: "10px", color: "rgba(255,255,255,0.5)",
                    flexShrink: 0, whiteSpace: "nowrap", display: "inline-flex",
                    alignItems: "center", gap: "3px",
                  }}>
                    {ind("flex-shrink") !== "none" && <StyleIndicator type={ind("flex-shrink")} />}Shrink
                  </span>
                </LabelScrub>
                <ValueInput value={flexShrink} onChange={handleFlexShrinkChange} />
              </div>
            </div>
          )}

          {/* Basis — compact input with unit selector, flex children only */}
          {parentIsFlex && (
            <div style={{ padding: "2px 12px" }}>
              <div style={{
                display: "flex", alignItems: "center", height: "28px",
                background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: "4px", overflow: "hidden",
              }}>
                <LabelScrub value={flexBasis} onChange={handleFlexBasisChange} step={1} min={0} max={500}>
                  <span style={{
                    padding: "0 6px", fontSize: "10px", color: "rgba(255,255,255,0.5)",
                    flexShrink: 0, whiteSpace: "nowrap", display: "inline-flex",
                    alignItems: "center", gap: "3px",
                  }}>
                    {ind("flex-basis") !== "none" && <StyleIndicator type={ind("flex-basis")} />}Basis
                  </span>
                </LabelScrub>
                <div style={{ flex: 1, display: "flex", justifyContent: "flex-end", paddingRight: "2px" }}>
                  <ValueInput value={flexBasis} onChange={handleFlexBasisChange} />
                </div>
                <div style={{ flexShrink: 0, paddingRight: "3px" }}>
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
            indicator={ind("align-self")}
          />

          {/* Order — simple number input, not a slider */}
          <div style={{ display: "flex", alignItems: "center", gap: "6px", padding: "2px 12px" }}>
            <span style={{
              width: "64px", fontSize: "11px", color: "rgba(255,255,255,0.5)",
              flexShrink: 0, display: "inline-flex", alignItems: "center", gap: "4px",
            }}>
              {ind("order") !== "none" && <StyleIndicator type={ind("order")} />}
              Order
            </span>
            <ValueInput value={flexOrder} onChange={handleFlexOrderChange} />
          </div>
        </>
      )}
    </Section>
  );
});
