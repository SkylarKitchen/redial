/**
 * PropertySearch.tsx — Cmd+F search input for filtering CSS property sections
 *
 * Renders a search bar at the top of the panel. Typing filters sections
 * to show only those containing matching CSS property names.
 */

import { useRef, useEffect, useCallback, useState } from "react";
import { Search, X } from "lucide-react";
import { color, border, surface, text, font } from "../theme";
import { ms } from "../timing";

// ─── Section-to-properties mapping ──────────────────────────────────

export const SECTION_PROPERTIES: Record<string, string[]> = {
  Layout: [
    "display", "flex-direction", "justify-content", "align-items", "flex-wrap",
    "gap", "row-gap", "column-gap", "grid-template-columns", "grid-template-rows",
    "flex-grow", "flex-shrink", "flex-basis", "order", "align-self",
  ],
  Spacing: [
    "margin", "padding", "margin-top", "margin-right", "margin-bottom", "margin-left",
    "padding-top", "padding-right", "padding-bottom", "padding-left",
  ],
  Size: [
    "width", "height", "min-width", "max-width", "min-height", "max-height",
    "overflow", "object-fit", "object-position", "aspect-ratio", "box-sizing",
  ],
  Position: [
    "position", "top", "right", "bottom", "left", "z-index", "float", "clear",
  ],
  Typography: [
    "font-family", "font-weight", "font-size", "line-height", "letter-spacing",
    "color", "text-align", "text-decoration-line", "text-transform", "font-style",
    "word-spacing", "white-space", "text-indent", "word-break", "hyphens",
    "direction", "column-count", "column-gap",
  ],
  Backgrounds: [
    "background-color", "background-image", "background-size", "background-position",
    "background-repeat", "background-attachment", "background-clip", "background-blend-mode",
  ],
  Borders: [
    "border-style", "border-width", "border-color", "border-radius",
    "border-top", "border-right", "border-bottom", "border-left",
  ],
  Effects: [
    "opacity", "mix-blend-mode", "box-shadow", "transform", "transition",
    "filter", "backdrop-filter", "cursor", "pointer-events", "user-select",
    "visibility", "perspective", "backface-visibility",
  ],
  "Custom properties": [
    "custom", "property", "css",
    "cursor", "pointer-events", "user-select", "scroll-snap-type",
    "scroll-snap-align", "clip-path", "mask", "will-change", "contain",
    "content-visibility", "accent-color", "caret-color", "touch-action",
    "scroll-behavior", "overscroll-behavior", "resize", "appearance",
    "isolation", "writing-mode", "text-orientation",
  ],
};

/** Check if a section matches a search query (case-insensitive substring on property names and section title) */
export function sectionMatchesQuery(sectionTitle: string, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  // Match against section title
  if (sectionTitle.toLowerCase().includes(q)) return true;
  // Match against property names in this section
  const props = SECTION_PROPERTIES[sectionTitle];
  if (!props) return true; // Unknown sections are always shown
  return props.some((prop) => prop.includes(q));
}

// ─── Component ──────────────────────────────────────────────────────

export interface PropertySearchProps {
  value: string;
  onChange: (value: string) => void;
  onClose: () => void;
}

export function PropertySearch({ value, onChange, onClose }: PropertySearchProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [clearHovered, setClearHovered] = useState(false);

  // Auto-focus when mounted
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onChange("");
        onClose();
      }
    },
    [onChange, onClose],
  );

  const handleClear = useCallback(() => {
    onChange("");
    inputRef.current?.focus();
  }, [onChange]);

  return (
    <div style={{
      padding: "6px 12px",
      borderBottom: `1px solid ${border.default}`,
      position: "relative",
    }}>
      {/* Search icon */}
      <Search
        size={13}
        strokeWidth={2}
        style={{
          position: "absolute",
          left: 20,
          top: "50%",
          transform: "translateY(-50%)",
          color: text.label,
          pointerEvents: "none",
        }}
      />

      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Search properties..."
        style={{
          width: "100%",
          height: 32,
          background: color.input,
          border: "none",
          paddingLeft: 28,
          paddingRight: 28,
          fontSize: 12,
          color: text.primary,
          outline: "none",
          borderRadius: 4,
        }}
      />

      {/* Clear button */}
      {value && (
        <button
          onClick={handleClear}
          onMouseEnter={() => setClearHovered(true)}
          onMouseLeave={() => setClearHovered(false)}
          style={{
            position: "absolute",
            right: 18,
            top: "50%",
            transform: "translateY(-50%)",
            background: "transparent",
            border: "none",
            padding: 2,
            cursor: "pointer",
            color: clearHovered ? text.primary : text.label,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 2,
            transition: `color ${ms("fast")}`,
          }}
        >
          <X size={12} strokeWidth={2} />
        </button>
      )}
    </div>
  );
}
