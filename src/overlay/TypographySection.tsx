/**
 * TypographySection.tsx — Extracted from WebflowPanel.tsx
 *
 * The largest section: font family, weight, size/height, color, alignment,
 * decoration, and the "More type options" advanced sub-section (letter-spacing,
 * text-indent, columns, column-gap, word-spacing, hyphens, italic, capitalize,
 * direction, breaking, wrap, truncate, stroke, text shadows).
 */

import React, { useState, useCallback, useEffect, useMemo, memo } from "react";
import { Section, SelectRow, ColorRow } from "./controls";
import { IconButtonGroup } from "./IconButtonGroup";
import { StyleIndicator } from "./StyleIndicator";
import { ShadowEditor, type ShadowValue } from "./ShadowEditor";
import { convertUnit } from "./unitConversion";
import { parseNum, shadowToCSS } from "./cssParsers";
import { cssColorToHex as rgbToHex } from "./colorUtils";
import { MiniDropdown, TypoValueCell } from "./layoutControls";
import { detectUnit, type SectionCtx } from "./panelUtils";
import { ChevronRight } from "lucide-react";
import { ms } from "./timing";
import {
  TEXT_ALIGN_OPTIONS, TEXT_DECORATION_OPTIONS, CAPITALIZE_OPTIONS,
  ITALIC_OPTIONS, DIRECTION_OPTIONS,
  FONT_WEIGHT_OPTIONS, WHITE_SPACE_OPTIONS, WORD_BREAK_OPTIONS,
  LINE_BREAK_OPTIONS, HYPHENS_OPTIONS,
  TYPO_SIZE_UNITS, LAYOUT_UNITS, LINE_HEIGHT_UNITS,
  FALLBACK_FONTS,
} from "./panelConstants";
import { parseBoxShadow } from "./cssParsers";

// ─── Props ────────────────────────────────────────────────────────────

export interface TypographySectionProps {
  ctx: SectionCtx;
  columnGap: number;
  columnGapUnit: string;
  onColumnGapChange: (v: number) => void;
  onColumnGapUnitChange: (u: string) => void;
}

// ─── Component ────────────────────────────────────────────────────────

