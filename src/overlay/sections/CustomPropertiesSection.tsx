/**
 * CustomPropertiesSection.tsx — Escape-hatch section for arbitrary CSS property:value pairs.
 *
 * Lets users add any CSS property not covered by the 8 structured sections.
 * Each entry is a property input + value input row with trash to remove.
 */

import { useState, useCallback, useRef, memo } from "react";
import { Trash2, Plus } from "lucide-react";
import { Section } from "../controls";
import { resetProp } from "../core/apply";
import type { SectionCtx } from "../panelUtils";
import { text, border, font, color } from "../theme";
import { ms } from "../timing";

// ─── Types ──────────────────────────────────────────────────────────────

type CustomEntry = { id: string; property: string; value: string };

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
  borderBottom: "1px solid transparent",
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

// ─── Component ──────────────────────────────────────────────────────────

export const CustomPropertiesSection = memo(function CustomPropertiesSection({
  ctx,
  forceOpen,
  focusOpen,
  onToggle,
}: Props) {
  const [entries, setEntries] = useState<CustomEntry[]>([]);
  const [focusedInput, setFocusedInput] = useState<string | null>(null);
  const [hoveredTrash, setHoveredTrash] = useState<string | null>(null);
  const [addHovered, setAddHovered] = useState(false);
  const newEntryRef = useRef<string | null>(null);
  const inputRefs = useRef<Map<string, HTMLInputElement>>(new Map());

  const handleAdd = useCallback(() => {
    const id = crypto.randomUUID();
    newEntryRef.current = id;
    setEntries((prev) => [...prev, { id, property: "", value: "" }]);
    // Focus is set in a microtask after render
    requestAnimationFrame(() => {
      const el = inputRefs.current.get(`${id}-prop`);
      if (el) el.focus();
    });
  }, []);

  const handleRemove = useCallback(
    (entry: CustomEntry) => {
      setEntries((prev) => prev.filter((e) => e.id !== entry.id));
      if (entry.property) {
        resetProp(ctx.element, entry.property);
      }
    },
    [ctx.element],
  );

  const handlePropertyBlur = useCallback(
    (id: string, newProp: string) => {
      setEntries((prev) =>
        prev.map((e) => (e.id === id ? { ...e, property: newProp } : e)),
      );
    },
    [],
  );

  const handleValueCommit = useCallback(
    (id: string, newValue: string) => {
      setEntries((prev) => {
        const entry = prev.find((e) => e.id === id);
        if (entry && entry.property) {
          ctx.apply(entry.property, newValue);
        }
        return prev.map((e) =>
          e.id === id ? { ...e, value: newValue } : e,
        );
      });
    },
    [ctx],
  );

  const setInputRef = useCallback(
    (key: string) => (el: HTMLInputElement | null) => {
      if (el) inputRefs.current.set(key, el);
      else inputRefs.current.delete(key);
    },
    [],
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
        {entries.map((entry, i) => (
          <div key={entry.id}>
            {i > 0 && <div style={dividerStyle} />}
            <div style={entryRowStyle}>
              <input
                ref={setInputRef(`${entry.id}-prop`)}
                style={{
                  ...inputStyle,
                  ...(focusedInput === `${entry.id}-prop` ? inputFocusStyle : {}),
                }}
                placeholder="property"
                defaultValue={entry.property}
                onFocus={() => setFocusedInput(`${entry.id}-prop`)}
                onBlur={(e) => {
                  setFocusedInput(null);
                  handlePropertyBlur(entry.id, e.currentTarget.value);
                }}
              />
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
        ))}
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
