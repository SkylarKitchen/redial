import React, { useState, useCallback, memo } from "react";
import { Section, SliderRow } from "./controls";
import { PositionOffsetDiagram } from "./PositionOffsetDiagram";
import { PositionSelector } from "./PositionSelector";
import { IconButtonGroup } from "./IconButtonGroup";
import { StyleIndicator } from "./StyleIndicator";
import { convertUnit } from "./unitConversion";
import { useConversionHint } from "./useConversionHint";
import { resetAndReadNum, resetAndReadStr } from "./apply";
import { parseNum } from "./cssParsers";
import { isAutoSize } from "./getAuthoredValue";
import { detectUnit, type SectionCtx } from "./panelUtils";
import { POSITION_UNITS, PIN_PRESETS } from "./panelConstants";
import { color, text, border, surface, font, blackAlpha, primaryAlpha } from "./theme";
import { ms } from "./timing";
import { ChevronDown, LocateFixed, X } from "lucide-react";
import {
  PositionTopLeftIcon, PositionTopRightIcon,
  PositionBottomLeftIcon, PositionBottomRightIcon,
  PositionLeftIcon, PositionRightIcon,
  PositionBottomIcon, PositionTopIcon,
  PositionAllIcon,
  FloatLeftIcon, FloatRightIcon,
  ClearLeftIcon, ClearRightIcon, ClearBothIcon,
} from "./webflowIcons";

// ─── Pin preset order matching Figma layout (single horizontal row) ───

const PIN_PRESET_ICONS: Array<{ presetIndex: number; Icon: React.FC<{ size?: number; className?: string }> }> = [
  { presetIndex: 0, Icon: PositionTopLeftIcon },      // TL
  { presetIndex: 2, Icon: PositionTopRightIcon },      // TR
  { presetIndex: 6, Icon: PositionBottomLeftIcon },    // BL
  { presetIndex: 8, Icon: PositionBottomRightIcon },   // BR
  { presetIndex: 3, Icon: PositionLeftIcon },          // L
  { presetIndex: 5, Icon: PositionRightIcon },         // R
  { presetIndex: 7, Icon: PositionBottomIcon },        // B
  { presetIndex: 1, Icon: PositionTopIcon },           // T
  { presetIndex: 4, Icon: PositionAllIcon },           // All
];

// ─── Float / Clear icon options ─────────────────────────────────────

const FLOAT_ICON_OPTIONS = [
  { value: "none", icon: <X size={14} strokeWidth={2} />, title: "None" },
  { value: "left", icon: <FloatLeftIcon size={14} />, title: "Float left" },
  { value: "right", icon: <FloatRightIcon size={14} />, title: "Float right" },
];

