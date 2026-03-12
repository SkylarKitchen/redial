/**
 * HistoryDrawer.tsx — chronological log of all property changes in current session
 *
 * Shows timestamp, property name, old->new value, and element selector.
 * "Undo to here" button on each entry.
 */

import { motion } from "motion/react";
import { timing } from "./timing";
import { Button } from "@/components/ui/button";

export interface HistoryEntry {
  timestamp: number;
  property: string;
  from: string;
  to: string;
  selector: string;
}

export interface HistoryDrawerProps {
  entries: HistoryEntry[];
  onUndoToIndex: (index: number) => void;
  onClose: () => void;
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

export function HistoryDrawer({ entries, onUndoToIndex, onClose }: HistoryDrawerProps) {
  const reversed = [...entries].reverse();

  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: "auto", opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: timing.expand / 1000 }}
      className="overflow-hidden border-t border-[var(--border)]"
    >
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border)]">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
          History ({entries.length})
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="h-6 px-2 text-[11px] text-[var(--muted-foreground)]"
        >
          Close
        </Button>
      </div>

      <div className="max-h-[200px] overflow-y-auto overflow-x-hidden">
        {reversed.length === 0 ? (
          <div className="p-3 text-[10px] text-[var(--muted-foreground)] italic text-center">
            No changes yet
          </div>
        ) : (
          reversed.map((entry, ri) => {
            const originalIndex = entries.length - 1 - ri;
            return (
              <div
                key={`${entry.timestamp}-${entry.property}-${ri}`}
                className="px-3 py-1.5 border-b border-[var(--border)] hover:bg-[var(--accent)]"
              >
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-[var(--muted-foreground)] font-mono">
                    {formatTime(entry.timestamp)}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onUndoToIndex(originalIndex)}
                    className="h-5 px-1.5 text-[9px] text-[var(--muted-foreground)]"
                  >
                    Undo to here
                  </Button>
                </div>
                <div className="text-[11px] font-medium text-[var(--foreground)] font-mono mt-0.5">
                  {entry.property}
                </div>
                <div className="text-[10px] text-[var(--muted-foreground)] mt-px">
                  <span className="text-red-400/70">{entry.from || "(none)"}</span>
                  <span className="mx-1">&rarr;</span>
                  <span className="text-green-400/70">{entry.to}</span>
                </div>
                <div className="text-[9px] text-[var(--muted-foreground)] opacity-50 mt-px overflow-hidden text-ellipsis whitespace-nowrap">
                  {entry.selector}
                </div>
              </div>
            );
          })
        )}
      </div>
    </motion.div>
  );
}
