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

import { useState, useCallback, useEffect, useRef, memo } from "react";
import { createPortal } from "react-dom";
import { Section, SliderRow, SelectRow, NumberRow, useResetPopover, SubSectionHeader } from "../controls";
import { ShadowEditor, type ShadowValue } from "./ShadowEditor";
import { FilterSliders, type FilterValues } from "./FilterSliders";
import { TransformEditor, type TransformValue } from "./TransformEditor";
import { TransitionEditor, type TransitionValue } from "./TransitionEditor";
import { IconButtonGroup } from "../controls/IconButtonGroup";
import { resetProp, resetAndReadNum, resetAndReadStr } from "../core/apply";
import {
  parseNum,
  parseBoxShadow,
  parseFilter,
  parseTransform,
  parseSelfPerspective,
  parseTransitions,
  shadowToCSS,
  filterToCSS,
  transformToCSSWithPerspective,
  transitionsToCSS,
} from "../cssParsers";
import type { SectionCtx } from "../panelUtils";
import {
  BLEND_MODE_OPTIONS,
  CURSOR_OPTIONS,
  POINTER_EVENTS_OPTIONS,
  VISIBILITY_OPTIONS,
  USER_SELECT_OPTIONS,
  OUTLINE_STYLE_OPTIONS,
} from "../panelConstants";
import { color, text, border, surface, shadow, zIndex, type IndicatorType, indicatorStyle, altClickReset } from "../theme";
import { ms } from "../timing";
import { ROW, LABEL } from "../panelStyles";
import { useFocusTrap } from "../hooks/useFocusTrap";

// ─── Transition Options Menu (portal) ─────────────────────────────────

interface TransMenuItemDef {
  label: string;
  action: () => void;
  destructive?: boolean;
}

function TransitionOptionsMenu({ anchor, items, onClose }: {
  anchor: HTMLElement;
  items: TransMenuItemDef[];
  onClose: () => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  useFocusTrap(menuRef, true);

  // Position below anchor
  const rect = anchor.getBoundingClientRect();

  // Clamp to viewport after mount
  useEffect(() => {
    const el = menuRef.current;
    if (!el) return;
    const menuRect = el.getBoundingClientRect();
    let left = rect.left;
    let top = rect.bottom + 4;
    if (menuRect.right > window.innerWidth - 8) left = window.innerWidth - menuRect.width - 8;
    if (menuRect.bottom > window.innerHeight - 8) top = rect.top - menuRect.height - 4;
    if (left < 8) left = 8;
    if (top < 8) top = 8;
    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
  }, [rect.left, rect.bottom, rect.top]);

  // Close on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler, true);
    return () => document.removeEventListener("mousedown", handler, true);
  }, [onClose]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.stopPropagation(); onClose(); }
    };
    document.addEventListener("keydown", handler, true);
    return () => document.removeEventListener("keydown", handler, true);
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      role="menu"
      data-tuner-portal
      style={{
        position: "fixed",
        zIndex: zIndex.max,
        minWidth: 140,
        background: color.popover,
        color: text.primary,
        border: `1px solid ${border.default}`,
        borderRadius: 6,
        boxShadow: shadow.dropdown,
        padding: "4px 0",
        overflow: "hidden",
        left: rect.left,
        top: rect.bottom + 4,
      }}
    >
      {items.map((item) => (
        <TransMenuItem key={item.label} label={item.label} onClick={item.action} destructive={item.destructive} />
      ))}
    </div>
  );
}

