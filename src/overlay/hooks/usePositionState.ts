import { useState, useCallback } from "react";
import { parseNum } from "../cssHelpers";

export function usePositionState(cs: Record<string, string>, apply: (prop: string, value: string) => void) {
  const [position, setPosition] = useState(() => cs.position);
  const [top, setTop] = useState(() => parseNum(cs.top));
  const [right, setRight] = useState(() => parseNum(cs.right));
  const [bottom, setBottom] = useState(() => parseNum(cs.bottom));
  const [left, setLeft] = useState(() => parseNum(cs.left));
  const [zIndex, setZIndex] = useState(() => parseInt(cs.zIndex) || 0);
  const [float_, setFloat] = useState(() => cs.cssFloat || "none");
  const [clear_, setClear] = useState(() => cs.clear || "none");
  const [topUnit, setTopUnit] = useState("px");
  const [rightUnit, setRightUnit] = useState("px");
  const [bottomUnit, setBottomUnit] = useState("px");
  const [leftUnit, setLeftUnit] = useState("px");

  const handlePositionChange = useCallback((v: string) => { setPosition(v); apply("position", v); }, [apply]);
  const handleTopChange = useCallback((v: number) => { setTop(v); apply("top", `${v}${topUnit}`); }, [apply, topUnit]);
  const handleRightChange = useCallback((v: number) => { setRight(v); apply("right", `${v}${rightUnit}`); }, [apply, rightUnit]);
  const handleBottomChange = useCallback((v: number) => { setBottom(v); apply("bottom", `${v}${bottomUnit}`); }, [apply, bottomUnit]);
  const handleLeftChange = useCallback((v: number) => { setLeft(v); apply("left", `${v}${leftUnit}`); }, [apply, leftUnit]);
  const handleZIndexChange = useCallback((v: number) => { setZIndex(v); apply("z-index", String(v)); }, [apply]);
  const handleFloatChange = useCallback((v: string) => { setFloat(v); apply("float", v); }, [apply]);
  const handleClearChange = useCallback((v: string) => { setClear(v); apply("clear", v); }, [apply]);
  const handleOffsetUnitChange = useCallback((prop: string, unit: string) => {
    if (prop === "top") setTopUnit(unit);
    else if (prop === "right") setRightUnit(unit);
    else if (prop === "bottom") setBottomUnit(unit);
    else if (prop === "left") setLeftUnit(unit);
  }, []);

  return {
    state: { position, top, right, bottom, left, zIndex, float_, clear_, topUnit, rightUnit, bottomUnit, leftUnit },
    handlers: { handlePositionChange, handleTopChange, handleRightChange, handleBottomChange, handleLeftChange, handleZIndexChange, handleFloatChange, handleClearChange, handleOffsetUnitChange, setTopUnit, setRightUnit, setBottomUnit, setLeftUnit },
  };
}
