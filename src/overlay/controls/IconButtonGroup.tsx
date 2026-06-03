/**
 * IconButtonGroup.tsx — Radio-style icon button group
 *
 * Used for text-align, text-decoration, text-transform, etc.
 * Supports single-select (radio) and multi-select (toggle) modes.
 * Pure inline styles with theme.ts tokens (no shadcn / Radix).
 */

import { useState, useCallback } from "react";
import { color, surface, border as borderTokens, focusRing } from "../theme";
import { ms, cssTransition } from "../timing";

export interface IconButtonGroupProps {
  options: Array<{ value: string; icon: React.ReactNode; title?: string; label?: string }>;
  value: string;
  onChange: (value: string) => void;
  multi?: boolean;
  onReset?: () => void;
  /**
   * When true (default), clicking the already-active single-select option
   * toggles it back to "none". Set false for true radio behavior where a
   * dedicated "none" option is the only way to clear — e.g. border-style,
   * whose inherited value is often "solid" (Tailwind Preflight) so a toggle
   * would silently remove the border the user is trying to add.
   */
  allowDeselect?: boolean;
  "aria-label"?: string;
}

export function IconButtonGroup({ options, value, onChange, multi = false, allowDeselect = true, onReset, "aria-label": ariaLabel }: IconButtonGroupProps) {
  const activeValues = multi ? new Set(value.split(" ").filter(Boolean)) : new Set([value]);

  const handleClick = useCallback(
    (optValue: string) => {
      if (multi) {
        // "none" is a reset value — clicking it clears everything
        if (optValue === "none") {
          onChange("none");
          return;
        }
        const current = new Set(value.split(" ").filter(Boolean));
        current.delete("none"); // remove "none" when toggling a real value
        if (current.has(optValue)) {
          current.delete(optValue);
        } else {
          current.add(optValue);
        }
        const result = Array.from(current).join(" ");
        onChange(result || "none");
      } else if (!allowDeselect) {
        // True radio: re-clicking the active option re-affirms it (never
        // deselects to "none"). Re-affirming still fires onChange so coupled
        // side effects (e.g. setting a visible border-width) can run.
        onChange(optValue);
      } else {
        // Toggle-deselect: clicking active option returns to "none"
        onChange(optValue === value ? "none" : optValue);
      }
    },
    [value, onChange, multi, allowDeselect]
  );

  const items = options.map((opt, i) => {
    const isActive = activeValues.has(opt.value);
    const isFirst = i === 0;
    const isLast = i === options.length - 1;

    return (
      <IconButtonItem
        key={opt.value}
        opt={opt}
        isActive={isActive}
        isFirst={isFirst}
        isLast={isLast}
        multi={multi}
        onReset={onReset}
        handleClick={handleClick}
        options={options}
      />
    );
  });

  // Single wrapper div replaces the old Radix ToggleGroup. Single-select is a
  // "radiogroup"; multi-select is a generic "group".
  return (
    <div
      role={multi ? "group" : "radiogroup"}
      aria-label={ariaLabel}
      style={{ display: "inline-flex", gap: 0, flex: 1 }}
    >
      {items}
    </div>
  );
}

/** Individual button item with hover tracking */
function IconButtonItem({ opt, isActive, isFirst, isLast, multi, onReset, handleClick, options }: {
  opt: { value: string; icon: React.ReactNode; title?: string; label?: string };
  isActive: boolean;
  isFirst: boolean;
  isLast: boolean;
  multi: boolean;
  onReset?: () => void;
  handleClick: (v: string) => void;
  options: Array<{ value: string; icon: React.ReactNode; title?: string; label?: string }>;
}) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [pressed, setPressed] = useState(false);

  // Active styling replaces the old Tailwind overrides
  // (data-[state=on]:bg-primary / data-[state=on]:text-primary-foreground)
  // with inline theme tokens. Computed up front so the style object stays flat.
  const activeBg = color.primary;
  const hoverBg = surface.hover;
  const bg = isActive ? activeBg : (hovered ? hoverBg : undefined);
  const fg = isActive ? color.primaryForeground : color.mutedForeground;

  // rounded-l / rounded-r / rounded (4px) — first/last corners only.
  const borderRadius = isFirst && isLast ? 4 : isFirst ? "4px 0 0 4px" : isLast ? "0 4px 4px 0" : 0;

  return (
    <button
      type="button"
      role={multi ? undefined : "radio"}
      aria-checked={multi ? undefined : isActive}
      aria-pressed={multi ? isActive : undefined}
      aria-label={opt.label ?? opt.title ?? opt.value}
      tabIndex={isActive ? 0 : -1}
      title={opt.title ?? opt.value}
      onClick={(e) => {
        e.preventDefault();
        if (e.altKey && onReset) { onReset(); return; }
        handleClick(opt.value);
      }}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
          e.preventDefault();
          const siblings = Array.from(e.currentTarget.parentElement?.children ?? []) as HTMLElement[];
          const idx = siblings.indexOf(e.currentTarget as HTMLElement);
          const next = e.key === "ArrowRight"
            ? siblings[(idx + 1) % siblings.length]
            : siblings[(idx - 1 + siblings.length) % siblings.length];
          next.focus();
          const nextOpt = options[siblings.indexOf(next)];
          if (nextOpt != null) handleClick(nextOpt.value);
        }
      }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setPressed(false); }}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{
        flex: 1,
        height: 28,
        minWidth: 0,
        padding: "0 6px",
        fontSize: 13,
        lineHeight: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        border: `1px solid ${borderTokens.default}`,
        borderRadius,
        outline: "none",
        transform: pressed ? "scale(0.93)" : undefined,
        transition: `color ${ms("fast")} ease, background ${ms("fast")} ease, ${cssTransition("transform", pressed ? "fast" : "release")}`,
        borderLeftWidth: isFirst ? 1 : 0,
        backgroundColor: bg,
        color: fg,
        fontWeight: isActive ? 500 : 400,
        boxShadow: focused ? focusRing : "none",
      }}
    >
      {opt.icon}
    </button>
  );
}
