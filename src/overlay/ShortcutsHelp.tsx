import React, { useEffect } from "react";
import { ms } from "./timing";

interface ShortcutsHelpProps {
  onClose: () => void;
}

const SHORTCUTS = [
  {
    category: "Selection",
    items: [
      { keys: "`", desc: "Toggle selection mode" },
      { keys: "Esc", desc: "Close panel" },
      { keys: "↑ ↓ ← →", desc: "Navigate elements" },
    ],
  },
  {
    category: "Editing",
    items: [
      { keys: "⌘Z", desc: "Undo" },
      { keys: "⌘⇧Z", desc: "Redo" },
      { keys: "R", desc: "Reset element" },
      { keys: "D (hold)", desc: "Diff peek" },
      { keys: "S", desc: "Cycle scope" },
    ],
  },
  {
    category: "Clipboard",
    items: [
      { keys: "⌘C", desc: "Copy CSS" },
      { keys: "⌘S", desc: "Save to source" },
      { keys: "⌘⌥C", desc: "Copy styles" },
      { keys: "⌘⌥V", desc: "Paste styles" },
      { keys: "⌘⇧V", desc: "Import CSS" },
    ],
  },
  {
    category: "Tools",
    items: [
      { keys: "⌘K", desc: "Command palette" },
      { keys: "?", desc: "This help" },
      { keys: "/", desc: "Search properties" },
    ],
  },
];

export function ShortcutsHelp({ onClose }: ShortcutsHelpProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.4)",
        zIndex: 2147483647,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transition: `opacity ${ms("normal")}`,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 400,
          maxHeight: "80vh",
          overflowY: "auto",
          background: "#1e1e1e",
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: 12,
          padding: "20px 24px",
        }}
      >
        <div
          style={{
            fontSize: 14,
            color: "rgba(255,255,255,0.9)",
            marginBottom: 16,
            fontWeight: 600,
          }}
        >
          Keyboard Shortcuts
        </div>

        {SHORTCUTS.map((section) => (
          <div key={section.category}>
            <div
              style={{
                fontSize: 10,
                textTransform: "uppercase",
                color: "rgba(255,255,255,0.4)",
                letterSpacing: 0.5,
                marginTop: 12,
                marginBottom: 6,
              }}
            >
              {section.category}
            </div>

            {section.items.map((item) => (
              <div
                key={item.keys}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "4px 0",
                }}
              >
                <span
                  style={{
                    background: "rgba(255,255,255,0.1)",
                    borderRadius: 4,
                    padding: "2px 6px",
                    fontFamily: "ui-monospace, 'SF Mono', monospace",
                    fontSize: 11,
                    color: "rgba(255,255,255,0.8)",
                  }}
                >
                  {item.keys}
                </span>
                <span
                  style={{
                    color: "rgba(255,255,255,0.7)",
                    fontSize: 12,
                  }}
                >
                  {item.desc}
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
