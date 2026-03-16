/**
 * GridSettingsPopup.tsx — Webflow-style grid track configuration popup
 *
 * Opens from a gear icon in GridTrackRow. Allows configuring individual
 * track sizes, using minmax(), and mixing units like 1fr and 200px.
 *
 * Rendered via portal to escape panel overflow/z-index constraints.
 */

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { X, Plus } from "lucide-react";
import { SegmentedControl } from "../controls/SegmentedControl";
import { UnitSelector } from "../controls/UnitSelector";
import { text, color, font, border, surface, shadow, zIndex, primaryAlpha } from "../theme";
import { ms } from "../timing";

// ─── Data Model ──────────────────────────────────────────────────

export type GridTrackDef = {
  /** Stable identity for React list keys — survives inserts/deletes */
  id: number;
  type: "default" | "minmax";
  value: number;
  unit: string;
  isAuto: boolean;
  minValue: number;
  minUnit: string;
  maxValue: number;
  maxUnit: string;
};

export const GRID_TRACK_UNITS = ["fr", "px", "%", "em", "rem", "vw", "vh"];

// ─── Parsing Helpers ─────────────────────────────────────────────

let nextTrackId = 1;

function makeDefault(value = 1, unit = "fr"): GridTrackDef {
  return { id: nextTrackId++, type: "default", value, unit, isAuto: false, minValue: 0, minUnit: "px", maxValue: 1, maxUnit: "fr" };
}

function makeAuto(): GridTrackDef {
  return { id: nextTrackId++, type: "default", value: 0, unit: "fr", isAuto: true, minValue: 0, minUnit: "px", maxValue: 1, maxUnit: "fr" };
}

function makeMinmax(minValue: number, minUnit: string, maxValue: number, maxUnit: string): GridTrackDef {
  return { id: nextTrackId++, type: "minmax", value: 0, unit: "fr", isAuto: false, minValue, minUnit, maxValue, maxUnit };
}

/** CSS sizing keywords that don't have a numeric component */
const SIZE_KEYWORDS = new Set(["auto", "min-content", "max-content"]);

function parseValueUnit(s: string): { value: number; unit: string } {
  const trimmed = s.trim();
  if (SIZE_KEYWORDS.has(trimmed)) return { value: 0, unit: trimmed };
  const match = trimmed.match(/^(-?[\d.]+)(.+)$/);
  if (!match) return { value: parseFloat(trimmed) || 0, unit: "fr" };
  return { value: parseFloat(match[1]), unit: match[2] };
}

