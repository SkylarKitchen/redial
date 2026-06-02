/**
 * controls/SwatchColorPicker.tsx — Reusable color swatch + portalled picker.
 *
 * Renders a color swatch button and, when opened, portals ColorPickerEnhanced
 * to document.body as a `position:fixed` surface so it is never clipped by the
 * panel's `overflow:hidden`. Placement is anchored to the swatch rect with
 * viewport clamping + flip-above (via computeColorPickerPosition, the same
 * helper ColorRow uses), tagged `data-tuner-portal`, and z-indexed to
 * zIndex.max.
 *
 * Owns its own open/close state; closes on Escape (ColorPickerEnhanced already
 * handles outside-click dismissal internally).
 *
 * Used by ShadowEditor, GradientEditor, and FilterSliders — the sub-editors
 * that previously mounted the picker `position:absolute` inside the panel and
 * got clipped near the right edge / bottom.
 */

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { ColorPickerEnhanced } from "./ColorPickerEnhanced";
import { computeColorPickerPosition } from "./colorPickerPosition";
import { cssColorToHex } from "../colorUtils";
import { parseVarRef, resolveVarColor } from "../variables/colorVariables";
import { zIndex } from "../theme";

export interface SwatchColorPickerProps {
  /** Current color value — raw CSS color or a var() reference. */
  value: string;
  /**
   * Emitted when the user edits the color via the picker canvas/sliders/hex.
   * `opacity` is 0-1; callers decide how to fold it into the stored value.
   */
  onChange: (hex: string, opacity: number) => void;
  /** Emitted when a CSS variable swatch is chosen, e.g. "var(--brand)". */
  onSelectVariable?: (varExpression: string) => void;
  /** Hex used when `value` is empty/undefined (drop-shadow with no color). */
  fallbackColor?: string;
  /** Swatch button title (tooltip). */
  title?: string;
  /** Inline style overrides for the swatch button (size, border, etc.). */
  swatchStyle?: React.CSSProperties;
  disabled?: boolean;
}

export function SwatchColorPicker({
  value,
  onChange,
  onSelectVariable,
  fallbackColor = "#000000",
  title,
  swatchStyle,
  disabled,
}: SwatchColorPickerProps) {
  const [open, setOpen] = useState(false);
  const swatchRef = useRef<HTMLButtonElement>(null);

  // Close on Escape (outside-click is handled inside ColorPickerEnhanced).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [open]);

  const resolved = resolveVarColor(value) ?? value;
  const swatchBackground = resolved || fallbackColor;
  const pickerColor = cssColorToHex(resolved || fallbackColor);
  const activeVariable = parseVarRef(value);

  return (
    <>
      <button
        ref={swatchRef}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        title={title}
        style={{
          cursor: disabled ? "default" : "pointer",
          padding: 0,
          flexShrink: 0,
          background: swatchBackground,
          ...swatchStyle,
        }}
      />
      {open && swatchRef.current && (() => {
        const { top, left, maxHeight } = computeColorPickerPosition(
          swatchRef.current.getBoundingClientRect(),
          { width: window.innerWidth, height: window.innerHeight }
        );
        return createPortal(
          <div
            data-tuner-portal
            style={{ position: "fixed", top, left, maxHeight, overflowY: "auto", zIndex: zIndex.max }}
          >
            <ColorPickerEnhanced
              color={pickerColor}
              onChange={onChange}
              onClose={() => setOpen(false)}
              {...(onSelectVariable
                ? {
                    onSelectVariable: (varExpr: string) => {
                      onSelectVariable(varExpr);
                      setOpen(false);
                    },
                  }
                : {})}
              activeVariable={activeVariable}
            />
          </div>,
          document.body
        );
      })()}
    </>
  );
}
