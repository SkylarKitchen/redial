/**
 * CloseWarningBar.tsx — the "N unsaved changes" confirmation strip shown at the
 * bottom of the inspector when closing a panel that has unsaved overrides.
 *
 * Extracted verbatim from Overlay.tsx. Owns its own AnimatePresence so the
 * expand/collapse exit animation is preserved; the unsaved-change count is read
 * from the live selected-element ref at render time.
 */

import type { RefObject } from "react";
import { AnimatePresence, motion } from "motion/react";
import { overrideCount } from "../core/apply";
import { styleEngine } from "../core/engine";
import { resetAllModeOverrides } from "../core/modeOverrides";
import { font, text, border, surface, destructiveAlpha } from "../theme";

export interface CloseWarningBarProps {
  open: boolean;
  selectedElRef: RefObject<Element | null>;
  onDiscard: () => void;
  onKeepEditing: () => void;
}

export function CloseWarningBar({ open, selectedElRef, onDiscard, onKeepEditing }: CloseWarningBarProps) {
  return (
    <AnimatePresence>
      {open && (() => {
        const count = selectedElRef.current ? overrideCount(selectedElRef.current) : 0;
        return (
          <motion.div
            key="close-warning"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            style={{
              background: destructiveAlpha(0.08),
              fontSize: 12,
              fontFamily: font.sans,
              color: text.label,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "6px 10px",
              borderTop: `1px solid ${border.default}`,
              overflow: "hidden",
            }}
          >
            <span>{count} unsaved change{count === 1 ? "" : "s"}</span>
            <div style={{ display: "flex", gap: 6 }}>
              <button
                onClick={() => {
                  // "Discard" must actually discard ("Discard doesn't
                  // discard" trust bug): revert EVERY unsaved override —
                  // element/class/state via the engine's session-wide reset
                  // (which also wipes the persisted localStorage session so
                  // nothing resurrects on reload) PLUS global CSS-variable
                  // mode overrides (their own dimension, in-memory only) —
                  // before handing back to the host to close the panel.
                  styleEngine.resetAll();
                  resetAllModeOverrides();
                  onDiscard();
                }}
                style={{
                  background: surface.hover,
                  border: `1px solid ${border.default}`,
                  borderRadius: 4,
                  padding: "2px 8px",
                  fontSize: 11,
                  fontFamily: font.sans,
                  color: text.label,
                  cursor: "pointer",
                }}
              >
                Discard
              </button>
              <button
                onClick={onKeepEditing}
                style={{
                  background: surface.hover,
                  border: `1px solid ${border.default}`,
                  borderRadius: 4,
                  padding: "2px 8px",
                  fontSize: 11,
                  fontFamily: font.sans,
                  color: text.label,
                  cursor: "pointer",
                }}
              >
                Keep Editing
              </button>
            </div>
          </motion.div>
        );
      })()}
    </AnimatePresence>
  );
}
