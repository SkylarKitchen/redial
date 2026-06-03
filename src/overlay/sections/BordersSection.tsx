import React, { useState, useCallback, memo, useEffect } from "react";
import { Section, ValueInput, ColorRow, useResetPopover } from "../controls";
import { SideSelector } from "../controls/SideSelector";
import { CornerRadiusEditor } from "./CornerRadiusEditor";
import { IconButtonGroup } from "../controls/IconButtonGroup";
import { UnitSelector } from "../controls/UnitSelector";
import { Slider } from "@/components/ui/slider";
import { LabelScrub } from "../controls/LabelScrub";
import { convertUnit } from "../unitConversion";
import { useConversionHint } from "../hooks/useConversionHint";
import { beginBatch, endBatch } from "../core/apply";
import { parseNum } from "../cssParsers";
import { detectUnit, type SectionCtx } from "../panelUtils";
import { cssColorToHex as rgbToHex } from "../colorUtils";
import { BORDER_STYLE_ICON_OPTIONS, BORDER_UNITS } from "../panelConstants";
import { ms } from "../timing";
import { text, color, surface, font, border, indicatorStyle, layout, type IndicatorType } from "../theme";
import { ROW, LABEL } from "../panelStyles";

// ─── Radius mode ──────────────────────────────────────────────────────

type RadiusMode = "individual" | "linked" | "single";

