import { useState, useCallback } from "react";
import { parseNum } from "../cssHelpers";

export function useSizeState(cs: Record<string, string>, apply: (prop: string, value: string) => void) {
  const [width, setWidth] = useState(() => parseNum(cs.width));
  const [height, setHeight] = useState(() => parseNum(cs.height));
  const [minWidth, setMinWidth] = useState(() => parseNum(cs.minWidth));
  const [maxWidth, setMaxWidth] = useState(() => parseNum(cs.maxWidth === "none" ? "0" : cs.maxWidth));
  const [minHeight, setMinHeight] = useState(() => parseNum(cs.minHeight));
  const [maxHeight, setMaxHeight] = useState(() => parseNum(cs.maxHeight === "none" ? "0" : cs.maxHeight));
  const [overflow, setOverflow] = useState(() => cs.overflow.split(" ")[0] || "visible");
  const [aspectRatio, setAspectRatio] = useState(() => cs.aspectRatio === "auto" ? "" : cs.aspectRatio);
  const [objectFit, setObjectFit] = useState(() => cs.objectFit);
  const [objectPosition, setObjectPosition] = useState(() => cs.objectPosition);
  const [widthUnit, setWidthUnit] = useState("px");
  const [heightUnit, setHeightUnit] = useState("px");
  const [minWidthUnit, setMinWidthUnit] = useState("px");
  const [maxWidthUnit, setMaxWidthUnit] = useState("px");
  const [minHeightUnit, setMinHeightUnit] = useState("px");
  const [maxHeightUnit, setMaxHeightUnit] = useState("px");
  const [widthAuto, setWidthAuto] = useState(() => cs.width === "auto");
  const [heightAuto, setHeightAuto] = useState(() => cs.height === "auto");
  const [maxWidthNone, setMaxWidthNone] = useState(() => cs.maxWidth === "none");
  const [maxHeightNone, setMaxHeightNone] = useState(() => cs.maxHeight === "none");

  const handleWidthChange = useCallback((v: number) => { setWidth(v); apply("width", `${v}${widthUnit}`); }, [apply, widthUnit]);
  const handleHeightChange = useCallback((v: number) => { setHeight(v); apply("height", `${v}${heightUnit}`); }, [apply, heightUnit]);
  const handleMinWidthChange = useCallback((v: number) => { setMinWidth(v); apply("min-width", `${v}${minWidthUnit}`); }, [apply, minWidthUnit]);
  const handleMaxWidthChange = useCallback((v: number) => { setMaxWidth(v); apply("max-width", v === 0 ? "none" : `${v}${maxWidthUnit}`); }, [apply, maxWidthUnit]);
  const handleMinHeightChange = useCallback((v: number) => { setMinHeight(v); apply("min-height", `${v}${minHeightUnit}`); }, [apply, minHeightUnit]);
  const handleMaxHeightChange = useCallback((v: number) => { setMaxHeight(v); apply("max-height", v === 0 ? "none" : `${v}${maxHeightUnit}`); }, [apply, maxHeightUnit]);
  const handleOverflowChange = useCallback((v: string) => { setOverflow(v); apply("overflow", v); }, [apply]);
  const handleAspectRatioChange = useCallback((v: string) => { setAspectRatio(v); apply("aspect-ratio", v || "auto"); }, [apply]);
  const handleObjectFitChange = useCallback((v: string) => { setObjectFit(v); apply("object-fit", v); }, [apply]);
  const handleObjectPositionChange = useCallback((v: string) => { setObjectPosition(v); apply("object-position", v); }, [apply]);
  const handleWidthAutoToggle = useCallback(() => { const next = !widthAuto; setWidthAuto(next); apply("width", next ? "auto" : `${width}${widthUnit}`); }, [widthAuto, width, widthUnit, apply]);
  const handleHeightAutoToggle = useCallback(() => { const next = !heightAuto; setHeightAuto(next); apply("height", next ? "auto" : `${height}${heightUnit}`); }, [heightAuto, height, heightUnit, apply]);
  const handleMaxWidthNoneToggle = useCallback(() => { const next = !maxWidthNone; setMaxWidthNone(next); apply("max-width", next ? "none" : `${maxWidth}${maxWidthUnit}`); }, [maxWidthNone, maxWidth, maxWidthUnit, apply]);
  const handleMaxHeightNoneToggle = useCallback(() => { const next = !maxHeightNone; setMaxHeightNone(next); apply("max-height", next ? "none" : `${maxHeight}${maxHeightUnit}`); }, [maxHeightNone, maxHeight, maxHeightUnit, apply]);

  return {
    state: { width, height, minWidth, maxWidth, minHeight, maxHeight, overflow, aspectRatio, objectFit, objectPosition, widthUnit, heightUnit, minWidthUnit, maxWidthUnit, minHeightUnit, maxHeightUnit, widthAuto, heightAuto, maxWidthNone, maxHeightNone },
    handlers: { handleWidthChange, handleHeightChange, handleMinWidthChange, handleMaxWidthChange, handleMinHeightChange, handleMaxHeightChange, handleOverflowChange, handleAspectRatioChange, handleObjectFitChange, handleObjectPositionChange, handleWidthAutoToggle, handleHeightAutoToggle, handleMaxWidthNoneToggle, handleMaxHeightNoneToggle, setWidthUnit, setHeightUnit, setMinWidthUnit, setMaxWidthUnit, setMinHeightUnit, setMaxHeightUnit },
  };
}
