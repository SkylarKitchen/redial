import { useState, useCallback } from "react";
import { rgbToHex, parseNum } from "../cssHelpers";

export function useBorderState(cs: Record<string, string>, apply: (prop: string, value: string) => void) {
  const [borderSide, setBorderSide] = useState<"all" | "top" | "right" | "bottom" | "left">("all");
  const [borderStyle, setBorderStyle] = useState(() => cs.borderStyle.split(" ")[0] || "none");
  const [borderWidth, setBorderWidth] = useState(() => parseNum(cs.borderWidth));
  const [borderColor, setBorderColor] = useState(() => rgbToHex(cs.borderColor));
  const [radiusTL, setRadiusTL] = useState(() => parseNum(cs.borderTopLeftRadius));
  const [radiusTR, setRadiusTR] = useState(() => parseNum(cs.borderTopRightRadius));
  const [radiusBR, setRadiusBR] = useState(() => parseNum(cs.borderBottomRightRadius));
  const [radiusBL, setRadiusBL] = useState(() => parseNum(cs.borderBottomLeftRadius));
  const [radiusLinked, setRadiusLinked] = useState(() => { const tl = parseNum(cs.borderTopLeftRadius); const tr = parseNum(cs.borderTopRightRadius); const br = parseNum(cs.borderBottomRightRadius); const bl = parseNum(cs.borderBottomLeftRadius); return tl === tr && tr === br && br === bl; });
  const [radiusUnit, setRadiusUnit] = useState("px");

  const handleBorderStyleChange = useCallback((v: string) => { setBorderStyle(v); const prop = borderSide === "all" ? "border-style" : `border-${borderSide}-style`; apply(prop, v); }, [apply, borderSide]);
  const handleBorderWidthChange = useCallback((v: number) => { setBorderWidth(v); const prop = borderSide === "all" ? "border-width" : `border-${borderSide}-width`; apply(prop, `${v}px`); }, [apply, borderSide]);
  const handleBorderColorChange = useCallback((v: string) => { setBorderColor(v); const prop = borderSide === "all" ? "border-color" : `border-${borderSide}-color`; apply(prop, v); }, [apply, borderSide]);
  const handleCornerChange = useCallback((corner: string, value: number) => { apply(corner, `${value}${radiusUnit}`); if (corner === "border-top-left-radius") setRadiusTL(value); else if (corner === "border-top-right-radius") setRadiusTR(value); else if (corner === "border-bottom-right-radius") setRadiusBR(value); else if (corner === "border-bottom-left-radius") setRadiusBL(value); }, [apply, radiusUnit]);

  return {
    state: { borderSide, borderStyle, borderWidth, borderColor, radiusTL, radiusTR, radiusBR, radiusBL, radiusLinked, radiusUnit },
    handlers: { handleBorderStyleChange, handleBorderWidthChange, handleBorderColorChange, handleCornerChange, setBorderSide, setRadiusLinked, setRadiusUnit },
  };
}
