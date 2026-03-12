/**
 * FilterSliders.tsx — Grouped sliders for CSS filter and backdrop-filter
 *
 * Renders labeled sliders for blur, brightness, contrast, grayscale,
 * hue-rotate, invert, saturate, sepia. Only non-default filters are
 * shown (blur is always visible). An "+ Add filter" dropdown lets
 * the user add more.
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useDragReorder } from "./useDragReorder";
import { DragHandle } from "./DragHandle";

export interface FilterValues {
  blur: number;
  brightness: number;
  contrast: number;
  grayscale: number;
  "hue-rotate": number;
  invert: number;
  saturate: number;
  sepia: number;
}

export interface FilterSlidersProps {
  values: Partial<FilterValues>;
  onChange: (filter: string, value: number) => void;
  type?: "filter" | "backdrop-filter";
}

type FilterKey = keyof FilterValues;

interface FilterMeta {
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  defaultValue: number;
}

const FILTER_META: Record<FilterKey, FilterMeta> = {
  blur: { label: "Blur", unit: "px", min: 0, max: 50, step: 0.5, defaultValue: 0 },
  brightness: { label: "Brightness", unit: "%", min: 0, max: 200, step: 1, defaultValue: 100 },
  contrast: { label: "Contrast", unit: "%", min: 0, max: 200, step: 1, defaultValue: 100 },
  grayscale: { label: "Grayscale", unit: "%", min: 0, max: 100, step: 1, defaultValue: 0 },
  "hue-rotate": { label: "Hue Rotate", unit: "deg", min: 0, max: 360, step: 1, defaultValue: 0 },
  invert: { label: "Invert", unit: "%", min: 0, max: 100, step: 1, defaultValue: 0 },
  saturate: { label: "Saturate", unit: "%", min: 0, max: 200, step: 1, defaultValue: 100 },
  sepia: { label: "Sepia", unit: "%", min: 0, max: 100, step: 1, defaultValue: 0 },
};

const ALL_FILTER_KEYS: FilterKey[] = [
  "blur", "brightness", "contrast", "grayscale",
  "hue-rotate", "invert", "saturate", "sepia",
];

function isNonDefault(key: FilterKey, value: number | undefined): boolean {
  if (value === undefined) return false;
  return value !== FILTER_META[key].defaultValue;
}

/** Wrapper for useDragReorder — wraps filter keys in objects */
interface FilterItem { key: FilterKey }

