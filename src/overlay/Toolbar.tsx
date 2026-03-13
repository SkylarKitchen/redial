/**
 * Toolbar.tsx — Expandable FAB toolbar
 *
 * Collapsed: 48px dark circle with Plus icon (matches existing FAB)
 * Expanded: ~200px pill with tool icons (crosshair, variables, AI, session)
 *
 * Replaces the single-purpose FAB in Overlay.tsx.
 */

import { useState, useRef, useCallback } from "react";
import { Plus } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useClickOutside } from "./useClickOutside";
import { ms, springConfig } from "./timing";
import { primaryAlpha, blackAlpha, bgAlpha, surface, darkToolbar } from "./theme";
import type { ActivePanel } from "./Overlay";

// ─── Types ───────────────────────────────────────────────────────────

interface ToolbarProps {
  selecting: boolean;
  hasSelectedEl: boolean;
  activePanel: ActivePanel;
  onToggleSelecting: () => void;
  onOpenVariables: () => void;
  onOpenPrompt: () => void;
  onToggleSession: () => void;
  onClose: () => void;
}

// ─── Tool Definitions ────────────────────────────────────────────────

const HIT_SIZE = 32;

function ToolButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        height: HIT_SIZE,
        borderRadius: 6,
        border: "none",
        background: active
          ? darkToolbar.active
          : hovered
          ? darkToolbar.hover
          : "transparent",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        paddingLeft: 10,
        paddingRight: 10,
        fontSize: 12,
        fontWeight: active ? 500 : 400,
        fontFamily: "system-ui, -apple-system, sans-serif",
        color: active ? darkToolbar.text : darkToolbar.textMuted,
        whiteSpace: "nowrap" as const,
        transition: `background ${ms("fast")}, color ${ms("fast")}`,
      }}
    >
      {label}
    </button>
  );
}

// ─── Main Toolbar ────────────────────────────────────────────────────

export function Toolbar({
  selecting,
  hasSelectedEl,
  activePanel,
  onToggleSelecting,
  onOpenVariables,
  onOpenPrompt,
  onToggleSession,
  onClose,
}: ToolbarProps) {
  const [expanded, setExpanded] = useState(false);
  const toolbarRef = useRef<HTMLDivElement>(null);

  const isActive = selecting || hasSelectedEl;

  // Only allow click-outside collapse when nothing is active
  const collapse = useCallback(() => {
    if (!selecting && !hasSelectedEl) setExpanded(false);
  }, [selecting, hasSelectedEl]);
  useClickOutside(toolbarRef, expanded, collapse);

  const handleFabClick = () => {
    if (expanded && !isActive) {
      setExpanded(false);
      return;
    }
    if (hasSelectedEl) {
      onClose();
      setExpanded(false);
      return;
    }
    if (selecting) {
      onToggleSelecting();
      return;
    }
    // Expand toolbar AND enter select mode in one click
    setExpanded(true);
    onToggleSelecting();
  };

  return (
    <div
      ref={toolbarRef}
      className="__tuner-root"
      style={{
        position: "fixed",
        bottom: 24,
        right: 24,
        zIndex: 2147483647,
      }}
    >
      <motion.div
        layout
        style={{
          height: 48,
          borderRadius: 24,
          background: surface.darkToolbar,
          border: `1px solid ${isActive ? primaryAlpha(0.4) : darkToolbar.border}`,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: expanded ? "flex-start" : "center",
          gap: 2,
          paddingLeft: expanded ? 8 : 0,
          paddingRight: expanded ? 8 : 0,
          overflow: "hidden",
          transition: `box-shadow ${ms("layout")}, border-color ${ms("layout")}`,
          boxShadow: isActive
            ? `0 0 0 1px ${primaryAlpha(0.4)}, 0 4px 20px ${blackAlpha(0.12)}`
            : `0 4px 20px ${blackAlpha(0.25)}, 0 0 0 0.5px ${bgAlpha(0.06)}`,
        }}
        animate={{
          width: expanded ? 300 : 48,
        }}
        transition={springConfig("toolbarExpand")}
      >
        {/* Plus / Close icon — always visible */}
        <motion.div
          style={{
            width: expanded ? HIT_SIZE : 48,
            height: expanded ? HIT_SIZE : 48,
            borderRadius: expanded ? 6 : 24,
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          onClick={handleFabClick}
        >
          <Plus
            size={20}
            strokeWidth={1.5}
            color={darkToolbar.icon}
            style={{
              transition: `transform ${ms("layout")}`,
              transform: (isActive || expanded) ? "rotate(45deg)" : "rotate(0deg)",
            }}
          />
        </motion.div>

        {/* Expanded tool icons */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 2,
              }}
            >
              <ToolButton
                label="Select"
                active={selecting || (hasSelectedEl && activePanel.type === "inspector")}
                onClick={onToggleSelecting}
              />
              <ToolButton
                label="Variables"
                active={activePanel.type === "variables"}
                onClick={onOpenVariables}
              />
              <ToolButton
                label="AI"
                active={activePanel.type === "inspector" && "tab" in activePanel && activePanel.tab === "prompt"}
                onClick={onOpenPrompt}
              />
              <ToolButton
                label="Session"
                active={activePanel.type === "session"}
                onClick={onToggleSession}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
