/**
 * HistoryDrawer.tsx — chronological log of all property changes in current session
 *
 * Shows timestamp, property name, old->new value, and element selector.
 * "Undo to here" button on each entry.
 */

import { AnimatePresence, motion } from "motion/react";
import { ms, timing } from "./timing";

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
      style={{
        overflow: "hidden",
        borderTop: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "8px 12px 4px",
      }}>
        <span style={{
          fontSize: 10,
          fontWeight: 600,
          color: "rgba(255,255,255,0.5)",
          textTransform: "uppercase",
          letterSpacing: "0.04em",
        }}>
          History ({entries.length})
        </span>
        <button
          onClick={onClose}
          style={{
            background: "none",
            border: "none",
            color: "rgba(255,255,255,0.35)",
            fontSize: 11,
            cursor: "pointer",
            padding: "2px 6px",
          }}
        >
          Close
        </button>
      </div>

      <div style={{
        maxHeight: 200,
        overflowY: "auto",
        overflowX: "hidden",
      }}>
        {reversed.length === 0 ? (
          <div style={{
            padding: "12px",
            fontSize: 10,
            color: "rgba(255,255,255,0.25)",
            fontStyle: "italic",
            textAlign: "center",
          }}>
            No changes yet
          </div>
        ) : (
          reversed.map((entry, ri) => {
            const originalIndex = entries.length - 1 - ri;
            return (
              <div
                key={`${entry.timestamp}-${entry.property}-${ri}`}
                style={{
                  padding: "6px 12px",
                  borderBottom: "1px solid rgba(255,255,255,0.04)",
                }}
              >
                <div style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}>
                  <span style={{
                    fontSize: 10,
                    color: "rgba(255,255,255,0.35)",
                    fontFamily: "ui-monospace, 'SF Mono', monospace",
                  }}>
                    {formatTime(entry.timestamp)}
                  </span>
                  <button
                    onClick={() => onUndoToIndex(originalIndex)}
                    style={{
                      background: "rgba(255,255,255,0.06)",
                      border: "1px solid rgba(255,255,255,0.08)",
                      borderRadius: 3,
                      color: "rgba(255,255,255,0.4)",
                      fontSize: 9,
                      cursor: "pointer",
                      padding: "1px 6px",
                      transition: `color ${ms("fast")}, background ${ms("fast")}`,
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.7)";
                      (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.1)";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.4)";
                      (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.06)";
                    }}
                  >
                    Undo to here
                  </button>
                </div>
                <div style={{
                  fontSize: 11,
                  color: "rgba(255,255,255,0.7)",
                  fontFamily: "ui-monospace, 'SF Mono', monospace",
                  marginTop: 2,
                }}>
                  {entry.property}
                </div>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginTop: 1 }}>
                  <span style={{ color: "rgba(239,68,68,0.7)" }}>{entry.from || "(none)"}</span>
                  <span style={{ margin: "0 4px" }}>&rarr;</span>
                  <span style={{ color: "rgba(34,197,94,0.7)" }}>{entry.to}</span>
                </div>
                <div style={{
                  fontSize: 9,
                  color: "rgba(255,255,255,0.2)",
                  marginTop: 1,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}>
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
