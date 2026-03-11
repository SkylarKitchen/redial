import { useState, useCallback } from "react";
import { parseBoxShadow, parseFilter, parseTransform, parseTransitions, shadowToCSS, filterToCSS, transformToCSS, transitionsToCSS } from "../cssHelpers";
import type { ShadowValue } from "../ShadowEditor";
import type { FilterValues } from "../FilterSliders";
import type { TransformValue } from "../TransformEditor";
import type { TransitionValue } from "../TransitionEditor";

export function useEffectsState(cs: Record<string, string>, apply: (prop: string, value: string) => void) {
  const [opacity, setOpacity] = useState(() => parseFloat(cs.opacity) || 1);
  const [mixBlendMode, setMixBlendMode] = useState(() => cs.mixBlendMode);
  const [shadows, setShadows] = useState<ShadowValue[]>(() => parseBoxShadow(cs.boxShadow));
  const [transforms, setTransforms] = useState<TransformValue[]>(() => parseTransform(cs.transform));
  const [transformOrigin, setTransformOrigin] = useState(() => cs.transformOrigin || "center");
  const [filterValues, setFilterValues] = useState<Partial<FilterValues>>(() => parseFilter(cs.filter));
  const [backdropFilterValues, setBackdropFilterValues] = useState<Partial<FilterValues>>(() => parseFilter(cs.backdropFilter || ""));
  const [transitions, setTransitions] = useState<TransitionValue[]>(() => parseTransitions(cs));
  const [cursor, setCursor] = useState(() => cs.cursor);
  const [pointerEvents, setPointerEvents] = useState(() => cs.pointerEvents);
  const [visibility, setVisibility] = useState(() => cs.visibility);

  const handleOpacityChange = useCallback((v: number) => { setOpacity(v); apply("opacity", String(v)); }, [apply]);
  const handleOpacitySliderChange = useCallback((v: number) => handleOpacityChange(v / 100), [handleOpacityChange]);
  const handleMixBlendModeChange = useCallback((v: string) => { setMixBlendMode(v); apply("mix-blend-mode", v); }, [apply]);
  const handleShadowsChange = useCallback((s: ShadowValue[]) => { setShadows(s); apply("box-shadow", shadowToCSS(s)); }, [apply]);
  const handleTransformsChange = useCallback((t: TransformValue[]) => { setTransforms(t); apply("transform", transformToCSS(t)); }, [apply]);
  const handleTransformOriginChange = useCallback((o: string) => { setTransformOrigin(o); apply("transform-origin", o); }, [apply]);
  const handleFilterChange = useCallback((key: string, value: number) => { const next = { ...filterValues, [key]: value }; setFilterValues(next); apply("filter", filterToCSS(next)); }, [filterValues, apply]);
  const handleBackdropFilterChange = useCallback((key: string, value: number) => { const next = { ...backdropFilterValues, [key]: value }; setBackdropFilterValues(next); apply("backdrop-filter", filterToCSS(next)); }, [backdropFilterValues, apply]);
  const handleTransitionsChange = useCallback((t: TransitionValue[]) => { setTransitions(t); apply("transition", transitionsToCSS(t)); }, [apply]);
  const handleCursorChange = useCallback((v: string) => { setCursor(v); apply("cursor", v); }, [apply]);
  const handlePointerEventsChange = useCallback((v: string) => { setPointerEvents(v); apply("pointer-events", v); }, [apply]);
  const handleVisibilityChange = useCallback((v: string) => { setVisibility(v); apply("visibility", v); }, [apply]);

  return {
    state: { opacity, mixBlendMode, shadows, transforms, transformOrigin, filterValues, backdropFilterValues, transitions, cursor, pointerEvents, visibility },
    handlers: { handleOpacityChange, handleOpacitySliderChange, handleMixBlendModeChange, handleShadowsChange, handleTransformsChange, handleTransformOriginChange, handleFilterChange, handleBackdropFilterChange, handleTransitionsChange, handleCursorChange, handlePointerEventsChange, handleVisibilityChange },
  };
}
