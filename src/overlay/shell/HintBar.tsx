/**
 * HintBar.tsx — first-use hint strip at the bottom of the inspector
 * ("⌘S save · ⌘Z undo · ? all shortcuts"). Click to dismiss.
 *
 * Extracted verbatim from Overlay.tsx. Owns its AnimatePresence for the fade
 * exit; dismissal (including localStorage persistence) is handled by the caller.
 */

import { AnimatePresence, motion } from "motion/react";
import { font, text, surface, border } from "../theme";

export interface HintBarProps {
  show: boolean;
  onDismiss: () => void;
}

export function HintBar({ show, onDismiss }: HintBarProps) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key="hint-bar"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onDismiss}
          style={{
            fontSize: 10,
            fontFamily: font.sans,
            color: text.disabled,
            background: surface.subtle,
            textAlign: "center",
            padding: "5px 12px",
            borderTop: `1px solid ${border.subtle}`,
            cursor: "pointer",
            userSelect: "none",
          }}
        >
          {"⌘S save · ⌘Z undo · ? all shortcuts"}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
