import React, { useState, useCallback, memo, useEffect } from "react";
import { Section, ValueInput, ColorRow } from "./controls";
import { SideSelector } from "./SideSelector";
import { CornerRadiusEditor } from "./CornerRadiusEditor";
import { IconButtonGroup } from "./IconButtonGroup";
import { UnitSelector } from "./UnitSelector";
import { Slider } from "@/components/ui/slider";
import { LabelScrub } from "./LabelScrub";
import { convertUnit } from "./unitConversion";
import { useConversionHint } from "./useConversionHint";
import { resetProp, resetAndReadNum, beginBatch, endBatch } from "./apply";
import { parseNum } from "./cssParsers";
import { detectUnit, type SectionCtx } from "./panelUtils";
import { cssColorToHex as rgbToHex } from "./colorUtils";
import { BORDER_STYLE_ICON_OPTIONS, BORDER_UNITS } from "./panelConstants";
import { ms } from "./timing";
import { text, color, surface } from "./theme";

// ─── Radius mode ──────────────────────────────────────────────────────

type RadiusMode = "individual" | "linked" | "single";

/** 3 mode toggle icons for the Radius row (individual / linked / single). */
function RadiusModeIcons({ mode, onChange }: { mode: RadiusMode; onChange: (m: RadiusMode) => void }) {
  const modes: Array<{ key: RadiusMode; title: string; icon: React.ReactNode }> = [
    {
      key: "individual",
      title: "Individual corners",
      icon: (
        <svg width="12" height="12" viewBox="0 0 12 12" style={{ display: "block" }}>
          <path d="M1 4V1h3" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          <path d="M8 1h3v3" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          <path d="M11 8v3H8" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          <path d="M4 11H1V8" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      ),
    },
    {
      key: "linked",
      title: "Linked corners",
      icon: (
        <svg width="12" height="12" viewBox="0 0 12 12" style={{ display: "block" }}>
          <rect x="1" y="1" width="10" height="10" rx="2.5" fill="none" stroke="currentColor" strokeWidth="1.2" strokeDasharray="3 1.5" />
        </svg>
      ),
    },
    {
      key: "single",
      title: "Single value",
      icon: (
        <svg width="12" height="12" viewBox="0 0 12 12" style={{ display: "block" }}>
          <rect x="1.5" y="1.5" width="9" height="9" rx="2" fill="currentColor" />
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

  // Derive initial radius mode from computed values
  const [radiusMode, setRadiusMode] = useState<RadiusMode>(() => {
    const tl = parseNum(cs.borderTopLeftRadius);
    const tr = parseNum(cs.borderTopRightRadius);
    const br = parseNum(cs.borderBottomRightRadius);
    const bl = parseNum(cs.borderBottomLeftRadius);
    return tl === tr && tr === br && br === bl ? "single" : "individual";
  });

  const { conversionHint: bwHint, fireConversionHint: fireBwHint } = useConversionHint();

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

  const resetCss = (prop: string, setter: (v: number) => void) => setter(resetAndReadNum(element, prop));

  // ── Helpers ──
  const borderProp = (suffix: string) =>
    borderSide === "all" ? `border-${suffix}` : `border-${borderSide}-${suffix}`;

  // ── Handlers ──
  const handleBorderStyleChange = useCallback((v: string) => {
    setBorderStyle(v);
    apply(borderProp("style"), v);
  }, [apply, borderSide]);

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
    <Section title="Borders" indicator={sectionInd(["border-width", "border-style", "border-color", "border-radius", "outline"])} forceOpen={forceOpen} focusOpen={focusOpen} onToggle={onToggle}>

      {/* ── Radius row (compact) ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "2px 12px" }}>
        <span style={{ width: 44, fontSize: 11, color: text.label, flexShrink: 0 }}>Radius</span>
        <RadiusModeIcons mode={radiusMode} onChange={setRadiusMode} />
        {radiusMode !== "individual" && (
          <>
            <Slider
              className="tuner-focusable flex-1"
              aria-label={`Radius: ${radiusTL}${radiusUnit}`}
              min={0}
              max={200}
              step={1}
              value={[radiusTL]}
              onValueChange={([v]) => handleRadiusAllChange(v)}
              onPointerDown={() => beginBatch()}
              onPointerUp={() => endBatch()}
            />
            <ValueInput value={radiusTL} onChange={handleRadiusAllChange} />
            <UnitSelector value={radiusUnit} options={BORDER_UNITS} onChange={(u: string) => setRadiusUnit(u)} />
          </>
        )}
      </div>

      {/* ── Expanded corner editor (individual mode) ── */}
      {radiusMode === "individual" && (
        <CornerRadiusEditor
          topLeft={radiusTL}
          topRight={radiusTR}
          bottomRight={radiusBR}
          bottomLeft={radiusBL}
          linked={false}
          onChange={handleCornerChange}
          onLinkedChange={() => {}}
          unit={radiusUnit}
          units={BORDER_UNITS}
          onUnitChange={(u: string) => setRadiusUnit(u)}
        />
      )}

      {/* ── "Borders" sub-label ── */}
      <div style={{ padding: "6px 12px 2px", fontSize: 10, color: text.label, textTransform: "uppercase" as const, letterSpacing: "0.05em" }}>
        Borders
      </div>

      {/* ── Side selector (compact) ── */}
      <SideSelector value={borderSide} onChange={setBorderSide} compact />

      {/* ── Style (icon toggle) ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "2px 12px" }} onContextMenu={ctxMenu(borderProp("style"), borderStyle)}>
        <span style={{ width: 44, fontSize: 11, color: text.label, flexShrink: 0 }}>Style</span>
        <IconButtonGroup
          options={BORDER_STYLE_ICON_OPTIONS}
          value={borderStyle}
          onChange={handleBorderStyleChange}
          aria-label="Border style"
        />
      </div>

      {/* ── Width (value input, no slider) ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "2px 12px" }} onContextMenu={ctxMenu(borderProp("width"), `${borderWidth}${borderWidthUnit}`)}>
        <LabelScrub value={borderWidth} onChange={handleBorderWidthChange} step={1} min={0} max={20} onAltClick={() => resetCss(borderProp("width"), setBorderWidth)}>
          <span style={{ width: 44, fontSize: 11, color: text.label, flexShrink: 0, cursor: "ew-resize" }}>Width</span>
        </LabelScrub>
        <ValueInput value={borderWidth} onChange={handleBorderWidthChange} onAltClick={() => resetCss(borderProp("width"), setBorderWidth)} />
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
        />
      </div>

      {/* ── Color ── */}
      <ColorRow label="Color" value={borderColor} onChange={handleBorderColorChange} onReset={() => { resetProp(element, borderProp("color")); setBorderColor(rgbToHex(getComputedStyle(element).getPropertyValue(borderProp("color")))); }} indicator={ind(borderProp("color"))} onContextMenu={ctxMenu(borderProp("color"), borderColor)} computedProp={borderProp("color")} computedElement={element} />
    </Section>
  );
});