const CLEAR_ICON_OPTIONS = [
  { value: "none", icon: <X size={14} strokeWidth={2} />, title: "None" },
  { value: "left", icon: <ClearLeftIcon size={14} />, title: "Clear left" },
  { value: "right", icon: <ClearRightIcon size={14} />, title: "Clear right" },
  { value: "both", icon: <ClearBothIcon size={14} />, title: "Clear both" },
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
      <PositionSelector value={position} onChange={handlePositionChange} indicator={ind("position")} onReset={() => { const v = resetAndReadStr(element, "position"); setPosition(v); }} />
      {position !== "static" && (
        <>
          {/* Pin preset icons — horizontal row matching Figma */}
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: "3.75px",
            padding: "4px 8px 2px",
          }}>
            {PIN_PRESET_ICONS.map(({ presetIndex, Icon }) => {
              const preset = PIN_PRESETS[presetIndex];
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
                    width: 16,
                    height: 16,
                    padding: 0,
                    border: "none",
                    borderRadius: "2px",
                    background: isActive ? primaryAlpha(0.12) : "transparent",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: isActive ? color.primary : text.hint,
                    transition: `all ${ms("normal")}`,
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) (e.currentTarget as HTMLElement).style.background = surface.hover;
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) (e.currentTarget as HTMLElement).style.background = "transparent";
                  }}
                >
                  <Icon size={16} />
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
            onReset={(prop) => {
              if (prop === "top") { resetCss("top", setTop); setTopAuto(isAutoSize(element, "top")); }
              else if (prop === "right") { resetCss("right", setRight); setRightAuto(isAutoSize(element, "right")); }
              else if (prop === "bottom") { resetCss("bottom", setBottom); setBottomAuto(isAutoSize(element, "bottom")); }
              else if (prop === "left") { resetCss("left", setLeft); setLeftAuto(isAutoSize(element, "left")); }
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

          {/* Z-Index row — Figma: icon + "Itself" input + "Auto" input with unit */}
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            padding: "4px 7px",
          }}>
            {/* Label area */}
            <div style={{ width: 49, flexShrink: 0, display: "flex", alignItems: "center" }}>
              {ind("z-index") !== "none" && <StyleIndicator type={ind("z-index")} />}
            </div>

            {/* "Itself" context dropdown — shows which element z-index is relative to */}
            <div
              style={{
                flex: 1,
                height: 24,
                display: "flex",
                alignItems: "center",
                background: color.input,
                border: `1px solid ${color.border}`,
                borderRadius: 3,
                padding: "0 4px",
                cursor: "default",
              }}
            >
              <LocateFixed size={14} strokeWidth={1.5} style={{ color: text.disabled, flexShrink: 0, marginRight: 4 }} />
              <span style={{
                fontSize: 11,
                fontFamily: font.mono,
                color: text.secondary,
                flex: 1,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}>
                Itself
              </span>
            </div>

            {/* Z-index value input */}
            <div
              style={{
                width: 64,
                height: 24,
                display: "flex",
                alignItems: "center",
                background: color.input,
                border: `1px solid ${color.border}`,
                borderRadius: 3,
                overflow: "hidden",
                flexShrink: 0,
              }}
            >
              {zIndexAuto ? (
                <button
                  onClick={(e) => { if (e.altKey) { const v = resetAndReadStr(element, "z-index"); setZIndex(parseInt(v) || 0); setZIndexAuto(v === "auto" || !v); return; } handleZIndexAutoToggle(); }}
                  style={{
                    flex: 1,
                    height: "100%",
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    fontSize: 11,
                    fontFamily: font.mono,
                    color: text.label,
                    textAlign: "left",
                    padding: "0 4px",
                  }}
                >
                  Auto
                </button>
              ) : (
                <input
                  type="text"
                  value={zIndex}
                  onClick={(e) => { if (e.altKey) { const v = resetAndReadStr(element, "z-index"); setZIndex(parseInt(v) || 0); setZIndexAuto(v === "auto" || !v); } }}
                  onChange={(e) => {
                    const v = parseInt(e.target.value);
                    if (!isNaN(v)) handleZIndexChange(v);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "ArrowUp") { e.preventDefault(); handleZIndexChange(zIndex + (e.shiftKey ? 10 : 1)); }
                    else if (e.key === "ArrowDown") { e.preventDefault(); handleZIndexChange(zIndex - (e.shiftKey ? 10 : 1)); }
                    else if (e.key === "Escape") { handleZIndexAutoToggle(); }
                  }}
                  style={{
                    flex: 1,
                    height: "100%",
                    background: "transparent",
                    border: "none",
                    outline: "none",
                    fontSize: 11,
                    fontFamily: font.mono,
                    color: text.secondary,
                    padding: "0 4px",
                    width: "100%",
                  }}
                />
              )}
              {/* Unit suffix — shows a dash (like Figma) */}
              <div style={{
                width: 16,
                height: 24,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "#E7E6E1",
                flexShrink: 0,
                borderLeft: `1px solid ${color.border}`,
              }}>
                <svg width="5" height="1" viewBox="0 0 5 1">
                  <line x1="0" y1="0.5" x2="5" y2="0.5" stroke="#7B7974" strokeWidth="1" />
                </svg>
              </div>
            </div>
          </div>

          {/* Columns / Rows labels */}
          <div style={{
            display: "flex",
            alignItems: "center",
            padding: "0 7px",
          }}>
            <div style={{ width: 49, flexShrink: 0 }} />
            <div style={{ flex: 1, display: "flex", alignItems: "center" }}>
              <span style={{
                fontSize: 11,
                color: text.label,
                flex: 1,
                textAlign: "center",
              }}>
                Columns
              </span>
              <span style={{
                fontSize: 11,
                color: text.label,
                width: 64,
                textAlign: "center",
                flexShrink: 0,
              }}>
                Rows
              </span>
            </div>
          </div>
        </>
      )}

      {/* Float and clear collapsible button */}
      <button
        onClick={() => setShowFloatClear(!showFloatClear)}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 2,
          width: "calc(100% - 16px)",
          margin: "4px 8px",
          padding: "4px 0",
          height: 24,
          background: "transparent",
          border: "none",
          cursor: "pointer",
          borderRadius: 3,
          transition: `background ${ms("fast")}`,
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = surface.hover; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
      >
        <ChevronDown
          size={14}
          strokeWidth={2}
          style={{
            color: text.label,
            transition: `transform ${ms("expand")}`,
            transform: showFloatClear ? "rotate(0deg)" : "rotate(-90deg)",
          }}
        />
        <span style={{ fontSize: 11, color: text.label }}>
          Float and clear
        </span>
      </button>

      {showFloatClear && (
        <div style={{ padding: "2px 7px 6px" }}>
          {/* Float row */}
          <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 0" }}>
            <span style={{
              width: 49,
              fontSize: 11,
              color: text.label,
              flexShrink: 0,
              display: "inline-flex",
              alignItems: "center",
              gap: 3,
            }}>
              {ind("float") !== "none" && <StyleIndicator type={ind("float")} />}
              Float
            </span>
            <div style={{ flex: 1 }}>
              <IconButtonGroup options={FLOAT_ICON_OPTIONS} value={float_} onChange={handleFloatChange} aria-label="Float" onReset={() => { const v = resetAndReadStr(element, "float"); setFloat(v || "none"); }} />
            </div>
          </div>
          {/* Clear row */}
          <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 0" }}>
            <span style={{
              width: 49,
              fontSize: 11,
              color: text.label,
              flexShrink: 0,
              display: "inline-flex",
              alignItems: "center",
              gap: 3,
            }}>
              {ind("clear") !== "none" && <StyleIndicator type={ind("clear")} />}
              Clear
            </span>
            <div style={{ flex: 1 }}>
              <IconButtonGroup options={CLEAR_ICON_OPTIONS} value={clear_} onChange={handleClearChange} aria-label="Clear" onReset={() => { const v = resetAndReadStr(element, "clear"); setClear(v || "none"); }} />
            </div>
          </div>
        </div>
      )}
    </Section>
  );
});
