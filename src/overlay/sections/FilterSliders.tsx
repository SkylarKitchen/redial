/**
 * FilterSliders.tsx — Webflow-style filter editor
 *
 * Renders an ordered list of collapsible filter items. Each item shows
 * a summary row when collapsed ("Blur: 5px") and expands to reveal
 * type dropdown + parameter sliders. Categorized add dropdown groups
 * filters into General, Color Adjustments, and Color Effects.
 *
 * Follows the ShadowEditor pattern: useDragReorder, DragHandle,
 * VisibilityToggle, EditorRemoveButton per item.
 */

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useDragReorder } from "../hooks/useDragReorder";
import { useClickOutside } from "../hooks/useClickOutside";
import { DragHandle } from "../shell/DragHandle";
import { SwatchColorPicker } from "../controls/SwatchColorPicker";
import { hexToRgba } from "../colorUtils";
import { EditorRemoveButton, VisibilityToggle, AnimatedListItem } from "../controls";
import { color, text, surface, font, shadow, zIndex, border, primaryAlpha, blackAlpha, filledTrackBg, focusBorder } from "../theme";
import { ms } from "../timing";

// ─── Types ──────────────────────────────────────────────────────────

export type FilterType =
  | "blur"
  | "drop-shadow"
  | "brightness"
  | "contrast"
  | "hue-rotate"
  | "saturate"
  | "grayscale"
  | "invert"
  | "sepia";

export interface FilterItem {
  type: FilterType;
  values: number[];    // [radius] for simple, [x, y, blur] for drop-shadow
  color?: string;      // only for drop-shadow
  visible: boolean;
  expanded: boolean;
}

// ─── Filter metadata ────────────────────────────────────────────────

interface FilterMeta {
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  defaultValues: number[];
  paramLabels: string[];
  defaultColor?: string;
}

const FILTER_META: Record<FilterType, FilterMeta> = {
  blur: { label: "Blur", unit: "px", min: 0, max: 50, step: 0.5, defaultValues: [0], paramLabels: ["Radius"] },
  "drop-shadow": { label: "Drop Shadow", unit: "px", min: -100, max: 100, step: 1, defaultValues: [0, 2, 4], paramLabels: ["X", "Y", "Blur"], defaultColor: "rgba(0,0,0,0.3)" },
  brightness: { label: "Brightness", unit: "%", min: 0, max: 200, step: 1, defaultValues: [100], paramLabels: ["Amount"] },
  contrast: { label: "Contrast", unit: "%", min: 0, max: 200, step: 1, defaultValues: [100], paramLabels: ["Amount"] },
  "hue-rotate": { label: "Hue Rotate", unit: "deg", min: 0, max: 360, step: 1, defaultValues: [0], paramLabels: ["Angle"] },
  saturate: { label: "Saturate", unit: "%", min: 0, max: 200, step: 1, defaultValues: [100], paramLabels: ["Amount"] },
  grayscale: { label: "Grayscale", unit: "%", min: 0, max: 100, step: 1, defaultValues: [0], paramLabels: ["Amount"] },
  invert: { label: "Invert", unit: "%", min: 0, max: 100, step: 1, defaultValues: [0], paramLabels: ["Amount"] },
  sepia: { label: "Sepia", unit: "%", min: 0, max: 100, step: 1, defaultValues: [0], paramLabels: ["Amount"] },
};

// ─── Categories ─────────────────────────────────────────────────────

interface FilterCategory {
  label: string;
  types: FilterType[];
}

const FILTER_CATEGORIES: FilterCategory[] = [
  { label: "General", types: ["blur", "drop-shadow"] },
  { label: "Color Adjustments", types: ["brightness", "contrast", "hue-rotate", "saturate"] },
  { label: "Color Effects", types: ["grayscale", "invert", "sepia"] },
];

/** All filter types in category order — for type dropdown options */
const ALL_FILTER_TYPES: FilterType[] = FILTER_CATEGORIES.flatMap(cat => cat.types);

// ─── Helpers ────────────────────────────────────────────────────────

export function createDefaultItem(type: FilterType): FilterItem {
  const meta = FILTER_META[type];
  return {
    type,
    values: [...meta.defaultValues],
    color: meta.defaultColor,
    visible: true,
    expanded: true,
  };
}

function formatFilterSummary(item: FilterItem): string {
  const meta = FILTER_META[item.type];
  if (item.type === "drop-shadow") {
    return `Drop shadow: ${item.values.map((v) => `${v}px`).join(" ")}`;
  }
  return `${meta.label}: ${item.values[0]}${meta.unit}`;
}

