/**
 * CustomPropertiesSection.tsx — Escape-hatch section for arbitrary CSS property:value pairs.
 *
 * Lets users add any CSS property not covered by the 8 structured sections.
 * Each entry is a property input + value input row with trash to remove.
 * Includes property autocomplete dropdown filtered from CSS_PROPERTIES.
 */

import { useState, useCallback, useRef, useEffect, useMemo, useSyncExternalStore, memo } from "react";
import { createPortal } from "react-dom";
import { Trash2, Plus } from "lucide-react";
import { Section } from "../controls";
import { resetProp, diff, subscribeOverrides, getOverrideSnapshot } from "../core/apply";
import type { DiffEntry } from "../core/apply";
import type { SectionCtx } from "../panelUtils";
import { SECTION_PROPERTIES } from "../shell/PropertySearch";
import { text, border, font, color, surface, shadow } from "../theme";
import { ms } from "../timing";
import { CSS_PROPERTIES } from "./cssPropertyList";

// ─── Property filtering (exported for tests) ────────────────────────────

/** Filter CSS_PROPERTIES by query. startsWith matches first, then substring. Max 12. */
export function filterProperties(query: string): string[] {
  if (!query) return [];
  const q = query.toLowerCase();
  const startsWith: string[] = [];
  const includes: string[] = [];
  for (const prop of CSS_PROPERTIES) {
    if (prop.startsWith(q)) startsWith.push(prop);
    else if (prop.includes(q)) includes.push(prop);
  }
  return [...startsWith, ...includes].slice(0, 12);
}

// ─── Types ──────────────────────────────────────────────────────────────

type CustomEntry = { id: string; property: string; value: string };

// ─── Auto-population helper ─────────────────────────────────────────

/** All property names covered by the 8 structured sections */
const STRUCTURED_PROPS = new Set(
  Object.values(SECTION_PROPERTIES).flat()
);

/** Filter diff entries to only those NOT covered by structured sections */
export function getCustomOverrides(diffs: DiffEntry[]): CustomEntry[] {
  return diffs
    .filter(d => !d.state && !STRUCTURED_PROPS.has(d.prop))
    .map(d => ({ id: crypto.randomUUID(), property: d.prop, value: d.to }));
}

// ─── Validation ──────────────────────────────────────────────────────────

/** Set of all known CSS property names for validation */
const CSS_PROPERTY_SET = new Set(CSS_PROPERTIES);

/** Check if a property name is valid (known CSS property or custom property --*) */
export function isValidProperty(prop: string): boolean {
  if (!prop) return true; // empty is neutral, not invalid
  if (prop.startsWith("--")) return true; // custom properties always valid
  return CSS_PROPERTY_SET.has(prop);
}

/** Safely apply a style, returning true on success or false on error */
function safeApply(ctx: SectionCtx, prop: string, value: string): boolean {
  try {
    ctx.apply(prop, value);
    return true;
  } catch {
    return false;
  }
}

// ─── Props ──────────────────────────────────────────────────────────────

interface Props {
  ctx: SectionCtx;
  forceOpen?: boolean;
  focusOpen?: boolean;
  onToggle?: (title: string) => void;
}

// ─── Styles ─────────────────────────────────────────────────────────────

const containerStyle: React.CSSProperties = {
  border: `1px solid ${border.default}`,
  borderRadius: 6,
  margin: "4px 12px 8px",
  overflow: "hidden",
};

const entryRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 4,
  padding: "4px 8px",
  minHeight: 28,
};

const inputStyle: React.CSSProperties = {
  flex: 1,
  background: "transparent",
  border: "none",
  borderBottomWidth: 1,
  borderBottomStyle: "solid",
  borderBottomColor: "transparent",
  outline: "none",
  fontSize: 11,
  fontFamily: font.mono,
  color: text.primary,
  padding: "2px 4px",
  transition: `border-color ${ms("fast")} ease`,
  minWidth: 0,
};

const inputFocusStyle: React.CSSProperties = {
  borderBottomColor: border.hover,
};

const inputErrorStyle: React.CSSProperties = {
  borderBottomColor: color.destructive,
  color: color.destructive,
};

