import { useState, useCallback } from "react";
import { parseNum } from "../cssHelpers";

export function useLayoutState(cs: Record<string, string>, apply: (prop: string, value: string) => void) {
  const [display, setDisplay] = useState(() => cs.display);
  const [flexDirection, setFlexDirection] = useState(() => cs.flexDirection);
  const [justifyContent, setJustifyContent] = useState(() => cs.justifyContent);
  const [alignItems, setAlignItems] = useState(() => cs.alignItems);
  const [flexWrap, setFlexWrap] = useState(() => cs.flexWrap);
  const [gap, setGap] = useState(() => parseNum(cs.gap));
  const [gridCols, setGridCols] = useState(() => cs.gridTemplateColumns === "none" ? "" : cs.gridTemplateColumns);
  const [gridRows, setGridRows] = useState(() => cs.gridTemplateRows === "none" ? "" : cs.gridTemplateRows);
  const [flexGrow, setFlexGrow] = useState(() => parseNum(cs.flexGrow));
  const [flexShrink, setFlexShrink] = useState(() => parseNum(cs.flexShrink));
  const [flexBasis, setFlexBasis] = useState(() => parseNum(cs.flexBasis));
  const [alignSelf, setAlignSelf] = useState(() => cs.alignSelf);
  const [flexOrder, setFlexOrder] = useState(() => parseNum(cs.order));

  const handleDisplayChange = useCallback((v: string) => { setDisplay(v); apply("display", v); }, [apply]);
  const handleFlexDirectionChange = useCallback((v: string) => { const dir = v === "none" ? "row" : v; setFlexDirection(dir); apply("flex-direction", dir); }, [apply]);
  const handleAlignChange = useCallback((justify: string, align: string) => { setJustifyContent(justify); setAlignItems(align); apply("justify-content", justify); apply("align-items", align); }, [apply]);
  const handleFlexWrapChange = useCallback((v: string) => { setFlexWrap(v); apply("flex-wrap", v); }, [apply]);
  const handleGapChange = useCallback((v: number) => { setGap(v); apply("gap", `${v}px`); }, [apply]);
  const handleGridColsChange = useCallback((v: string) => { setGridCols(v); if (v.trim()) apply("grid-template-columns", v); }, [apply]);
  const handleGridRowsChange = useCallback((v: string) => { setGridRows(v); if (v.trim()) apply("grid-template-rows", v); }, [apply]);
  const handleFlexGrowChange = useCallback((v: number) => { setFlexGrow(v); apply("flex-grow", String(v)); }, [apply]);
  const handleFlexShrinkChange = useCallback((v: number) => { setFlexShrink(v); apply("flex-shrink", String(v)); }, [apply]);
  const handleFlexBasisChange = useCallback((v: number) => { setFlexBasis(v); apply("flex-basis", `${v}px`); }, [apply]);
  const handleAlignSelfChange = useCallback((v: string) => { setAlignSelf(v); apply("align-self", v); }, [apply]);
  const handleFlexOrderChange = useCallback((v: number) => { setFlexOrder(v); apply("order", String(v)); }, [apply]);

  return {
    state: { display, flexDirection, justifyContent, alignItems, flexWrap, gap, gridCols, gridRows, flexGrow, flexShrink, flexBasis, alignSelf, flexOrder },
    handlers: { handleDisplayChange, handleFlexDirectionChange, handleAlignChange, handleFlexWrapChange, handleGapChange, handleGridColsChange, handleGridRowsChange, handleFlexGrowChange, handleFlexShrinkChange, handleFlexBasisChange, handleAlignSelfChange, handleFlexOrderChange },
  };
}
