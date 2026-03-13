import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { color } from "./theme";

interface ShortcutsHelpProps {
  onClose: () => void;
}

const SHORTCUTS = [
  {
    category: "Selection",
    items: [
      { keys: "`", desc: "Toggle selection mode" },
      { keys: "Esc", desc: "Close panel" },
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
      { keys: "H", desc: "Toggle history drawer" },
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
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent
        style={{ backgroundColor: color.background, borderColor: color.border }}
        className="__tuner-root max-w-[400px] max-h-[80vh] overflow-y-auto border"
      >
        <DialogHeader>
          <DialogTitle style={{ color: color.foreground }} className="text-[14px] font-semibold">
            Keyboard Shortcuts
          </DialogTitle>
        </DialogHeader>

        {SHORTCUTS.map((section) => (
          <div key={section.category} className="mb-4">
            <div style={{ color: color.mutedForeground }} className="text-[11px] font-medium uppercase tracking-wider mb-2">
              {section.category}
            </div>

            {section.items.map((item) => (
              <div
                key={item.keys}
                className="flex items-center justify-between py-1"
              >
                <span style={{ backgroundColor: color.input, borderColor: color.border }} className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono border rounded">
                  {item.keys}
                </span>
                <span style={{ color: color.foreground }} className="text-[12px]">
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
