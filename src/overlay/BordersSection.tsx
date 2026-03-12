import React, { useState, useCallback, memo, useEffect } from "react";
import { Section, SliderRow, SelectRow, ColorRow } from "./controls";
import { SideSelector } from "./SideSelector";
import { CornerRadiusEditor } from "./CornerRadiusEditor";
import { convertUnit, conversionBasis } from "./unitConversion";
import { useConversionHint } from "./useConversionHint";
import { resetProp, resetAndReadNum } from "./apply";
import { parseNum } from "./cssParsers";
import { detectUnit, type SectionCtx } from "./panelUtils";
import { cssColorToHex as rgbToHex } from "./colorUtils";
import { BORDER_STYLE_OPTIONS, BORDER_UNITS } from "./panelConstants";

interface BordersSectionProps {
  ctx: SectionCtx;
  forceOpen?: boolean;
  focusOpen?: boolean;
  onToggle?: (title: string) => void;
}

export const BordersSection = memo(function BordersSection({
  ctx,
  forceOpen,
  focusOpen,
  onToggle,
}: BordersSectionProps) {
  const { element, apply, ind, sectionInd, cs, getConversionCtx, ctxMenu } = ctx;

  // ── Border state ──
  const [borderSide, setBorderSide] = useState<"all" | "top" | "right" | "bottom" | "left">("all");
  const [borderStyle, setBorderStyle] = useState(() => cs.borderStyle.split(" ")[0] || "none");
  const [borderWidth, setBorderWidth] = useState(() => parseNum(cs.borderWidth));
  const [borderColor, setBorderColor] = useState(() => rgbToHex(cs.borderColor));
  const [radiusTL, setRadiusTL] = useState(() => parseNum(cs.borderTopLeftRadius));
  const [radiusTR, setRadiusTR] = useState(() => parseNum(cs.borderTopRightRadius));
  const [radiusBR, setRadiusBR] = useState(() => parseNum(cs.borderBottomRightRadius));
  const [radiusBL, setRadiusBL] = useState(() => parseNum(cs.borderBottomLeftRadius));
  const [radiusUnit, setRadiusUnit] = useState(() => detectUnit(element, "border-top-left-radius"));
  const [borderWidthUnit, setBorderWidthUnit] = useState(() => detectUnit(element, "border-width"));
  const [radiusLinked, setRadiusLinked] = useState(() => {
    const tl = parseNum(cs.borderTopLeftRadius);
    const tr = parseNum(cs.borderTopRightRadius);
    const br = parseNum(cs.borderBottomRightRadius);
    const bl = parseNum(cs.borderBottomLeftRadius);
    return tl === tr && tr === br && br === bl;
  });

  const { conversionHint: bwHint, fireConversionHint: fireBwHint } = useConversionHint();

  // ── Sync controls when side tab changes ──
  // Reads per-side computed values so the controls reflect the selected side.
  useEffect(() => {
    const fresh = getComputedStyle(element);
    if (borderSide === "all") {
      setBorderStyle(fresh.borderStyle.split(" ")[0] || "none");
      setBorderWidth(parseNum(fresh.borderWidth));
      setBorderColor(rgbToHex(fresh.borderColor));
    } else {
      const side = borderSide; // top | right | bottom | left
      const sideStyle = fresh.getPropertyValue(`border-${side}-style`).trim() || "none";
      const sideWidth = parseNum(fresh.getPropertyValue(`border-${side}-width`));
      const sideColor = rgbToHex(fresh.getPropertyValue(`border-${side}-color`));
      setBorderStyle(sideStyle);
      setBorderWidth(sideWidth);
      setBorderColor(sideColor);
    }
  }, [borderSide, element]);

  const resetCss = (prop: string, setter: (v: number) => void) => setter(resetAndReadNum(element, prop));

  // ── Handlers ──
  const handleBorderStyleChange = useCallback((v: string) => {
    setBorderStyle(v);
    const prop = borderSide === "all" ? "border-style" : `border-${borderSide}-style`;
    apply(prop, v);
  }, [apply, borderSide]);

  const handleBorderWidthChange = useCallback((v: number) => {
    setBorderWidth(v);
    const prop = borderSide === "all" ? "border-width" : `border-${borderSide}-width`;
    apply(prop, `${v}${borderWidthUnit}`);
  }, [apply, borderSide, borderWidthUnit]);

  const handleBorderColorChange = useCallback((v: string) => {
    setBorderColor(v);
    const prop = borderSide === "all" ? "border-color" : `border-${borderSide}-color`;
    apply(prop, v);
  }, [apply, borderSide]);

  const handleCornerChange = useCallback(
    (corner: string, value: number) => {
      apply(corner, `${value}${radiusUnit}`);
      if (corner === "border-top-left-radius") setRadiusTL(value);
      else if (corner === "border-top-right-radius") setRadiusTR(value);
      else if (corner === "border-bottom-right-radius") setRadiusBR(value);
      else if (corner === "border-bottom-left-radius") setRadiusBL(value);
    },
    [apply, radiusUnit]
  );

  return (
    <Section title="Borders" indicator={sectionInd(["border-width", "border-style", "border-color", "border-radius", "outline"])} forceOpen={forceOpen} focusOpen={focusOpen} onToggle={onToggle}>
      <SideSelector value={borderSide} onChange={setBorderSide} />
      <SelectRow label="Style" value={borderStyle} options={BORDER_STYLE_OPTIONS} onChange={handleBorderStyleChange} indicator={ind(borderSide === "all" ? "border-style" : `border-${borderSide}-style`)} onContextMenu={ctxMenu(borderSide === "all" ? "border-style" : `border-${borderSide}-style`, borderStyle)} computedProp={borderSide === "all" ? "border-style" : `border-${borderSide}-style`} computedElement={element} />
      <SliderRow label="Width" value={borderWidth} min={0} max={20} step={1} unit={borderWidthUnit} units={BORDER_UNITS} onUnitChange={(u) => { const ctx = getConversionCtx(); const c = convertUnit(borderWidth, borderWidthUnit, u, ctx); fireBwHint(borderWidth, borderWidthUnit, c, u, ctx); setBorderWidth(c); setBorderWidthUnit(u); const prop = borderSide === "all" ? "border-width" : `border-${borderSide}-width`; apply(prop, `${c}${u}`); }} onChange={handleBorderWidthChange} onReset={() => resetCss(borderSide === "all" ? "border-width" : `border-${borderSide}-width`, setBorderWidth)} indicator={ind(borderSide === "all" ? "border-width" : `border-${borderSide}-width`)} conversionHint={bwHint} onContextMenu={ctxMenu(borderSide === "all" ? "border-width" : `border-${borderSide}-width`, `${borderWidth}${borderWidthUnit}`)} computedProp={borderSide === "all" ? "border-width" : `border-${borderSide}-width`} computedElement={element} />
      <ColorRow label="Color" value={borderColor} onChange={handleBorderColorChange} indicator={ind(borderSide === "all" ? "border-color" : `border-${borderSide}-color`)} onContextMenu={ctxMenu(borderSide === "all" ? "border-color" : `border-${borderSide}-color`, borderColor)} computedProp={borderSide === "all" ? "border-color" : `border-${borderSide}-color`} computedElement={element} />
      <div style={{ padding: "4px 12px 0", fontSize: "10px", color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
        Radius
      </div>
      <CornerRadiusEditor
        topLeft={radiusTL}
        topRight={radiusTR}
        bottomRight={radiusBR}
        bottomLeft={radiusBL}
        linked={radiusLinked}
        onChange={handleCornerChange}
        onLinkedChange={setRadiusLinked}
        unit={radiusUnit}
        units={BORDER_UNITS}
        onUnitChange={(u: string) => { setRadiusUnit(u); }}
      />
    </Section>
  );
});
