/**
 * VariableLinkDot.tsx — Webflow-style purple dot for variable link/unlink.
 *
 * Progressive disclosure (unlinked):
 *   1. Row not hovered → hidden (opacity 0)
 *   2. Row hovered → small purple circle with white dot center
 *   3. Dot hovered → purple circle with white + sign
 *   4. Clicked → opens VariablePicker
 *
 * Linked state:
 *   1. Always visible — purple circle with white dot center
 *   2. Dot hovered → purple circle with white × sign
 *   3. Clicked → calls onUnlink
 *
 * Position: absolute top-left corner of parent (parent must be position: relative).
 * Size: 14px circle, shifted -7px top/left to sit on the corner.
 */

import { useState, useRef, useCallback } from "react";
import { color } from "../theme";
import { ms } from "../timing";
import { VariablePicker } from "./VariablePicker";

const DOT_SIZE = 14;
const OFFSET = -(DOT_SIZE / 2); // -7px — center on corner

export interface VariableLinkDotProps {
  /** Is the parent row currently hovered? Controls visibility (only matters when unlinked). */
  rowHovered: boolean;
  /** Is a variable currently linked? When true, dot is always visible and click unlinks. */
  isLinked?: boolean;
  /** Called when user clicks the dot while linked — should unlink the variable. */
  onUnlink?: () => void;
  /** Variable type filter for the picker */
  variableType?: "color" | "length" | "all";
  /** Element for scoped variable discovery */
  element?: Element;
  /** Called when user selects a variable — receives `var(--name)` */
  onSelect: (varExpr: string) => void;
  /** Currently active variable name (e.g. `--spacing-4`) for highlighting in picker */
  activeVariable?: string | null;
}

export function VariableLinkDot({
  rowHovered,
  isLinked = false,
  onUnlink,
  variableType = "length",
  element,
  onSelect,
  activeVariable,
}: VariableLinkDotProps) {
  const [dotHovered, setDotHovered] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const dotRef = useRef<HTMLButtonElement>(null);

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (isLinked && onUnlink) {
      onUnlink();
    } else {
      setPickerOpen((prev) => !prev);
    }
  }, [isLinked, onUnlink]);

  const handleSelect = useCallback(
    (varExpr: string) => {
      onSelect(varExpr);
      setPickerOpen(false);
    },
    [onSelect],
  );

  const visible = isLinked || rowHovered || pickerOpen;

  return (
    <>
      <button
        ref={dotRef}
        type="button"
        title={isLinked ? "Unlink variable" : "Link to variable"}
        onClick={handleClick}
        onMouseEnter={() => setDotHovered(true)}
        onMouseLeave={() => setDotHovered(false)}
        style={{
          position: "absolute",
          top: OFFSET,
          left: OFFSET,
          zIndex: 1,
          width: DOT_SIZE,
          height: DOT_SIZE,
          borderRadius: "50%",
          border: "none",
          padding: 0,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: color.variable,
          opacity: visible ? 1 : 0,
          transform: dotHovered ? "scale(1.15)" : "scale(1)",
          transition: `opacity ${ms("fast")}, transform 100ms cubic-bezier(0.34, 1.56, 0.64, 1)`,
          pointerEvents: visible ? "auto" : "none",
          outline: "none",
        }}
      >
        {dotHovered ? (
          isLinked ? (
            // × sign for unlink
            <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
              <line x1="2" y1="2" x2="6" y2="6" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="6" y1="2" x2="2" y2="6" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          ) : (
            // + sign for link
            <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
              <line x1="4" y1="1" x2="4" y2="7" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="1" y1="4" x2="7" y2="4" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          )
        ) : (
          // White center dot
          <span
            style={{
              width: 4,
              height: 4,
              borderRadius: "50%",
              background: "white",
            }}
          />
        )}
      </button>
      {!isLinked && pickerOpen && dotRef.current && (
        <VariablePicker
          anchor={dotRef.current}
          type={variableType}
          element={element}
          onSelect={handleSelect}
          onClose={() => setPickerOpen(false)}
          activeVariable={activeVariable}
        />
      )}
    </>
  );
}
