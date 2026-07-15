/**
 * ChangesDrawer.tsx — unified drawer combining pending changes + history
 *
 * Two tabs:
 * - "Pending" — all changes grouped by element (from SessionDrawer)
 * - "History" — chronological log with "Undo to here" (from HistoryDrawer)
 */

import { useState, useCallback, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { diffAll, type DiffEntry } from "../core/apply";
import { ChevronDown, ChevronRight } from "lucide-react";
import { getDisplayClass, formatCSSDiff } from "../util";
import { composeExportCSS } from "../breakpoints";
import { save, type SideChannelReport } from "../core/save";
import { timing, ms } from "../timing";
import { text, border, surface, color, font, destructiveAlpha, blackAlpha, layout } from "../theme";

// ─── Shared types ────────────────────────────────────────────────

export interface HistoryEntry {
  timestamp: number;
  property: string;
  from: string;
  to: string;
  selector: string;
}

export type ChangesTab = "pending" | "history";

interface ChangesDrawerProps {
  open: boolean;
  tab?: ChangesTab;
  onTabChange?: (tab: ChangesTab) => void;
  onResetAll: () => void;
  onSaved?: () => void;
  entries: HistoryEntry[];
  onUndoToIndex: (index: number) => void;
  onClose: () => void;
}

// ─── Inline-hover button (matches overlay convention) ────────────

function ActionButton({
  children,
  onClick,
  disabled,
  color: textColor = text.label,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  color?: string;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        height: 28,
        paddingLeft: 8,
        paddingRight: 8,
        fontSize: 12,
        fontFamily: font.sans,
        fontWeight: 400,
        border: "none",
        borderRadius: 4,
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.5 : 1,
        color: textColor,
        background: hovered && !disabled ? surface.hover : "transparent",
        transition: `background ${ms("fast")}, opacity ${ms("fast")}`,
      }}
    >
      {children}
    </button>
  );
}

// ─── Main component ──────────────────────────────────────────────

export function ChangesDrawer({
  open,
  tab: controlledTab,
  onTabChange,
  onResetAll,
  onSaved,
  entries,
  onUndoToIndex,
  onClose,
}: ChangesDrawerProps) {
  const [internalTab, setInternalTab] = useState<ChangesTab>("pending");
  const activeTab = controlledTab ?? internalTab;

  const setTab = useCallback(
    (t: ChangesTab) => {
      if (onTabChange) onTabChange(t);
      else setInternalTab(t);
    },
    [onTabChange],
  );

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: timing.layout / 1000 }}
          className="overflow-hidden border-t"
          style={{ borderColor: border.default }}
        >
          {/* Tab bar */}
          <div
            role="tablist"
            aria-label="Changes view"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              padding: "8px 12px 4px",
            }}
          >
            <TabPill label="Pending" active={activeTab === "pending"} onClick={() => setTab("pending")} />
            <TabPill label="History" active={activeTab === "history"} onClick={() => setTab("history")} />
            <div style={{ marginLeft: "auto" }}>
              <ActionButton onClick={onClose}>Close</ActionButton>
            </div>
          </div>

          {/* Tab content — no animation on switch */}
          {activeTab === "pending" ? (
            <PendingContent onResetAll={onResetAll} onSaved={onSaved} />
          ) : (
            <HistoryContent entries={entries} onUndoToIndex={onUndoToIndex} />
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── Tab pill ────────────────────────────────────────────────────

function TabPill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  // Native <button> so the pill is Tab-reachable and activates on Enter/Space
  // for free (issue #85 — this was a mouse-only div).
  return (
    <button
      role="tab"
      aria-selected={active}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        border: "none",
        paddingTop: 0,
        paddingBottom: 0,
        paddingLeft: 8,
        paddingRight: 8,
        fontSize: 10,
        fontFamily: font.sans,
        borderRadius: layout.pillRadius,
        cursor: "pointer",
        lineHeight: "16px",
        whiteSpace: "nowrap" as const,
        transition: `color ${ms("normal")}, background ${ms("normal")}`,
        background: active
          ? (hovered ? blackAlpha(0.1) : surface.active)
          : (hovered ? surface.subtle : "transparent"),
        color: active ? text.primary : (hovered ? blackAlpha(0.6) : text.label),
        fontWeight: active ? 600 : 400,
      }}
    >
      {label}
    </button>
  );
}

// ─── Pending tab content (from SessionDrawer) ────────────────────