function TransMenuItem({ label, onClick, destructive }: { label: string; onClick: () => void; destructive?: boolean }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      role="menuitem"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        alignItems: "center",
        padding: "6px 12px",
        fontSize: 12,
        cursor: "pointer",
        background: hovered ? surface.hover : "transparent",
        color: destructive ? color.destructive : text.primary,
        outline: "none",
        userSelect: "none",
        transition: `background ${ms("fast")}`,
      }}
    >
      {label}
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
  const [transMenuAnchor, setTransMenuAnchor] = useState<HTMLElement | null>(null);
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
  const [transformSettingsOpen, setTransformSettingsOpen] = useState(false);
  const [selfPerspective, setSelfPerspective] = useState(() => parseSelfPerspective(cs.transform));
  const [perspectiveOrigin, setPerspectiveOrigin] = useState(() => cs.getPropertyValue("perspective-origin") || "50% 50%");

  // Collapsed-by-default for filter sub-sections (auto-expand if element has values)
  const [filtersExpanded, setFiltersExpanded] = useState(() => {
    const f = cs.filter;
    return !!f && f !== "none" && f !== "";
  });
  const [backdropFiltersExpanded, setBackdropFiltersExpanded] = useState(() => {
    const f = cs.getPropertyValue("backdrop-filter") || cs.getPropertyValue("-webkit-backdrop-filter") || "";
    return !!f && f !== "none" && f !== "";
  });

  // ── Reset popover for Outline label ──
  const outlineResetPopover = useResetPopover(ind("outline-style"), () => resetCssStr("outline-style", setOutlineStyle));

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
      apply("transform", transformToCSSWithPerspective(t, selfPerspective));
    },
    [apply, selfPerspective],
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

  const handleSelfPerspectiveChange = useCallback(
    (v: number) => {
      setSelfPerspective(v);
      apply("transform", transformToCSSWithPerspective(transforms, v));
    },
    [apply, transforms],
  );

  const handlePerspectiveOriginChange = useCallback(
    (v: string) => { setPerspectiveOrigin(v); apply("perspective-origin", v); },
    [apply],
  );

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

  // ── Transition options menu items ────────────────────────────────────
  const allTransitionsHidden = transitions.length > 0 && transitions.every(t => !t.visible);
  const transMenuItems: TransMenuItemDef[] = [
    // Only show enable/disable toggle when there are transitions to toggle
    ...(transitions.length > 0 ? [{
      label: allTransitionsHidden ? "Enable All" : "Disable All",
      action: () => {
        handleTransitionsChange(transitions.map(t => ({ ...t, visible: allTransitionsHidden })));
        setTransMenuAnchor(null);
      },
    }] : []),
    {
      label: "Copy CSS",
      action: () => {
        navigator.clipboard.writeText(`transition: ${transitionsToCSS(transitions)};`).catch(() => {});
        setTransMenuAnchor(null);
      },
    },
    {
      label: "Remove All",
      action: () => {
        handleTransitionsChange([]);
        setTransMenuAnchor(null);
      },
      destructive: true,
    },
  ];

  // ── Render ─────────────────────────────────────────────────────────

  return (
    <Section title="Effects" indicator={sectionInd(["opacity", "box-shadow", "filter", "backdrop-filter", "mix-blend-mode", "transform", "transition", "cursor", "outline-style", "perspective", "backface-visibility", "pointer-events", "visibility", "user-select"])} forceOpen={forceOpen} focusOpen={focusOpen} onToggle={onToggle}>

      {/* 1. Blending (mix-blend-mode) */}
      <SelectRow label="Blending" value={mixBlendMode} options={BLEND_MODE_OPTIONS} onChange={handleMixBlendModeChange} onReset={() => resetCssStr("mix-blend-mode", setMixBlendMode)} indicator={ind("mix-blend-mode")} onContextMenu={ctxMenu("mix-blend-mode", mixBlendMode)} computedProp="mix-blend-mode" computedElement={element} />

      {/* 2. Opacity */}
      <SliderRow label="Opacity" value={Math.round(opacity * 100)} min={0} max={100} step={1} unit="%" onChange={handleOpacitySliderChange} onReset={() => { resetProp(element, "opacity"); const fresh = parseFloat(getComputedStyle(element).opacity) || 1; setOpacity(fresh); }} indicator={ind("opacity")} onContextMenu={ctxMenu("opacity", String(opacity))} computedProp="opacity" computedElement={element} property="opacity" onPreset={(v) => { const n = typeof v === "number" ? v : parseFloat(String(v)); if (!isNaN(n)) handleOpacityChange(n); }} />

      {/* 3. Outline */}
      <div style={ROW}>
        <span
          ref={outlineResetPopover.anchorRef}
          style={{ ...LABEL, cursor: ind("outline-style") === "modified" ? "pointer" : "default" }}
          title={ind("outline-style") !== "none" ? "Click to reset" : undefined}
          onClick={(e) => { if (e.altKey) { resetCssStr("outline-style", setOutlineStyle); return; } outlineResetPopover.triggerOpen(); }}
        >
          <span style={indicatorStyle(ind("outline-style"))}>
            Outline
          </span>
        </span>
        <IconButtonGroup options={OUTLINE_STYLE_OPTIONS} value={outlineStyle} onChange={handleOutlineStyleChange} aria-label="Outline style" />
        {outlineResetPopover.node}
      </div>

      {/* 4. Box shadows */}
      <SubSectionHeader label="Box shadows" onAdd={handleAddShadow} indicator={ind("box-shadow")} onReset={() => { resetProp(element, "box-shadow"); setShadows(parseBoxShadow(getComputedStyle(element).boxShadow)); }} />
      {shadows.length > 0 && (
        <ShadowEditor shadows={shadows} onChange={handleShadowsChange} />
      )}

      {/* 5. 2D & 3D transforms */}
      <SubSectionHeader
        label="2D & 3D transforms"
        onAdd={handleAddTransform}
        onMenu={() => setTransformSettingsOpen((o) => !o)}
        indicator={ind("transform")}
        onReset={() => {
          resetProp(element, "transform");
          resetProp(element, "transform-origin");
          resetProp(element, "perspective");
          resetProp(element, "backface-visibility");
          resetProp(element, "perspective-origin");
          const fresh = getComputedStyle(element);
          setTransforms(parseTransform(fresh.transform));
          setTransformOrigin(fresh.transformOrigin || "center");
          setPerspective(parseNum(fresh.getPropertyValue("perspective")));
          setBackfaceVisibility(fresh.getPropertyValue("backface-visibility") || "visible");
          setPerspectiveOrigin(fresh.getPropertyValue("perspective-origin") || "50% 50%");
          setSelfPerspective(parseSelfPerspective(fresh.transform));
        }}
      />
      {(transforms.length > 0 || transformSettingsOpen) && (
        <div style={{ padding: "4px 12px" }}>
          <TransformEditor
            transforms={transforms}
            onChange={handleTransformsChange}
            origin={transformOrigin}
            onOriginChange={handleTransformOriginChange}
            backfaceVisibility={backfaceVisibility}
            onBackfaceChange={handleBackfaceVisibilityChange}
            selfPerspective={selfPerspective}
            onSelfPerspectiveChange={handleSelfPerspectiveChange}
            childrenPerspective={perspective}
            onChildrenPerspectiveChange={handlePerspectiveChange}
            perspectiveOrigin={perspectiveOrigin}
            onPerspectiveOriginChange={handlePerspectiveOriginChange}
            settingsOpen={transformSettingsOpen}
          />
        </div>
      )}

      {/* 6. Transitions */}
      <SubSectionHeader label="Transitions" onAdd={handleAddTransition} onMenu={(e) => setTransMenuAnchor(e.currentTarget)} indicator={ind("transition")} onReset={() => { resetProp(element, "transition"); setTransitions(parseTransitions(getComputedStyle(element))); }} />
      {transitions.length > 0 && (
        <div style={{ padding: "4px 12px" }}>
          <TransitionEditor transitions={transitions} onChange={handleTransitionsChange} element={element} />
        </div>
      )}

      {/* 7. Filters */}
      <SubSectionHeader label="Filters" onAdd={() => setFiltersExpanded(true)} indicator={ind("filter")} onReset={() => { resetProp(element, "filter"); setFilterValues(parseFilter(getComputedStyle(element).filter)); }} />
      {filtersExpanded && (
        <div style={{ padding: "4px 12px" }}>
          <FilterSliders values={filterValues} onChange={handleFilterChange} type="filter" />
        </div>
      )}

      {/* 8. Backdrop filters */}
      <SubSectionHeader label="Backdrop filters" onAdd={() => setBackdropFiltersExpanded(true)} indicator={ind("backdrop-filter")} onReset={() => { resetProp(element, "backdrop-filter"); const fresh = getComputedStyle(element); setBackdropFilterValues(parseFilter(fresh.getPropertyValue("backdrop-filter") || fresh.getPropertyValue("-webkit-backdrop-filter") || "")); }} />
      {backdropFiltersExpanded && (
        <div style={{ padding: "4px 12px" }}>
          <FilterSliders values={backdropFilterValues} onChange={handleBackdropFilterChange} type="backdrop-filter" />
        </div>
      )}

      {/* ── Interaction controls ── */}
      <SubSectionHeader label="Other" />

      <SelectRow label="Cursor" value={cursor} options={CURSOR_OPTIONS} onChange={handleCursorChange} onReset={() => resetCssStr("cursor", setCursor)} indicator={ind("cursor")} onContextMenu={ctxMenu("cursor", cursor)} computedProp="cursor" computedElement={element} />
      <SelectRow label="Pointer" value={pointerEvents} options={POINTER_EVENTS_OPTIONS} onChange={handlePointerEventsChange} onReset={() => resetCssStr("pointer-events", setPointerEvents)} indicator={ind("pointer-events")} onContextMenu={ctxMenu("pointer-events", pointerEvents)} computedProp="pointer-events" computedElement={element} />
      <SelectRow label="Visibility" value={visibility} options={VISIBILITY_OPTIONS} onChange={handleVisibilityChange} onReset={() => resetCssStr("visibility", setVisibility)} indicator={ind("visibility")} onContextMenu={ctxMenu("visibility", visibility)} computedProp="visibility" computedElement={element} />
      <SelectRow label="Selection" value={userSelect} options={USER_SELECT_OPTIONS} onChange={handleUserSelectChange} onReset={() => resetCssStr("user-select", setUserSelect)} indicator={ind("user-select")} onContextMenu={ctxMenu("user-select", userSelect)} computedProp="user-select" computedElement={element} />

      {/* Transition options menu portal */}
      {transMenuAnchor && createPortal(
        <TransitionOptionsMenu
          anchor={transMenuAnchor}
          items={transMenuItems}
          onClose={() => setTransMenuAnchor(null)}
        />,
        document.body
      )}
    </Section>
  );
});