const separatorStyle: React.CSSProperties = {
  color: text.label,
  fontSize: 11,
  flexShrink: 0,
  userSelect: "none",
};

const trashBtnStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "transparent",
  border: "none",
  cursor: "pointer",
  padding: 2,
  color: text.label,
  flexShrink: 0,
  transition: `color ${ms("fast")} ease`,
};

const addBtnStyle: React.CSSProperties = {
  width: "100%",
  textAlign: "left" as const,
  padding: "6px 8px",
  background: "transparent",
  border: "none",
  cursor: "pointer",
  fontSize: 11,
  fontFamily: font.sans,
  color: text.label,
  display: "flex",
  alignItems: "center",
  gap: 4,
  transition: `color ${ms("fast")} ease`,
};

const dividerStyle: React.CSSProperties = {
  height: 1,
  background: border.default,
  margin: 0,
};

// ─── Autocomplete dropdown styles ───────────────────────────────────────

const dropdownStyle: React.CSSProperties = {
  position: "absolute",
  background: color.background,
  border: `1px solid ${border.default}`,
  borderRadius: 6,
  boxShadow: shadow.dropdown,
  maxHeight: 240,
  overflowY: "auto",
  zIndex: 2147483647,
  padding: "2px 0",
};

const dropdownItemStyle: React.CSSProperties = {
  padding: "4px 8px",
  fontSize: 11,
  fontFamily: font.mono,
  color: text.primary,
  cursor: "pointer",
  whiteSpace: "nowrap",
  transition: `background ${ms("fast")} ease`,
};

// ─── PropertyAutocomplete ───────────────────────────────────────────────

function PropertyAutocomplete({
  query,
  inputRef,
  onSelect,
  onClose,
}: {
  query: string;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onSelect: (prop: string) => void;
  onClose: () => void;
}) {
  const results = filterProperties(query);
  const [activeIdx, setActiveIdx] = useState(0);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Reset active index when results change
  useEffect(() => {
    setActiveIdx(0);
  }, [query]);

  // Position dropdown below input
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setPos({
      top: rect.bottom + 2,
      left: rect.left,
      width: Math.max(rect.width, 160),
    });
  }, [inputRef, query]);

  // Keyboard navigation on the input
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!results.length) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIdx((prev) => Math.min(prev + 1, results.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIdx((prev) => Math.max(prev - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (results[activeIdx]) {
          onSelect(results[activeIdx]);
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };

    el.addEventListener("keydown", handleKeyDown);
    return () => el.removeEventListener("keydown", handleKeyDown);
  }, [inputRef, results, activeIdx, onSelect, onClose]);

  // Scroll active item into view
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const item = list.children[activeIdx] as HTMLElement | undefined;
    if (item) item.scrollIntoView({ block: "nearest" });
  }, [activeIdx]);

  if (!results.length || !pos) return null;

  return createPortal(
    <div
      data-tuner-portal
      style={{ ...dropdownStyle, top: pos.top, left: pos.left, width: pos.width }}
      ref={listRef}
      onMouseDown={(e) => e.preventDefault()} // prevent blur before click registers
    >
      {results.map((prop, i) => (
        <div
          key={prop}
          style={{
            ...dropdownItemStyle,
            background:
              hoveredIdx === i || activeIdx === i ? surface.active : "transparent",
          }}
          onMouseEnter={() => setHoveredIdx(i)}
          onMouseLeave={() => setHoveredIdx(null)}
          onClick={() => onSelect(prop)}
        >
          {prop}
        </div>
      ))}
    </div>,
    document.body,
  );
}

// ─── Component ──────────────────────────────────────────────────────────