export const TypographySection = memo(function TypographySection({
  ctx,
  columnGap,
  columnGapUnit,
  onColumnGapChange,
  onColumnGapUnitChange,
}: TypographySectionProps) {
  const { element, apply, ind, sectionInd, cs, getConversionCtx } = ctx;

  // ── Typography state ──
  const [fontSize, setFontSize] = useState(() => parseNum(cs.fontSize));
  const [fontWeight, setFontWeight] = useState(() => cs.fontWeight);
  const [lineHeight, setLineHeight] = useState(() => {
    const lh = parseNum(cs.lineHeight);
    const fs = parseNum(cs.fontSize);
    return fs > 0 ? Math.round((lh / fs) * 100) / 100 : 1.4;
  });
  const [letterSpacing, setLetterSpacing] = useState(() => parseNum(cs.letterSpacing));
  const [fontSizeUnit, setFontSizeUnit] = useState(() => detectUnit(element, "font-size"));
  const [letterSpacingUnit, setLetterSpacingUnit] = useState(() => detectUnit(element, "letter-spacing"));
  const [color, setColor] = useState(() => rgbToHex(cs.color));
  const [textAlign, setTextAlign] = useState(() => cs.textAlign);
  const [textDecoration, setTextDecoration] = useState(() => {
    const td = cs.textDecorationLine || cs.textDecoration;
    return td === "none" ? "none" : td;
  });
  const [textTransform, setTextTransform] = useState(() => cs.textTransform);
  const [fontStyle, setFontStyle] = useState(() => cs.fontStyle);
  const [fontFamily, setFontFamily] = useState(() => cs.fontFamily.replace(/['"]/g, ""));

  // Page font enumeration
  const [pageFonts, setPageFonts] = useState<string[]>([]);
  useEffect(() => {
    let alive = true;
    document.fonts.ready.then(() => {
      if (!alive) return;
      const seen = new Set<string>();
      const fonts: string[] = [];
      document.fonts.forEach(f => {
        const family = f.family.replace(/['"]/g, "");
        if (!seen.has(family)) { seen.add(family); fonts.push(family); }
      });
      setPageFonts(fonts);
    });
    return () => { alive = false; };
  }, []);
  const fontOptions = useMemo(
    () => [...new Set([...pageFonts, ...FALLBACK_FONTS])].map(f => ({ value: f, label: f })),
    [pageFonts],
  );

  const [lineHeightUnit, setLineHeightUnit] = useState(() => detectUnit(element, "line-height", "\u2014"));
  const [textIndentUnit, setTextIndentUnit] = useState(() => detectUnit(element, "text-indent"));
  const [showTypoAdvanced, setShowTypoAdvanced] = useState(false);
  const [whiteSpace, setWhiteSpace] = useState(() => cs.whiteSpace);
  const [textIndent, setTextIndent] = useState(() => parseNum(cs.textIndent));
  const [wordBreak, setWordBreak] = useState(() => cs.wordBreak);
  const [columnCount, setColumnCount] = useState(() => {
    const v = cs.columnCount;
    return v === "auto" ? 1 : parseNum(cs.columnCount);
  });
  const [direction, setDirection] = useState(() => cs.direction || "ltr");
  const [textShadows, setTextShadows] = useState<ShadowValue[]>(() => parseBoxShadow(cs.textShadow || "none"));
  const [textOverflow, setTextOverflow] = useState(() => cs.getPropertyValue("text-overflow") || "clip");
  const [textStrokeWidth, setTextStrokeWidth] = useState(() => parseNum(cs.getPropertyValue("-webkit-text-stroke-width") || "0"));
  const [textStrokeColor, setTextStrokeColor] = useState(() => rgbToHex(cs.getPropertyValue("-webkit-text-stroke-color") || cs.color));
  const [lineBreak, setLineBreak] = useState(() => cs.getPropertyValue("line-break") || "auto");
  const [wordSpacing, setWordSpacing] = useState(() => parseNum(cs.wordSpacing));
  const [hyphens, setHyphens] = useState(() => cs.getPropertyValue("hyphens") || "manual");

  // ── Handlers ──
  const handleFontSizeChange = useCallback((v: number) => { setFontSize(v); apply("font-size", `${v}${fontSizeUnit}`); }, [apply, fontSizeUnit]);
  const handleFontWeightChange = useCallback((v: string) => { setFontWeight(v); apply("font-weight", v); }, [apply]);
  const handleLineHeightChange = useCallback((v: number) => {
    setLineHeight(v);
    if (lineHeightUnit === "\u2014") apply("line-height", String(v));
    else if (lineHeightUnit === "%") apply("line-height", `${v}%`);
    else apply("line-height", `${v}${lineHeightUnit}`);
  }, [apply, lineHeightUnit]);
  const handleLetterSpacingChange = useCallback((v: number) => { setLetterSpacing(v); apply("letter-spacing", `${v}${letterSpacingUnit}`); }, [apply, letterSpacingUnit]);
  const handleColorChange = useCallback((v: string) => { setColor(v); apply("color", v); }, [apply]);
  const handleTextAlignChange = useCallback((v: string) => { setTextAlign(v); apply("text-align", v); }, [apply]);
  const handleTextDecorationChange = useCallback((v: string) => { setTextDecoration(v); apply("text-decoration-line", v); }, [apply]);
  const handleTextTransformChange = useCallback((v: string) => { setTextTransform(v); apply("text-transform", v); }, [apply]);
  const handleFontFamilyChange = useCallback((v: string) => { setFontFamily(v); apply("font-family", v); }, [apply]);

  const handleWhiteSpaceChange = useCallback((v: string) => { setWhiteSpace(v); apply("white-space", v); }, [apply]);
  const handleTextIndentChange = useCallback((v: number) => { setTextIndent(v); apply("text-indent", `${v}${textIndentUnit}`); }, [apply, textIndentUnit]);
  const handleWordBreakChange = useCallback((v: string) => { setWordBreak(v); apply("word-break", v); }, [apply]);
  const handleColumnCountChange = useCallback((v: number) => { setColumnCount(v); apply("column-count", String(v)); }, [apply]);
  const handleDirectionChange = useCallback((v: string) => { setDirection(v); apply("direction", v); }, [apply]);
  const handleTextShadowsChange = useCallback((newShadows: ShadowValue[]) => {
    setTextShadows(newShadows);
    apply("text-shadow", shadowToCSS(newShadows));
  }, [apply]);
  const handleTextOverflowChange = useCallback((v: string) => { setTextOverflow(v); apply("text-overflow", v); }, [apply]);
  const handleTextStrokeWidthChange = useCallback((v: number) => { setTextStrokeWidth(v); apply("-webkit-text-stroke-width", `${v}px`); }, [apply]);
  const handleTextStrokeColorChange = useCallback((v: string) => { setTextStrokeColor(v); apply("-webkit-text-stroke-color", v); }, [apply]);
  const handleLineBreakChange = useCallback((v: string) => { setLineBreak(v); apply("line-break", v); }, [apply]);
  const handleWordSpacingChange = useCallback((v: number) => { setWordSpacing(v); apply("word-spacing", `${v}px`); }, [apply]);
  const handleHyphensChange = useCallback((v: string) => { setHyphens(v); apply("hyphens", v); }, [apply]);

  // IconButtonGroup-compatible handlers (map "none" -> valid defaults)
  const handleFontStyleIconChange = useCallback((v: string) => {
    const val = v === "none" ? "normal" : v;
    setFontStyle(val);
    apply("font-style", val);
  }, [apply]);
  const handleDirectionIconChange = useCallback((v: string) => {
    const val = v === "none" ? "ltr" : v;
    setDirection(val);
    apply("direction", val);
  }, [apply]);

  // Suppress unused-variable warnings for handlers that are referenced
  // only implicitly via the JSX below
  void handleDirectionChange;

  return (
    <Section
      title="Typography"
      indicator={sectionInd([
        "font-family", "font-weight", "font-size", "line-height",
        "letter-spacing", "color", "text-align", "text-decoration", "text-transform",
      ])}
    >
      {/* Font family dropdown */}
      <SelectRow label="Font" value={fontFamily} options={fontOptions} onChange={handleFontFamilyChange} indicator={ind("font-family")} searchable fontPreview />

      {/* Weight dropdown */}
      <SelectRow label="Weight" value={fontWeight} options={FONT_WEIGHT_OPTIONS} onChange={handleFontWeightChange} indicator={ind("font-weight")} />

      {/* Size + Height side-by-side compact cells */}
      <div style={{ display: "flex", alignItems: "center", gap: "4px", padding: "2px 12px" }}>
        <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.5)", flexShrink: 0, display: "inline-flex", alignItems: "center", gap: "3px" }}>
          {ind("font-size") !== "none" && <StyleIndicator type={ind("font-size")} />}
          Size
        </span>
        <TypoValueCell
          value={fontSize}
          onChange={handleFontSizeChange}
          unit={fontSizeUnit}
          units={TYPO_SIZE_UNITS}
          onUnitChange={(u) => { const c = convertUnit(fontSize, fontSizeUnit, u, getConversionCtx()); setFontSize(c); setFontSizeUnit(u); apply("font-size", `${c}${u}`); }}
          step={1}
        />
        <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.5)", flexShrink: 0, display: "inline-flex", alignItems: "center", gap: "3px" }}>
          {ind("line-height") !== "none" && <StyleIndicator type={ind("line-height")} />}
          Height
        </span>
        <TypoValueCell
          value={lineHeight}
          onChange={handleLineHeightChange}
          unit={lineHeightUnit === "\u2014" ? "\u2013" : lineHeightUnit}
          units={LINE_HEIGHT_UNITS}
          onUnitChange={(u) => { if (lineHeightUnit !== "\u2014" && u !== "\u2014") { const c = convertUnit(lineHeight, lineHeightUnit, u, getConversionCtx()); setLineHeight(c); } setLineHeightUnit(u); }}
          step={lineHeightUnit === "%" ? 5 : lineHeightUnit === "px" ? 1 : 0.05}
        />
      </div>

      {/* Color */}
      <ColorRow label="Color" value={color} onChange={handleColorChange} indicator={ind("color")} />

      {/* Align */}
      <div style={{ padding: "4px 12px", display: "flex", alignItems: "center", gap: "6px" }}>
        <span style={{ width: "64px", fontSize: "11px", color: "rgba(255,255,255,0.5)", flexShrink: 0 }}>Align</span>
        <IconButtonGroup options={TEXT_ALIGN_OPTIONS} value={textAlign} onChange={handleTextAlignChange} />
      </div>

      {/* Decor — with none X button + ... overflow */}
      <div style={{ padding: "4px 12px", display: "flex", alignItems: "center", gap: "6px" }}>
        <span style={{ width: "64px", fontSize: "11px", color: "rgba(255,255,255,0.5)", flexShrink: 0 }}>Decor</span>
        <IconButtonGroup options={TEXT_DECORATION_OPTIONS} value={textDecoration} onChange={handleTextDecorationChange} multi />
      </div>

      {/* More type options toggle */}
      <div style={{ padding: "4px 12px" }}>
        <button
          onClick={() => setShowTypoAdvanced(!showTypoAdvanced)}
          style={{
            width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
            padding: "6px 0", cursor: "pointer",
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)", borderRadius: "4px",
            color: "rgba(255,255,255,0.45)", fontSize: "11px",
            fontFamily: "system-ui, sans-serif", outline: "none",
            transition: `background ${ms("fast")}`,
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.08)"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)"; }}
        >
          <ChevronRight size={10} strokeWidth={2} style={{ transition: `transform ${ms("expand")}`, transform: showTypoAdvanced ? "rotate(90deg)" : "rotate(0deg)" }} />
          More type options
        </button>
      </div>

      {showTypoAdvanced && (
        <>
          {/* Letter spacing + Text indent — compact row */}
          <div style={{ display: "flex", gap: "4px", padding: "4px 12px" }}>
            <div style={{ flex: 1 }}>
              <TypoValueCell
                value={letterSpacing}
                onChange={handleLetterSpacingChange}
                unit={letterSpacingUnit}
                units={TYPO_SIZE_UNITS}
                onUnitChange={(u) => { const c = convertUnit(letterSpacing, letterSpacingUnit, u, getConversionCtx()); setLetterSpacing(c); setLetterSpacingUnit(u); apply("letter-spacing", `${c}${u}`); }}
                step={0.25}
                keyword={letterSpacing === 0 ? "Normal" : null}
              />
              <div style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", textAlign: "center", marginTop: "3px" }}>Letter spacing</div>
            </div>
            <div style={{ flex: 1 }}>
              <TypoValueCell
                value={textIndent}
                onChange={handleTextIndentChange}
                unit={textIndentUnit}
                units={LAYOUT_UNITS}
                onUnitChange={(u) => { const c = convertUnit(textIndent, textIndentUnit, u, getConversionCtx()); setTextIndent(c); setTextIndentUnit(u); apply("text-indent", `${c}${u}`); }}
                step={1}
              />
              <div style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", textAlign: "center", marginTop: "3px" }}>Text indent</div>
            </div>
          </div>

          {/* Columns + Column gap — compact row (column-gap only shown when multi-column is active to avoid duplicate with Layout section) */}
          <div style={{ display: "flex", gap: "4px", padding: "4px 12px" }}>
            <div style={{ flex: 1 }}>
              <TypoValueCell
                value={columnCount}
                onChange={handleColumnCountChange}
                unit=""
                step={1}
                keyword={columnCount <= 1 ? "Auto" : null}
              />
              <div style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", textAlign: "center", marginTop: "3px" }}>Columns</div>
            </div>
            {columnCount > 1 && (
              <div style={{ flex: 1 }}>
                <TypoValueCell
                  value={columnGap}
                  onChange={onColumnGapChange}
                  unit={columnGapUnit}
                  units={LAYOUT_UNITS}
                  onUnitChange={(u) => { const c = convertUnit(columnGap, columnGapUnit, u, getConversionCtx()); onColumnGapChange(c); onColumnGapUnitChange(u); apply("column-gap", `${c}${u}`); }}
                  step={1}
                  keyword={columnGap === 0 ? "Normal" : null}
                />
                <div style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", textAlign: "center", marginTop: "3px" }}>Column gap</div>
              </div>
            )}
          </div>

          {/* Word spacing + Hyphens — compact row */}
          <div style={{ display: "flex", alignItems: "flex-start", gap: "4px", padding: "4px 12px" }}>
            <div style={{ flex: 1 }}>
              <TypoValueCell
                value={wordSpacing}
                onChange={handleWordSpacingChange}
                unit="px"
                step={0.5}
                keyword={wordSpacing === 0 ? "Normal" : null}
              />
              <div style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", textAlign: "center", marginTop: "3px" }}>Word spacing</div>
            </div>
            <div style={{ flex: 1 }}>
              <MiniDropdown value={hyphens} options={HYPHENS_OPTIONS} onChange={handleHyphensChange} />
              <div style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", textAlign: "center", marginTop: "3px" }}>Hyphens</div>
            </div>
          </div>

          {/* Italicize + Capitalize + Direction — toggle groups with labels below */}
          <div style={{ display: "flex", gap: "6px", padding: "6px 12px", alignItems: "flex-start" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "3px" }}>
              <IconButtonGroup options={ITALIC_OPTIONS} value={fontStyle} onChange={handleFontStyleIconChange} />
              <span style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)" }}>Italicize</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "3px", flex: 1 }}>
              <IconButtonGroup options={CAPITALIZE_OPTIONS} value={textTransform} onChange={handleTextTransformChange} />
              <span style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)" }}>Capitalize</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "3px" }}>
              <IconButtonGroup options={DIRECTION_OPTIONS} value={direction} onChange={handleDirectionIconChange} />
              <span style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)" }}>Direction</span>
            </div>
          </div>

          {/* Breaking — Word + Line side by side */}
          <div style={{ display: "flex", alignItems: "flex-start", gap: "4px", padding: "4px 12px" }}>
            <span style={{ width: "64px", fontSize: "11px", color: "rgba(255,255,255,0.5)", flexShrink: 0, paddingTop: "3px" }}>Breaking</span>
            <div style={{ flex: 1 }}>
              <MiniDropdown value={wordBreak} options={WORD_BREAK_OPTIONS} onChange={handleWordBreakChange} />
              <div style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", textAlign: "center", marginTop: "3px" }}>Word</div>
            </div>
            <div style={{ flex: 1 }}>
              <MiniDropdown value={lineBreak} options={LINE_BREAK_OPTIONS} onChange={handleLineBreakChange} />
              <div style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", textAlign: "center", marginTop: "3px" }}>Line</div>
            </div>
          </div>

          {/* Wrap */}
          <SelectRow label="Wrap" value={whiteSpace} options={WHITE_SPACE_OPTIONS} onChange={handleWhiteSpaceChange} />

          {/* Truncate — Clip / Ellipsis segmented toggle */}
          <div style={{ display: "flex", alignItems: "center", gap: "6px", padding: "4px 12px" }}>
            <span style={{ width: "64px", fontSize: "11px", color: "rgba(255,255,255,0.5)", flexShrink: 0 }}>Truncate</span>
            <div style={{ display: "flex", flex: 1, borderRadius: "4px", overflow: "hidden", border: "1px solid rgba(255,255,255,0.15)" }}>
              {(["clip", "ellipsis"] as const).map((opt) => (
                <button
                  key={opt}
                  onClick={() => handleTextOverflowChange(opt)}
                  style={{
                    flex: 1, height: "28px", cursor: "pointer",
                    background: textOverflow === opt ? "rgba(255,255,255,0.12)" : "transparent",
                    color: textOverflow === opt ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.4)",
                    border: "none", borderRight: opt === "clip" ? "1px solid rgba(255,255,255,0.15)" : "none",
                    fontSize: "11px", fontFamily: "system-ui, sans-serif",
                    fontWeight: textOverflow === opt ? 500 : 400,
                    outline: "none", transition: `background ${ms("fast")}, color ${ms("fast")}`,
                    textTransform: "capitalize",
                  }}
                >
                  {opt === "clip" ? "Clip" : "Ellipsis"}
                </button>
              ))}
            </div>
          </div>

          {/* Stroke — width + color side by side */}
          <div style={{ display: "flex", alignItems: "flex-start", gap: "4px", padding: "4px 12px" }}>
            <span style={{ width: "64px", fontSize: "11px", color: "rgba(255,255,255,0.5)", flexShrink: 0, paddingTop: "3px" }}>Stroke</span>
            <div style={{ flex: 1 }}>
              <TypoValueCell
                value={textStrokeWidth}
                onChange={handleTextStrokeWidthChange}
                unit="px"
                step={1}
              />
              <div style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", textAlign: "center", marginTop: "3px" }}>Width</div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", height: "28px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "4px", overflow: "hidden", padding: "0 6px", gap: "6px", position: "relative" }}>
                <label style={{ width: "16px", height: "16px", borderRadius: "2px", background: textStrokeColor, border: "1px solid rgba(255,255,255,0.2)", flexShrink: 0, cursor: "pointer", display: "block" }}>
                  <input
                    type="color"
                    value={textStrokeColor}
                    onChange={(e) => handleTextStrokeColorChange(e.target.value)}
                    style={{ position: "absolute", width: 0, height: 0, opacity: 0, overflow: "hidden" }}
                  />
                </label>
                <span style={{ fontSize: "11px", fontFamily: "ui-monospace, 'SF Mono', monospace", color: "rgba(255,255,255,0.6)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {textStrokeColor}
                </span>
              </div>
              <div style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", textAlign: "center", marginTop: "3px" }}>Color</div>
            </div>
          </div>

          {/* Text shadows */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px 2px" }}>
            <span style={{ fontSize: "11px", fontWeight: 500, color: "rgba(255,255,255,0.85)" }}>Text shadows</span>
            <button
              onClick={() => handleTextShadowsChange([...textShadows, { x: 0, y: 2, blur: 4, spread: 0, color: "rgba(0,0,0,0.25)", inset: false }])}
              style={{
                display: "flex", alignItems: "center", justifyContent: "center",
                width: "22px", height: "22px", cursor: "pointer",
                background: "transparent", border: "1px solid rgba(255,255,255,0.15)",
                borderRadius: "3px", color: "rgba(255,255,255,0.5)", fontSize: "14px",
                lineHeight: 1, outline: "none", transition: `background ${ms("fast")}`,
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.08)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
            >
              +
            </button>
          </div>
          {textShadows.length > 0 && <ShadowEditor shadows={textShadows} onChange={handleTextShadowsChange} />}
        </>
      )}
    </Section>
  );
});