/** Tokenize a grid template string, respecting nested parentheses */
function tokenizeTemplate(css: string): string[] {
  const tokens: string[] = [];
  let depth = 0;
  let current = "";
  for (const ch of css) {
    if (ch === "(") { depth++; current += ch; continue; }
    if (ch === ")") { depth--; current += ch; continue; }
    if (ch === " " && depth === 0) {
      if (current.trim()) tokens.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  if (current.trim()) tokens.push(current.trim());
  return tokens;
}

function parseToken(token: string): GridTrackDef[] {
  // repeat(N, value) or repeat(auto-fill/auto-fit, value)
  const repeatMatch = token.match(/^repeat\(\s*([^,]+)\s*,\s*(.+)\s*\)$/);
  if (repeatMatch) {
    const countStr = repeatMatch[1].trim();
    const count = parseInt(countStr, 10);
    // auto-fill / auto-fit: can't expand to a fixed count, treat inner as a single track
    if (isNaN(count)) {
      return parseToken(repeatMatch[2].trim());
    }
    const inner = parseToken(repeatMatch[2].trim());
    const result: GridTrackDef[] = [];
    for (let i = 0; i < count; i++) result.push(...inner.map(t => ({ ...t, id: nextTrackId++ })));
    return result;
  }

  // minmax(min, max) — split on first top-level comma (respects nested parens in calc() etc.)
  if (token.startsWith("minmax(") && token.endsWith(")")) {
    const inner = token.slice(7, -1); // strip "minmax(" and ")"
    let depth = 0;
    let splitIdx = -1;
    for (let i = 0; i < inner.length; i++) {
      if (inner[i] === "(") depth++;
      else if (inner[i] === ")") depth--;
      else if (inner[i] === "," && depth === 0) { splitIdx = i; break; }
    }
    if (splitIdx >= 0) {
      const min = parseValueUnit(inner.slice(0, splitIdx).trim());
      const max = parseValueUnit(inner.slice(splitIdx + 1).trim());
      if (min.unit === "auto" && max.unit === "auto") return [makeAuto()];
      if (min.unit === "auto") return [makeMinmax(0, "auto", max.value, max.unit)];
      if (max.unit === "auto") return [makeMinmax(min.value, min.unit, 0, "auto")];
      return [makeMinmax(min.value, min.unit, max.value, max.unit)];
    }
  }

  // Keywords: auto, min-content, max-content
  if (SIZE_KEYWORDS.has(token)) {
    if (token === "auto") return [makeAuto()];
    return [makeDefault(0, token)];
  }

  // Simple value+unit
  const { value, unit } = parseValueUnit(token);
  return [makeDefault(value, unit)];
}

export function parseGridTemplate(css: string): GridTrackDef[] {
  if (!css || css === "none") return [makeDefault()];
  const tokens = tokenizeTemplate(css.trim());
  if (tokens.length === 0) return [makeDefault()];
  return tokens.flatMap(parseToken);
}

export function serializeGridTemplate(tracks: GridTrackDef[]): string {
  if (tracks.length === 0) return "1fr";

  const serializeValue = (value: number, unit: string): string =>
    SIZE_KEYWORDS.has(unit) ? unit : `${value}${unit}`;

  const parts = tracks.map(t => {
    if (t.isAuto) return "auto";
    if (t.type === "minmax") {
      const min = serializeValue(t.minValue, t.minUnit);
      const max = serializeValue(t.maxValue, t.maxUnit);
      return `minmax(${min}, ${max})`;
    }
    return serializeValue(t.value, t.unit);
  });

  // Use repeat() shorthand when all tracks are identical
  if (parts.length > 1 && parts.every(p => p === parts[0])) {
    return `repeat(${parts.length}, ${parts[0]})`;
  }

  return parts.join(" ");
}

// ─── Popup Dimensions ────────────────────────────────────────────

const POPUP_WIDTH = 260;
const POPUP_MIN_HEIGHT = 200;

// ─── TrackValueInput ─────────────────────────────────────────────

function TrackValueInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [draft, setDraft] = useState(String(value));

  useEffect(() => { setDraft(String(value)); }, [value]);

  const commit = () => {
    const parsed = parseFloat(draft);
    if (!isNaN(parsed)) onChange(parsed);
  };

  return (
    <input
      value={draft}
      onChange={e => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={e => { if (e.key === "Enter") commit(); }}
      style={{
        width: 48,
        height: 24,
        background: surface.hover,
        border: `1px solid ${border.default}`,
        borderRadius: 3,
        color: text.secondary,
        fontSize: 11,
        fontFamily: font.mono,
        textAlign: "center",
        padding: "0 4px",
        outline: "none",
      }}
    />
  );
}

// ─── TrackDetailPanel ────────────────────────────────────────────

function TrackDetailPanel({ track, onChange }: {
  track: GridTrackDef;
  onChange: (t: GridTrackDef) => void;
}) {
  const isMinmax = track.type === "minmax";

  const handleModeChange = (mode: string) => {
    if (mode === "minmax") {
      onChange({
        ...track,
        type: "minmax",
        isAuto: false,
        minValue: track.isAuto ? 0 : track.value,
        minUnit: track.isAuto ? "px" : (track.unit === "fr" ? "px" : track.unit),
        maxValue: track.isAuto ? 1 : track.value,
        maxUnit: track.isAuto ? "fr" : track.unit,
      });
    } else {
      onChange({
        ...track,
        type: "default",
        isAuto: false,
        value: isMinmax ? track.maxValue : (track.isAuto ? 1 : track.value),
        unit: isMinmax ? track.maxUnit : (track.isAuto ? "fr" : track.unit),
      });
    }
  };

  return (
    <div style={{ padding: "8px 0 4px", display: "flex", flexDirection: "column", gap: 6 }}>
      {/* Mode toggle */}
      <SegmentedControl
        options={[
          { value: "default", label: "Default" },
          { value: "minmax", label: "Min-Max" },
        ]}
        value={isMinmax ? "minmax" : "default"}
        onChange={handleModeChange}
        aria-label="Track sizing mode"
      />

      {isMinmax ? (
        <>
          {/* Min row */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 10, color: text.label, fontFamily: font.sans, width: 28, flexShrink: 0 }}>Min</span>
            {track.minUnit === "auto" ? (
              <span style={{ flex: 1, fontSize: 11, color: text.secondary, fontFamily: font.mono }}>auto</span>
            ) : (
              <TrackValueInput value={track.minValue} onChange={v => onChange({ ...track, minValue: v })} />
            )}
            <UnitSelector
              value={track.minUnit === "auto" ? "auto" : track.minUnit}
              options={GRID_TRACK_UNITS}
              onChange={u => onChange({ ...track, minUnit: u })}
              specialOptions={[{ value: "auto", label: "Auto" }]}
              onSpecialSelect={() => onChange({ ...track, minUnit: "auto", minValue: 0 })}
            />
          </div>
          {/* Max row */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 10, color: text.label, fontFamily: font.sans, width: 28, flexShrink: 0 }}>Max</span>
            {track.maxUnit === "auto" ? (
              <span style={{ flex: 1, fontSize: 11, color: text.secondary, fontFamily: font.mono }}>auto</span>
            ) : (
              <TrackValueInput value={track.maxValue} onChange={v => onChange({ ...track, maxValue: v })} />
            )}
            <UnitSelector
              value={track.maxUnit === "auto" ? "auto" : track.maxUnit}
              options={GRID_TRACK_UNITS}
              onChange={u => onChange({ ...track, maxUnit: u })}
              specialOptions={[{ value: "auto", label: "Auto" }]}
              onSpecialSelect={() => onChange({ ...track, maxUnit: "auto", maxValue: 0 })}
            />
          </div>
        </>
      ) : (
        /* Default mode */
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {track.isAuto ? (
            <span style={{ flex: 1, fontSize: 11, color: text.secondary, fontFamily: font.mono }}>auto</span>
          ) : (
            <TrackValueInput value={track.value} onChange={v => onChange({ ...track, value: v })} />
          )}
          <UnitSelector
            value={track.isAuto ? "auto" : track.unit}
            options={GRID_TRACK_UNITS}
            onChange={u => onChange({ ...track, isAuto: false, unit: u, value: track.isAuto ? 1 : track.value })}
            specialOptions={[{ value: "auto", label: "Auto" }]}
            onSpecialSelect={() => onChange({ ...track, isAuto: true })}
          />
        </div>
      )}
    </div>
  );
}

