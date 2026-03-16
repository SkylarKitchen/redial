/**
 * TransformEditor.tsx — Transform property editor
 *
 * Add/remove translate, scale, rotate, skew transforms.
 * Pill-based list with drag reorder, tabbed expanded editor per item,
 * and a settings sub-panel for origin, backface, and perspective.
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { TransformOriginPicker } from "./TransformOriginPicker";
import { EditorRemoveButton, SliderRow } from "../controls";
import { SegmentedControl, type SegmentOption } from "../controls/SegmentedControl";
import { DragHandle } from "../shell/DragHandle";
import { useDragReorder } from "../hooks/useDragReorder";
import { Slider } from "@/components/ui/slider";
import { beginBatch, endBatch } from "../core/apply";
import { color, text, border, surface, font, blackAlpha, focusBorder } from "../theme";
import { BACKFACE_OPTIONS } from "../panelConstants";
import { ROW, LABEL, SUB_HEADER } from "../panelStyles";
import { ms } from "../timing";

// ─── Types & Exports ─────────────────────────────────────────────

export interface TransformValue {
  type: "translate" | "scale" | "rotate" | "skew";
  x: number;
  y: number;
  z?: number;           // translate, scale, rotate (not skew)
  scaleLocked?: boolean; // scale only — uniform X/Y/Z lock
}

export interface TransformEditorProps {
  transforms: TransformValue[];
  onChange: (transforms: TransformValue[]) => void;
  origin: string;
  onOriginChange: (origin: string) => void;
  // Settings panel props
  backfaceVisibility: string;
  onBackfaceChange: (v: string) => void;
  selfPerspective: number;
  onSelfPerspectiveChange: (v: number) => void;
  childrenPerspective: number;
  onChildrenPerspectiveChange: (v: number) => void;
  perspectiveOrigin: string;
  onPerspectiveOriginChange: (v: string) => void;
  settingsOpen: boolean;
}

// ─── Constants & Helpers ─────────────────────────────────────────

type TransformType = TransformValue["type"];

const TRANSFORM_TYPES: TransformType[] = ["translate", "scale", "rotate", "skew"];

const TRANSFORM_LABELS: Record<TransformType, string> = {
  translate: "Move",
  scale: "Scale",
  rotate: "Rotate",
  skew: "Skew",
};

const TRANSFORM_DEFAULTS: Record<TransformType, TransformValue> = {
  translate: { type: "translate", x: 0, y: 0, z: 0 },
  scale: { type: "scale", x: 1, y: 1, z: 1, scaleLocked: true },
  rotate: { type: "rotate", x: 0, y: 0, z: 0 },
  skew: { type: "skew", x: 0, y: 0 },
};

const TRANSFORM_RANGES: Record<TransformType, { min: number; max: number; step: number }> = {
  translate: { min: -500, max: 500, step: 1 },
  scale: { min: 0, max: 5, step: 0.01 },
  rotate: { min: -360, max: 360, step: 1 },
  skew: { min: -90, max: 90, step: 1 },
};

function getUnit(type: TransformType, _axis: "x" | "y" | "z"): string {
  if (type === "translate") return "PX";
  if (type === "rotate") return "DEG";
  if (type === "skew") return "DEG";
  return "";
}

function formatTransformSummary(t: TransformValue): string {
  const { type, x, y, z } = t;
  switch (type) {
    case "translate":
      return `Move: ${x}px, ${y}px, ${z ?? 0}px`;
    case "scale":
      return z !== undefined ? `Scale: ${x}, ${y}, ${z}` : `Scale: ${x}, ${y}`;
    case "rotate":
      return `Rotate: ${x}deg, ${y}deg, ${z ?? 0}deg`;
    case "skew":
      return `Skew: ${x}deg, ${y}deg`;
  }
}

// ─── Tab Options ─────────────────────────────────────────────────

const TRANSFORM_TAB_OPTIONS: SegmentOption[] = TRANSFORM_TYPES.map((t) => ({
  value: t,
  label: TRANSFORM_LABELS[t],
}));


// ─── SVG Icons (14x14) ──────────────────────────────────────────

function TranslateIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M7 2L7 12M7 2L5 4M7 2L9 4M7 12L5 10M7 12L9 10M2 7L12 7M2 7L4 5M2 7L4 9M12 7L10 5M12 7L10 9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ScaleIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="2" y="2" width="10" height="10" rx="1" stroke="currentColor" strokeWidth="1.2" />
      <rect x="4.5" y="4.5" width="5" height="5" rx="0.5" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}

function RotateIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M11 7A4 4 0 1 1 7 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M7 1L9 3L7 5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SkewIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M4 2L10 2L12 12L2 12Z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

const TRANSFORM_ICONS: Record<TransformType, React.ReactNode> = {
  translate: <TranslateIcon />,
  scale: <ScaleIcon />,
  rotate: <RotateIcon />,
  skew: <SkewIcon />,
};

// ─── Lock Icon ───────────────────────────────────────────────────

function LockIcon({ locked }: { locked: boolean }) {
  if (locked) {
    return (
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="2.5" y="5" width="7" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.1" />
        <path d="M4 5V3.5a2 2 0 0 1 4 0V5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="2.5" y="5" width="7" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.1" />
      <path d="M4 5V3.5a2 2 0 0 1 4 0V2" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
    </svg>
  );
}

// ─── AxisSliderRow ───────────────────────────────────────────────

function AxisSliderRow({
  label,
  value,
  range,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  range: { min: number; max: number; step: number };
  unit: string;
  onChange: (v: number) => void;
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
      onChange(Math.min(range.max, Math.max(range.min, parsed)));
    }
  }, [draft, range.min, range.max, onChange]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        commit();
        (e.target as HTMLInputElement).blur();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        const inc = e.shiftKey ? range.step * 10 : range.step;
        const next = Math.min(range.max, Math.round((value + inc) * 1000) / 1000);
        onChange(next);
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        const inc = e.shiftKey ? range.step * 10 : range.step;
        const next = Math.max(range.min, Math.round((value - inc) * 1000) / 1000);
        onChange(next);
      }
    },
    [commit, value, range.min, range.max, range.step, onChange],
  );

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "2px 0" }}>
      {/* Axis label */}
      <span
        style={{
          width: 12,
          textAlign: "center",
          fontSize: 10,
          fontFamily: font.sans,
          color: text.disabled,
          flexShrink: 0,
          userSelect: "none",
        }}
      >
        {label}
      </span>

      {/* Slider */}
      <Slider
        className="tuner-focusable"
        style={{ flex: 1 }}
        aria-label={`${label}: ${value}${unit}`}
        min={range.min}
        max={range.max}
        step={range.step}
        value={[value]}
        onValueChange={([v]) => onChange(v)}
        onPointerDown={() => beginBatch()}
        onPointerUp={() => endBatch()}
      />

      {/* Value input + unit */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          height: 22,
          borderRadius: 3,
          border: focusBorder(focused),
          background: surface.subtle,
          flexShrink: 0,
        }}
      >
        <input
          value={focused ? draft : String(value)}
          onChange={(e) => setDraft(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={commit}
          onKeyDown={handleKeyDown}
          style={{
            width: 40,
            background: "transparent",
            border: "none",
            color: text.secondary,
            fontSize: 10,
            fontFamily: font.mono,
            textAlign: "center",
            padding: "2px 2px",
            outline: "none",
          }}
        />
        {unit && (
          <span
            style={{
              fontSize: 9,
              fontFamily: font.mono,
              color: text.disabled,
              paddingRight: 4,
              flexShrink: 0,
              userSelect: "none",
            }}
          >
            {unit}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── TransformExpanded ───────────────────────────────────────────

function TransformExpanded({
  transform,
  onUpdate,
  onTypeChange,
}: {
  transform: TransformValue;
  onUpdate: (updates: Partial<TransformValue>) => void;
  onTypeChange: (type: TransformType) => void;
}) {
  const { type, x, y, z, scaleLocked } = transform;
  const range = TRANSFORM_RANGES[type];
  const hasZ = type !== "skew";
  const isScale = type === "scale";

  const handleAxisChange = useCallback(
    (axis: "x" | "y" | "z") => (v: number) => {
      if (isScale && scaleLocked) {
        // Batch: update all axes at once via a single onUpdate call
        const updates: Partial<TransformValue> = { x: v, y: v };
        if (hasZ) updates.z = v;
        onUpdate(updates);
      } else {
        onUpdate({ [axis]: v });
      }
    },
    [isScale, scaleLocked, hasZ, onUpdate],
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, padding: "8px 8px 6px" }}>
      {/* Type tabs */}
      <SegmentedControl
        options={TRANSFORM_TAB_OPTIONS}
        value={type}
        onChange={(v) => onTypeChange(v as TransformType)}
        aria-label="Transform type"
      />

      {/* Axis sliders */}
      <div style={{ display: "flex", flexDirection: "column", gap: 2, marginTop: 4 }}>
        <AxisSliderRow label="X" value={x} range={range} unit={getUnit(type, "x")} onChange={handleAxisChange("x")} />
        <AxisSliderRow label="Y" value={y} range={range} unit={getUnit(type, "y")} onChange={handleAxisChange("y")} />
        {hasZ && (
          <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
            <div style={{ flex: 1 }}>
              <AxisSliderRow label="Z" value={z ?? 0} range={range} unit={getUnit(type, "z")} onChange={handleAxisChange("z")} />
            </div>
            {isScale && (
              <button
                onClick={() => onUpdate({ scaleLocked: !scaleLocked })}
                title={scaleLocked ? "Unlock axes" : "Lock axes (uniform scale)"}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 22,
                  height: 22,
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: scaleLocked ? text.label : text.disabled,
                  borderRadius: 3,
                  flexShrink: 0,
                  padding: 0,
                  transition: `color ${ms("fast")} ease`,
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.background = surface.hover;
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.background = "transparent";
                }}
              >
                <LockIcon locked={!!scaleLocked} />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── TransformPill ───────────────────────────────────────────────

function TransformPill({
  transform,
  isExpanded,
  onClick,
  onRemove,
  dragHandleProps,
  isDragging,
}: {
  transform: TransformValue;
  isExpanded: boolean;
  onClick: () => void;
  onRemove: () => void;
  dragHandleProps?: { onPointerDown: (e: React.PointerEvent) => void; style: React.CSSProperties };
  isDragging?: boolean;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        background: isExpanded
          ? blackAlpha(0.05)
          : hovered
            ? blackAlpha(0.03)
            : blackAlpha(0.02),
        border: `1px solid ${isExpanded ? border.hover : surface.hover}`,
        borderRadius: 3,
        padding: "4px 6px",
        height: 28,
        cursor: "pointer",
        transition: `background ${ms("fast")} ease, border-color ${ms("fast")} ease`,
        overflow: "hidden",
      }}
    >
      {/* Drag handle */}
      {dragHandleProps && (
        <span
          onClick={(e) => e.stopPropagation()}
          style={{ display: "inline-flex" }}
        >
          <DragHandle
            isDragging={isDragging}
            onPointerDown={dragHandleProps.onPointerDown}
            style={{ alignSelf: "center" }}
          />
        </span>
      )}

      {/* Icon */}
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 14,
          height: 14,
          flexShrink: 0,
          color: text.label,
        }}
      >
        {TRANSFORM_ICONS[transform.type]}
      </span>

      {/* Summary text */}
      <span
        style={{
          flex: 1,
          fontSize: 10,
          fontFamily: font.sans,
          color: text.label,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {formatTransformSummary(transform)}
      </span>

      {/* Remove button — visible on hover or when expanded */}
      <span
        style={{
          opacity: hovered || isExpanded ? 1 : 0,
          transition: `opacity ${ms("fast")} ease`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <EditorRemoveButton onClick={onRemove} />
      </span>
    </div>
  );
}

// ─── TransformSettings ──────────────────────────────────────────

interface TransformSettingsProps {
  origin: string;
  onOriginChange: (v: string) => void;
  backfaceVisibility: string;
  onBackfaceChange: (v: string) => void;
  selfPerspective: number;
  onSelfPerspectiveChange: (v: number) => void;
  childrenPerspective: number;
  onChildrenPerspectiveChange: (v: number) => void;
  perspectiveOrigin: string;
  onPerspectiveOriginChange: (v: string) => void;
}

function TransformSettings({
  origin,
  onOriginChange,
  backfaceVisibility,
  onBackfaceChange,
  selfPerspective,
  onSelfPerspectiveChange,
  childrenPerspective,
  onChildrenPerspectiveChange,
  perspectiveOrigin,
  onPerspectiveOriginChange,
}: TransformSettingsProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {/* Transform settings header */}
      <div style={{ ...SUB_HEADER, padding: "8px 12px 4px" }}>Transform settings</div>

      {/* Origin */}
      <div style={{ ...ROW, gap: 8 }}>
        <span style={LABEL}>Origin</span>
        <TransformOriginPicker value={origin} onChange={onOriginChange} showInputs />
      </div>

      {/* Backface */}
      <div style={{ ...ROW, gap: 8 }}>
        <span style={LABEL}>Backface</span>
        <SegmentedControl
          options={BACKFACE_OPTIONS}
          value={backfaceVisibility}
          onChange={onBackfaceChange}
          aria-label="Backface visibility"
        />
      </div>

      {/* Self perspective */}
      <div style={{ ...SUB_HEADER, padding: "8px 12px 4px" }}>Self perspective</div>
      <SliderRow
        label="Distance"
        value={selfPerspective}
        min={0}
        max={2000}
        step={1}
        unit="PX"
        onChange={onSelfPerspectiveChange}
      />

      {/* Children perspective */}
      <div style={{ ...SUB_HEADER, padding: "8px 12px 4px" }}>Children perspective</div>
      <SliderRow
        label="Distance"
        value={childrenPerspective}
        min={0}
        max={2000}
        step={1}
        unit="PX"
        onChange={onChildrenPerspectiveChange}
      />

      {/* Children perspective origin */}
      <div style={{ ...ROW, gap: 8 }}>
        <span style={LABEL}>Origin</span>
        <TransformOriginPicker value={perspectiveOrigin} onChange={onPerspectiveOriginChange} showInputs />
      </div>
    </div>
  );
}

// ─── TransformEditor (orchestrator) ─────────────────────────────

export function TransformEditor({
  transforms,
  onChange,
  origin,
  onOriginChange,
  backfaceVisibility,
  onBackfaceChange,
  selfPerspective,
  onSelfPerspectiveChange,
  childrenPerspective,
  onChildrenPerspectiveChange,
  perspectiveOrigin,
  onPerspectiveOriginChange,
  settingsOpen,
}: TransformEditorProps) {
  const { registerRef, handleProps, itemStyle, dropLineStyle, isDragging } = useDragReorder(transforms, onChange);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const prevLengthRef = useRef(transforms.length);

  // Auto-expand newly added transforms
  useEffect(() => {
    if (transforms.length > prevLengthRef.current) {
      setExpandedIndex(transforms.length - 1);
    }
    prevLengthRef.current = transforms.length;
  }, [transforms.length]);

  const handleRemove = useCallback(
    (index: number) => {
      const next = transforms.filter((_, i) => i !== index);
      onChange(next);
      // Adjust expandedIndex
      if (expandedIndex === index) {
        setExpandedIndex(null);
      } else if (expandedIndex !== null && expandedIndex > index) {
        setExpandedIndex(expandedIndex - 1);
      }
    },
    [transforms, onChange, expandedIndex],
  );

  const handleUpdate = useCallback(
    (index: number, updates: Partial<TransformValue>) => {
      const next = transforms.map((t, i) => (i !== index ? t : { ...t, ...updates }));
      onChange(next);
    },
    [transforms, onChange],
  );

  const handleTypeChange = useCallback(
    (index: number, newType: TransformType) => {
      const current = transforms[index];
      if (current.type === newType) return;
      const next = transforms.map((t, i) => {
        if (i !== index) return t;
        return { ...TRANSFORM_DEFAULTS[newType] };
      });
      onChange(next);
    },
    [transforms, onChange],
  );

  const toggleExpand = useCallback(
    (index: number) => {
      setExpandedIndex((prev) => (prev === index ? null : index));
    },
    [],
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {/* Transform pill list */}
      <div style={{ position: "relative" }}>
        {transforms.map((t, index) => {
          const dragProps = handleProps(index);
          const isExpanded = expandedIndex === index;
          return (
            <div key={index} ref={registerRef(index)} style={{ ...itemStyle(index), marginBottom: 6 }}>
              <TransformPill
                transform={t}
                isExpanded={isExpanded}
                onClick={() => toggleExpand(index)}
                onRemove={() => handleRemove(index)}
                dragHandleProps={dragProps}
                isDragging={isDragging}
              />
              {isExpanded && (
                <TransformExpanded
                  transform={t}
                  onUpdate={(updates) => handleUpdate(index, updates)}
                  onTypeChange={(type) => handleTypeChange(index, type)}
                />
              )}
            </div>
          );
        })}
        {/* Drop indicator line */}
        {(() => {
          const style = dropLineStyle();
          return style ? <div style={style} /> : null;
        })()}
      </div>

      {/* Settings panel (toggled by parent's "..." button) */}
      {settingsOpen && (
        <TransformSettings
          origin={origin}
          onOriginChange={onOriginChange}
          backfaceVisibility={backfaceVisibility}
          onBackfaceChange={onBackfaceChange}
          selfPerspective={selfPerspective}
          onSelfPerspectiveChange={onSelfPerspectiveChange}
          childrenPerspective={childrenPerspective}
          onChildrenPerspectiveChange={onChildrenPerspectiveChange}
          perspectiveOrigin={perspectiveOrigin}
          onPerspectiveOriginChange={onPerspectiveOriginChange}
        />
      )}
    </div>
  );
}
