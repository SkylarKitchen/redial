/**
 * controls/EditableValue.tsx — Inline editable numeric value (memo'd).
 * Used by SpacingBoxModel for individual spacing values.
 */

import React, { useState, useCallback, useRef, useEffect, memo } from "react";
import { evaluateMathExpr } from "../inputMath";
import { ms } from "../timing";
import { color, font, surface, blackAlpha, primaryAlpha } from "../theme";
import { selectAllOnDoubleClick, type EditableValueProps } from "./helpers";

export const EditableValue = memo(
  function EditableValue(props: EditableValueProps) {
    const { value, onChange, onAltClick } = props;
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState(String(value));
    const [hovered, setHovered] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    // Sync draft when external value changes
    useEffect(() => {
      if (!editing) setDraft(String(value));
    }, [value, editing]);

    const commit = useCallback(() => {
      setEditing(false);
      const mathResult = evaluateMathExpr(draft, value);
      if (mathResult !== null) { onChange(mathResult); return; }
      const parsed = parseFloat(draft);
      if (!isNaN(parsed) && parsed !== value) {
        onChange(parsed);
      }
    }, [draft, value, onChange]);

    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent) => {
        if (e.key === "Enter") {
          commit();
        } else if (e.key === "Escape") {
          e.stopPropagation();
          setDraft(String(value));
          setEditing(false);
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          e.stopPropagation();
          const step = e.altKey ? 0.1 : e.shiftKey ? 10 : 1;
          const next = Math.round((value + step) * 10) / 10;
          setDraft(String(next));
          onChange(next);
        } else if (e.key === "ArrowDown") {
          e.preventDefault();
          e.stopPropagation();
          const step = e.altKey ? 0.1 : e.shiftKey ? 10 : 1;
          const next = Math.round((value - step) * 10) / 10;
          setDraft(String(next));
          onChange(next);
        }
      },
      [commit, value, onChange]
    );

    if (editing) {
      return (
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={handleKeyDown}
          onDoubleClick={selectAllOnDoubleClick}
          autoFocus
          style={{
            width: 28,
            borderRadius: 2,
            fontSize: 10,
            fontFamily: font.mono,
            textAlign: "center" as const,
            padding: "1px 2px",
            outline: "none",
            background: blackAlpha(0.07),
            border: `1px solid ${primaryAlpha(0.5)}`,
            color: color.foreground,
          }}
          onClick={(e) => e.stopPropagation()}
        />
      );
    }

    return (
      <span
        tabIndex={0}
        data-spacing-index={props['data-spacing-index']}
        onClick={(e) => {
          e.stopPropagation();
          if (e.altKey && onAltClick) {
            onAltClick();
            return;
          }
          setEditing(true);
        }}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); setEditing(true); } }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          fontSize: 10,
          fontFamily: font.mono,
          cursor: "text",
          padding: "1px 3px",
          borderRadius: 2,
          minWidth: 16,
          textAlign: "center" as const,
          outline: "none",
          background: hovered ? surface.hover : "transparent",
          color: value !== 0 ? color.foreground : color.mutedForeground,
          transition: `background ${ms("normal")}, box-shadow ${ms("fast")}`,
        }}
      >
        {value}
      </span>
    );
  },
);