// ─── TrackItem ───────────────────────────────────────────────────

function TrackItem({ track, onTrackChange, onDelete, canDelete }: {
  track: GridTrackDef;
  onTrackChange: (t: GridTrackDef) => void;
  onDelete: () => void;
  canDelete: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [hovered, setHovered] = useState(false);

  const sizeText = track.isAuto
    ? "auto"
    : track.type === "minmax"
      ? `minmax(${track.minUnit === "auto" ? "auto" : `${track.minValue}${track.minUnit}`}, ${track.maxUnit === "auto" ? "auto" : `${track.maxValue}${track.maxUnit}`})`
      : `${track.value}${track.unit}`;

  const icon = track.isAuto ? "A" : "↔";

  return (
    <div>
      <div
        onClick={() => setExpanded(!expanded)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "4px 8px",
          cursor: "pointer",
          borderRadius: 4,
          background: expanded ? primaryAlpha(0.08) : hovered ? surface.hover : "transparent",
          transition: `background ${ms("fast")}`,
        }}
      >
        {/* Icon */}
        <span style={{
          width: 18,
          height: 18,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 10,
          color: text.label,
          fontFamily: font.mono,
          background: surface.hover,
          borderRadius: 3,
          flexShrink: 0,
        }}>
          {icon}
        </span>

        {/* Size text */}
        <span style={{ flex: 1, fontSize: 11, fontFamily: font.mono, color: text.secondary }}>
          {sizeText}
        </span>

        {/* Delete button */}
        {canDelete && (
          <button
            onClick={e => { e.stopPropagation(); onDelete(); }}
            style={{
              width: 18,
              height: 18,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              color: text.disabled,
              padding: 0,
              borderRadius: 3,
              opacity: hovered ? 1 : 0,
              transition: `opacity ${ms("fast")}`,
            }}
          >
            <X size={12} strokeWidth={1.5} />
          </button>
        )}
      </div>

      {/* Expanded detail panel */}
      {expanded && (
        <div style={{ padding: "0 8px" }}>
          <TrackDetailPanel track={track} onChange={onTrackChange} />
        </div>
      )}
    </div>
  );
}

// ─── TrackSection ────────────────────────────────────────────────

