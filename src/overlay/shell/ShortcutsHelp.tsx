import { Modal } from "./Modal";
import { color, font } from "../theme";

interface ShortcutsHelpProps {
  onClose: () => void;
}

const SHORTCUTS = [
  {
    category: "Selection",
    items: [
      { keys: "`", desc: "Toggle selection mode" },
      { keys: "Esc", desc: "Close panel" },
      { keys: "P", desc: "Pin / unpin element" },
      { keys: "N", desc: "Toggle navigator" },
      { keys: "↑ ↓ ← →", desc: "Navigate elements" },
    ],
  },
  {
    category: "Editing",
    items: [
      { keys: "⌘Z", desc: "Undo" },
      { keys: "⌘⇧Z", desc: "Redo" },
      { keys: "R", desc: "Reset element" },
      { keys: "⇧R", desc: "Reset all elements" },
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
      { keys: "H", desc: "Toggle changes drawer" },
      { keys: "M", desc: "Toggle box model overlay" },
      { keys: "G", desc: "Toggle grid overlay" },
    ],
  },
  {
    category: "Navigation",
    items: [
      { keys: "1–8", desc: "Jump to section" },
      { keys: "[ ]", desc: "Cycle sections" },
      { keys: "T", desc: "Toggle Style / AI tab" },
    ],
  },
];

export function ShortcutsHelp({ onClose }: ShortcutsHelpProps) {
  return (
    <Modal
      onClose={onClose}
      maxWidth={400}
      labelledBy="tuner-shortcuts-title"
      contentStyle={{ padding: 16 }}
    >
      <h2
        id="tuner-shortcuts-title"
        style={{
          color: color.foreground,
          fontSize: 14,
          fontWeight: 600,
          margin: "0 0 12px 0",
        }}
      >
        Keyboard Shortcuts
      </h2>

      {SHORTCUTS.map((section) => (
        <div key={section.category} style={{ marginBottom: 16 }}>
          <div style={{
            color: color.mutedForeground,
            fontSize: 11,
            fontWeight: 500,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            marginBottom: 8,
          }}>
            {section.category}
          </div>

          {section.items.map((item) => (
            <div
              key={item.keys}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "4px 0",
              }}
            >
              <span style={{
                display: "inline-flex",
                alignItems: "center",
                padding: "2px 6px",
                fontSize: 10,
                fontFamily: font.mono,
                border: `1px solid ${color.border}`,
                borderRadius: 4,
                backgroundColor: color.input,
              }}>
                {item.keys}
              </span>
              <span style={{ color: color.foreground, fontSize: 12 }}>
                {item.desc}
              </span>
            </div>
          ))}
        </div>
      ))}
    </Modal>
  );
}
