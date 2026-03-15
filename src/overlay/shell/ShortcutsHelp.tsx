import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { color, border, text, font } from "../theme";

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
      { keys: "\u2191 \u2193 \u2190 \u2192", desc: "Navigate elements" },
    ],
  },
  {
    category: "Editing",
    items: [
      { keys: "\u2318Z", desc: "Undo" },
      { keys: "\u2318\u21e7Z", desc: "Redo" },
      { keys: "R", desc: "Reset element" },
      { keys: "\u21e7R", desc: "Reset all elements" },
      { keys: "D (hold)", desc: "Diff peek" },
      { keys: "S", desc: "Cycle scope" },
    ],
  },
  {
    category: "Clipboard",
    items: [
      { keys: "\u2318C", desc: "Copy CSS" },
      { keys: "\u2318S", desc: "Save to source" },
      { keys: "\u2318\u2325C", desc: "Copy styles" },
      { keys: "\u2318\u2325V", desc: "Paste styles" },
      { keys: "\u2318\u21e7V", desc: "Import CSS" },
    ],
  },
  {
    category: "Tools",
    items: [
      { keys: "\u2318K", desc: "Command palette" },
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
      { keys: "1\u20138", desc: "Jump to section" },
      { keys: "[ ]", desc: "Cycle sections" },
      { keys: "T", desc: "Toggle Style / AI tab" },
    ],
  },
];

export function ShortcutsHelp({ onClose }: ShortcutsHelpProps) {
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent
        style={{
          backgroundColor: color.background,
          borderColor: color.border,
          maxWidth: 400,
          maxHeight: "80vh",
          overflowY: "auto",
          border: `1px solid ${color.border}`,
        }}
        className="__tuner-root"
      >
        <DialogHeader>
          <DialogTitle style={{ color: color.foreground, fontSize: 14, fontWeight: 600 }}>
            Keyboard Shortcuts
          </DialogTitle>
        </DialogHeader>

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
      </DialogContent>
    </Dialog>
  );
}
