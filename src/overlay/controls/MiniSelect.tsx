/**
 * controls/MiniSelect.tsx — Small styled native <select>.
 *
 * Consolidates the styled select + custom caret arrow that was reimplemented
 * (and whose SVG data-URI was pasted twice) across the panel. Pass a flat
 * `options` array for the common case, or arbitrary `children` (optgroups,
 * sentinel options) when you need richer markup. Style defaults match the
 * panel's compact mono mini-select and can be overridden via `style`.
 */

import { color, border, text, font } from "../theme";

/** The down-caret drawn as a CSS background-image (no extra DOM node). */
export const MINI_SELECT_CARET =
  "url(\"data:image/svg+xml,%3Csvg width='6' height='4' viewBox='0 0 6 4' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M3 4L0 0h6L3 4z' fill='rgba(0,0,0,0.35)'/%3E%3C/svg%3E\")";

/**
 * Base style. All-longhand (no shorthand mixing, per project rule): uses
 * `backgroundColor` so it never resets `backgroundImage`, and explicit
 * padding longhands so the wider right padding makes room for the caret.
 */
const BASE_STYLE: React.CSSProperties = {
  backgroundColor: color.input,
  border: `1px solid ${border.input}`,
  borderRadius: "2px",
  color: text.secondary,
  fontSize: "10px",
  fontFamily: font.mono,
  paddingTop: "2px",
  paddingBottom: "2px",
  paddingLeft: "4px",
  paddingRight: "14px",
  outline: "none",
  cursor: "pointer",
  appearance: "none",
  WebkitAppearance: "none",
  backgroundImage: MINI_SELECT_CARET,
  backgroundRepeat: "no-repeat",
  backgroundPosition: "right 4px center",
};

export interface MiniSelectProps {
  value: string;
  onChange: (value: string) => void;
  /** Flat option list — strings, or {value,label} pairs. */
  options?: (string | { value: string; label: string })[];
  /** Advanced markup (optgroups, sentinel options) — used when `options` is absent. */
  children?: React.ReactNode;
  /** Style overrides merged over the defaults. */
  style?: React.CSSProperties;
  "aria-label"?: string;
}

export function MiniSelect({
  value,
  onChange,
  options,
  children,
  style,
  "aria-label": ariaLabel,
}: MiniSelectProps) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={ariaLabel}
      style={{ ...BASE_STYLE, ...style }}
    >
      {options
        ? options.map((opt) => {
            const v = typeof opt === "string" ? opt : opt.value;
            const label = typeof opt === "string" ? opt : opt.label;
            return (
              <option key={v} value={v}>
                {label}
              </option>
            );
          })
        : children}
    </select>
  );
}
