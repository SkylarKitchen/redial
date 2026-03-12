import React, { useState, useCallback, memo } from "react";
import { cn } from "@/lib/utils";
import { Section, SliderRow } from "./controls";
import { PositionOffsetDiagram } from "./PositionOffsetDiagram";
import { PositionSelector } from "./PositionSelector";
import { IconButtonGroup } from "./IconButtonGroup";
import { StyleIndicator } from "./StyleIndicator";
import { convertUnit } from "./unitConversion";
import { useConversionHint } from "./useConversionHint";
import { resetProp, resetAndReadNum, resetAndReadStr } from "./apply";
import { parseNum } from "./cssParsers";
import { isAutoSize } from "./getAuthoredValue";
import { detectUnit, type SectionCtx } from "./panelUtils";
import { POSITION_UNITS, PIN_PRESETS } from "./panelConstants";
import { color, text, border, surface, font, blackAlpha, primaryAlpha } from "./theme";
import { ms } from "./timing";
import { ChevronRight, Layers, Minus, AlignLeft, AlignRight, X } from "lucide-react";

// ─── Float / Clear icon options (JSX — must live in .tsx) ────────────

const FLOAT_ICON_OPTIONS = [
  { value: "none", icon: <X size={14} strokeWidth={2} />, title: "None" },
  { value: "left", icon: <AlignLeft size={14} strokeWidth={1.5} />, title: "Float left" },
  { value: "right", icon: <AlignRight size={14} strokeWidth={1.5} />, title: "Float right" },
];