function PendingContent({ onResetAll, onSaved }: { onResetAll: () => void; onSaved?: () => void }) {
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const allDiffs = diffAll().filter(({ el }) => document.contains(el));

  const toggleExpand = useCallback((idx: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  }, []);

  const handleCopyAll = useCallback(() => {
    if (allDiffs.length === 0) return;
    // Shared base-vs-@media partition (breakpoints.composeExportCSS) so
    // responsive edits export as real @media blocks, not flattened into base.
    navigator.clipboard.writeText(composeExportCSS(allDiffs, formatCSSDiff));
    setMessage("Copied!");
    setTimeout(() => setMessage(null), timing.dismissal);
  }, [allDiffs]);

  const handleSaveAll = useCallback(async () => {
    if (allDiffs.length === 0) return;
    setSaving(true);
    setMessage(null);

    // SELECTION here is "every element's diff"; targeting, the
    // file-vs-clipboard partition, per-mode transport, fallbacks, and
    // post-save breakpoint reconciliation all live in core/save.ts
    // (ADR-0011) — the SAME pipeline as the Footer save, so the two
    // surfaces structurally cannot diverge (which button you press no
    // longer changes which file is written).
    const outcome = await save(allDiffs);

    const showExtras = (extras: SideChannelReport) => {
      if (!extras.clipboardWritten) return;
      const parts: string[] = [];
      if (extras.breakpointCount) parts.push(`${extras.breakpointCount} breakpoint edit${extras.breakpointCount === 1 ? "" : "s"}`);
      if (extras.modeCount) parts.push(`${extras.modeCount} mode override${extras.modeCount === 1 ? "" : "s"}`);
      if (parts.length > 0) setMessage(`${parts.join(" + ")} copied (not saved to file)`);
    };

    switch (outcome.kind) {
      case "nothing-to-save":
        break;
      case "clipboard":
        // No commit endpoint configured — the full export went to the
        // clipboard instead of silently POSTing into the void (the old
        // Save All fetch(undefined) path).
        setMessage(
          outcome.clipboardWritten
            ? `Copied ${outcome.propertyCount} change${outcome.propertyCount === 1 ? "" : "s"} to clipboard (no save endpoint)`
            : "Clipboard access denied",
        );
        break;
      case "extras-only":
        void outcome.extras.then(showExtras);
        break;
      case "http-error":
        setMessage(`Save failed (${outcome.status})${outcome.detail ? ` — ${outcome.detail}` : ""}`);
        break;
      case "unreachable":
        setMessage(
          outcome.clipboardWritten
            ? "Can't reach the dev server route — CSS copied to clipboard"
            : "Can't reach the dev server route",
        );
        break;
      case "saved": {
        const written = outcome.written.length;
        const failed = outcome.failed.length;
        setMessage(
          failed > 0
            ? `Saved ${written}, ${failed} failed`
            : `Saved ${written} change${written === 1 ? "" : "s"}`,
        );
        onSaved?.();
        void outcome.extras.then(showExtras);
        break;
      }
    }

    setSaving(false);
    setTimeout(() => setMessage(null), timing.dismissal);
  }, [allDiffs, onSaved]);

  const handleResetAll = useCallback(() => {
    // Route the session-wide reset SOLELY through onResetAll (Overlay →
    // useStyleHandlers.handleResetAll → styleEngine.resetAll). The engine path
    // already clears inline + class + state; a direct apply.ts resetAll() here
    // was redundant drift (RFC #14 item B). Mode overrides stay intact by design
    // (ADR-0004).
    setExpanded(new Set());
    onResetAll();
  }, [onResetAll]);

  return (
    <div className="px-3 py-2">
      <div className="text-[11px] uppercase tracking-wider mb-1.5" style={{ color: text.label }}>
        {allDiffs.length} element{allDiffs.length === 1 ? "" : "s"} changed
      </div>

      {allDiffs.map(({ el, changes }, idx) => (
        <ElementGroup
          key={idx}
          el={el}
          changes={changes}
          expanded={expanded.has(idx)}
          onToggle={() => toggleExpand(idx)}
        />
      ))}

      {allDiffs.length === 0 && (
        <div className="text-[11px] py-1" style={{ color: text.label }}>
          No changes yet
        </div>
      )}

      {/* Action bar */}
      <div className="flex items-center justify-between mt-2 pt-1.5 border-t" style={{ borderColor: border.default }}>
        <div style={{ display: "flex", gap: 6 }}>
          <ActionButton onClick={handleCopyAll} disabled={allDiffs.length === 0}>
            Copy All
          </ActionButton>
          <ActionButton onClick={handleSaveAll} disabled={allDiffs.length === 0 || saving}>
            {saving ? "..." : "Save All"}
          </ActionButton>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div role="status" aria-live="polite" style={{ minHeight: 14 }}>
            <AnimatePresence mode="wait">
              {message && (
                <motion.span
                  key={message}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: timing.expand / 1000 }}
                  style={{ fontSize: 10, color: text.label }}
                >
                  {message}
                </motion.span>
              )}
            </AnimatePresence>
          </div>
          <ActionButton onClick={handleResetAll} disabled={allDiffs.length === 0} color={destructiveAlpha(0.8)}>
            Reset All
          </ActionButton>
        </div>
      </div>
    </div>
  );
}

