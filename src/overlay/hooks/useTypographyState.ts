import { useState, useCallback, useEffect } from "react";
import { rgbToHex, parseNum } from "../cssHelpers";
import { FALLBACK_FONTS } from "../constants";

export function useTypographyState(cs: Record<string, string>, apply: (prop: string, value: string) => void) {
  const [fontSize, setFontSize] = useState(() => parseNum(cs.fontSize));
  const [fontWeight, setFontWeight] = useState(() => cs.fontWeight);
  const [lineHeight, setLineHeight] = useState(() => { const lh = parseNum(cs.lineHeight); const fs = parseNum(cs.fontSize); return fs > 0 ? Math.round((lh / fs) * 100) / 100 : 1.4; });
  const [letterSpacing, setLetterSpacing] = useState(() => parseNum(cs.letterSpacing));
  const [fontSizeUnit, setFontSizeUnit] = useState("px");
  const [letterSpacingUnit, setLetterSpacingUnit] = useState("px");
  const [color, setColor] = useState(() => rgbToHex(cs.color));
  const [textAlign, setTextAlign] = useState(() => cs.textAlign);
  const [textDecoration, setTextDecoration] = useState(() => { const td = cs.textDecorationLine || cs.textDecoration; return td === "none" ? "none" : td; });
  const [textTransform, setTextTransform] = useState(() => cs.textTransform);
  const [fontStyle, setFontStyle] = useState(() => cs.fontStyle);
  const [fontFamily, setFontFamily] = useState(() => cs.fontFamily?.replace(/['"]/g, "") ?? "");
  const [pageFonts, setPageFonts] = useState<string[]>([]);
  useEffect(() => { document.fonts.ready.then(() => { const fonts: string[] = []; document.fonts.forEach(f => { const family = f.family.replace(/['"]/g, ""); if (!fonts.includes(family)) fonts.push(family); }); setPageFonts(fonts); }); }, []);
  const fontOptions = [...new Set([...pageFonts, ...FALLBACK_FONTS])].map(f => ({ value: f, label: f }));
  const [showTypoAdvanced, setShowTypoAdvanced] = useState(false);
  const [wordSpacing, setWordSpacing] = useState(() => parseNum(cs.wordSpacing));
  const [whiteSpace, setWhiteSpace] = useState(() => cs.whiteSpace);
  const [textIndent, setTextIndent] = useState(() => parseNum(cs.textIndent));
  const [wordBreak, setWordBreak] = useState(() => cs.wordBreak);
  const [columnCount, setColumnCount] = useState(() => { const v = cs.columnCount; return v === "auto" ? 1 : parseNum(cs.columnCount); });

  const handleFontSizeChange = useCallback((v: number) => { setFontSize(v); apply("font-size", `${v}${fontSizeUnit}`); }, [apply, fontSizeUnit]);
  const handleFontWeightChange = useCallback((v: string) => { setFontWeight(v); apply("font-weight", v); }, [apply]);
  const handleLineHeightChange = useCallback((v: number) => { setLineHeight(v); apply("line-height", String(v)); }, [apply]);
  const handleLetterSpacingChange = useCallback((v: number) => { setLetterSpacing(v); apply("letter-spacing", `${v}${letterSpacingUnit}`); }, [apply, letterSpacingUnit]);
  const handleColorChange = useCallback((v: string) => { setColor(v); apply("color", v); }, [apply]);
  const handleTextAlignChange = useCallback((v: string) => { setTextAlign(v); apply("text-align", v); }, [apply]);
  const handleTextDecorationChange = useCallback((v: string) => { setTextDecoration(v); apply("text-decoration-line", v); }, [apply]);
  const handleTextTransformChange = useCallback((v: string) => { setTextTransform(v); apply("text-transform", v); }, [apply]);
  const handleFontStyleChange = useCallback(() => { const next = fontStyle === "italic" ? "normal" : "italic"; setFontStyle(next); apply("font-style", next); }, [fontStyle, apply]);
  const handleFontFamilyChange = useCallback((v: string) => { setFontFamily(v); apply("font-family", v); }, [apply]);
  const handleWordSpacingChange = useCallback((v: number) => { setWordSpacing(v); apply("word-spacing", `${v}px`); }, [apply]);
  const handleWhiteSpaceChange = useCallback((v: string) => { setWhiteSpace(v); apply("white-space", v); }, [apply]);
  const handleTextIndentChange = useCallback((v: number) => { setTextIndent(v); apply("text-indent", `${v}px`); }, [apply]);
  const handleWordBreakChange = useCallback((v: string) => { setWordBreak(v); apply("word-break", v); }, [apply]);
  const handleColumnCountChange = useCallback((v: number) => { setColumnCount(v); apply("column-count", String(v)); }, [apply]);

  return {
    state: { fontSize, fontWeight, lineHeight, letterSpacing, fontSizeUnit, letterSpacingUnit, color, textAlign, textDecoration, textTransform, fontStyle, fontFamily, fontOptions, showTypoAdvanced, wordSpacing, whiteSpace, textIndent, wordBreak, columnCount },
    handlers: { handleFontSizeChange, handleFontWeightChange, handleLineHeightChange, handleLetterSpacingChange, handleColorChange, handleTextAlignChange, handleTextDecorationChange, handleTextTransformChange, handleFontStyleChange, handleFontFamilyChange, handleWordSpacingChange, handleWhiteSpaceChange, handleTextIndentChange, handleWordBreakChange, handleColumnCountChange, setFontSizeUnit, setLetterSpacingUnit, setShowTypoAdvanced },
  };
}
