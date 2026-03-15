/**
 * TypographySection.tsx — Extracted from WebflowPanel.tsx
 *
 * The largest section: font family, weight, size/height, color, alignment,
 * decoration, and the "More type options" advanced sub-section (letter-spacing,
 * text-indent, columns, column-gap, word-spacing, hyphens, italic, capitalize,
 * direction, breaking, wrap, truncate, stroke, text shadows).
 */

import React, { useState, useCallback, useEffect, useMemo, memo } from "react";
import { Section, SelectRow, ColorRow, useResetPopover, SubSectionHeader } from "../controls";
import { IconButtonGroup } from "../controls/IconButtonGroup";
import { ShadowEditor, type ShadowValue } from "./ShadowEditor";
import { convertUnit } from "../unitConversion";
import { useConversionHint } from "../hooks/useConversionHint";
import { parseNum, shadowToCSS } from "../cssParsers";
import { cssColorToHex as rgbToHex } from "../colorUtils";
import { MiniDropdown, TypoValueCell } from "./layoutControls";
import { detectUnit, type SectionCtx } from "../panelUtils";
import { ChevronRight } from "lucide-react";
import { scanTextStyles, matchTextStyle, type TextStyle } from "../textStyleScanner";
import { TextStyleRow } from "./TextStyleRow";
import { beginBatch, endBatch, resetProp, resetAndReadStr } from "../core/apply";
import { ROW, LABEL, LABEL_INLINE, HINT, EXPAND_BUTTON, SEGMENT_GROUP, segmentButton, INLINE_SWATCH } from "../panelStyles";
import { text, border, surface, font, indicatorStyle, layout } from "../theme";
import { ms } from "../timing";
import {
  TEXT_ALIGN_OPTIONS, TEXT_DECORATION_OPTIONS, CAPITALIZE_OPTIONS,
  ITALIC_OPTIONS, DIRECTION_OPTIONS,
  FONT_WEIGHT_OPTIONS, WHITE_SPACE_OPTIONS, WORD_BREAK_OPTIONS,
  LINE_BREAK_OPTIONS, HYPHENS_OPTIONS,
  TYPO_SIZE_UNITS, LAYOUT_UNITS, LINE_HEIGHT_UNITS,
  FALLBACK_FONTS,
} from "../panelConstants";
import { parseBoxShadow } from "../cssParsers";

// ─── Props ────────────────────────────────────────────────────────────

export interface TypographySectionProps {
  ctx: SectionCtx;
  columnGap: number;
  columnGapUnit: string;
  onColumnGapChange: (v: number) => void;
  onColumnGapUnitChange: (u: string) => void;
  forceOpen?: boolean;
  focusOpen?: boolean;
  onToggle?: (title: string) => void;
}

// ─── Component ────────────────────────────────────────────────────────

