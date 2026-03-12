/**
 * IconButtonGroup.tsx — Radio-style icon button group
 *
 * Used for text-align, text-decoration, text-transform, etc.
 * Supports single-select (radio) and multi-select (toggle) modes.
 */

import { useCallback } from "react";
import { ms } from "./timing";

export interface IconButtonGroupProps {
  options: Array<{ value: string; icon: React.ReactNode; title?: string; label?: string }>;
  value: string;
  onChange: (value: string) => void;
  multi?: boolean;
  "aria-label"?: string;
}

export function IconButtonGroup({ options, value, onChange, multi = false, "aria-label": ariaLabel }: IconButtonGroupProps) {
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
      } else {
        // Toggle-deselect: clicking active option returns to "none"
        onChange(optValue === value ? "none" : optValue);
      }
    },
    [value, onChange, multi]
  );

  return (
    <div role={multi ? "toolbar" : "radiogroup"} aria-label={ariaLabel} style={{ display: "inline-flex" }}>
      {options.map((opt, i) => {
        const isActive = activeValues.has(opt.value);
        const isFirst = i === 0;
        const isLast = i === options.length - 1;

        return (
          <button
            key={opt.value}
            role={multi ? undefined : "radio"}
            aria-checked={multi ? undefined : isActive}
            aria-pressed={multi ? isActive : undefined}
            aria-label={opt.label ?? opt.title ?? opt.value}
            tabIndex={isActive ? 0 : -1}
            title={opt.title ?? opt.value}
            onClick={() => handleClick(opt.value)}
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
            onFocus={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = "0 0 0 2px rgba(99,102,241,0.3)"; }}
            onBlur={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = "none"; }}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: "28px",
              minWidth: "28px",
              padding: "0 6px",
              cursor: "pointer",
              background: isActive ? "#6366f1" : "transparent",
              color: isActive ? "#fff" : "rgba(255,255,255,0.5)",
              border: "1px solid rgba(255,255,255,0.15)",
              borderLeft: isFirst ? "1px solid rgba(255,255,255,0.15)" : "none",
              borderRadius: isFirst
                ? "4px 0 0 4px"
                : isLast
                  ? "0 4px 4px 0"
                  : "0",
              fontSize: "13px",
              lineHeight: 1,
              fontFamily: "system-ui, sans-serif",
              outline: "none",
              transition: `background ${ms("fast")}, color ${ms("fast")}, box-shadow ${ms("fast")}`,
            }}
            onMouseEnter={(e) => {
              if (!isActive) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.08)";
            }}
            onMouseLeave={(e) => {
              if (!isActive) (e.currentTarget as HTMLElement).style.background = "transparent";
            }}
          >
            {opt.icon}
          </button>
        );
      })}
    </div>
  );
}
