/**
 * EffectsSection.tsx — Effects section extracted from WebflowPanel.tsx
 *
 * Handles opacity, blend mode, box-shadow, transform, filters,
 * backdrop-filter, transitions, cursor, and interaction properties.
 */

import { useState, useCallback, memo } from "react";
import { Section, SliderRow, SelectRow } from "./controls";
import { ShadowEditor, type ShadowValue } from "./ShadowEditor";
import { FilterSliders, type FilterValues } from "./FilterSliders";
import { TransformEditor, type TransformValue } from "./TransformEditor";
import { TransitionEditor, type TransitionValue } from "./TransitionEditor";
import { resetProp, resetAndReadNum, resetAndReadStr } from "./apply";
import {
  parseNum,
  parseBoxShadow,
  parseFilter,
  parseTransform,
  parseTransitions,
  shadowToCSS,
  filterToCSS,
  transformToCSS,
  transitionsToCSS,
} from "./cssParsers";
import type { SectionCtx } from "./panelUtils";
import {
  BLEND_MODE_OPTIONS,
  CURSOR_OPTIONS,
  POINTER_EVENTS_OPTIONS,
  VISIBILITY_OPTIONS,
  USER_SELECT_OPTIONS,
  BACKFACE_OPTIONS,
} from "./panelConstants";

const SUB_HEADER_CLASS = "px-3 pt-2 text-[10px] text-[var(--muted-foreground)] uppercase tracking-wider";

// ─── Props ───────────────────────────────────────────────────────────

interface EffectsSectionProps {
  ctx: SectionCtx;
  forceOpen?: boolean;
  focusOpen?: boolean;
  onToggle?: (title: string) => void;
}

// ─── Component ───────────────────────────────────────────────────────

export const EffectsSection = memo(function EffectsSection({ ctx, forceOpen, focusOpen, onToggle }: EffectsSectionProps) {
  const { element, apply, ind, sectionInd, cs, ctxMenu } = ctx;

  // ── State ──────────────────────────────────────────────────────────
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

  const resetCss = (prop: string, setter: (v: number) => void) => setter(resetAndReadNum(element, prop));
  const resetCssStr = (prop: string, setter: (v: string) => void) => setter(resetAndReadStr(element, prop));

  // ── Handlers ───────────────────────────────────────────────────────
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

  // ── Render ─────────────────────────────────────────────────────────

  return (
    <Section title="Effects" indicator={sectionInd(["opacity", "box-shadow", "filter", "backdrop-filter", "mix-blend-mode", "transform", "transition", "cursor"])} forceOpen={forceOpen} focusOpen={focusOpen} onToggle={onToggle}>
      <SliderRow label="Opacity" value={Math.round(opacity * 100)} min={0} max={100} step={1} unit="%" onChange={handleOpacitySliderChange} onReset={() => { resetProp(element, "opacity"); const fresh = parseFloat(getComputedStyle(element).opacity) || 1; setOpacity(fresh); }} indicator={ind("opacity")} onContextMenu={ctxMenu("opacity", String(opacity))} computedProp="opacity" computedElement={element} property="opacity" onPreset={(v) => { const n = parseFloat(v); if (!isNaN(n)) handleOpacityChange(n); }} />
      <SelectRow label="Mix Blend" value={mixBlendMode} options={BLEND_MODE_OPTIONS} onChange={handleMixBlendModeChange} onReset={() => resetCssStr("mix-blend-mode", setMixBlendMode)} indicator={ind("mix-blend-mode")} onContextMenu={ctxMenu("mix-blend-mode", mixBlendMode)} computedProp="mix-blend-mode" computedElement={element} />

      <div className={SUB_HEADER_CLASS}>
        Box Shadow
      </div>
      <ShadowEditor shadows={shadows} onChange={handleShadowsChange} />

      <div className={SUB_HEADER_CLASS}>
        Transform
      </div>
      <div className="px-3 py-1">
        <TransformEditor
          transforms={transforms}
          onChange={handleTransformsChange}
          origin={transformOrigin}
          onOriginChange={handleTransformOriginChange}
        />
      </div>
      <SliderRow label="Perspective" value={perspective} min={0} max={2000} step={10} unit="px" onChange={handlePerspectiveChange} onReset={() => resetCss("perspective", setPerspective)} indicator={ind("perspective")} onContextMenu={ctxMenu("perspective", `${perspective}px`)} computedProp="perspective" computedElement={element} />
      <SelectRow label="Backface" value={backfaceVisibility} options={BACKFACE_OPTIONS} onChange={handleBackfaceVisibilityChange} onReset={() => resetCssStr("backface-visibility", setBackfaceVisibility)} indicator={ind("backface-visibility")} onContextMenu={ctxMenu("backface-visibility", backfaceVisibility)} computedProp="backface-visibility" computedElement={element} />

      <div className={SUB_HEADER_CLASS}>
        Transition
      </div>
      <div className="px-3 py-1">
        <TransitionEditor transitions={transitions} onChange={handleTransitionsChange} element={element} />
      </div>

      <div className={SUB_HEADER_CLASS}>
        Filter
      </div>
      <div className="px-3 py-1">
        <FilterSliders values={filterValues} onChange={handleFilterChange} type="filter" />
      </div>

      <div className={SUB_HEADER_CLASS}>
        Backdrop Filter
      </div>
      <div className="px-3 py-1">
        <FilterSliders values={backdropFilterValues} onChange={handleBackdropFilterChange} type="backdrop-filter" />
      </div>

      <div className={SUB_HEADER_CLASS}>
        Cursor
      </div>
      <SelectRow label="Cursor" value={cursor} options={CURSOR_OPTIONS} onChange={handleCursorChange} onReset={() => resetCssStr("cursor", setCursor)} indicator={ind("cursor")} onContextMenu={ctxMenu("cursor", cursor)} computedProp="cursor" computedElement={element} />

      <div className={SUB_HEADER_CLASS}>
        Interaction
      </div>
      <SelectRow label="Pointer" value={pointerEvents} options={POINTER_EVENTS_OPTIONS} onChange={handlePointerEventsChange} onReset={() => resetCssStr("pointer-events", setPointerEvents)} indicator={ind("pointer-events")} onContextMenu={ctxMenu("pointer-events", pointerEvents)} computedProp="pointer-events" computedElement={element} />
      <SelectRow label="Visibility" value={visibility} options={VISIBILITY_OPTIONS} onChange={handleVisibilityChange} onReset={() => resetCssStr("visibility", setVisibility)} indicator={ind("visibility")} onContextMenu={ctxMenu("visibility", visibility)} computedProp="visibility" computedElement={element} />
      <SelectRow label="Selection" value={userSelect} options={USER_SELECT_OPTIONS} onChange={handleUserSelectChange} onReset={() => resetCssStr("user-select", setUserSelect)} indicator={ind("user-select")} onContextMenu={ctxMenu("user-select", userSelect)} computedProp="user-select" computedElement={element} />
    </Section>
  );
});