/** 2 mode toggle icons for the Radius row: single (rounded rect) / individual (4 corners). */
function RadiusModeIcons({ mode, onChange }: { mode: RadiusMode; onChange: (m: RadiusMode) => void }) {
  const modes: Array<{ key: RadiusMode; title: string; icon: React.ReactNode }> = [
    {
      key: "single",
      title: "Single value",
      icon: (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ display: "block" }}>
          <path d="M2.5 5.5C2.5 3.84315 3.84315 2.5 5.5 2.5H10.5C12.1569 2.5 13.5 3.84315 13.5 5.5V10.5C13.5 12.1569 12.1569 13.5 10.5 13.5H5.5C3.84315 13.5 2.5 12.1569 2.5 10.5V5.5Z" stroke="currentColor" fill="none" />
        </svg>
      ),
    },
    {
      key: "individual",
      title: "Individual corners",
      icon: (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ display: "block" }}>
          <path d="M4.5 2C3.11929 2 2 3.11929 2 4.5V7H3V4.5C3 3.67157 3.67157 3 4.5 3H7V2H4.5Z" fill="currentColor" />
          <path d="M9 2V3H11.5C12.3284 3 13 3.67157 13 4.5V7H14V4.5C14 3.11929 12.8807 2 11.5 2H9Z" fill="currentColor" />
          <path d="M14 9H13V11.5C13 12.3284 12.3284 13 11.5 13H9V14H11.5C12.8807 14 14 12.8807 14 11.5V9Z" fill="currentColor" />
          <path d="M7 14V13H4.5C3.67157 13 3 12.3284 3 11.5V9H2V11.5C2 12.8807 3.11929 14 4.5 14H7Z" fill="currentColor" />
        </svg>
      ),
    },
  ];

  return (
    <div style={{ display: "flex", gap: 1 }}>
      {modes.map((m) => (
        <button
          key={m.key}
          title={m.title}
          onClick={() => onChange(m.key)}
          style={{
            width: 18,
            height: 18,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: "none",
            borderRadius: 3,
            cursor: "pointer",
            background: mode === m.key ? surface.active : "transparent",
            color: mode === m.key ? color.primary : text.disabled,
            transition: `background ${ms("fast")}, color ${ms("fast")}`,
          }}
          onMouseEnter={(e) => {
            if (mode !== m.key) (e.currentTarget as HTMLElement).style.background = surface.hover;
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = mode === m.key ? surface.active : "transparent";
          }}
        >
          {m.icon}
        </button>
      ))}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────

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
  const { element, apply, ind, sectionInd, cs, getConversionCtx, ctxMenu, reset, resetRead } = ctx;

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

  // Derive initial radius mode from computed values
  const [radiusMode, setRadiusMode] = useState<RadiusMode>(() => {
    const tl = parseNum(cs.borderTopLeftRadius);
    const tr = parseNum(cs.borderTopRightRadius);
    const br = parseNum(cs.borderBottomRightRadius);
    const bl = parseNum(cs.borderBottomLeftRadius);
    return tl === tr && tr === br && br === bl ? "single" : "individual";
  });

  const { conversionHint: bwHint, fireConversionHint: fireBwHint } = useConversionHint();
  const { conversionHint: radiusHint, fireConversionHint: fireRadiusHint } = useConversionHint();

  /** Convert all 4 corner values when the radius unit changes and apply them. */
  const handleRadiusUnitChange = useCallback(
    (u: string) => {
      const convCtx = getConversionCtx();
      const cTL = convertUnit(radiusTL, radiusUnit, u, convCtx);
      const cTR = convertUnit(radiusTR, radiusUnit, u, convCtx);
      const cBR = convertUnit(radiusBR, radiusUnit, u, convCtx);
      const cBL = convertUnit(radiusBL, radiusUnit, u, convCtx);
      fireRadiusHint(radiusTL, radiusUnit, cTL, u, convCtx);
      setRadiusTL(cTL);
      setRadiusTR(cTR);
      setRadiusBR(cBR);
      setRadiusBL(cBL);
      setRadiusUnit(u);
      apply("border-top-left-radius", `${cTL}${u}`);
      apply("border-top-right-radius", `${cTR}${u}`);
      apply("border-bottom-right-radius", `${cBR}${u}`);
      apply("border-bottom-left-radius", `${cBL}${u}`);
    },
    [apply, getConversionCtx, radiusTL, radiusTR, radiusBR, radiusBL, radiusUnit, fireRadiusHint]
  );

  // ── Sync controls when side tab changes ──
  useEffect(() => {
    const fresh = getComputedStyle(element);
    if (borderSide === "all") {
      setBorderStyle(fresh.borderStyle.split(" ")[0] || "none");
      setBorderWidth(parseNum(fresh.borderWidth));
      setBorderColor(rgbToHex(fresh.borderColor));
    } else {
      const side = borderSide;
      setBorderStyle(fresh.getPropertyValue(`border-${side}-style`).trim() || "none");
      setBorderWidth(parseNum(fresh.getPropertyValue(`border-${side}-width`)));
      setBorderColor(rgbToHex(fresh.getPropertyValue(`border-${side}-color`)));
    }
  }, [borderSide, element]);

  const resetCss = (prop: string, setter: (v: number) => void) => setter(resetRead(prop));

  // ── Helpers ──
  const borderProp = (suffix: string) =>
    borderSide === "all" ? `border-${suffix}` : `border-${borderSide}-${suffix}`;

  // ── Indicators ──
  const radiusInd: IndicatorType = [
    ind("border-top-left-radius"),
    ind("border-top-right-radius"),
    ind("border-bottom-right-radius"),
    ind("border-bottom-left-radius"),
  ].includes("modified") ? "modified" : "none";

  const styleInd = ind(borderProp("style"));
  const widthInd = ind(borderProp("width"));

  // ── Radius reset (batch all 4 corners) ──
  const handleRadiusReset = useCallback(() => {
    beginBatch();
    setRadiusTL(resetRead("border-top-left-radius"));
    setRadiusTR(resetRead("border-top-right-radius"));
    setRadiusBR(resetRead("border-bottom-right-radius"));
    setRadiusBL(resetRead("border-bottom-left-radius"));
    endBatch();
  }, [element]);

  const handleStyleReset = useCallback(() => {
    reset(borderProp("style"));
    setBorderStyle(getComputedStyle(element).getPropertyValue(borderProp("style")).split(" ")[0] || "none");
  }, [element, borderSide, reset]);

  const handleWidthReset = useCallback(() => {
    resetCss(borderProp("width"), setBorderWidth);
  }, [element, borderSide]);

  // ── Corner reset (individual) ──
  const handleCornerReset = useCallback((corner: string) => {
    const v = resetRead(corner);
    if (corner === "border-top-left-radius") setRadiusTL(v);
    else if (corner === "border-top-right-radius") setRadiusTR(v);
    else if (corner === "border-bottom-right-radius") setRadiusBR(v);
    else if (corner === "border-bottom-left-radius") setRadiusBL(v);
  }, [element]);

  // ── Reset popovers ──
  const radiusPopover = useResetPopover(radiusInd, handleRadiusReset);
  const stylePopover = useResetPopover(styleInd, handleStyleReset);
  const widthPopover = useResetPopover(widthInd, handleWidthReset);

  // ── Handlers ──
  const handleBorderStyleChange = useCallback((v: string) => {
    setBorderStyle(v);
    apply(borderProp("style"), v);
    // A border style with width 0 renders nothing. When the user picks a
    // visible style (solid/dotted/dashed) and there's no width yet, give it a
    // 1px default so the border actually appears (Webflow parity). This is the
    // common case under Tailwind Preflight, where border-style defaults to
    // "solid" but border-width is 0.
    if (v !== "none" && borderWidth === 0) {
      setBorderWidth(1);
      apply(borderProp("width"), `1${borderWidthUnit}`);
    }
  }, [apply, borderSide, borderWidth, borderWidthUnit]);

  const handleBorderWidthChange = useCallback((v: number) => {
    setBorderWidth(v);
    apply(borderProp("width"), `${v}${borderWidthUnit}`);
  }, [apply, borderSide, borderWidthUnit]);

  const handleBorderColorChange = useCallback((v: string) => {
    setBorderColor(v);
    apply(borderProp("color"), v);
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

  /** In single/linked mode, update all 4 corners at once. */
  const handleRadiusAllChange = useCallback(
    (v: number) => {
      setRadiusTL(v);
      setRadiusTR(v);
      setRadiusBR(v);
      setRadiusBL(v);
      for (const prop of [
        "border-top-left-radius",
        "border-top-right-radius",
        "border-bottom-right-radius",
        "border-bottom-left-radius",
      ]) {
        apply(prop, `${v}${radiusUnit}`);
      }
    },
    [apply, radiusUnit]
  );

  return (
    <Section title="Borders" indicator={sectionInd(["border-width", "border-style", "border-color", "border-top-left-radius", "border-top-right-radius", "border-bottom-right-radius", "border-bottom-left-radius", "outline"])} forceOpen={forceOpen} focusOpen={focusOpen} onToggle={onToggle}>

      {/* ── Radius row (compact) ── */}
      <div style={ROW}>
        <span
          ref={radiusPopover.anchorRef}
          style={{ ...LABEL, cursor: radiusInd === "modified" ? "pointer" : "default" }}
          onClick={(e) => { if (e.altKey) { handleRadiusReset(); return; } radiusPopover.triggerOpen(); }}
        >
          <span style={indicatorStyle(radiusInd)}>Radius</span>
        </span>
        {radiusPopover.node}
        <RadiusModeIcons mode={radiusMode} onChange={setRadiusMode} />
        <Slider
          className="tuner-focusable"
          style={{ flex: 1 }}
          aria-label={`Radius: ${radiusTL}${radiusUnit}`}
          min={0}
          max={200}
          step={1}
          value={[radiusTL]}
          onValueChange={([v]) => handleRadiusAllChange(v)}
          onPointerDown={() => beginBatch()}
          onPointerUp={() => endBatch()}
        />
        <div style={{ display: "flex", alignItems: "center", height: 28, borderRadius: 4, border: `1px solid ${border.default}`, background: surface.subtle, flexShrink: 0, minWidth: 0 }}>
          <ValueInput value={radiusTL} onChange={handleRadiusAllChange} embedded />
          <div style={{ borderLeft: `1px solid ${border.default}`, alignSelf: "stretch", display: "flex", alignItems: "center", justifyContent: "center", width: 32, flexShrink: 0 }}>
            <UnitSelector value={radiusUnit} options={BORDER_UNITS} onChange={handleRadiusUnitChange} conversionHint={radiusHint} embedded />
          </div>
        </div>
      </div>

      {/* ── Expanded corner editor (individual mode) ── */}
      {radiusMode === "individual" && (
        <CornerRadiusEditor
          topLeft={radiusTL}
          topRight={radiusTR}
          bottomRight={radiusBR}
          bottomLeft={radiusBL}
          onChange={handleCornerChange}
          unit={radiusUnit}
          units={BORDER_UNITS}
          onUnitChange={handleRadiusUnitChange}
          indicators={{
            "border-top-left-radius": ind("border-top-left-radius"),
            "border-top-right-radius": ind("border-top-right-radius"),
            "border-bottom-right-radius": ind("border-bottom-right-radius"),
            "border-bottom-left-radius": ind("border-bottom-left-radius"),
          }}
          onCornerReset={handleCornerReset}
        />
      )}

      {/* ── "Borders" sub-label ── */}
      <div style={{ display: "flex", alignItems: "center", padding: "4px 8px", height: 32 }}>
        <span style={{ fontSize: 11, fontFamily: font.sans, color: text.secondary, fontWeight: 500, flexShrink: 0, paddingLeft: 4 }}>Borders</span>
      </div>

      {/* ── Two-column: cross side selector (left) + controls (right) ── */}
      {/* No right padding: the control column extends to the panel's right edge so
          the Style buttons (which size to their 4-button content width) align flush
          with the Width input and Color row below them. */}
      <div style={{ display: "flex", gap: 10, padding: "0 0 4px 12px" }}>

        {/* Left: cross-pattern side selector */}
        <SideSelector value={borderSide} onChange={setBorderSide} cross />

        {/* Right: Style / Width / Color controls */}
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>

          {/* ── Style (icon toggle) ── */}
          <div style={{ display: "flex", alignItems: "center", gap: 4, height: 32, padding: "4px 0" }} onContextMenu={ctxMenu(borderProp("style"), borderStyle)}>
            <span
              ref={stylePopover.anchorRef}
              style={{ width: layout.labelWidth, fontSize: 11, color: text.secondary, flexShrink: 0, paddingLeft: 1, cursor: styleInd === "modified" ? "pointer" : "default" }}
              onClick={(e) => { if (e.altKey) { handleStyleReset(); return; } stylePopover.triggerOpen(); }}
            >
              <span style={indicatorStyle(styleInd)}>Style</span>
            </span>
            {stylePopover.node}
            <IconButtonGroup
              options={BORDER_STYLE_ICON_OPTIONS}
              value={borderStyle}
              onChange={handleBorderStyleChange}
              allowDeselect={false}
              aria-label="Border style"
            />
          </div>

          {/* ── Width (value input + unit) ── */}
          <div style={{ display: "flex", alignItems: "center", gap: 4, height: 32, padding: "4px 0" }} onContextMenu={ctxMenu(borderProp("width"), `${borderWidth}${borderWidthUnit}`)}>
            <LabelScrub value={borderWidth} onChange={handleBorderWidthChange} step={1} min={0} max={20} onAltClick={() => resetCss(borderProp("width"), setBorderWidth)}>
              <span
                ref={widthPopover.anchorRef}
                style={{ width: layout.labelWidth, fontSize: 11, color: text.secondary, flexShrink: 0, cursor: "ew-resize", paddingLeft: 1 }}
              >
                <span style={indicatorStyle(widthInd)}>Width</span>
              </span>
            </LabelScrub>
            {widthPopover.node}
            <div style={{ display: "flex", alignItems: "center", height: 28, borderRadius: 4, border: `1px solid ${border.default}`, background: surface.subtle, flex: 1, minWidth: 0 }}>
              <ValueInput value={borderWidth} onChange={handleBorderWidthChange} onAltClick={() => resetCss(borderProp("width"), setBorderWidth)} embedded />
              <div style={{ borderLeft: `1px solid ${border.default}`, alignSelf: "stretch", display: "flex", alignItems: "center", justifyContent: "center", width: 32, flexShrink: 0 }}>
                <UnitSelector
                  value={borderWidthUnit}
                  options={BORDER_UNITS}
                  onChange={(u) => {
                    const ctx = getConversionCtx();
                    const c = convertUnit(borderWidth, borderWidthUnit, u, ctx);
                    fireBwHint(borderWidth, borderWidthUnit, c, u, ctx);
                    setBorderWidth(c);
                    setBorderWidthUnit(u);
                    apply(borderProp("width"), `${c}${u}`);
                  }}
                  conversionHint={bwHint}
                  embedded
                />
              </div>
            </div>
          </div>

          {/* ── Color ── */}
          <ColorRow label="Color" value={borderColor} onChange={handleBorderColorChange} onReset={() => { reset(borderProp("color")); setBorderColor(rgbToHex(getComputedStyle(element).getPropertyValue(borderProp("color")))); }} indicator={ind(borderProp("color"))} onContextMenu={ctxMenu(borderProp("color"), borderColor)} computedProp={borderProp("color")} computedElement={element} compact />
        </div>
      </div>
    </Section>
  );
});
