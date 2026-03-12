import React, { useState, useCallback, memo } from "react";
import { cn } from "@/lib/utils";
import { Section, SliderRow, SelectRow } from "./controls";
import { PositionOffsetDiagram } from "./PositionOffsetDiagram";
import { PositionSelector } from "./PositionSelector";
import { StyleIndicator } from "./StyleIndicator";
import { convertUnit } from "./unitConversion";
import { useConversionHint } from "./useConversionHint";
import { resetProp, resetAndReadNum } from "./apply";
import { parseNum } from "./cssParsers";
import { detectUnit, type SectionCtx } from "./panelUtils";
import { POSITION_UNITS, FLOAT_OPTIONS, CLEAR_OPTIONS } from "./panelConstants";

interface PositionSectionProps {
  ctx: SectionCtx;
  forceOpen?: boolean;
  focusOpen?: boolean;
  onToggle?: (title: string) => void;
}

export const PositionSection = memo(function PositionSection({
  ctx,
  forceOpen,
  focusOpen,
  onToggle,
}: PositionSectionProps) {
  const { element, apply, ind, sectionInd, cs, getConversionCtx, ctxMenu } = ctx;

  // ── Position state ──
  const [position, setPosition] = useState(() => cs.position);
  const [top, setTop] = useState(() => parseNum(cs.top));
  const [right, setRight] = useState(() => parseNum(cs.right));
  const [bottom, setBottom] = useState(() => parseNum(cs.bottom));
  const [left, setLeft] = useState(() => parseNum(cs.left));
  const [zIndex, setZIndex] = useState(() => parseInt(cs.zIndex) || 0);
  const [zIndexAuto, setZIndexAuto] = useState(() => cs.zIndex === "auto" || !cs.zIndex);
  const [float_, setFloat] = useState(() => cs.cssFloat || "none");
  const [clear_, setClear] = useState(() => cs.clear || "none");

  // Position units
  const [topUnit, setTopUnit] = useState(() => detectUnit(element, "top"));
  const [rightUnit, setRightUnit] = useState(() => detectUnit(element, "right"));
  const [bottomUnit, setBottomUnit] = useState(() => detectUnit(element, "bottom"));
  const [leftUnit, setLeftUnit] = useState(() => detectUnit(element, "left"));

  const { conversionHint: posHint, fireConversionHint: firePosHint } = useConversionHint();

  const resetCss = (prop: string, setter: (v: number) => void) => setter(resetAndReadNum(element, prop));

  // ── Handlers ──
  const handlePositionChange = useCallback((v: string) => { setPosition(v); apply("position", v); }, [apply]);
  const handleTopChange = useCallback((v: number) => { setTop(v); apply("top", `${v}${topUnit}`); }, [apply, topUnit]);
  const handleRightChange = useCallback((v: number) => { setRight(v); apply("right", `${v}${rightUnit}`); }, [apply, rightUnit]);
  const handleBottomChange = useCallback((v: number) => { setBottom(v); apply("bottom", `${v}${bottomUnit}`); }, [apply, bottomUnit]);
  const handleLeftChange = useCallback((v: number) => { setLeft(v); apply("left", `${v}${leftUnit}`); }, [apply, leftUnit]);
  const handleZIndexChange = useCallback((v: number) => { setZIndexAuto(false); setZIndex(v); apply("z-index", String(v)); }, [apply]);
  const handleZIndexAutoToggle = useCallback(() => {
    const next = !zIndexAuto;
    setZIndexAuto(next);
    apply("z-index", next ? "auto" : String(zIndex));
  }, [zIndexAuto, zIndex, apply]);
  const handleFloatChange = useCallback((v: string) => { setFloat(v); apply("float", v); }, [apply]);
  const handleClearChange = useCallback((v: string) => { setClear(v); apply("clear", v); }, [apply]);

  return (
    <Section title="Position" collapsed={position === "static"} indicator={sectionInd(["position", "top", "right", "bottom", "left", "z-index", "float", "clear"])} forceOpen={forceOpen} focusOpen={focusOpen} onToggle={onToggle}>
      <PositionSelector value={position} onChange={handlePositionChange} indicator={ind("position")} />
      {position !== "static" && (
        <>
          <PositionOffsetDiagram
            top={top}
            right={right}
            bottom={bottom}
            left={left}
            onChange={(prop, v) => {
              if (prop === "top") handleTopChange(v);
              else if (prop === "right") handleRightChange(v);
              else if (prop === "bottom") handleBottomChange(v);
              else if (prop === "left") handleLeftChange(v);
            }}
            units={{ top: topUnit, right: rightUnit, bottom: bottomUnit, left: leftUnit }}
            availableUnits={POSITION_UNITS}
            onUnitChange={(prop: string, unit: string) => {
              const ctx = getConversionCtx();
              const axis = (prop === "top" || prop === "bottom") ? "height" as const : "width" as const;
              if (prop === "top") { const c = convertUnit(top, topUnit, unit, ctx, axis); firePosHint(top, topUnit, c, unit, ctx, axis); setTop(c); setTopUnit(unit); apply("top", `${c}${unit}`); }
              else if (prop === "right") { const c = convertUnit(right, rightUnit, unit, ctx, axis); firePosHint(right, rightUnit, c, unit, ctx, axis); setRight(c); setRightUnit(unit); apply("right", `${c}${unit}`); }
              else if (prop === "bottom") { const c = convertUnit(bottom, bottomUnit, unit, ctx, axis); firePosHint(bottom, bottomUnit, c, unit, ctx, axis); setBottom(c); setBottomUnit(unit); apply("bottom", `${c}${unit}`); }
              else if (prop === "left") { const c = convertUnit(left, leftUnit, unit, ctx, axis); firePosHint(left, leftUnit, c, unit, ctx, axis); setLeft(c); setLeftUnit(unit); apply("left", `${c}${unit}`); }
            }}
            conversionHint={posHint}
          />
          <div className="flex items-center gap-1.5 py-0.5 px-3">
            <span className="w-16 text-[11px] text-black/45 shrink-0 inline-flex items-center gap-[3px]">
              {ind("z-index") !== "none" && <StyleIndicator type={ind("z-index")} />}
              Z-Index
            </span>
            <button
              onClick={handleZIndexAutoToggle}
              className={cn(
                "px-2 py-0.5 text-[10px] font-mono rounded-[3px] cursor-pointer border",
                zIndexAuto
                  ? "bg-[#c17a50]/20 text-[#c17a50] border-[#c17a50]/30"
                  : "bg-black/[0.04] text-black/35 border-black/07"
              )}
            >
              auto
            </button>
            {!zIndexAuto && (
              <SliderRow label="" value={zIndex} min={-10} max={9999} step={1} unit="" onChange={handleZIndexChange} onReset={() => { resetCss("z-index", setZIndex); setZIndexAuto(true); }} indicator={"none" as const} onContextMenu={ctxMenu("z-index", String(zIndex))} computedProp="z-index" computedElement={element} />
            )}
          </div>
        </>
      )}
      <SelectRow label="Float" value={float_} options={FLOAT_OPTIONS} onChange={handleFloatChange} indicator={ind("float")} onContextMenu={ctxMenu("float", float_)} computedProp="float" computedElement={element} />
      <SelectRow label="Clear" value={clear_} options={CLEAR_OPTIONS} onChange={handleClearChange} indicator={ind("clear")} onContextMenu={ctxMenu("clear", clear_)} computedProp="clear" computedElement={element} />
    </Section>
  );
});
