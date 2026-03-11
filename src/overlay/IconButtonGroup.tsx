/**
 * IconButtonGroup.tsx — Radio-style icon button group
 *
 * Used for text-align, text-decoration, text-transform, etc.
 * Supports single-select (radio) and multi-select (toggle) modes.
 */

import { useCallback } from "react";

export interface IconButtonGroupProps {
  options: Array<{ value: string; icon: React.ReactNode; title?: string }>;
  value: string;
  onChange: (value: string) => void;
  multi?: boolean;
}

export function IconButtonGroup({ options, value, onChange, multi = false }: IconButtonGroupProps) {
  const activeValues = multi ? new Set(value.split(" ").filter(Boolean)) : new Set([value]);

  const handleClick = useCallback(
    (optValue: string) => {
      if (multi) {
        const current = new Set(value.split(" ").filter(Boolean));
        if (current.has(optValue)) {
          current.delete(optValue);
        } else {
          current.add(optValue);
        }
        onChange(Array.from(current).join(" "));
      } else {
        onChange(optValue);
      }
    },
    [value, onChange, multi]
  );

  return (
    <div style={{ display: "inline-flex" }}>
      {options.map((opt, i) => {
        const isActive = activeValues.has(opt.value);
        const isFirst = i === 0;
        const isLast = i === options.length - 1;

        return (
          <button
            key={opt.value}
            title={opt.title ?? opt.value}
            onClick={() => handleClick(opt.value)}
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
              transition: "background 80ms, color 80ms",
            }}
            onMouseEnter={(e) => {
              if (!isActive) (e.target as HTMLElement).style.background = "rgba(255,255,255,0.08)";
            }}
            onMouseLeave={(e) => {
              if (!isActive) (e.target as HTMLElement).style.background = "transparent";
            }}
          >
            {opt.icon}
          </button>
        );
      })}
    </div>
  );
}