const CLEAR_ICON_OPTIONS = [
  { value: "none", icon: <X size={14} strokeWidth={2} />, title: "None" },
  { value: "left", icon: <AlignLeft size={14} strokeWidth={1.5} />, title: "Clear left" },
  { value: "right", icon: <AlignRight size={14} strokeWidth={1.5} />, title: "Clear right" },
  { value: "both", icon: <span style={{ fontSize: "9px", fontWeight: 600, lineHeight: 1 }}>Both</span>, title: "Clear both" },
];

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

  // Auto states for offsets
  const [topAuto, setTopAuto] = useState(() => isAutoSize(element, "top"));
  const [rightAuto, setRightAuto] = useState(() => isAutoSize(element, "right"));
  const [bottomAuto, setBottomAuto] = useState(() => isAutoSize(element, "bottom"));
  const [leftAuto, setLeftAuto] = useState(() => isAutoSize(element, "left"));

  // Float/clear collapsible
  const [showFloatClear, setShowFloatClear] = useState(false);

  // Position units
  const [topUnit, setTopUnit] = useState(() => detectUnit(element, "top"));
  const [rightUnit, setRightUnit] = useState(() => detectUnit(element, "right"));
  const [bottomUnit, setBottomUnit] = useState(() => detectUnit(element, "bottom"));
  const [leftUnit, setLeftUnit] = useState(() => detectUnit(element, "left"));

  const { conversionHint: posHint, fireConversionHint: firePosHint } = useConversionHint();

  const resetCss = (prop: string, setter: (v: number) => void) => setter(resetAndReadNum(element, prop));
  const resetCssStr = (prop: string, setter: (v: string) => void) => setter(resetAndReadStr(element, prop));

  // ── Handlers ──
  const handlePositionChange = useCallback((v: string) => { setPosition(v); apply("position", v); }, [apply]);
  const handleTopChange = useCallback((v: number) => { setTopAuto(false); setTop(v); apply("top", `${v}${topUnit}`); }, [apply, topUnit]);
  const handleRightChange = useCallback((v: number) => { setRightAuto(false); setRight(v); apply("right", `${v}${rightUnit}`); }, [apply, rightUnit]);
  const handleBottomChange = useCallback((v: number) => { setBottomAuto(false); setBottom(v); apply("bottom", `${v}${bottomUnit}`); }, [apply, bottomUnit]);
  const handleLeftChange = useCallback((v: number) => { setLeftAuto(false); setLeft(v); apply("left", `${v}${leftUnit}`); }, [apply, leftUnit]);
  const handleZIndexChange = useCallback((v: number) => { setZIndexAuto(false); setZIndex(v); apply("z-index", String(v)); }, [apply]);
  const handleZIndexAutoToggle = useCallback(() => {
    const next = !zIndexAuto;
    setZIndexAuto(next);
    apply("z-index", next ? "auto" : String(zIndex));
  }, [zIndexAuto, zIndex, apply]);
  const handleFloatChange = useCallback((v: string) => { setFloat(v); apply("float", v); }, [apply]);
  const handleClearChange = useCallback((v: string) => { setClear(v); apply("clear", v); }, [apply]);

  // ── Pin preset handler ──
  const handlePinPreset = useCallback((pin: { top: boolean; right: boolean; bottom: boolean; left: boolean }) => {
    if (pin.top) { setTopAuto(false); setTop(0); apply("top", `0${topUnit}`); } else { setTopAuto(true); apply("top", "auto"); }
    if (pin.right) { setRightAuto(false); setRight(0); apply("right", `0${rightUnit}`); } else { setRightAuto(true); apply("right", "auto"); }
    if (pin.bottom) { setBottomAuto(false); setBottom(0); apply("bottom", `0${bottomUnit}`); } else { setBottomAuto(true); apply("bottom", "auto"); }
    if (pin.left) { setLeftAuto(false); setLeft(0); apply("left", `0${leftUnit}`); } else { setLeftAuto(true); apply("left", "auto"); }
  }, [apply, topUnit, rightUnit, bottomUnit, leftUnit]);

  // ── Auto disable handler (user clicks "Auto" to switch to editable) ──
  const handleAutoDisable = useCallback((prop: string) => {
    if (prop === "top") { setTopAuto(false); setTop(0); apply("top", `0${topUnit}`); }
    else if (prop === "right") { setRightAuto(false); setRight(0); apply("right", `0${rightUnit}`); }
    else if (prop === "bottom") { setBottomAuto(false); setBottom(0); apply("bottom", `0${bottomUnit}`); }
    else if (prop === "left") { setLeftAuto(false); setLeft(0); apply("left", `0${leftUnit}`); }
  }, [apply, topUnit, rightUnit, bottomUnit, leftUnit]);

  return (
    <Section title="Position" collapsed={position === "static"} indicator={sectionInd(["position", "top", "right", "bottom", "left", "z-index", "float", "clear"])} forceOpen={forceOpen} focusOpen={focusOpen} onToggle={onToggle}>
      <PositionSelector value={position} onChange={handlePositionChange} indicator={ind("position")} />
      {position !== "static" && (
        <>
          {/* Pin preset icons */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "2px", padding: "4px 12px 2px" }}>
            {PIN_PRESETS.map((preset) => {
              const isActive =
                preset.pin.top === !topAuto &&
                preset.pin.right === !rightAuto &&
                preset.pin.bottom === !bottomAuto &&
                preset.pin.left === !leftAuto;
              return (
                <button
                  key={preset.label}
                  title={preset.label}
                  onClick={() => handlePinPreset(preset.pin)}
                  style={{
                    width: "20px",
                    height: "20px",
                    padding: 0,
                    border: `1px solid ${isActive ? primaryAlpha(0.4) : blackAlpha(0.08)}`,
                    borderRadius: "3px",
                    background: isActive ? primaryAlpha(0.15) : "transparent",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    transition: `all ${ms("normal")}`,
                  }}
                >
                  <PinPresetIcon pin={preset.pin} active={isActive} />
                </button>
              );
            })}
          </div>

          <PositionOffsetDiagram
            top={top}
            right={right}
            bottom={bottom}
            left={left}
            autoStates={{ top: topAuto, right: rightAuto, bottom: bottomAuto, left: leftAuto }}
            onAutoDisable={handleAutoDisable}
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

          {/* Z-Index row */}
          <div className="flex items-center gap-1.5 py-0.5 px-3">
            <Layers size={12} strokeWidth={1.5} style={{ color: text.disabled, flexShrink: 0 }} />
            <span className="text-[11px] shrink-0 inline-flex items-center gap-[3px]" style={{ color: text.disabled }}>
              {ind("z-index") !== "none" && <StyleIndicator type={ind("z-index")} />}
              Z-Index
            </span>
            <div style={{ flex: 1 }} />
            {zIndexAuto ? (
              <button
                onClick={handleZIndexAutoToggle}
                className="px-2 py-0.5 text-[10px] font-mono rounded-[3px] cursor-pointer border"
                style={{ background: primaryAlpha(0.2), color: color.primary, borderColor: primaryAlpha(0.3) }}
              >
                Auto
              </button>
            ) : (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleZIndexChange(zIndex - 1)}
                  className="flex items-center justify-center cursor-pointer border rounded-[3px]"
                  style={{ width: "20px", height: "20px", background: surface.subtle, borderColor: blackAlpha(0.07), color: text.secondary }}
                  title="Decrement z-index"
                >
                  <Minus size={10} strokeWidth={2} />
                </button>
                <SliderRow label="" value={zIndex} min={-10} max={9999} step={1} unit="" onChange={handleZIndexChange} onReset={() => { resetCss("z-index", setZIndex); setZIndexAuto(true); }} indicator={"none" as const} onContextMenu={ctxMenu("z-index", String(zIndex))} computedProp="z-index" computedElement={element} />
                <button
                  onClick={handleZIndexAutoToggle}
                  className="px-1.5 py-0.5 text-[9px] font-mono rounded-[3px] cursor-pointer border"
                  style={{ background: surface.subtle, color: text.disabled, borderColor: blackAlpha(0.07) }}
                  title="Set to auto"
                >
                  auto
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {/* Float and clear collapsible */}
      <div onClick={() => setShowFloatClear(!showFloatClear)} className="px-3 py-1.5 cursor-pointer flex items-center gap-1 border-t" style={{ borderColor: border.subtle }}>
        <ChevronRight size={9} strokeWidth={2} style={{ color: "#7A7974", transition: `transform ${ms("expand")}`, transform: showFloatClear ? "rotate(90deg)" : "rotate(0deg)" }} />
        <span className="text-[10px] uppercase tracking-[0.04em]" style={{ color: text.label }}>Float and clear</span>
      </div>
      {showFloatClear && (
        <div style={{ padding: "2px 12px 6px" }}>
          {/* Float row */}
          <div className="flex items-center gap-2 py-1">
            <span className="w-10 text-[11px] shrink-0" style={{ color: text.disabled }}>
              {ind("float") !== "none" && <StyleIndicator type={ind("float")} />}
              Float
            </span>
            <IconButtonGroup options={FLOAT_ICON_OPTIONS} value={float_} onChange={handleFloatChange} aria-label="Float" />
          </div>
          {/* Clear row */}
          <div className="flex items-center gap-2 py-1">
            <span className="w-10 text-[11px] shrink-0" style={{ color: text.disabled }}>
              {ind("clear") !== "none" && <StyleIndicator type={ind("clear")} />}
              Clear
            </span>
            <IconButtonGroup options={CLEAR_ICON_OPTIONS} value={clear_} onChange={handleClearChange} aria-label="Clear" />
          </div>
        </div>
      )}
    </Section>
  );
});

// ─── Pin Preset Icon (tiny SVG showing which edges are pinned) ──────

function PinPresetIcon({ pin, active }: { pin: { top: boolean; right: boolean; bottom: boolean; left: boolean }; active: boolean }) {
  const fill = active ? color.primary : "#9A9994";
  const dim = "#D4D3D0";
  return (
    <svg width="12" height="12" viewBox="0 0 12 12">
      {/* Top edge */}
      <rect x="3" y="0" width="6" height="2" rx="0.5" fill={pin.top ? fill : dim} />
      {/* Bottom edge */}
      <rect x="3" y="10" width="6" height="2" rx="0.5" fill={pin.bottom ? fill : dim} />
      {/* Left edge */}
      <rect x="0" y="3" width="2" height="6" rx="0.5" fill={pin.left ? fill : dim} />
      {/* Right edge */}
      <rect x="10" y="3" width="2" height="6" rx="0.5" fill={pin.right ? fill : dim} />
      {/* Center dot */}
      <circle cx="6" cy="6" r="1.5" fill={active ? fill : dim} />
    </svg>
  );
}