// ─── FilterEditor props ─────────────────────────────────────────────

export interface FilterEditorProps {
  items: FilterItem[];
  onChange: (items: FilterItem[]) => void;
  type?: "filter" | "backdrop-filter";
}

// ─── NumberInput ─────────────────────────────────────────────────────

/** Small monospace number input with arrow key support */
function NumberInput({
  value,
  min,
  max,
  step,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setDraft(String(value));
  }, [value, focused]);

  const commit = useCallback(() => {
    setFocused(false);
    const parsed = parseFloat(draft);
    if (!isNaN(parsed)) {
      onChange(Math.min(max, Math.max(min, parsed)));
    }
  }, [draft, min, max, onChange]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        commit();
        (e.target as HTMLInputElement).blur();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        const inc = e.shiftKey ? step * 10 : step;
        const next = Math.min(max, value + inc);
        onChange(next);
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        const inc = e.shiftKey ? step * 10 : step;
        const next = Math.max(min, value - inc);
        onChange(next);
      }
    },
    [commit, value, min, max, step, onChange]
  );

  return (
    <input
      value={focused ? draft : String(value)}
      onChange={(e) => setDraft(e.target.value)}
      onFocus={() => setFocused(true)}
      onBlur={commit}
      onKeyDown={handleKeyDown}
      style={{
        width: "36px",
        background: color.input,
        border: focusBorder(focused),
        borderRadius: "2px",
        color: text.secondary,
        fontSize: "10px",
        fontFamily: font.mono,
        textAlign: "center",
        padding: "2px 2px",
        outline: "none",
        flexShrink: 0,
      }}
    />
  );
}

// ─── FilterItemEditor ───────────────────────────────────────────────

function FilterItemEditor({
  item,
  onUpdate,
}: {
  item: FilterItem;
  onUpdate: (item: FilterItem) => void;
}) {
  const meta = FILTER_META[item.type];

  const handleValueChange = useCallback(
    (paramIdx: number, val: number) => {
      const next = [...item.values];
      next[paramIdx] = val;
      onUpdate({ ...item, values: next });
    },
    [item, onUpdate]
  );

  const handleTypeChange = useCallback((newType: FilterType) => {
    const newMeta = FILTER_META[newType];
    onUpdate({
      ...item,
      type: newType,
      values: [...newMeta.defaultValues],
      color: newMeta.defaultColor,
    });
  }, [item, onUpdate]);

  const handleColorChange = useCallback(
    (hex: string, opacity: number) => {
      onUpdate({ ...item, color: opacity < 1 ? hexToRgba(hex, opacity) : hex });
    },
    [item, onUpdate]
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "4px", padding: "4px 0 4px 20px" }}>
      {/* Filter type dropdown */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <span style={{ fontSize: "10px", fontFamily: font.sans, color: text.label, width: "44px", flexShrink: 0 }}>
          Filter
        </span>
        <select
          value={item.type}
          onChange={(e) => handleTypeChange(e.target.value as FilterType)}
          style={{
            flex: 1,
            background: color.input,
            border: `1px solid ${border.default}`,
            borderRadius: "3px",
            color: text.secondary,
            fontSize: "10px",
            fontFamily: font.sans,
            padding: "3px 6px",
            outline: "none",
          }}
        >
          {ALL_FILTER_TYPES.map(t => (
            <option key={t} value={t}>{FILTER_META[t].label}</option>
          ))}
        </select>
      </div>

      {/* Parameter sliders */}
      {meta.paramLabels.map((label, idx) => {
        const val = item.values[idx] ?? 0;
        const sliderMin = item.type === "drop-shadow" && idx < 2 ? -100 : meta.min;
        const sliderMax = item.type === "drop-shadow" && idx < 2 ? 100 : meta.max;
        const pct = ((val - sliderMin) / (sliderMax - sliderMin)) * 100;

        return (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: "6px", height: "22px" }}>
            <span
              style={{
                width: "36px",
                fontSize: "9px",
                fontFamily: font.sans,
                color: text.disabled,
                flexShrink: 0,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {label}
            </span>

            {/* Slider */}
            <div style={{ flex: 1, position: "relative", height: "14px", display: "flex", alignItems: "center" }}>
              <input
                type="range"
                min={sliderMin}
                max={sliderMax}
                step={meta.step}
                value={val}
                onChange={(e) => handleValueChange(idx, parseFloat(e.target.value))}
                style={{
                  width: "100%",
                  height: "3px",
                  appearance: "none",
                  WebkitAppearance: "none",
                  background: filledTrackBg(pct),
                  borderRadius: "2px",
                  outline: "none",
                  cursor: "pointer",
                }}
              />
            </div>

            <NumberInput
              value={val}
              min={sliderMin}
              max={sliderMax}
              step={meta.step}
              onChange={(v) => handleValueChange(idx, v)}
            />

            <span
              style={{
                width: "18px",
                fontSize: "9px",
                fontFamily: font.mono,
                color: text.disabled,
                flexShrink: 0,
              }}
            >
              {meta.unit}
            </span>
          </div>
        );
      })}

      {/* Color picker for drop-shadow */}
      {item.type === "drop-shadow" && (
        <div style={{ display: "flex", alignItems: "center", gap: "6px", height: "22px" }}>
          <span
            style={{
              width: "36px",
              fontSize: "9px",
              fontFamily: font.sans,
              color: text.disabled,
              flexShrink: 0,
            }}
          >
            Color
          </span>
          <SwatchColorPicker
            value={item.color || meta.defaultColor || ""}
            fallbackColor="#000000"
            title={`Shadow color: ${item.color || meta.defaultColor}`}
            swatchStyle={{
              width: "16px",
              height: "16px",
              borderRadius: "2px",
              border: `1px solid ${blackAlpha(0.15)}`,
            }}
            onChange={handleColorChange}
            onSelectVariable={(varExpr) => {
              onUpdate({ ...item, color: varExpr });
            }}
          />
          <span
            style={{
              fontSize: "9px",
              fontFamily: font.mono,
              color: text.hint,
            }}
          >
            {item.color || meta.defaultColor}
          </span>
        </div>
      )}
    </div>
  );
}

