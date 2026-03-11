/**
 * WebflowPanel.tsx — Central CSS property panel (Webflow-style)
 *
 * Replaces the DialKit-based Panel.tsx with custom inline-styled sections.
 * Each section is collapsible and maps to a CSS category:
 * Layout, Spacing, Size, Position, Typography, Backgrounds, Borders, Effects.
 */

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { getAuthoredValue } from "./getAuthoredValue";
import { AlignBox } from "./AlignBox";
import { IconButtonGroup } from "./IconButtonGroup";
import { SideSelector } from "./SideSelector";
import { CornerRadiusEditor } from "./CornerRadiusEditor";
import { ShadowEditor, type ShadowValue } from "./ShadowEditor";
import { FilterSliders, type FilterValues } from "./FilterSliders";
import { TransformEditor, type TransformValue } from "./TransformEditor";
import { TransitionEditor, type TransitionValue } from "./TransitionEditor";
import { BackgroundLayerList, type BackgroundLayer } from "./BackgroundLayerList";
import { SpacingBoxModel } from "./SpacingBoxModel";
import { PositionOffsetDiagram } from "./PositionOffsetDiagram";
import { PositionSelector } from "./PositionSelector";
import type { SpacingValues } from "./infer";
import { applyInlineStyle, isDirty, resetProp } from "./apply";
import { LabelScrub } from "./LabelScrub";
import { SizeInputCell } from "./SizeInputCell";
import { UnitSelector } from "./UnitSelector";
import { buildConversionContext, convertUnit } from "./unitConversion";
import { StyleIndicator, type IndicatorType } from "./StyleIndicator";
import { Section, SliderRow, SelectRow, ColorRow, TextRow, ValueInput } from "./controls";
import { cssColorToHex as rgbToHex } from "./colorUtils";
import {
  parseNum, extractUnit, parseBoxShadow, parseFilter, parseTransform, parseTransitions,
  shadowToCSS, filterToCSS, transformToCSS, transitionsToCSS,
} from "./cssParsers";
import {
  TEXT_ALIGN_OPTIONS, TEXT_DECORATION_OPTIONS, CAPITALIZE_OPTIONS,
  ITALIC_OPTIONS, DIRECTION_OPTIONS,
  FONT_WEIGHT_OPTIONS, WHITE_SPACE_OPTIONS, WORD_BREAK_OPTIONS, LINE_BREAK_OPTIONS,
  FLOAT_OPTIONS, CLEAR_OPTIONS,
  SIZE_UNITS_W, SIZE_UNITS_H, POSITION_UNITS, TYPO_SIZE_UNITS,
  LAYOUT_UNITS, BORDER_UNITS, SPACING_UNITS, LINE_HEIGHT_UNITS,
  OVERFLOW_ICON_OPTIONS,
  OBJECT_FIT_OPTIONS, OBJECT_POSITION_OPTIONS,
  BORDER_STYLE_OPTIONS, BLEND_MODE_OPTIONS, FALLBACK_FONTS,
  CURSOR_OPTIONS, POINTER_EVENTS_OPTIONS, VISIBILITY_OPTIONS,
  ALIGN_SELF_OPTIONS, JUSTIFY_OPTIONS, ALIGN_ITEMS_OPTIONS,
  BG_CLIP_OPTIONS, USER_SELECT_OPTIONS, BACKFACE_OPTIONS, BOX_SIZING_OPTIONS,
} from "./panelConstants";
import { MiniDropdown, DirectionRow, GapRow, DisplayTabs, TypoValueCell } from "./layoutControls";
import { ChevronRight, Link } from "lucide-react";

// ─── Props ───────────────────────────────────────────────────────────

export interface WebflowPanelProps {
  element: Element;
  spacing: SpacingValues;
  onSpacingChange: (prop: string, value: number, unit: string) => void;
  onDirtyChange?: () => void;
}

// ─── Local Helpers ──────────────────────────────────────────────────

/** CSS properties that are inherited by default */
const INHERITABLE_PROPERTIES = new Set([
  "color", "font-family", "font-size", "font-style", "font-weight", "font-variant",
  "line-height", "letter-spacing", "word-spacing", "text-align", "text-indent",
  "text-transform", "text-decoration", "white-space", "word-break", "word-wrap",
  "direction", "visibility", "cursor", "list-style", "list-style-type", "quotes",
  "hyphens", "tab-size", "text-shadow",
]);

function getIndicatorType(
  el: Element,
  prop: string,
  cs?: CSSStyleDeclaration,
  parentCs?: CSSStyleDeclaration | null,
): IndicatorType {
  if ((el as HTMLElement).style.getPropertyValue(prop) !== "") return "element";
  if (INHERITABLE_PROPERTIES.has(prop) && parentCs) {
    const computedValue = cs?.getPropertyValue(prop) ?? "";
    const parentValue = parentCs.getPropertyValue(prop);
    if (computedValue !== parentValue) return "inherited";
  }
  return "none";
}


/** Extract the CSS unit from the authored value of a property, falling back to `fallback` */
function detectUnit(el: Element, prop: string, fallback: string = "px"): string {
  const authored = getAuthoredValue(el, prop);
  if (!authored) return fallback;
  return extractUnit(authored, fallback);
}

const TEXT_TAGS = new Set([
  "h1", "h2", "h3", "h4", "h5", "h6", "p", "span", "a", "label",
  "button", "li", "td", "th", "input", "textarea", "strong", "em",
  "b", "i", "small", "blockquote",
]);

function isTextBearing(el: Element): boolean {
  if (TEXT_TAGS.has(el.tagName.toLowerCase())) return true;
  if (el.matches("[role=button], [role=heading], [contenteditable]")) return true;
  for (const child of el.childNodes) {
    if (child.nodeType === Node.TEXT_NODE && child.textContent?.trim()) return true;
  }
  return false;
}

// ─── Main Component ──────────────────────────────────────────────────