export function FilterSliders({ values, onChange, type = "filter" }: FilterSlidersProps) {
  // Track which filters are explicitly shown (added by user)
  const [addedFilters, setAddedFilters] = useState<Set<FilterKey>>(() => {
    const set = new Set<FilterKey>(["blur"]);
    for (const key of ALL_FILTER_KEYS) {
      if (isNonDefault(key, values[key])) set.add(key);
    }
    return set;
  });
  const [hiddenFilters, setHiddenFilters] = useState<Set<FilterKey>>(new Set());
  const [filterOrder, setFilterOrder] = useState<FilterKey[]>([...ALL_FILTER_KEYS]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    if (!dropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [dropdownOpen]);

  const visibleFilters = filterOrder.filter(
    (key) => addedFilters.has(key) || isNonDefault(key, values[key])
  );

  const availableFilters = filterOrder.filter(
    (key) => !addedFilters.has(key) && !isNonDefault(key, values[key])
  );

  // Wrap visible filters as items for useDragReorder
  const filterItems: FilterItem[] = visibleFilters.map((key) => ({ key }));

  const handleReorder = useCallback(
    (items: FilterItem[]) => {
      // Rebuild the full order: keep non-visible keys in place, update visible order
      const reorderedKeys = items.map((i) => i.key);
      const hiddenKeys = filterOrder.filter(
        (key) => !addedFilters.has(key) && !isNonDefault(key, values[key])
      );
      setFilterOrder([...reorderedKeys, ...hiddenKeys]);
    },
    [filterOrder, addedFilters, values]
  );

  const { registerRef, handleProps, itemStyle, dropLineStyle, isDragging } = useDragReorder(filterItems, handleReorder);

  const handleAdd = useCallback((key: FilterKey) => {
    setAddedFilters((prev) => new Set(prev).add(key));
    setDropdownOpen(false);
  }, []);

  const toggleFilterVisible = useCallback(
    (key: FilterKey) => {
      setHiddenFilters((prev) => {
        const next = new Set(prev);
        if (next.has(key)) {
          next.delete(key);
        } else {
          next.add(key);
        }
        // Re-fire onChange so CSS updates
        if (next.has(key)) {
          onChange(key, FILTER_META[key].defaultValue);
        } else {
          onChange(key, values[key] ?? FILTER_META[key].defaultValue);
        }
        return next;
      });
    },
    [values, onChange]
  );

  const handleRemove = useCallback(
    (key: FilterKey) => {
      if (key === "blur" && !isNonDefault(key, values[key])) return; // always show blur
      onChange(key, FILTER_META[key].defaultValue);
      setAddedFilters((prev) => {
        const next = new Set(prev);
        if (key !== "blur") next.delete(key);
        return next;
      });
    },
    [onChange, values]
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
      {/* Section label */}
      <div
        style={{
          fontSize: "10px",
          fontFamily: "system-ui, sans-serif",
          color: "rgba(0,0,0,0.35)",
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          padding: "0 0 4px",
        }}
      >
        {type === "backdrop-filter" ? "Backdrop Filter" : "Filter"}
      </div>

      {/* Filter rows */}
      <div style={{ position: "relative" }}>
      {visibleFilters.map((key, index) => {
        const meta = FILTER_META[key];
        const val = values[key] ?? meta.defaultValue;
        const pct = ((val - meta.min) / (meta.max - meta.min)) * 100;

        const isHidden = hiddenFilters.has(key);
        const dragProps = handleProps(index);

        return (
          <div
            key={key}
            ref={registerRef(index)}
            style={{
              ...itemStyle(index),
              display: "flex",
              alignItems: "center",
              gap: "6px",
              height: "24px",
              opacity: isHidden ? 0.4 : 1,
              transition: "opacity 100ms",
            }}
          >
            {/* Drag handle */}
            <DragHandle
              isDragging={isDragging}
              onPointerDown={dragProps.onPointerDown}
            />

            {/* Label */}
            <span
              style={{
                width: "64px",
                fontSize: "10px",
                fontFamily: "system-ui, sans-serif",
                color: "rgba(0,0,0,0.5)",
                flexShrink: 0,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {meta.label}
            </span>

            {/* Slider track */}
            <div style={{ flex: 1, position: "relative", height: "14px", display: "flex", alignItems: "center" }}>
              <input
                type="range"
                min={meta.min}
                max={meta.max}
                step={meta.step}
                value={val}
                onChange={(e) => onChange(key, parseFloat(e.target.value))}
                style={{
                  width: "100%",
                  height: "3px",
                  appearance: "none",
                  WebkitAppearance: "none",
                  background: `linear-gradient(to right, #c17a50 ${pct}%, rgba(0,0,0,0.1) ${pct}%)`,
                  borderRadius: "2px",
                  outline: "none",
                  cursor: "pointer",
                }}
              />
            </div>

            {/* Number input */}
            <NumberInput
              value={val}
              min={meta.min}
              max={meta.max}
              step={meta.step}
              onChange={(v) => onChange(key, v)}
            />

            {/* Unit */}
            <span
              style={{
                width: "18px",
                fontSize: "9px",
                fontFamily: "ui-monospace, 'SF Mono', monospace",
                color: "rgba(0,0,0,0.3)",
                flexShrink: 0,
              }}
            >
              {meta.unit}
            </span>

            {/* Eye visibility toggle */}
            <button
              onClick={() => toggleFilterVisible(key)}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: "2px",
                color: !isHidden ? "rgba(0,0,0,0.45)" : "rgba(0,0,0,0.15)",
                flexShrink: 0,
              }}
              title={!isHidden ? "Hide filter" : "Show filter"}
            >
              {!isHidden ? <Eye size={12} /> : <EyeOff size={12} />}
            </button>

            {/* Remove button */}
            <button
              onClick={() => handleRemove(key)}
              style={{
                width: "14px",
                height: "14px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "transparent",
                border: "none",
                color: "rgba(0,0,0,0.3)",
                cursor: "pointer",
                fontSize: "11px",
                fontFamily: "system-ui, sans-serif",
                padding: 0,
                borderRadius: "2px",
                flexShrink: 0,
                lineHeight: 1,
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background = "rgba(0,0,0,0.05)";
                (e.currentTarget as HTMLElement).style.color = "rgba(0,0,0,0.6)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = "transparent";
                (e.currentTarget as HTMLElement).style.color = "rgba(0,0,0,0.3)";
              }}
            >
              {"\u00D7"}
            </button>
          </div>
        );
      })}

      {/* Drop indicator line */}
      {(() => {
        const style = dropLineStyle();
        return style ? <div style={style} /> : null;
      })()}
      </div>

      {/* Add filter button + dropdown */}
      <div style={{ position: "relative" }} ref={dropdownRef}>
        <button
          onClick={() => setDropdownOpen((o) => !o)}
          disabled={availableFilters.length === 0}
          style={{
            background: "transparent",
            border: "1px solid rgba(0,0,0,0.08)",
            borderRadius: "3px",
            color: availableFilters.length === 0 ? "rgba(0,0,0,0.15)" : "rgba(0,0,0,0.45)",
            fontSize: "10px",
            fontFamily: "system-ui, sans-serif",
            padding: "3px 8px",
            cursor: availableFilters.length === 0 ? "default" : "pointer",
            marginTop: "4px",
          }}
          onMouseEnter={(e) => {
            if (availableFilters.length > 0)
              (e.currentTarget as HTMLElement).style.background = "rgba(0,0,0,0.04)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = "transparent";
          }}
        >
          + Add filter
        </button>

        {dropdownOpen && availableFilters.length > 0 && (
          <div
            style={{
              position: "absolute",
              top: "100%",
              left: 0,
              marginTop: "2px",
              background: "#eae5df",
              border: "1px solid rgba(0,0,0,0.1)",
              borderRadius: "4px",
              padding: "2px 0",
              zIndex: 100,
              minWidth: "120px",
              boxShadow: "0 4px 12px rgba(0,0,0,0.12)",
            }}
          >
            {availableFilters.map((key) => (
              <div
                key={key}
                onClick={() => handleAdd(key)}
                style={{
                  padding: "4px 10px",
                  fontSize: "10px",
                  fontFamily: "system-ui, sans-serif",
                  color: "rgba(0,0,0,0.6)",
                  cursor: "pointer",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.background = "rgba(193,122,80,0.2)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.background = "transparent";
                }}
              >
                {FILTER_META[key].label}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

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
        background: "rgba(0,0,0,0.04)",
        border: focused ? "1px solid rgba(193,122,80,0.5)" : "1px solid rgba(0,0,0,0.08)",
        borderRadius: "2px",
        color: "rgba(0,0,0,0.7)",
        fontSize: "10px",
        fontFamily: "ui-monospace, 'SF Mono', monospace",
        textAlign: "center",
        padding: "2px 2px",
        outline: "none",
        flexShrink: 0,
      }}
    />
  );
}