// ─── FilterItemRow ──────────────────────────────────────────────────

function FilterItemRow({
  item,
  index,
  onUpdate,
  onRemove,
  onToggleVisible,
  onToggleExpanded,
  dragHandleProps,
  isDragging,
}: {
  item: FilterItem;
  index: number;
  onUpdate: (index: number, item: FilterItem) => void;
  onRemove: (index: number) => void;
  onToggleVisible: (index: number) => void;
  onToggleExpanded: (index: number) => void;
  dragHandleProps?: { onPointerDown: (e: React.PointerEvent) => void; style: React.CSSProperties };
  isDragging?: boolean;
}) {
  const summaryText = formatFilterSummary(item);

  return (
    <div
      style={{
        borderBottom: `1px solid ${border.subtle}`,
        opacity: item.visible ? 1 : 0.4,
        transition: `opacity ${ms("normal")}`,
      }}
    >
      {/* Summary row (always visible) */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "4px",
          height: "28px",
          cursor: "pointer",
        }}
        onClick={() => onToggleExpanded(index)}
      >
        {dragHandleProps && (
          <DragHandle
            isDragging={isDragging}
            onPointerDown={(e) => {
              e.stopPropagation();
              dragHandleProps.onPointerDown(e);
            }}
            style={{ flexShrink: 0 }}
          />
        )}

        {/* Expand chevron */}
        <span
          style={{
            fontSize: "8px",
            color: text.disabled,
            width: "10px",
            textAlign: "center",
            flexShrink: 0,
            transition: `transform ${ms("normal")}`,
            transform: item.expanded ? "rotate(90deg)" : "rotate(0deg)",
          }}
        >
          ▶
        </span>

        {/* Summary text */}
        <span
          style={{
            flex: 1,
            fontSize: "10px",
            fontFamily: font.sans,
            color: text.label,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {summaryText}
        </span>

        <span onClick={(e) => e.stopPropagation()}>
          <VisibilityToggle
            visible={item.visible}
            onToggle={() => onToggleVisible(index)}
            title={item.visible ? "Hide filter" : "Show filter"}
          />
        </span>

        <span onClick={(e) => e.stopPropagation()}>
          <EditorRemoveButton onClick={() => onRemove(index)} />
        </span>
      </div>

      {/* Expanded editor */}
      {item.expanded && (
        <FilterItemEditor
          item={item}
          onUpdate={(updated) => onUpdate(index, updated)}
        />
      )}
    </div>
  );
}

// ─── CategorizedDropdown ────────────────────────────────────────────

function CategorizedDropdown({
  activeTypes,
  onSelect,
  onClose,
}: {
  activeTypes: Set<FilterType>;
  onSelect: (type: FilterType) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, true, onClose);

  return (
    <div
      ref={ref}
      style={{
        position: "absolute",
        top: "100%",
        left: 0,
        marginTop: "2px",
        background: color.popover,
        border: `1px solid ${surface.track}`,
        borderRadius: "4px",
        padding: "4px 0",
        zIndex: zIndex.dropdown,
        minWidth: "160px",
        boxShadow: shadow.dropdown,
      }}
    >
      {FILTER_CATEGORIES.map((cat) => (
        <div key={cat.label}>
          {/* Category header */}
          <div
            style={{
              padding: "4px 10px 2px",
              fontSize: "9px",
              fontFamily: font.sans,
              color: text.disabled,
              textTransform: "uppercase",
              letterSpacing: "0.04em",
            }}
          >
            {cat.label}
          </div>

          {/* Filter types in category */}
          {cat.types.map((type) => {
            const isActive = activeTypes.has(type);
            const meta = FILTER_META[type];
            return (
              <div
                key={type}
                onClick={() => onSelect(type)}
                style={{
                  padding: "4px 10px",
                  fontSize: "10px",
                  fontFamily: font.sans,
                  color: text.label,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.background = primaryAlpha(0.2);
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.background = "transparent";
                }}
              >
                {/* Checkmark for active types */}
                <span style={{ width: "12px", fontSize: "10px", color: color.primary }}>
                  {isActive ? "✓" : ""}
                </span>
                {meta.label}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ─── FilterEditor (main component) ─────────────────────────────────

export function FilterEditor({ items, onChange, type = "filter" }: FilterEditorProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const { registerRef, handleProps, itemStyle, dropLineStyle, isDragging } = useDragReorder(items, onChange);

  const activeTypes = useMemo(() => new Set(items.map((i) => i.type)), [items]);

  const handleAdd = useCallback(
    (type: FilterType) => {
      // If type already exists, expand it instead of duplicating
      const existingIdx = items.findIndex((i) => i.type === type);
      if (existingIdx >= 0) {
        const next = [...items];
        next[existingIdx] = { ...next[existingIdx], expanded: true };
        onChange(next);
      } else {
        onChange([...items, createDefaultItem(type)]);
      }
      setDropdownOpen(false);
    },
    [items, onChange]
  );

  const handleUpdate = useCallback(
    (index: number, item: FilterItem) => {
      const next = [...items];
      next[index] = item;
      onChange(next);
    },
    [items, onChange]
  );

  const handleRemove = useCallback(
    (index: number) => {
      onChange(items.filter((_, i) => i !== index));
    },
    [items, onChange]
  );

  const handleToggleVisible = useCallback(
    (index: number) => {
      const next = [...items];
      next[index] = { ...next[index], visible: !next[index].visible };
      onChange(next);
    },
    [items, onChange]
  );

  const handleToggleExpanded = useCallback(
    (index: number) => {
      const next = [...items];
      next[index] = { ...next[index], expanded: !next[index].expanded };
      onChange(next);
    },
    [items, onChange]
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
      {/* Filter item rows */}
      <div style={{ position: "relative" }}>
        {items.map((item, i) => {
          const dragProps = handleProps(i);
          return (
            <div key={i} ref={registerRef(i)} style={itemStyle(i)}>
              <AnimatedListItem>
                <FilterItemRow
                  item={item}
                  index={i}
                  onUpdate={handleUpdate}
                  onRemove={handleRemove}
                  onToggleVisible={handleToggleVisible}
                  onToggleExpanded={handleToggleExpanded}
                  dragHandleProps={dragProps}
                  isDragging={isDragging}
                />
              </AnimatedListItem>
            </div>
          );
        })}

        {/* Drop indicator line */}
        {(() => {
          const style = dropLineStyle();
          return style ? <div style={style} /> : null;
        })()}
      </div>

      {items.length === 0 && (
        <div
          style={{
            padding: "8px 0",
            fontSize: "10px",
            color: text.hint,
            textAlign: "center",
            fontFamily: font.sans,
          }}
        >
          No {type === "backdrop-filter" ? "backdrop filters" : "filters"}
        </div>
      )}

      {/* Add filter button + categorized dropdown */}
      <div style={{ position: "relative" }}>
        <button
          onClick={() => setDropdownOpen((o) => !o)}
          style={{
            background: "transparent",
            border: `1px solid ${surface.active}`,
            borderRadius: "3px",
            color: text.label,
            fontSize: "10px",
            fontFamily: font.sans,
            padding: "3px 8px",
            cursor: "pointer",
            marginTop: "4px",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background = color.input;
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = "transparent";
          }}
        >
          + Add {type === "backdrop-filter" ? "backdrop filter" : "filter"}
        </button>

        {dropdownOpen && (
          <CategorizedDropdown
            activeTypes={activeTypes}
            onSelect={handleAdd}
            onClose={() => setDropdownOpen(false)}
          />
        )}
      </div>
    </div>
  );
}