function TrackSection({ label, tracks, onTracksChange }: {
  label: string;
  tracks: GridTrackDef[];
  onTracksChange: (tracks: GridTrackDef[]) => void;
}) {
  const handleTrackChange = (index: number, track: GridTrackDef) => {
    const next = [...tracks];
    next[index] = track;
    onTracksChange(next);
  };

  const handleDelete = (index: number) => {
    if (tracks.length <= 1) return;
    onTracksChange(tracks.filter((_, i) => i !== index));
  };

  const handleAdd = () => {
    onTracksChange([...tracks, makeDefault()]);
  };

  return (
    <div>
      {/* Section header */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "4px 8px",
      }}>
        <span style={{ fontSize: 11, fontFamily: font.sans, color: text.primary, fontWeight: 500 }}>
          {label} ({tracks.length})
        </span>
        <button
          onClick={handleAdd}
          title={`Add ${label.toLowerCase().slice(0, -1)}`}
          style={{
            width: 20,
            height: 20,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "transparent",
            border: "none",
            cursor: "pointer",
            color: text.label,
            padding: 0,
            borderRadius: 3,
          }}
        >
          <Plus size={14} strokeWidth={1.5} />
        </button>
      </div>

      {/* Track list */}
      {tracks.map((track, i) => (
        <TrackItem
          key={track.id}
          track={track}
          onTrackChange={t => handleTrackChange(i, t)}
          onDelete={() => handleDelete(i)}
          canDelete={tracks.length > 1}
        />
      ))}
    </div>
  );
}

// ─── GridSettingsPopup ───────────────────────────────────────────

export interface GridSettingsPopupProps {
  gridCols: string;
  gridRows: string;
  onGridColsChange: (css: string) => void;
  onGridRowsChange: (css: string) => void;
  anchorRect: DOMRect;
  onClose: () => void;
}

export function GridSettingsPopup({
  gridCols,
  gridRows,
  onGridColsChange,
  onGridRowsChange,
  anchorRect,
  onClose,
}: GridSettingsPopupProps) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Derive tracks from props (no local copy — always in sync)
  const colTracks = useMemo(() => parseGridTemplate(gridCols), [gridCols]);
  const rowTracks = useMemo(() => parseGridTemplate(gridRows), [gridRows]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.stopPropagation(); onCloseRef.current(); }
    };
    document.addEventListener("keydown", handler, true);
    return () => document.removeEventListener("keydown", handler, true);
  }, []);

  // Close on click outside (delayed to avoid closing from the opening click)
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        const target = e.target as HTMLElement;
        if (target.closest("[data-tuner-portal]")) return;
        onCloseRef.current();
      }
    };
    const id = setTimeout(() => {
      document.addEventListener("mousedown", handler, true);
    }, 0);
    return () => { clearTimeout(id); document.removeEventListener("mousedown", handler, true); };
  }, []);

  // Positioning: to the right of the anchor, clamped to viewport
  const left = Math.max(8, Math.min(
    anchorRect.right + 8,
    window.innerWidth - POPUP_WIDTH - 8,
  ));
  const top = Math.max(8, Math.min(
    anchorRect.top,
    window.innerHeight - POPUP_MIN_HEIGHT - 8,
  ));

  const handleColsChange = useCallback((tracks: GridTrackDef[]) => {
    onGridColsChange(serializeGridTemplate(tracks));
  }, [onGridColsChange]);

  const handleRowsChange = useCallback((tracks: GridTrackDef[]) => {
    onGridRowsChange(serializeGridTemplate(tracks));
  }, [onGridRowsChange]);

  return createPortal(
    <div
      ref={popoverRef}
      data-tuner-portal
      style={{
        position: "fixed",
        left,
        top,
        width: POPUP_WIDTH,
        background: color.popover,
        border: `1px solid ${border.default}`,
        borderRadius: 8,
        boxShadow: shadow.picker,
        zIndex: zIndex.max,
        fontFamily: font.sans,
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "8px 10px",
        borderBottom: `1px solid ${border.subtle}`,
      }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: text.primary }}>Grid settings</span>
        <button
          onClick={onClose}
          style={{
            width: 20,
            height: 20,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "transparent",
            border: "none",
            cursor: "pointer",
            color: text.label,
            padding: 0,
            borderRadius: 3,
          }}
        >
          <X size={14} strokeWidth={1.5} />
        </button>
      </div>

      {/* Body */}
      <div style={{ padding: "4px 0", maxHeight: 400, overflowY: "auto" }}>
        <TrackSection label="Columns" tracks={colTracks} onTracksChange={handleColsChange} />
        <div style={{ height: 1, background: border.subtle, margin: "4px 0" }} />
        <TrackSection label="Rows" tracks={rowTracks} onTracksChange={handleRowsChange} />
      </div>
    </div>,
    document.body,
  );
}
