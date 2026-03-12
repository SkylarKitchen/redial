/**
 * EffectsSection.tsx — Effects section extracted from WebflowPanel.tsx
 *
 * Handles blending, opacity, outline, box-shadow, transform, filters,
 * backdrop-filter, transitions, cursor, and interaction properties.
 *
 * Layout matches Webflow's Effects panel: top-level rows (Blending, Opacity,
 * Outline), collapsible sub-sections with "+" buttons (Box shadows, Transforms,
 * Transitions, Filters), then Cursor + secondary controls.
 */

import { useState, useCallback, memo } from "react";
import { Section, SliderRow, SelectRow } from "./controls";
import { ShadowEditor, type ShadowValue } from "./ShadowEditor";
import { FilterSliders, type FilterValues } from "./FilterSliders";
import { TransformEditor, type TransformValue } from "./TransformEditor";
import { TransitionEditor, type TransitionValue } from "./TransitionEditor";
import { IconButtonGroup } from "./IconButtonGroup";
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
  OUTLINE_STYLE_OPTIONS,
} from "./panelConstants";
import { Plus, MoreHorizontal } from "lucide-react";
import { color, text, font } from "./theme";
import { ms } from "./timing";

// ─── Sub-section header ───────────────────────────────────────────────

function SubSectionHeader({ label, onAdd, onMenu }: {
  label: string;
  onAdd?: () => void;
  onMenu?: () => void;
}) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "8px 12px 4px",
      background: color.background,
    }}>
      <span style={{ fontSize: "11px", fontFamily: font.sans, color: text.secondary, fontWeight: 500 }}>
        {label}
      </span>
      <div style={{ display: "flex", alignItems: "center", gap: "2px" }}
        onClick={(e) => e.stopPropagation()}>
        {onMenu && (
          <button
            onClick={onMenu}
            style={{
              background: "none", border: "none", cursor: "pointer", padding: "2px",
              color: text.disabled, display: "flex", alignItems: "center",
              borderRadius: "3px", transition: `color ${ms("fast")} ease`,
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = text.label; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = text.disabled; }}
          >
            <MoreHorizontal size={14} strokeWidth={1.5} />
          </button>
        )}
        {onAdd && (
          <button
            onClick={onAdd}
            style={{
              background: "none", border: "none", cursor: "pointer", padding: "2px",
              color: text.disabled, display: "flex", alignItems: "center",
              borderRadius: "3px", transition: `color ${ms("fast")} ease`,
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = text.label; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = text.disabled; }}
          >
            <Plus size={14} strokeWidth={1.5} />
          </button>
        )}
      </div>
    </div>
  );
}

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
  const [outlineStyle, setOutlineStyle] = useState(() => cs.outlineStyle || "none");
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
  const handleOutlineStyleChange = useCallback((v: string) => { setOutlineStyle(v); apply("outline-style", v); }, [apply]);
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

  // ── Add shortcuts (for sub-section "+" buttons) ────────────────────
  const handleAddShadow = useCallback(() => {
    handleShadowsChange([...shadows, { x: 0, y: 2, blur: 4, spread: 0, color: "rgba(0,0,0,0.1)", inset: false, visible: true }]);
  }, [shadows, handleShadowsChange]);

  const handleAddTransform = useCallback(() => {
    handleTransformsChange([...transforms, { type: "translate", x: 0, y: 0, z: 0 }]);
  }, [transforms, handleTransformsChange]);

  const handleAddTransition = useCallback(() => {
    handleTransitionsChange([...transitions, { property: "all", duration: 300, easing: "ease", delay: 0, visible: true }]);
  }, [transitions, handleTransitionsChange]);

  // ── Render ─────────────────────────────────────────────────────────

  return (
    <Section title="Effects" indicator={sectionInd(["opacity", "box-shadow", "filter", "backdrop-filter", "mix-blend-mode", "transform", "transition", "cursor", "outline-style"])} forceOpen={forceOpen} focusOpen={focusOpen} onToggle={onToggle}>

      {/* 1. Blending (mix-blend-mode) */}
      <SelectRow label="Blending" value={mixBlendMode} options={BLEND_MODE_OPTIONS} onChange={handleMixBlendModeChange} onReset={() => resetCssStr("mix-blend-mode", setMixBlendMode)} indicator={ind("mix-blend-mode")} onContextMenu={ctxMenu("mix-blend-mode", mixBlendMode)} computedProp="mix-blend-mode" computedElement={element} />

      {/* 2. Opacity */}
      <SliderRow label="Opacity" value={Math.round(opacity * 100)} min={0} max={100} step={1} unit="%" onChange={handleOpacitySliderChange} onReset={() => { resetProp(element, "opacity"); const fresh = parseFloat(getComputedStyle(element).opacity) || 1; setOpacity(fresh); }} indicator={ind("opacity")} onContextMenu={ctxMenu("opacity", String(opacity))} computedProp="opacity" computedElement={element} property="opacity" onPreset={(v) => { const n = parseFloat(v); if (!isNaN(n)) handleOpacityChange(n); }} />

      {/* 3. Outline */}
      <div style={{ display: "flex", alignItems: "center", padding: "2px 12px" }}>
        <span style={{ width: 64, fontSize: "11px", fontFamily: font.sans, color: text.label, flexShrink: 0 }}>
          Outline
        </span>
        <IconButtonGroup options={OUTLINE_STYLE_OPTIONS} value={outlineStyle} onChange={handleOutlineStyleChange} aria-label="Outline style" />
      </div>

      {/* 4. Box shadows */}
      <SubSectionHeader label="Box shadows" onAdd={handleAddShadow} />
      <ShadowEditor shadows={shadows} onChange={handleShadowsChange} />

      {/* 5. 2D & 3D transforms */}
      <SubSectionHeader label="2D & 3D transforms" onAdd={handleAddTransform} />
      <div className="px-3 py-1">
        <TransformEditor
          transforms={transforms}
          onChange={handleTransformsChange}
          origin={transformOrigin}
          onOriginChange={handleTransformOriginChange}
        />
      </div>

      {/* 6. Transitions */}
      <SubSectionHeader label="Transitions" onAdd={handleAddTransition} onMenu={() => { /* TODO: transition options menu */ }} />
      <div className="px-3 py-1">
        <TransitionEditor transitions={transitions} onChange={handleTransitionsChange} element={element} />
      </div>

      {/* 7. Filters */}
      <SubSectionHeader label="Filters" />
      <div className="px-3 py-1">
        <FilterSliders values={filterValues} onChange={handleFilterChange} type="filter" />
      </div>

      {/* 8. Cursor */}
      <SelectRow label="Cursor" value={cursor} options={CURSOR_OPTIONS} onChange={handleCursorChange} onReset={() => resetCssStr("cursor", setCursor)} indicator={ind("cursor")} onContextMenu={ctxMenu("cursor", cursor)} computedProp="cursor" computedElement={element} />

      {/* ── Secondary controls (below the fold) ── */}

      <SubSectionHeader label="Backdrop filter" />
      <div className="px-3 py-1">
        <FilterSliders values={backdropFilterValues} onChange={handleBackdropFilterChange} type="backdrop-filter" />
      </div>

      <SliderRow label="Perspective" value={perspective} min={0} max={2000} step={10} unit="px" onChange={handlePerspectiveChange} onReset={() => resetCss("perspective", setPerspective)} indicator={ind("perspective")} onContextMenu={ctxMenu("perspective", `${perspective}px`)} computedProp="perspective" computedElement={element} />
      <SelectRow label="Backface" value={backfaceVisibility} options={BACKFACE_OPTIONS} onChange={handleBackfaceVisibilityChange} onReset={() => resetCssStr("backface-visibility", setBackfaceVisibility)} indicator={ind("backface-visibility")} onContextMenu={ctxMenu("backface-visibility", backfaceVisibility)} computedProp="backface-visibility" computedElement={element} />
      <SelectRow label="Pointer" value={pointerEvents} options={POINTER_EVENTS_OPTIONS} onChange={handlePointerEventsChange} onReset={() => resetCssStr("pointer-events", setPointerEvents)} indicator={ind("pointer-events")} onContextMenu={ctxMenu("pointer-events", pointerEvents)} computedProp="pointer-events" computedElement={element} />
      <SelectRow label="Visibility" value={visibility} options={VISIBILITY_OPTIONS} onChange={handleVisibilityChange} onReset={() => resetCssStr("visibility", setVisibility)} indicator={ind("visibility")} onContextMenu={ctxMenu("visibility", visibility)} computedProp="visibility" computedElement={element} />
      <SelectRow label="Selection" value={userSelect} options={USER_SELECT_OPTIONS} onChange={handleUserSelectChange} onReset={() => resetCssStr("user-select", setUserSelect)} indicator={ind("user-select")} onContextMenu={ctxMenu("user-select", userSelect)} computedProp="user-select" computedElement={element} />
    </Section>
  );
});