// ─── History tab content (from HistoryDrawer) ────────────────────

function formatTime(ts: number): string {
  const d = new Date(ts);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

function HistoryContent({
  entries,
  onUndoToIndex,
}: {
  entries: HistoryEntry[];
  onUndoToIndex: (index: number) => void;
}) {
  const reversed = [...entries].reverse();

  return (
    <div className="max-h-[200px] overflow-y-auto overflow-x-hidden">
      {reversed.length === 0 ? (
        <div className="p-3 text-[10px] italic text-center" style={{ color: text.label }}>
          No changes yet
        </div>
      ) : (
        reversed.map((entry, ri) => {
          const originalIndex = entries.length - 1 - ri;
          return (
            <div
              key={`${entry.timestamp}-${entry.property}-${ri}`}
              className="px-3 py-1.5 border-b"
              style={{ borderColor: border.default }}
              onMouseEnter={(e) => { e.currentTarget.style.background = surface.hover; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
            >
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-mono" style={{ color: text.label }}>
                  {formatTime(entry.timestamp)}
                </span>
                <ActionButton onClick={() => onUndoToIndex(originalIndex)}>
                  Undo to here
                </ActionButton>
              </div>
              <div className="text-[11px] font-medium font-mono mt-0.5" style={{ color: color.foreground }}>
                {entry.property}
              </div>
              <div className="text-[10px] mt-px" style={{ color: text.label }}>
                <span className="text-red-400/70">{entry.from || "(none)"}</span>
                <span className="mx-1">&rarr;</span>
                <span className="text-green-400/70">{entry.to}</span>
              </div>
              <div className="text-[9px] opacity-50 mt-px overflow-hidden text-ellipsis whitespace-nowrap" style={{ color: text.label }}>
                {entry.selector}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

// ─── Element group (for pending tab) ─────────────────────────────

function ElementGroup({
  el,
  changes,
  expanded,
  onToggle,
}: {
  el: Element;
  changes: DiffEntry[];
  expanded: boolean;
  onToggle: () => void;
}) {
  const tag = el.tagName.toLowerCase();
  const cls = getDisplayClass(el);

  return (
    <div className="mb-1">
      <button
        onClick={onToggle}
        className="flex items-center gap-1.5 w-full bg-transparent border-none py-0.5 cursor-pointer text-left text-[12px] font-mono"
        style={{ color: color.foreground }}
      >
        <span className="flex items-center" style={{ color: text.label }}>
          {expanded ? <ChevronDown size={10} strokeWidth={2} /> : <ChevronRight size={10} strokeWidth={2} />}
        </span>
        <span style={{ color: color.foreground }}>{"<"}{tag}{">"}</span>
        {cls && <span style={{ color: text.label }}>.{cls}</span>}
        <span className="ml-auto text-[10px]" style={{ color: text.label }}>
          {changes.length} change{changes.length === 1 ? "" : "s"}
        </span>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: timing.expand / 1000 }}
            className="overflow-hidden"
          >
            {changes.map((c, i) => (
              <div
                key={i}
                className="flex items-baseline gap-1.5 py-0.5 pl-[18px] text-[11px] font-mono"
              >
                <span className="min-w-[100px]" style={{ color: text.label }}>{c.prop}</span>
                <span style={{ color: text.label }}>{c.from}</span>
                <span className="opacity-50" style={{ color: text.label }}>&rarr;</span>
                <span style={{ color: color.foreground }}>{c.to}</span>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
