/**
 * KeyboardHelpModal.tsx — Keyboard shortcut reference overlay
 *
 * Triggered by pressing '?' — shows all available shortcuts grouped by category.
 * Closes on Escape or clicking the backdrop.
 */

import { useEffect, useRef, useCallback } from "react";
import { ms } from "./timing";

export interface KeyboardHelpModalProps {
  onClose: () => void;
}

interface ShortcutEntry {
  keys: string[];
  desc: string;
}

interface ShortcutCategory {
  label: string;
  entries: ShortcutEntry[];
}

const categories: ShortcutCategory[] = [
  {
    label: "Selection",
    entries: [
      { keys: ["`"], desc: "Toggle element selector" },
      { keys: ["Escape"], desc: "Close panel" },
      { keys: ["Click"], desc: "Re-select element" },
    ],
  },
  {
    label: "Navigation",
    entries: [
      { keys: ["\u2191"], desc: "Parent element" },
      { keys: ["\u2193"], desc: "First child" },
      { keys: ["\u2190"], desc: "Previous sibling" },
      { keys: ["\u2192"], desc: "Next sibling" },
    ],
  },
  {
    label: "Actions",
    entries: [
      { keys: ["S"], desc: "Cycle scope" },
      { keys: ["R"], desc: "Reset overrides" },
      { keys: ["D"], desc: "Diff peek (hold)" },
      { keys: ["M"], desc: "Box model overlay" },
    ],
  },
  {
    label: "Edit",
    entries: [
      { keys: ["\u2318", "Z"], desc: "Undo" },
      { keys: ["\u2318", "\u21e7", "Z"], desc: "Redo" },
      { keys: ["\u2318", "S"], desc: "Save to source" },
      { keys: ["\u2318", "C"], desc: "Copy CSS diff" },
    ],
  },
  {
    label: "Clipboard",
    entries: [
      { keys: ["\u2318", "\u2325", "C"], desc: "Copy styles" },
      { keys: ["\u2318", "\u2325", "V"], desc: "Paste styles" },
    ],
  },
  {
    label: "Search",
    entries: [
      { keys: ["\u2318", "F"], desc: "Search properties" },
      { keys: ["/"], desc: "Search properties" },
      { keys: ["?"], desc: "This help" },
    ],
  },
];

function KeyBadge({ label }: { label: string }) {
  return (
    <kbd
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minWidth: 22,
        height: 22,
        padding: "0 6px",
        fontSize: "11px",
        fontFamily: "ui-monospace, 'SF Mono', monospace",
        color: "rgba(255,255,255,0.85)",
        background: "rgba(255,255,255,0.08)",
        border: "1px solid rgba(255,255,255,0.12)",
        borderRadius: "4px",
        lineHeight: 1,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </kbd>
  );
}

export function KeyboardHelpModal({ onClose }: KeyboardHelpModalProps) {
  const backdropRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "?") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    },
    [onClose],
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown, true);
    return () => document.removeEventListener("keydown", handleKeyDown, true);
  }, [handleKeyDown]);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === backdropRef.current) {
        onClose();
      }
    },
    [onClose],
  );

  return (
    <div
      ref={backdropRef}
      onClick={handleBackdropClick}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 2147483647,
        background: "rgba(0,0,0,0.5)",
        backdropFilter: "blur(4px)",
        WebkitBackdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        animation: `tuner-help-fade-in ${ms("expand")} ease-out both`,
      }}
    >
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @keyframes tuner-help-fade-in {
              from { opacity: 0; }
              to { opacity: 1; }
            }
            @keyframes tuner-help-slide-in {
              from { opacity: 0; transform: translateY(8px) scale(0.97); }
              to { opacity: 1; transform: translateY(0) scale(1); }
            }
          `,
        }}
      />
      <div
        style={{
          width: 320,
          maxHeight: "80vh",
          overflowY: "auto",
          background: "#1e1e1e",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: "10px",
          boxShadow:
            "0 8px 32px rgba(0,0,0,0.6), 0 0 0 0.5px rgba(255,255,255,0.06)",
          padding: "16px 0",
          animation: `tuner-help-slide-in ${ms("layout")} ease-out both`,
        }}
      >
        {/* Title */}
        <div
          style={{
            padding: "0 16px 12px",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
            marginBottom: "4px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span
            style={{
              fontSize: "13px",
              fontWeight: 600,
              color: "rgba(255,255,255,0.9)",
              fontFamily: "system-ui, -apple-system, sans-serif",
            }}
          >
            Keyboard Shortcuts
          </span>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: "rgba(255,255,255,0.4)",
              cursor: "pointer",
              fontSize: "16px",
              lineHeight: 1,
              padding: "2px 4px",
              borderRadius: "4px",
            }}
            onMouseEnter={(e) => {
              (e.target as HTMLElement).style.color = "rgba(255,255,255,0.7)";
            }}
            onMouseLeave={(e) => {
              (e.target as HTMLElement).style.color = "rgba(255,255,255,0.4)";
            }}
          >
            {"\u00d7"}
          </button>
        </div>

        {/* Categories */}
        {categories.map((cat, ci) => (
          <div key={cat.label} style={{ padding: "8px 16px" }}>
            <div
              style={{
                fontSize: "10px",
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                color: "rgba(255,255,255,0.35)",
                marginBottom: "6px",
                fontFamily: "system-ui, -apple-system, sans-serif",
              }}
            >
              {cat.label}
            </div>
            {cat.entries.map((entry, ei) => (
              <div
                key={ei}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "4px 0",
                }}
              >
                <span
                  style={{
                    fontSize: "12px",
                    color: "rgba(255,255,255,0.6)",
                    fontFamily: "system-ui, -apple-system, sans-serif",
                  }}
                >
                  {entry.desc}
                </span>
                <span
                  style={{
                    display: "flex",
                    gap: "3px",
                    flexShrink: 0,
                    marginLeft: "12px",
                  }}
                >
                  {entry.keys.map((k, ki) => (
                    <KeyBadge key={ki} label={k} />
                  ))}
                </span>
              </div>
            ))}
            {ci < categories.length - 1 && (
              <div
                style={{
                  borderBottom: "1px solid rgba(255,255,255,0.06)",
                  marginTop: "8px",
                }}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