export function WebflowPanel({ element, spacing, onSpacingChange, onDirtyChange }: WebflowPanelProps) {
  // Read computed styles once on mount
  const [cs] = useState(() => getComputedStyle(element));
  const [parentCs] = useState(() => element.parentElement ? getComputedStyle(element.parentElement) : null);
  /** Build fresh conversion context on demand (not cached — avoids stale font-size/parent dims) */
  const getConversionCtx = useCallback(() => buildConversionContext(element), [element]);

  // Inject :focus-visible styles for keyboard navigation
  useEffect(() => {
    const id = 'tuner-focus-styles';
    if (!document.getElementById(id)) {
      const style = document.createElement('style');
      style.id = id;
      style.textContent = `.tuner-focusable:focus-visible { outline: 1px solid rgba(99,102,241,0.5); outline-offset: 1px; }`;
      document.head.appendChild(style);
    }
    return () => { document.getElementById(id)?.remove(); };
  }, []);

  /** Shorthand for getIndicatorType bound to this element's cached styles */
  const ind = useCallback((prop: string) => getIndicatorType(element, prop, cs, parentCs), [element, cs, parentCs]);

  // ── Layout state ──
  const [display, setDisplay] = useState(() => cs.display);
  const [flexDirection, setFlexDirection] = useState(() => cs.flexDirection);
  const [justifyContent, setJustifyContent] = useState(() => cs.justifyContent);
  const [alignItems, setAlignItems] = useState(() => cs.alignItems);
  const [flexWrap, setFlexWrap] = useState(() => cs.flexWrap);
  const [gap, setGap] = useState(() => parseNum(cs.gap));
  const [gapLocked, setGapLocked] = useState(true);
  const [rowGap, setRowGap] = useState(() => parseNum(cs.rowGap));
  const [columnGap, setColumnGap] = useState(() => parseNum(cs.columnGap));

  // Grid track definitions
  const [gridCols, setGridCols] = useState(() => cs.gridTemplateColumns === "none" ? "" : cs.gridTemplateColumns);
  const [gridRows, setGridRows] = useState(() => cs.gridTemplateRows === "none" ? "" : cs.gridTemplateRows);

  // Flex child controls
  const [flexGrow, setFlexGrow] = useState(() => parseNum(cs.flexGrow));
  const [flexShrink, setFlexShrink] = useState(() => parseNum(cs.flexShrink));
  const [flexBasis, setFlexBasis] = useState(() => parseNum(cs.flexBasis));
  const [alignSelf, setAlignSelf] = useState(() => cs.alignSelf);
  const [flexOrder, setFlexOrder] = useState(() => parseNum(cs.order));

  // Layout units
  const [gapUnit, setGapUnit] = useState(() => detectUnit(element, "gap"));
  const [flexBasisUnit, setFlexBasisUnit] = useState(() => detectUnit(element, "flex-basis"));

  // ── Size state ──
  // For width/height: use 0 as the fallback numeric value when auto (the keyword handles display)
  const [width, setWidth] = useState(() => {
    const authored = getAuthoredValue(element, "width");
    return (!authored || authored === "auto") ? 0 : parseNum(cs.width);
  });
  const [height, setHeight] = useState(() => {
    const authored = getAuthoredValue(element, "height");
    return (!authored || authored === "auto") ? 0 : parseNum(cs.height);
  });
  const [minWidth, setMinWidth] = useState(() => {
    const authored = getAuthoredValue(element, "min-width");
    return authored ? parseNum(authored) : 0;
  });
  const [maxWidth, setMaxWidth] = useState(() => {
    const authored = getAuthoredValue(element, "max-width");
    return (!authored || authored === "none") ? 0 : parseNum(authored);
  });
  const [minHeight, setMinHeight] = useState(() => {
    const authored = getAuthoredValue(element, "min-height");
    return authored ? parseNum(authored) : 0;
  });
  const [maxHeight, setMaxHeight] = useState(() => {
    const authored = getAuthoredValue(element, "max-height");
    return (!authored || authored === "none") ? 0 : parseNum(authored);
  });
  const [overflow, setOverflow] = useState(() => cs.overflow.split(" ")[0] || "visible");
  const [overflowLocked, setOverflowLocked] = useState(true);
  const [overflowX, setOverflowX] = useState(() => cs.overflowX || "visible");
  const [overflowY, setOverflowY] = useState(() => cs.overflowY || "visible");
  const [boxSizing, setBoxSizing] = useState(() => cs.boxSizing || "border-box");
  const [aspectRatio, setAspectRatio] = useState(() => cs.aspectRatio === "auto" ? "" : cs.aspectRatio);
  const [objectFit, setObjectFit] = useState(() => cs.objectFit);
  const [objectPosition, setObjectPosition] = useState(() => cs.objectPosition);
  const [showMoreSize, setShowMoreSize] = useState(false);

  // Size units
  const [widthUnit, setWidthUnit] = useState(() => detectUnit(element, "width"));
  const [heightUnit, setHeightUnit] = useState(() => detectUnit(element, "height"));
  const [minWidthUnit, setMinWidthUnit] = useState(() => detectUnit(element, "min-width"));
  const [maxWidthUnit, setMaxWidthUnit] = useState(() => detectUnit(element, "max-width"));
  const [minHeightUnit, setMinHeightUnit] = useState(() => detectUnit(element, "min-height"));
  const [maxHeightUnit, setMaxHeightUnit] = useState(() => detectUnit(element, "max-height"));

  // Size keyword toggles
  // getComputedStyle always resolves to pixels — detect "auto"/"none" from authored CSS
  const [widthAuto, setWidthAuto] = useState(() => {
    const authored = getAuthoredValue(element, "width");
    return !authored || authored === "auto";
  });
  const [heightAuto, setHeightAuto] = useState(() => {
    const authored = getAuthoredValue(element, "height");
    return !authored || authored === "auto";
  });
  const [maxWidthNone, setMaxWidthNone] = useState(() => {
    const authored = getAuthoredValue(element, "max-width");
    return !authored || authored === "none";
  });
  const [maxHeightNone, setMaxHeightNone] = useState(() => {
    const authored = getAuthoredValue(element, "max-height");
    return !authored || authored === "none";
  });

  // ── Position state ──
  const [position, setPosition] = useState(() => cs.position);
  const [top, setTop] = useState(() => parseNum(cs.top));
  const [right, setRight] = useState(() => parseNum(cs.right));
  const [bottom, setBottom] = useState(() => parseNum(cs.bottom));
  const [left, setLeft] = useState(() => parseNum(cs.left));
  const [zIndex, setZIndex] = useState(() => parseInt(cs.zIndex) || 0);
  const [float_, setFloat] = useState(() => cs.cssFloat || "none");
  const [clear_, setClear] = useState(() => cs.clear || "none");

  // Position units
  const [topUnit, setTopUnit] = useState(() => detectUnit(element, "top"));
  const [rightUnit, setRightUnit] = useState(() => detectUnit(element, "right"));
  const [bottomUnit, setBottomUnit] = useState(() => detectUnit(element, "bottom"));
  const [leftUnit, setLeftUnit] = useState(() => detectUnit(element, "left"));

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
  const [lineHeightUnit, setLineHeightUnit] = useState(() => detectUnit(element, "line-height", "—"));
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

  // ── Background state ──
  const [bgColor, setBgColor] = useState(() => rgbToHex(cs.backgroundColor));
  const [bgLayers, setBgLayers] = useState<BackgroundLayer[]>(() => {
    const bg = rgbToHex(cs.backgroundColor);
    if (bg !== "transparent") {
      return [{ id: "initial_color", type: "color", color: bg, opacity: 1, blendMode: "normal" }];
    }
    return [];
  });
  const [bgClip, setBgClip] = useState(() => cs.getPropertyValue("background-clip") || "border-box");

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

  // ── Effects state ──
  const [opacity, setOpacity] = useState(() => parseFloat(cs.opacity) || 1);
  const [mixBlendMode, setMixBlendMode] = useState(() => cs.mixBlendMode);
  const [shadows, setShadows] = useState<ShadowValue[]>(() => parseBoxShadow(cs.boxShadow));
  const [transforms, setTransforms] = useState<TransformValue[]>(() => parseTransform(cs.transform));
  const [transformOrigin, setTransformOrigin] = useState(() => cs.transformOrigin || "center");
  const [filterValues, setFilterValues] = useState<Partial<FilterValues>>(() => parseFilter(cs.filter));
  const [backdropFilterValues, setBackdropFilterValues] = useState<Partial<FilterValues>>(() =>
    parseFilter(cs.getPropertyValue("backdrop-filter") || cs.getPropertyValue("-webkit-backdrop-filter") || "")
  );
  const [transitions, setTransitions] = useState<TransitionValue[]>(() => parseTransitions(cs));
  const [cursor, setCursor] = useState(() => cs.cursor);
  const [pointerEvents, setPointerEvents] = useState(() => cs.pointerEvents);
  const [visibility, setVisibility] = useState(() => cs.visibility);
  const [userSelect, setUserSelect] = useState(() => cs.userSelect || "auto");
  const [perspective, setPerspective] = useState(() => parseNum(cs.getPropertyValue("perspective")));
  const [backfaceVisibility, setBackfaceVisibility] = useState(() => cs.getPropertyValue("backface-visibility") || "visible");

  // Spacing units
  const [marginUnit, setMarginUnit] = useState(() => detectUnit(element, "margin-top"));
  const [paddingUnit, setPaddingUnit] = useState(() => detectUnit(element, "padding-top"));

  // ── Derived flags ──
  const isFlex = display === "flex" || display === "inline-flex";
  const isGrid = display === "grid" || display === "inline-grid";
  const parentIsFlex = parentCs != null && (parentCs.display === "flex" || parentCs.display === "inline-flex");
  const parentIsGrid = parentCs != null && (parentCs.display === "grid" || parentCs.display === "inline-grid");
  const parentIsFlexOrGrid = parentIsFlex || parentIsGrid;
  const isMedia = ["img", "video", "canvas"].includes(element.tagName.toLowerCase());
  const showTypography = isTextBearing(element);

  // ── Apply helper ──
  const apply = useCallback(
    (prop: string, value: string) => {
      applyInlineStyle(element, prop, value);
      onDirtyChange?.();
    },
    [element, onDirtyChange]
  );

  /** Reset a CSS property to its computed value and update React state via setter */
  const resetCss = useCallback(
    (prop: string, setter: (v: number) => void) => {
      resetProp(element, prop);
      const fresh = getComputedStyle(element).getPropertyValue(prop).trim();
      setter(parseFloat(fresh) || 0);
      onDirtyChange?.();
    },
    [element, onDirtyChange]
  );

  // ─── Section Handlers ──────────────────────────────────────────────

  // Layout
  const handleDisplayChange = useCallback(
    (v: string) => {
      setDisplay(v);
      apply("display", v);
    },
    [apply]
  );

  const handleFlexDirectionChange = useCallback(
    (v: string) => {
      const dir = v === "none" ? "row" : v;
      setFlexDirection(dir);
      apply("flex-direction", dir);
    },
    [apply]
  );

  const handleAlignChange = useCallback(
    (justify: string, align: string) => {
      setJustifyContent(justify);
      setAlignItems(align);
      apply("justify-content", justify);
      apply("align-items", align);
    },
    [apply]
  );

  const handleFlexWrapChange = useCallback(
    (v: string) => {
      setFlexWrap(v);
      apply("flex-wrap", v);
    },
    [apply]
  );

  const handleGapChange = useCallback(
    (v: number) => {
      setGap(v);
      apply("gap", `${v}${gapUnit}`);
      if (gapLocked) { setRowGap(v); setColumnGap(v); }
    },
    [apply, gapUnit, gapLocked]
  );
  const handleRowGapChange = useCallback((v: number) => { setRowGap(v); apply("row-gap", `${v}px`); }, [apply]);
  const handleColumnGapChange = useCallback((v: number) => { setColumnGap(v); apply("column-gap", `${v}px`); }, [apply]);
  const handleGapLockToggle = useCallback(() => {
    setGapLocked(prev => {
      if (!prev) { setRowGap(gap); setColumnGap(gap); apply("row-gap", `${gap}px`); apply("column-gap", `${gap}px`); }
      return !prev;
    });
  }, [gap, apply]);

  const handleGridColsChange = useCallback(
    (v: string) => { setGridCols(v); if (v.trim()) apply("grid-template-columns", v); },
    [apply]
  );
  const handleGridRowsChange = useCallback(
    (v: string) => { setGridRows(v); if (v.trim()) apply("grid-template-rows", v); },
    [apply]
  );

  const handleFlexGrowChange = useCallback(
    (v: number) => {
      setFlexGrow(v);
      apply("flex-grow", String(v));
    },
    [apply]
  );

  const handleFlexShrinkChange = useCallback(
    (v: number) => {
      setFlexShrink(v);
      apply("flex-shrink", String(v));
    },
    [apply]
  );

  const handleFlexBasisChange = useCallback(
    (v: number) => {
      setFlexBasis(v);
      apply("flex-basis", `${v}${flexBasisUnit}`);
    },
    [apply, flexBasisUnit]
  );

  const handleAlignSelfChange = useCallback(
    (v: string) => {
      setAlignSelf(v);
      apply("align-self", v);
    },
    [apply]
  );

  const handleFlexOrderChange = useCallback(
    (v: number) => {
      setFlexOrder(v);
      apply("order", String(v));
    },
    [apply]
  );

  // Size
  const handleWidthChange = useCallback((v: number) => { setWidth(v); apply("width", `${v}${widthUnit}`); }, [apply, widthUnit]);
  const handleHeightChange = useCallback((v: number) => { setHeight(v); apply("height", `${v}${heightUnit}`); }, [apply, heightUnit]);
  const handleMinWidthChange = useCallback((v: number) => { setMinWidth(v); apply("min-width", `${v}${minWidthUnit}`); }, [apply, minWidthUnit]);
  const handleMaxWidthChange = useCallback((v: number) => { setMaxWidth(v); apply("max-width", v === 0 ? "none" : `${v}${maxWidthUnit}`); }, [apply, maxWidthUnit]);
  const handleMinHeightChange = useCallback((v: number) => { setMinHeight(v); apply("min-height", `${v}${minHeightUnit}`); }, [apply, minHeightUnit]);
  const handleMaxHeightChange = useCallback((v: number) => { setMaxHeight(v); apply("max-height", v === 0 ? "none" : `${v}${maxHeightUnit}`); }, [apply, maxHeightUnit]);
  const handleOverflowChange = useCallback((v: string) => { setOverflow(v); apply("overflow", v); }, [apply]);
  const handleOverflowXChange = useCallback((v: string) => { setOverflowX(v); apply("overflow-x", v); }, [apply]);
  const handleOverflowYChange = useCallback((v: string) => { setOverflowY(v); apply("overflow-y", v); }, [apply]);
  const handleOverflowLockToggle = useCallback(() => {
    setOverflowLocked(prev => {
      if (!prev) { setOverflowX(overflow); setOverflowY(overflow); apply("overflow-x", overflow); apply("overflow-y", overflow); }
      return !prev;
    });
  }, [overflow, apply]);
  const handleBoxSizingChange = useCallback((v: string) => { setBoxSizing(v); apply("box-sizing", v); }, [apply]);
  const handleAspectRatioChange = useCallback((v: string) => { setAspectRatio(v); apply("aspect-ratio", v || "auto"); }, [apply]);
  const handleObjectFitChange = useCallback((v: string) => { setObjectFit(v); apply("object-fit", v); }, [apply]);
  const handleObjectPositionChange = useCallback((v: string) => { setObjectPosition(v); apply("object-position", v); }, [apply]);

  // Size keyword toggles
  const handleWidthAutoToggle = useCallback(() => {
    const next = !widthAuto;
    setWidthAuto(next);
    apply("width", next ? "auto" : `${width}${widthUnit}`);
  }, [widthAuto, width, widthUnit, apply]);

  const handleHeightAutoToggle = useCallback(() => {
    const next = !heightAuto;
    setHeightAuto(next);
    apply("height", next ? "auto" : `${height}${heightUnit}`);
  }, [heightAuto, height, heightUnit, apply]);

  const handleMaxWidthNoneToggle = useCallback(() => {
    const next = !maxWidthNone;
    setMaxWidthNone(next);
    apply("max-width", next ? "none" : `${maxWidth}${maxWidthUnit}`);
  }, [maxWidthNone, maxWidth, maxWidthUnit, apply]);

  const handleMaxHeightNoneToggle = useCallback(() => {
    const next = !maxHeightNone;
    setMaxHeightNone(next);
    apply("max-height", next ? "none" : `${maxHeight}${maxHeightUnit}`);
  }, [maxHeightNone, maxHeight, maxHeightUnit, apply]);

  // Position
  const handlePositionChange = useCallback((v: string) => { setPosition(v); apply("position", v); }, [apply]);
  const handleTopChange = useCallback((v: number) => { setTop(v); apply("top", `${v}${topUnit}`); }, [apply, topUnit]);
  const handleRightChange = useCallback((v: number) => { setRight(v); apply("right", `${v}${rightUnit}`); }, [apply, rightUnit]);
  const handleBottomChange = useCallback((v: number) => { setBottom(v); apply("bottom", `${v}${bottomUnit}`); }, [apply, bottomUnit]);
  const handleLeftChange = useCallback((v: number) => { setLeft(v); apply("left", `${v}${leftUnit}`); }, [apply, leftUnit]);
  const handleZIndexChange = useCallback((v: number) => { setZIndex(v); apply("z-index", String(v)); }, [apply]);
  const handleFloatChange = useCallback((v: string) => { setFloat(v); apply("float", v); }, [apply]);
  const handleClearChange = useCallback((v: string) => { setClear(v); apply("clear", v); }, [apply]);

  // Typography
  const handleFontSizeChange = useCallback((v: number) => { setFontSize(v); apply("font-size", `${v}${fontSizeUnit}`); }, [apply, fontSizeUnit]);
  const handleFontWeightChange = useCallback((v: string) => { setFontWeight(v); apply("font-weight", v); }, [apply]);
  const handleLineHeightChange = useCallback((v: number) => {
    setLineHeight(v);
    if (lineHeightUnit === "—") apply("line-height", String(v));
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
  // IconButtonGroup-compatible handlers (map "none" → valid defaults)
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

  // Backgrounds
  const handleBgColorChange = useCallback((v: string) => { setBgColor(v); apply("background-color", v); }, [apply]);
  const handleBgLayersChange = useCallback(
    (layers: BackgroundLayer[]) => {
      setBgLayers(layers);
      // Build background parts from all layers
      const bgParts: string[] = [];
      let bgColor = "transparent";
      for (const layer of layers) {
        if (layer.type === "color") {
          bgColor = layer.color || "transparent";
        } else if (layer.type === "gradient" && layer.gradient) {
          const g = layer.gradient;
          const stops = g.stops
            .map((s) => `${s.color} ${s.position}%`)
            .join(", ");
          if (g.type === "linear") {
            bgParts.push(`linear-gradient(${g.angle}deg, ${stops})`);
          } else if (g.type === "radial") {
            bgParts.push(`radial-gradient(${stops})`);
          } else if (g.type === "conic") {
            bgParts.push(`conic-gradient(from ${g.angle}deg, ${stops})`);
          }
        } else if (layer.type === "image" && layer.image) {
          const img = layer.image;
          bgParts.push(
            `url(${img.url}) ${img.position} / ${img.size} ${img.repeat}`
          );
        }
      }
      // CSS background: gradients/images first, then color as the last layer
      if (bgParts.length > 0) {
        apply("background", bgParts.join(", "));
        apply("background-color", bgColor);
      } else {
        apply("background", "none");
        apply("background-color", bgColor);
      }
    },
    [apply]
  );
  const handleBgClipChange = useCallback((v: string) => { setBgClip(v); apply("background-clip", v); if (v === "text") { apply("-webkit-background-clip", "text"); } }, [apply]);

  // Borders
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

  // Effects
  const handleOpacityChange = useCallback((v: number) => { setOpacity(v); apply("opacity", String(v)); }, [apply]);
  const handleOpacitySliderChange = useCallback((v: number) => handleOpacityChange(v / 100), [handleOpacityChange]);
  const handleMixBlendModeChange = useCallback((v: string) => { setMixBlendMode(v); apply("mix-blend-mode", v); }, [apply]);
  const handleShadowsChange = useCallback(
    (s: ShadowValue[]) => {
      setShadows(s);
      apply("box-shadow", shadowToCSS(s));
    },
    [apply]
  );
  const handleTransformsChange = useCallback(
    (t: TransformValue[]) => {
      setTransforms(t);
      apply("transform", transformToCSS(t));
    },
    [apply]
  );
  const handleTransformOriginChange = useCallback(
    (o: string) => {
      setTransformOrigin(o);
      apply("transform-origin", o);
    },
    [apply]
  );
  const handleFilterChange = useCallback(
    (key: string, value: number) => {
      const next = { ...filterValues, [key]: value };
      setFilterValues(next);
      apply("filter", filterToCSS(next));
    },
    [filterValues, apply]
  );
  const handleBackdropFilterChange = useCallback(
    (key: string, value: number) => {
      const next = { ...backdropFilterValues, [key]: value };
      setBackdropFilterValues(next);
      apply("backdrop-filter", filterToCSS(next));
    },
    [backdropFilterValues, apply]
  );
  const handleTransitionsChange = useCallback(
    (t: TransitionValue[]) => {
      setTransitions(t);
      apply("transition", transitionsToCSS(t));
    },
    [apply]
  );
  const handleCursorChange = useCallback((v: string) => { setCursor(v); apply("cursor", v); }, [apply]);
  const handlePointerEventsChange = useCallback((v: string) => { setPointerEvents(v); apply("pointer-events", v); }, [apply]);
  const handleVisibilityChange = useCallback((v: string) => { setVisibility(v); apply("visibility", v); }, [apply]);
  const handleUserSelectChange = useCallback((v: string) => { setUserSelect(v); apply("user-select", v); }, [apply]);
  const handlePerspectiveChange = useCallback((v: number) => { setPerspective(v); apply("perspective", v > 0 ? `${v}px` : "none"); }, [apply]);
  const handleBackfaceVisibilityChange = useCallback((v: string) => { setBackfaceVisibility(v); apply("backface-visibility", v); }, [apply]);

  // ─── Render ────────────────────────────────────────────────────────

  return (
    <div style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}>
      {/* 1. Layout */}
      <Section title="Layout">
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
              onUnitChange={(u) => { const c = convertUnit(gap, gapUnit, u, getConversionCtx()); setGap(c); setGapUnit(u); apply("gap", `${c}${u}`); }}
            />
          </>
        )}

        {isGrid && (
          <>
            <TextRow label="Columns" value={gridCols} placeholder="1fr 1fr 1fr" onChange={handleGridColsChange} />
            <TextRow label="Rows" value={gridRows} placeholder="auto" onChange={handleGridRowsChange} />
            <div style={{ padding: "6px 12px" }}>
              <AlignBox
                justify={justifyContent}
                align={alignItems}
                onChange={handleAlignChange}
                mode="grid"
              />
            </div>
            {gapLocked ? (
              <div style={{ display: "flex", alignItems: "center" }}>
                <div style={{ flex: 1 }}>
                  <SliderRow label="Gap" value={gap} min={0} max={200} step={1} unit={gapUnit} units={LAYOUT_UNITS} onUnitChange={(u) => { const c = convertUnit(gap, gapUnit, u, getConversionCtx()); setGap(c); setGapUnit(u); apply("gap", `${c}${u}`); }} onChange={handleGapChange} onReset={() => resetCss("gap", setGap)} indicator={ind("gap")} />
                </div>
                <button onClick={handleGapLockToggle} title="Unlock row/column gap" style={{ width: "20px", height: "20px", display: "flex", alignItems: "center", justifyContent: "center", background: "transparent", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.4)", fontSize: "10px", marginRight: "8px", borderRadius: "3px", flexShrink: 0 }}><Link size={12} strokeWidth={1.5} /></button>
              </div>
            ) : (
              <>
                <div style={{ display: "flex", alignItems: "center" }}>
                  <div style={{ flex: 1 }}>
                    <SliderRow label="Row Gap" value={rowGap} min={0} max={200} step={1} unit="px" onChange={handleRowGapChange} onReset={() => resetCss("row-gap", setRowGap)} indicator={ind("row-gap")} />
                  </div>
                  <button onClick={handleGapLockToggle} title="Lock gap" style={{ width: "20px", height: "20px", display: "flex", alignItems: "center", justifyContent: "center", background: "transparent", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.25)", fontSize: "10px", marginRight: "8px", borderRadius: "3px", flexShrink: 0 }}><Link size={12} strokeWidth={1.5} /></button>
                </div>
                <SliderRow label="Col Gap" value={columnGap} min={0} max={200} step={1} unit="px" onChange={handleColumnGapChange} onReset={() => resetCss("column-gap", setColumnGap)} indicator={ind("column-gap")} />
              </>
            )}
          </>
        )}

        {parentIsFlexOrGrid && (
          <>
            <div style={{ padding: "6px 12px 2px", fontSize: "10px", color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
              {parentIsFlex ? "Flex Child" : "Grid Child"}
            </div>

            {/* Grow / Shrink — compact inline inputs, flex children only */}
            {parentIsFlex && (
              <div style={{ display: "flex", gap: "6px", padding: "2px 12px" }}>
                <div style={{ flex: 1, display: "flex", alignItems: "center", height: "28px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "4px", overflow: "hidden" }}>
                  <LabelScrub value={flexGrow} onChange={handleFlexGrowChange} step={1} min={0} max={10}>
                    <span style={{ padding: "0 6px", fontSize: "10px", color: "rgba(255,255,255,0.5)", flexShrink: 0, whiteSpace: "nowrap", display: "inline-flex", alignItems: "center", gap: "3px" }}>
                      {ind("flex-grow") !== "none" && <StyleIndicator type={ind("flex-grow")} />}Grow
                    </span>
                  </LabelScrub>
                  <ValueInput value={flexGrow} onChange={handleFlexGrowChange} />
                </div>
                <div style={{ flex: 1, display: "flex", alignItems: "center", height: "28px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "4px", overflow: "hidden" }}>
                  <LabelScrub value={flexShrink} onChange={handleFlexShrinkChange} step={1} min={0} max={10}>
                    <span style={{ padding: "0 6px", fontSize: "10px", color: "rgba(255,255,255,0.5)", flexShrink: 0, whiteSpace: "nowrap", display: "inline-flex", alignItems: "center", gap: "3px" }}>
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
                <div style={{ display: "flex", alignItems: "center", height: "28px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "4px", overflow: "hidden" }}>
                  <LabelScrub value={flexBasis} onChange={handleFlexBasisChange} step={1} min={0} max={500}>
                    <span style={{ padding: "0 6px", fontSize: "10px", color: "rgba(255,255,255,0.5)", flexShrink: 0, whiteSpace: "nowrap", display: "inline-flex", alignItems: "center", gap: "3px" }}>
                      {ind("flex-basis") !== "none" && <StyleIndicator type={ind("flex-basis")} />}Basis
                    </span>
                  </LabelScrub>
                  <div style={{ flex: 1, display: "flex", justifyContent: "flex-end", paddingRight: "2px" }}>
                    <ValueInput value={flexBasis} onChange={handleFlexBasisChange} />
                  </div>
                  <div style={{ flexShrink: 0, paddingRight: "3px" }}>
                    <UnitSelector value={flexBasisUnit} options={LAYOUT_UNITS} onChange={(u) => { const c = convertUnit(flexBasis, flexBasisUnit, u, getConversionCtx()); setFlexBasis(c); setFlexBasisUnit(u); apply("flex-basis", `${c}${u}`); }} />
                  </div>
                </div>
              </div>
            )}

            <SelectRow label="Align Self" value={alignSelf} options={ALIGN_SELF_OPTIONS} onChange={handleAlignSelfChange} indicator={ind("align-self")} />

            {/* Order — simple number input, not a slider */}
            <div style={{ display: "flex", alignItems: "center", gap: "6px", padding: "2px 12px" }}>
              <span style={{ width: "64px", fontSize: "11px", color: "rgba(255,255,255,0.5)", flexShrink: 0, display: "inline-flex", alignItems: "center", gap: "4px" }}>
                {ind("order") !== "none" && <StyleIndicator type={ind("order")} />}
                Order
              </span>
              <ValueInput value={flexOrder} onChange={handleFlexOrderChange} />
            </div>
          </>
        )}
      </Section>

      {/* 2. Spacing */}
      <Section title="Spacing">
        <SpacingBoxModel
          margin={spacing.margin}
          padding={spacing.padding}
          onChange={onSpacingChange}
          marginUnit={marginUnit}
          paddingUnit={paddingUnit}
          marginUnits={SPACING_UNITS}
          paddingUnits={SPACING_UNITS}
          onMarginUnitChange={(u) => {
            const ctx = buildConversionContext(element);
            const sides = ["top", "right", "bottom", "left"] as const;
            for (const s of sides) {
              const converted = convertUnit(spacing.margin[s], marginUnit, u, ctx);
              onSpacingChange(`margin-${s}`, converted, u);
            }
            setMarginUnit(u);
          }}
          onPaddingUnitChange={(u) => {
            const ctx = buildConversionContext(element);
            const sides = ["top", "right", "bottom", "left"] as const;
            for (const s of sides) {
              const converted = convertUnit(spacing.padding[s], paddingUnit, u, ctx);
              onSpacingChange(`padding-${s}`, converted, u);
            }
            setPaddingUnit(u);
          }}
        />
      </Section>

      {/* 3. Size */}
      <Section title="Size">
        {/* Row 1: Width + Height */}
        <div style={{ display: "flex", gap: "4px", padding: "2px 12px" }}>
          <SizeInputCell
            label="Width"
            value={width}
            unit={widthUnit}
            units={SIZE_UNITS_W}
            keyword={widthAuto ? "auto" : null}
            onValueChange={handleWidthChange}
            onUnitChange={(u) => { const c = convertUnit(width, widthUnit, u, getConversionCtx(), "width"); setWidth(c); setWidthUnit(u); apply("width", `${c}${u}`); }}
            onKeywordChange={(k) => { setWidthAuto(k === "auto"); apply("width", k === "auto" ? "auto" : `${width}${widthUnit}`); }}
            isModified={isDirty(element, "width")}
            supportsAuto
            min={0}
            max={1920}
          />
          <SizeInputCell
            label="Height"
            value={height}
            unit={heightUnit}
            units={SIZE_UNITS_H}
            keyword={heightAuto ? "auto" : null}
            onValueChange={handleHeightChange}
            onUnitChange={(u) => { const c = convertUnit(height, heightUnit, u, getConversionCtx(), "height"); setHeight(c); setHeightUnit(u); apply("height", `${c}${u}`); }}
            onKeywordChange={(k) => { setHeightAuto(k === "auto"); apply("height", k === "auto" ? "auto" : `${height}${heightUnit}`); }}
            isModified={isDirty(element, "height")}
            supportsAuto
            min={0}
            max={1200}
          />
        </div>
        {/* Row 2: Min W + Min H */}
        <div style={{ display: "flex", gap: "4px", padding: "2px 12px" }}>
          <SizeInputCell
            label="Min W"
            value={minWidth}
            unit={minWidthUnit}
            units={SIZE_UNITS_W}
            keyword={null}
            onValueChange={handleMinWidthChange}
            onUnitChange={(u) => { const c = convertUnit(minWidth, minWidthUnit, u, getConversionCtx(), "width"); setMinWidth(c); setMinWidthUnit(u); apply("min-width", `${c}${u}`); }}
            onKeywordChange={() => {}}
            isModified={isDirty(element, "min-width")}
            min={0}
            max={1920}
          />
          <SizeInputCell
            label="Min H"
            value={minHeight}
            unit={minHeightUnit}
            units={SIZE_UNITS_H}
            keyword={null}
            onValueChange={handleMinHeightChange}
            onUnitChange={(u) => { const c = convertUnit(minHeight, minHeightUnit, u, getConversionCtx(), "height"); setMinHeight(c); setMinHeightUnit(u); apply("min-height", `${c}${u}`); }}
            onKeywordChange={() => {}}
            isModified={isDirty(element, "min-height")}
            min={0}
            max={1200}
          />
        </div>
        {/* Row 3: Max W + Max H */}
        <div style={{ display: "flex", gap: "4px", padding: "2px 12px" }}>
          <SizeInputCell
            label="Max W"
            value={maxWidth}
            unit={maxWidthUnit}
            units={SIZE_UNITS_W}
            keyword={maxWidthNone ? "none" : null}
            onValueChange={handleMaxWidthChange}
            onUnitChange={(u) => { const c = convertUnit(maxWidth, maxWidthUnit, u, getConversionCtx(), "width"); setMaxWidth(c); setMaxWidthUnit(u); apply("max-width", c === 0 ? "none" : `${c}${u}`); }}
            onKeywordChange={(k) => { setMaxWidthNone(k === "none"); apply("max-width", k === "none" ? "none" : `${maxWidth}${maxWidthUnit}`); }}
            isModified={isDirty(element, "max-width")}
            supportsNone
            min={0}
            max={1920}
          />
          <SizeInputCell
            label="Max H"
            value={maxHeight}
            unit={maxHeightUnit}
            units={SIZE_UNITS_H}
            keyword={maxHeightNone ? "none" : null}
            onValueChange={handleMaxHeightChange}
            onUnitChange={(u) => { const c = convertUnit(maxHeight, maxHeightUnit, u, getConversionCtx(), "height"); setMaxHeight(c); setMaxHeightUnit(u); apply("max-height", c === 0 ? "none" : `${c}${u}`); }}
            onKeywordChange={(k) => { setMaxHeightNone(k === "none"); apply("max-height", k === "none" ? "none" : `${maxHeight}${maxHeightUnit}`); }}
            isModified={isDirty(element, "max-height")}
            supportsNone
            min={0}
            max={1200}
          />
        </div>
        {/* Overflow: icon button row */}
        {overflowLocked ? (
          <div style={{ display: "flex", alignItems: "center", gap: "6px", padding: "4px 12px" }}>
            <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.5)", flexShrink: 0, width: "48px" }}>Overflow</span>
            <IconButtonGroup options={OVERFLOW_ICON_OPTIONS} value={overflow} onChange={handleOverflowChange} />
            <button onClick={handleOverflowLockToggle} title="Per-axis overflow" style={{ width: "20px", height: "20px", display: "flex", alignItems: "center", justifyContent: "center", background: "transparent", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.4)", fontSize: "10px", borderRadius: "3px", flexShrink: 0 }}><Link size={12} strokeWidth={1.5} /></button>
          </div>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", padding: "4px 12px" }}>
              <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.5)", flexShrink: 0, width: "48px" }}>Over X</span>
              <IconButtonGroup options={OVERFLOW_ICON_OPTIONS} value={overflowX} onChange={handleOverflowXChange} />
              <button onClick={handleOverflowLockToggle} title="Lock overflow" style={{ width: "20px", height: "20px", display: "flex", alignItems: "center", justifyContent: "center", background: "transparent", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.25)", fontSize: "10px", borderRadius: "3px", flexShrink: 0 }}><Link size={12} strokeWidth={1.5} /></button>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", padding: "4px 12px" }}>
              <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.5)", flexShrink: 0, width: "48px" }}>Over Y</span>
              <IconButtonGroup options={OVERFLOW_ICON_OPTIONS} value={overflowY} onChange={handleOverflowYChange} />
            </div>
          </>
        )}
        <div onClick={() => setShowMoreSize(!showMoreSize)} style={{ padding: "6px 12px", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <ChevronRight size={9} strokeWidth={2} style={{ color: "rgba(255,255,255,0.35)", transition: "transform 150ms", transform: showMoreSize ? "rotate(90deg)" : "rotate(0deg)" }} />
          <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "0.04em" }}>More size options</span>
        </div>
        {showMoreSize && (
          <>
            <TextRow label="Ratio" value={aspectRatio} placeholder="16 / 9" onChange={handleAspectRatioChange} />
            <div style={{ padding: "4px 12px", display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ width: "64px", fontSize: "11px", color: "rgba(255,255,255,0.5)", flexShrink: 0 }}>Box Size</span>
              <IconButtonGroup
                options={BOX_SIZING_OPTIONS}
                value={boxSizing}
                onChange={handleBoxSizingChange}
              />
            </div>
            {isMedia && (
              <>
                <SelectRow label="Fit" value={objectFit} options={OBJECT_FIT_OPTIONS} onChange={handleObjectFitChange} />
                <SelectRow label="Obj Pos" value={objectPosition} options={OBJECT_POSITION_OPTIONS} onChange={handleObjectPositionChange} />
              </>
            )}
          </>
        )}
      </Section>

      {/* 4. Position */}
      <Section title="Position" collapsed={position === "static"}>
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
                const axis = (prop === "top" || prop === "bottom") ? "height" as const : "width" as const;
                if (prop === "top") { const c = convertUnit(top, topUnit, unit, getConversionCtx(),axis); setTop(c); setTopUnit(unit); apply("top", `${c}${unit}`); }
                else if (prop === "right") { const c = convertUnit(right, rightUnit, unit, getConversionCtx(),axis); setRight(c); setRightUnit(unit); apply("right", `${c}${unit}`); }
                else if (prop === "bottom") { const c = convertUnit(bottom, bottomUnit, unit, getConversionCtx(),axis); setBottom(c); setBottomUnit(unit); apply("bottom", `${c}${unit}`); }
                else if (prop === "left") { const c = convertUnit(left, leftUnit, unit, getConversionCtx(),axis); setLeft(c); setLeftUnit(unit); apply("left", `${c}${unit}`); }
              }}
            />
            <SliderRow label="Z-Index" value={zIndex} min={-10} max={9999} step={1} unit="" onChange={handleZIndexChange} onReset={() => resetCss("z-index", setZIndex)} indicator={ind("z-index")} />
          </>
        )}
        <SelectRow label="Float" value={float_} options={FLOAT_OPTIONS} onChange={handleFloatChange} indicator={ind("float")} />
        <SelectRow label="Clear" value={clear_} options={CLEAR_OPTIONS} onChange={handleClearChange} indicator={ind("clear")} />
      </Section>

      {/* 5. Typography */}
      {showTypography && (
        <Section title="Typography">
          {/* Font family dropdown */}
          <SelectRow label="Font" value={fontFamily} options={fontOptions} onChange={handleFontFamilyChange} indicator={ind("font-family")} />

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
              unit={lineHeightUnit === "—" ? "–" : lineHeightUnit}
              units={LINE_HEIGHT_UNITS}
              onUnitChange={(u) => { if (lineHeightUnit !== "—" && u !== "—") { const c = convertUnit(lineHeight, lineHeightUnit, u, getConversionCtx()); setLineHeight(c); } setLineHeightUnit(u); }}
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
            <IconButtonGroup options={TEXT_DECORATION_OPTIONS} value={textDecoration} onChange={handleTextDecorationChange} />
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
                transition: "background 80ms",
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.08)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)"; }}
            >
              <ChevronRight size={10} strokeWidth={2} style={{ transition: "transform 150ms", transform: showTypoAdvanced ? "rotate(90deg)" : "rotate(0deg)" }} />
              More type options
            </button>
          </div>

          {showTypoAdvanced && (
            <>
              {/* Letter spacing + Text indent + Columns — compact row with labels below */}
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
                        outline: "none", transition: "background 80ms, color 80ms",
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
                    lineHeight: 1, outline: "none", transition: "background 80ms",
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
      )}

      {/* 6. Backgrounds */}
      <Section title="Backgrounds">
        {bgLayers.length > 0 ? (
          <div style={{ padding: "0 12px" }}>
            <BackgroundLayerList layers={bgLayers} onChange={handleBgLayersChange} />
          </div>
        ) : (
          <ColorRow label="Color" value={bgColor} onChange={handleBgColorChange} indicator={ind("background-color")} />
        )}
        <SelectRow label="Clip" value={bgClip} options={BG_CLIP_OPTIONS} onChange={handleBgClipChange} indicator={ind("background-clip")} />
      </Section>

      {/* 7. Borders */}
      <Section title="Borders">
        <SideSelector value={borderSide} onChange={setBorderSide} />
        <SelectRow label="Style" value={borderStyle} options={BORDER_STYLE_OPTIONS} onChange={handleBorderStyleChange} indicator={ind("border-style")} />
        <SliderRow label="Width" value={borderWidth} min={0} max={20} step={1} unit={borderWidthUnit} units={BORDER_UNITS} onUnitChange={(u) => { const c = convertUnit(borderWidth, borderWidthUnit, u, getConversionCtx()); setBorderWidth(c); setBorderWidthUnit(u); apply("border-width", `${c}${u}`); }} onChange={handleBorderWidthChange} onReset={() => resetCss("border-width", setBorderWidth)} indicator={ind("border-width")} />
        <ColorRow label="Color" value={borderColor} onChange={handleBorderColorChange} indicator={ind("border-color")} />
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

      {/* 8. Effects */}
      <Section title="Effects">
        <SliderRow label="Opacity" value={Math.round(opacity * 100)} min={0} max={100} step={1} unit="%" onChange={handleOpacitySliderChange} onReset={() => { resetProp(element, "opacity"); const fresh = parseFloat(getComputedStyle(element).opacity) || 1; setOpacity(fresh); onDirtyChange?.(); }} indicator={ind("opacity")} />
        <SelectRow label="Blend" value={mixBlendMode} options={BLEND_MODE_OPTIONS} onChange={handleMixBlendModeChange} indicator={ind("mix-blend-mode")} />

        <div style={{ padding: "8px 12px 0", fontSize: "10px", color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
          Box Shadow
        </div>
        <ShadowEditor shadows={shadows} onChange={handleShadowsChange} />

        <div style={{ padding: "8px 12px 0", fontSize: "10px", color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
          Transform
        </div>
        <div style={{ padding: "4px 12px" }}>
          <TransformEditor
            transforms={transforms}
            onChange={handleTransformsChange}
            origin={transformOrigin}
            onOriginChange={handleTransformOriginChange}
          />
        </div>

        <div style={{ padding: "4px 12px" }}>
          <FilterSliders values={filterValues} onChange={handleFilterChange} type="filter" />
        </div>

        <div style={{ padding: "4px 12px" }}>
          <FilterSliders values={backdropFilterValues} onChange={handleBackdropFilterChange} type="backdrop-filter" />
        </div>

        <div style={{ padding: "8px 12px 0", fontSize: "10px", color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
          Transition
        </div>
        <div style={{ padding: "4px 12px" }}>
          <TransitionEditor transitions={transitions} onChange={handleTransitionsChange} />
        </div>

        <SelectRow label="Cursor" value={cursor} options={CURSOR_OPTIONS} onChange={handleCursorChange} indicator={ind("cursor")} />
        <SelectRow label="Pointer" value={pointerEvents} options={POINTER_EVENTS_OPTIONS} onChange={handlePointerEventsChange} indicator={ind("pointer-events")} />
        <SelectRow label="Visibility" value={visibility} options={VISIBILITY_OPTIONS} onChange={handleVisibilityChange} indicator={ind("visibility")} />
        <SelectRow label="User Sel" value={userSelect} options={USER_SELECT_OPTIONS} onChange={handleUserSelectChange} indicator={ind("user-select")} />
        <SliderRow label="Perspect" value={perspective} min={0} max={2000} step={10} unit="px" onChange={handlePerspectiveChange} onReset={() => resetCss("perspective", setPerspective)} indicator={ind("perspective")} />
        <SelectRow label="Backface" value={backfaceVisibility} options={BACKFACE_OPTIONS} onChange={handleBackfaceVisibilityChange} indicator={ind("backface-visibility")} />
      </Section>
    </div>
  );
}