export const TypographySection = memo(function TypographySection({
  ctx,
  columnGap,
  columnGapUnit,
  onColumnGapChange,
  onColumnGapUnitChange,
  forceOpen,
  focusOpen,
  onToggle,
}: TypographySectionProps) {
  const { element, apply, ind, sectionInd, cs, getConversionCtx, ctxMenu } = ctx;

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

  // Conversion hints
  const { conversionHint: fontSizeHint, fireConversionHint: fireFontSizeHint } = useConversionHint();
  const { conversionHint: lineHeightHint, fireConversionHint: fireLineHeightHint } = useConversionHint();
  const { conversionHint: letterSpacingHint, fireConversionHint: fireLetterSpacingHint } = useConversionHint();
  const { conversionHint: textIndentHint, fireConversionHint: fireTextIndentHint } = useConversionHint();
  const { conversionHint: typoColGapHint, fireConversionHint: fireTypoColGapHint } = useConversionHint();

  // ── Reset popovers for custom labels ──
  const fontSizeResetPopover = useResetPopover(ind("font-size"), () => { const v = resetAndReadStr(element, "font-size"); setFontSize(parseNum(v)); setFontSizeUnit(detectUnit(element, "font-size")); });
  const lineHeightResetPopover = useResetPopover(ind("line-height"), () => { const v = resetAndReadStr(element, "line-height"); setLineHeight(parseNum(v)); setLineHeightUnit(detectUnit(element, "line-height", "\u2014")); });

  // ── Text style scanning ──
  const textStyles = useMemo(() => scanTextStyles(), []);
  const matchedTextStyle = useMemo(
    () => matchTextStyle(element, cs, textStyles),
    [element, cs, textStyles],
  );

  const handleTextStyleApply = useCallback((style: TextStyle) => {
    beginBatch();
    apply("font-family", style.fontFamily);
    apply("font-weight", style.fontWeight);
    apply("font-size", style.fontSize);
    apply("line-height", style.lineHeight);
    apply("letter-spacing", style.letterSpacing);
    apply("color", style.color);
    apply("text-transform", style.textTransform);
    endBatch();

    // Sync local state to match the applied style
    setFontFamily(style.fontFamily.replace(/['"]/g, ""));
    setFontWeight(style.fontWeight);
    setFontSize(parseNum(style.fontSize));
    const lhPx = parseNum(style.lineHeight);
    const fsPx = parseNum(style.fontSize);
    setLineHeight(fsPx > 0 ? Math.round((lhPx / fsPx) * 100) / 100 : 1.4);
    setLetterSpacing(parseNum(style.letterSpacing));
    setColor(rgbToHex(style.color));
    setTextTransform(style.textTransform);
  }, [apply]);

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

  const resetCssStr = (prop: string, setter: (v: string) => void) => setter(resetAndReadStr(element, prop));

  return (
    <Section
      title="Typography"
      indicator={sectionInd([
        "font-family", "font-weight", "font-size", "line-height",
        "letter-spacing", "color", "text-align", "text-decoration", "text-transform",
      ])}
      forceOpen={forceOpen}
      focusOpen={focusOpen}
      onToggle={onToggle}
    >
      {/* Text style picker */}
      <TextStyleRow styles={textStyles} matchedStyle={matchedTextStyle} onApply={handleTextStyleApply} />

      {/* Font family dropdown */}
      <SelectRow label="Font" value={fontFamily} options={fontOptions} onChange={handleFontFamilyChange} indicator={ind("font-family")} searchable fontPreview onContextMenu={ctxMenu("font-family", fontFamily)} computedProp="font-family" computedElement={element} onReset={() => resetCssStr("font-family", (v) => setFontFamily(v.replace(/['"]/g, "")))} />

      {/* Weight dropdown */}
      <SelectRow label="Weight" value={fontWeight} options={FONT_WEIGHT_OPTIONS} onChange={handleFontWeightChange} indicator={ind("font-weight")} weightPreview onContextMenu={ctxMenu("font-weight", fontWeight)} computedProp="font-weight" computedElement={element} onReset={() => resetCssStr("font-weight", setFontWeight)} />

      {/* Size + Height side-by-side compact cells */}
      <div style={{ ...ROW, gap: layout.compactGap }}>
        <span
          ref={fontSizeResetPopover.anchorRef}
          style={{ ...LABEL, display: "inline-flex", alignItems: "center", gap: 3, cursor: ind("font-size") === "modified" ? "pointer" : "default" }}
          onClick={(e) => { if (e.altKey) { const v = resetAndReadStr(element, "font-size"); setFontSize(parseNum(v)); setFontSizeUnit(detectUnit(element, "font-size")); return; } fontSizeResetPopover.triggerOpen(); }}
        >
          <span style={indicatorStyle(ind("font-size"))}>Size</span>
        </span>
        {fontSizeResetPopover.node}
        <TypoValueCell
          value={fontSize}
          onChange={handleFontSizeChange}
          unit={fontSizeUnit}
          units={TYPO_SIZE_UNITS}
          onUnitChange={(u) => { const ctx = getConversionCtx(); const c = convertUnit(fontSize, fontSizeUnit, u, ctx); fireFontSizeHint(fontSize, fontSizeUnit, c, u, ctx); setFontSize(c); setFontSizeUnit(u); apply("font-size", `${c}${u}`); }}
          step={ctx.isTailwind && fontSizeUnit === "px" ? 4 : 1}
          conversionHint={fontSizeHint}
        />
        <span
          ref={lineHeightResetPopover.anchorRef}
          style={{ ...LABEL_INLINE, display: "inline-flex", alignItems: "center", gap: 3, cursor: ind("line-height") === "modified" ? "pointer" : "default" }}
          onClick={(e) => { if (e.altKey) { const v = resetAndReadStr(element, "line-height"); setLineHeight(parseNum(v)); setLineHeightUnit(detectUnit(element, "line-height")); return; } lineHeightResetPopover.triggerOpen(); }}
        >
          <span style={indicatorStyle(ind("line-height"))}>Height</span>
        </span>
        {lineHeightResetPopover.node}
        <TypoValueCell
          value={lineHeight}
          onChange={handleLineHeightChange}
          unit={lineHeightUnit === "\u2014" ? "\u2013" : lineHeightUnit}
          units={LINE_HEIGHT_UNITS}
          onUnitChange={(u) => { if (lineHeightUnit !== "\u2014" && u !== "\u2014") { const ctx = getConversionCtx(); const c = convertUnit(lineHeight, lineHeightUnit, u, ctx); fireLineHeightHint(lineHeight, lineHeightUnit, c, u, ctx); setLineHeight(c); } setLineHeightUnit(u); }}
          step={lineHeightUnit === "%" ? 5 : lineHeightUnit === "px" ? (ctx.isTailwind ? 4 : 1) : 0.05}
          conversionHint={lineHeightHint}
        />
      </div>

      {/* Color */}
      <ColorRow label="Color" value={color} onChange={handleColorChange} indicator={ind("color")} onContextMenu={ctxMenu("color", color)} computedProp="color" computedElement={element} onReset={() => { resetProp(element, "color"); setColor(rgbToHex(getComputedStyle(element).color)); }} />

      {/* Align */}
      <div style={ROW}>
        <span style={LABEL}>Align</span>
        <IconButtonGroup options={TEXT_ALIGN_OPTIONS} value={textAlign} onChange={handleTextAlignChange} />
      </div>

      {/* Style — Italicize + Decoration side by side with sub-labels */}
      <div style={{ ...ROW, alignItems: "flex-start" }}>
        <span style={{ ...LABEL, paddingTop: 3 }}>Style</span>
        <div style={{ display: "flex", flexDirection: "column", flex: 1, gap: 3 }}>
          <IconButtonGroup options={ITALIC_OPTIONS} value={fontStyle} onChange={handleFontStyleIconChange} />
          <span style={HINT}>Italicize</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", flex: 1, gap: 3 }}>
          <IconButtonGroup options={TEXT_DECORATION_OPTIONS} value={textDecoration} onChange={handleTextDecorationChange} multi />
          <span style={HINT}>Decoration</span>
        </div>
      </div>

      {/* More type options toggle */}
      <div style={{ padding: "4px 12px" }}>
        <button
          onClick={() => setShowTypoAdvanced(!showTypoAdvanced)}
          style={EXPAND_BUTTON}
          onMouseEnter={(e) => { e.currentTarget.style.background = surface.hover; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = surface.subtle; }}
        >
          <ChevronRight size={10} strokeWidth={2} style={{ transition: `transform ${ms("fast")} ease`, transform: showTypoAdvanced ? "rotate(90deg)" : "rotate(0deg)" }} />
          More type options
        </button>
      </div>

      {showTypoAdvanced && (
        <>
          {/* Letter spacing + Text indent — compact row */}
          <div style={{ ...ROW, gap: layout.compactGap }}>
            <div className="flex-1">
              <TypoValueCell
                value={letterSpacing}
                onChange={handleLetterSpacingChange}
                unit={letterSpacingUnit}
                units={TYPO_SIZE_UNITS}
                onUnitChange={(u) => { const ctx = getConversionCtx(); const c = convertUnit(letterSpacing, letterSpacingUnit, u, ctx); fireLetterSpacingHint(letterSpacing, letterSpacingUnit, c, u, ctx); setLetterSpacing(c); setLetterSpacingUnit(u); apply("letter-spacing", `${c}${u}`); }}
                step={0.25}
                keyword={letterSpacing === 0 ? "Normal" : null}
                conversionHint={letterSpacingHint}
              />
              <div style={HINT}>Letter spacing</div>
            </div>
            <div className="flex-1">
              <TypoValueCell
                value={textIndent}
                onChange={handleTextIndentChange}
                unit={textIndentUnit}
                units={LAYOUT_UNITS}
                onUnitChange={(u) => { const ctx = getConversionCtx(); const c = convertUnit(textIndent, textIndentUnit, u, ctx); fireTextIndentHint(textIndent, textIndentUnit, c, u, ctx); setTextIndent(c); setTextIndentUnit(u); apply("text-indent", `${c}${u}`); }}
                step={1}
                conversionHint={textIndentHint}
              />
              <div style={HINT}>Text indent</div>
            </div>
          </div>

          {/* Columns + Column gap — compact row */}
          <div style={{ ...ROW, gap: layout.compactGap }}>
            <div className="flex-1">
              <TypoValueCell
                value={columnCount}
                onChange={handleColumnCountChange}
                unit=""
                step={1}
                keyword={columnCount <= 1 ? "Auto" : null}
              />
              <div style={HINT}>Columns</div>
            </div>
            {columnCount > 1 && (
              <div className="flex-1">
                <TypoValueCell
                  value={columnGap}
                  onChange={(v) => { onColumnGapChange(v); apply("column-gap", `${v}${columnGapUnit}`); }}
                  unit={columnGapUnit}
                  units={LAYOUT_UNITS}
                  onUnitChange={(u) => { const ctx = getConversionCtx(); const c = convertUnit(columnGap, columnGapUnit, u, ctx); fireTypoColGapHint(columnGap, columnGapUnit, c, u, ctx); onColumnGapChange(c); onColumnGapUnitChange(u); apply("column-gap", `${c}${u}`); }}
                  step={1}
                  keyword={columnGap === 0 ? "Normal" : null}
                  conversionHint={typoColGapHint}
                />
                <div style={HINT}>Column gap</div>
              </div>
            )}
          </div>

          {/* Word spacing + Hyphens — compact row */}
          <div style={{ ...ROW, alignItems: "flex-start", gap: layout.compactGap }}>
            <div className="flex-1">
              <TypoValueCell
                value={wordSpacing}
                onChange={handleWordSpacingChange}
                unit="px"
                step={0.5}
                keyword={wordSpacing === 0 ? "Normal" : null}
              />
              <div style={HINT}>Word spacing</div>
            </div>
            <div className="flex-1">
              <MiniDropdown value={hyphens} options={HYPHENS_OPTIONS} onChange={handleHyphensChange} />
              <div style={HINT}>Hyphens</div>
            </div>
          </div>

          {/* Capitalize + Direction — toggle groups with labels below */}
          <div style={{ ...ROW, alignItems: "flex-start" }}>
            <div className="flex flex-col items-center flex-1" style={{ gap: 3 }}>
              <IconButtonGroup options={CAPITALIZE_OPTIONS} value={textTransform} onChange={handleTextTransformChange} />
              <span style={HINT}>Case</span>
            </div>
            <div className="flex flex-col items-center" style={{ gap: 3 }}>
              <IconButtonGroup options={DIRECTION_OPTIONS} value={direction} onChange={handleDirectionIconChange} />
              <span style={HINT}>Direction</span>
            </div>
          </div>

          {/* Breaking — Word + Line side by side */}
          <div style={{ ...ROW, alignItems: "flex-start", gap: layout.compactGap }}>
            <span style={{ ...LABEL, paddingTop: 3 }}>Breaking</span>
            <div className="flex-1">
              <MiniDropdown value={wordBreak} options={WORD_BREAK_OPTIONS} onChange={handleWordBreakChange} />
              <div style={HINT}>Word</div>
            </div>
            <div className="flex-1">
              <MiniDropdown value={lineBreak} options={LINE_BREAK_OPTIONS} onChange={handleLineBreakChange} />
              <div style={HINT}>Line</div>
            </div>
          </div>

          {/* Wrap */}
          <SelectRow label="Wrap" value={whiteSpace} options={WHITE_SPACE_OPTIONS} onChange={handleWhiteSpaceChange} onContextMenu={ctxMenu("white-space", whiteSpace)} computedProp="white-space" computedElement={element} onReset={() => resetCssStr("white-space", setWhiteSpace)} />

          {/* Truncate — Clip / Ellipsis segmented toggle */}
          <div style={ROW}>
            <span style={LABEL}>Truncate</span>
            <div style={SEGMENT_GROUP}>
              {(["clip", "ellipsis"] as const).map((opt, i) => (
                <button
                  key={opt}
                  onClick={() => handleTextOverflowChange(opt)}
                  style={{
                    ...segmentButton(textOverflow === opt),
                    textTransform: "capitalize",
                    ...(i === 0 ? { borderRight: `1px solid ${border.default}` } : {}),
                  }}
                >
                  {opt === "clip" ? "Clip" : "Ellipsis"}
                </button>
              ))}
            </div>
          </div>

          {/* Stroke — width + color side by side */}
          <div style={{ ...ROW, alignItems: "flex-start", gap: layout.compactGap }}>
            <span style={{ ...LABEL, paddingTop: 3 }}>Stroke</span>
            <div className="flex-1">
              <TypoValueCell
                value={textStrokeWidth}
                onChange={handleTextStrokeWidthChange}
                unit="px"
                step={1}
              />
              <div style={HINT}>Width</div>
            </div>
            <div className="flex-1">
              <div className="flex items-center relative" style={{ height: 28, background: surface.subtle, border: `1px solid ${border.default}`, borderRadius: 4, overflow: "hidden", padding: "0 6px", gap: 6 }}>
                <label style={{ ...INLINE_SWATCH, background: textStrokeColor }}>
                  <input
                    type="color"
                    value={textStrokeColor}
                    onChange={(e) => handleTextStrokeColorChange(e.target.value)}
                    style={{ position: "absolute", width: 0, height: 0, opacity: 0, overflow: "hidden" }}
                  />
                </label>
                <span style={{ fontSize: 11, fontFamily: font.mono, color: text.label, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {textStrokeColor}
                </span>
              </div>
              <div style={HINT}>Color</div>
            </div>
          </div>

          {/* Text shadows */}
          <SubSectionHeader label="Text shadows" onAdd={() => handleTextShadowsChange([...textShadows, { x: 0, y: 2, blur: 4, spread: 0, color: "rgba(0,0,0,0.25)", inset: false, visible: true }])} />
          {textShadows.length > 0 && <ShadowEditor shadows={textShadows} onChange={handleTextShadowsChange} />}
        </>
      )}
    </Section>
  );
});