export const CustomPropertiesSection = memo(function CustomPropertiesSection({
  ctx,
  forceOpen,
  focusOpen,
  onToggle,
}: Props) {
  // Track override changes reactively
  const overrideVersion = useSyncExternalStore(subscribeOverrides, getOverrideSnapshot);

  // Auto-populated entries from current overrides
  const autoEntries = useMemo(() => {
    // overrideVersion is read to trigger recalculation
    void overrideVersion;
    return ctx.element ? getCustomOverrides(diff(ctx.element)) : [];
  }, [ctx.element, overrideVersion]);

  // Manual entries added via "+ Add"
  const [manualEntries, setManualEntries] = useState<CustomEntry[]>([]);
  // Track dismissed auto-populated property names so they don't re-appear
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  // Merge auto + manual, filtering out dismissed auto entries
  const entries = useMemo(() => {
    const manualProps = new Set(manualEntries.map(e => e.property));
    const filtered = autoEntries.filter(
      e => !dismissed.has(e.property) && !manualProps.has(e.property),
    );
    return [...filtered, ...manualEntries];
  }, [autoEntries, manualEntries, dismissed]);

  // Track entries with errors (invalid property name or failed apply)
  const [errors, setErrors] = useState<Set<string>>(new Set());

  const [focusedInput, setFocusedInput] = useState<string | null>(null);
  const [hoveredTrash, setHoveredTrash] = useState<string | null>(null);
  const [addHovered, setAddHovered] = useState(false);
  const newEntryRef = useRef<string | null>(null);
  const inputRefs = useRef<Map<string, HTMLInputElement>>(new Map());

  // Track local text for each property input (controlled for autocomplete)
  const [propTexts, setPropTexts] = useState<Map<string, string>>(new Map());
  // Track which property input has autocomplete open
  const [autocompleteId, setAutocompleteId] = useState<string | null>(null);

  const handleAdd = useCallback(() => {
    const id = crypto.randomUUID();
    newEntryRef.current = id;
    setManualEntries((prev) => [...prev, { id, property: "", value: "" }]);
    // Focus is set in a microtask after render
    requestAnimationFrame(() => {
      const el = inputRefs.current.get(`${id}-prop`);
      if (el) el.focus();
    });
  }, []);

  const handleRemove = useCallback(
    (entry: CustomEntry) => {
      // Check if this is a manual entry or auto-populated
      const isManual = manualEntries.some(e => e.id === entry.id);
      if (isManual) {
        setManualEntries((prev) => prev.filter((e) => e.id !== entry.id));
      } else {
        // Auto-populated: dismiss it so it doesn't reappear
        setDismissed((prev) => new Set(prev).add(entry.property));
      }
      if (entry.property) {
        resetProp(ctx.element, entry.property);
      }
      // Clean up propTexts
      setPropTexts((prev) => {
        const next = new Map(prev);
        next.delete(entry.id);
        return next;
      });
    },
    [ctx.element, manualEntries],
  );

  const handlePropertyCommit = useCallback(
    (id: string, newProp: string) => {
      setManualEntries((prev) =>
        prev.map((e) => (e.id === id ? { ...e, property: newProp } : e)),
      );
      // Validate property name — mark error if unrecognized
      if (newProp && !isValidProperty(newProp)) {
        setErrors((prev) => new Set(prev).add(id));
      } else {
        setErrors((prev) => { const next = new Set(prev); next.delete(id); return next; });
      }
    },
    [],
  );

  const handleValueCommit = useCallback(
    (id: string, newValue: string) => {
      // Check manual entries first, then auto entries
      const entry = manualEntries.find((e) => e.id === id) ?? entries.find((e) => e.id === id);
      if (entry && entry.property) {
        const ok = safeApply(ctx, entry.property, newValue);
        if (!ok) {
          setErrors((prev) => new Set(prev).add(id));
        } else {
          setErrors((prev) => { const next = new Set(prev); next.delete(id); return next; });
        }
      }
      setManualEntries((prev) =>
        prev.map((e) =>
          e.id === id ? { ...e, value: newValue } : e,
        ),
      );
    },
    [ctx, manualEntries, entries],
  );

  const setInputRef = useCallback(
    (key: string) => (el: HTMLInputElement | null) => {
      if (el) inputRefs.current.set(key, el);
      else inputRefs.current.delete(key);
    },
    [],
  );

  const handleAutocompleteSelect = useCallback(
    (entryId: string, prop: string) => {
      // Update the property text and entry
      setPropTexts((prev) => new Map(prev).set(entryId, prop));
      handlePropertyCommit(entryId, prop);
      setAutocompleteId(null);
      // Focus the value input
      requestAnimationFrame(() => {
        const el = inputRefs.current.get(`${entryId}-val`);
        if (el) el.focus();
      });
    },
    [handlePropertyCommit],
  );

  const handlePropInputChange = useCallback(
    (id: string, value: string) => {
      setPropTexts((prev) => new Map(prev).set(id, value));
      if (value) {
        setAutocompleteId(id);
      } else {
        setAutocompleteId(null);
      }
    },
    [],
  );

  const handlePropFocus = useCallback(
    (id: string) => {
      setFocusedInput(`${id}-prop`);
      const currentText = propTexts.get(id) ?? "";
      if (currentText) setAutocompleteId(id);
    },
    [propTexts],
  );

  const handlePropBlur = useCallback(
    (id: string) => {
      setFocusedInput(null);
      // Small delay so click on dropdown registers before close
      setTimeout(() => {
        setAutocompleteId((curr) => (curr === id ? null : curr));
      }, 150);
      const currentText = propTexts.get(id) ?? "";
      handlePropertyCommit(id, currentText);
    },
    [propTexts, handlePropertyCommit],
  );

  return (
    <Section
      title="Custom properties"
      collapsed
      forceOpen={forceOpen}
      focusOpen={focusOpen}
      onToggle={onToggle}
    >
      <div style={containerStyle}>
        {entries.map((entry, i) => {
          const propText = propTexts.get(entry.id) ?? entry.property;
          const propInputRef = { current: inputRefs.current.get(`${entry.id}-prop`) ?? null };

          return (
            <div key={entry.id}>
              {i > 0 && <div style={dividerStyle} />}
              <div style={entryRowStyle}>
                <input
                  ref={setInputRef(`${entry.id}-prop`)}
                  style={{
                    ...inputStyle,
                    ...(focusedInput === `${entry.id}-prop` ? inputFocusStyle : {}),
                    ...(errors.has(entry.id) ? inputErrorStyle : {}),
                  }}
                  placeholder="property"
                  title={errors.has(entry.id) ? `Unknown CSS property "${propText}"` : undefined}
                  value={propText}
                  onChange={(e) => handlePropInputChange(entry.id, e.target.value)}
                  onFocus={() => handlePropFocus(entry.id)}
                  onBlur={() => handlePropBlur(entry.id)}
                />
                {autocompleteId === entry.id && (
                  <PropertyAutocomplete
                    query={propText}
                    inputRef={propInputRef}
                    onSelect={(prop) => handleAutocompleteSelect(entry.id, prop)}
                    onClose={() => setAutocompleteId(null)}
                  />
                )}
                <span style={separatorStyle}>:</span>
                <input
                  ref={setInputRef(`${entry.id}-val`)}
                  style={{
                    ...inputStyle,
                    ...(focusedInput === `${entry.id}-val` ? inputFocusStyle : {}),
                  }}
                  placeholder="value"
                  defaultValue={entry.value}
                  onFocus={() => setFocusedInput(`${entry.id}-val`)}
                  onBlur={(e) => {
                    setFocusedInput(null);
                    handleValueCommit(entry.id, e.currentTarget.value);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleValueCommit(entry.id, e.currentTarget.value);
                      e.currentTarget.blur();
                    }
                  }}
                />
                <button
                  style={{
                    ...trashBtnStyle,
                    color:
                      hoveredTrash === entry.id ? text.primary : text.label,
                  }}
                  onMouseEnter={() => setHoveredTrash(entry.id)}
                  onMouseLeave={() => setHoveredTrash(null)}
                  onClick={() => handleRemove(entry)}
                  title="Remove property"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          );
        })}
        {entries.length > 0 && <div style={dividerStyle} />}
        <button
          style={{
            ...addBtnStyle,
            color: addHovered ? text.primary : text.label,
          }}
          onMouseEnter={() => setAddHovered(true)}
          onMouseLeave={() => setAddHovered(false)}
          onClick={handleAdd}
        >
          <Plus size={12} />
          Add
        </button>
      </div>
    </Section>
  );
});
