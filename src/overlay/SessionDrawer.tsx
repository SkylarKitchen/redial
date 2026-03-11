/**
 * SessionDrawer.tsx — expandable panel showing all accumulated changes
 *
 * Groups changes by element, each expandable to show property-level diffs.
 * Provides Copy All, Save All, and Reset All actions.
 */

import { useState, useCallback } from "react";
import { AnimatePresence, motion } from "motion/react";
import { diffAll, resetAll, type DiffEntry } from "./apply";
import { ChevronDown, ChevronRight } from "lucide-react";
import { getDisplayClass, formatCSSDiff } from "./util";
import { resolveSource, getModuleClassInfo } from "./sourcemap";
import { timing } from "./timing";

interface SessionDrawerProps {
  open: boolean;
  onResetAll: () => void;
  onSaved?: () => void;
}

export function SessionDrawer({ open, onResetAll, onSaved }: SessionDrawerProps) {
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const allDiffs = open
    ? diffAll().filter(({ el }) => document.contains(el))
    : [];

  const toggleExpand = useCallback((idx: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  }, []);

  const handleCopyAll = useCallback(() => {
    if (allDiffs.length === 0) return;
    const blocks = allDiffs.map(({ el, changes }) => formatCSSDiff(el, changes));
    navigator.clipboard.writeText(blocks.join("\n\n"));
    setMessage("Copied!");
    setTimeout(() => setMessage(null), 1500);
  }, [allDiffs]);

  const handleSaveAll = useCallback(async () => {
    if (allDiffs.length === 0) return;
    setSaving(true);
    setMessage(null);

    const enriched = allDiffs.flatMap(({ el, changes }) => {
      const moduleInfo = getModuleClassInfo(el);
      return changes.map((c) => {
        const source = resolveSource(el, c.prop);
        return {
          ...c,
          sourceFile: source?.file,
          sourceLine: source?.line,
          className: moduleInfo?.className,
          componentName: moduleInfo?.componentName,
        };
      });
    });

    try {
      const res = await fetch("/api/tuner/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ changes: enriched }),
      });

      if (!res.ok) {
        setMessage("Save failed");
      } else {
        const result = await res.json();
        const written = result.written?.length ?? 0;
        const failed = result.failed?.length ?? 0;
        setMessage(
          failed > 0
            ? `Saved ${written}, ${failed} failed`
            : `Saved ${written} change${written === 1 ? "" : "s"}`
        );
        onSaved?.();
      }
    } catch {
      setMessage("Save failed — no route?");
    }

    setSaving(false);
    setTimeout(() => setMessage(null), 2000);
  }, [allDiffs, onSaved]);

  const handleResetAll = useCallback(() => {
    resetAll();
    setExpanded(new Set());
    onResetAll();
  }, [onResetAll]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: timing.layout / 1000 }}
          style={{ overflow: "hidden", borderTop: "1px solid rgba(255,255,255,0.1)" }}
        >
          <div style={{ padding: "8px 12px" }}>
            <div
              style={{
                fontSize: "11px",
                color: "rgba(255, 255, 255, 0.4)",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                marginBottom: "6px",
              }}
            >
              Session — {allDiffs.length} element{allDiffs.length === 1 ? "" : "s"}
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
              <div style={{ color: "rgba(255, 255, 255, 0.3)", fontSize: "11px", padding: "4px 0" }}>
                No changes yet
              </div>
            )}

            {/* Action bar */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginTop: "8px",
                paddingTop: "6px",
                borderTop: "1px solid rgba(255,255,255,0.1)",
              }}
            >
              <div style={{ display: "flex", gap: "6px" }}>
                <SmallButton onClick={handleCopyAll} disabled={allDiffs.length === 0}>
                  Copy All
                </SmallButton>
                <SmallButton onClick={handleSaveAll} disabled={allDiffs.length === 0 || saving} primary>
                  {saving ? "..." : "Save All"}
                </SmallButton>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                {message && (
                  <span style={{ color: "rgba(255, 255, 255, 0.4)", fontSize: "10px" }}>{message}</span>
                )}
                <SmallButton onClick={handleResetAll} disabled={allDiffs.length === 0}>
                  Reset All
                </SmallButton>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// --- Sub-components ---

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
    <div style={{ marginBottom: "4px" }}>
      <button
        onClick={onToggle}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          width: "100%",
          background: "none",
          border: "none",
          padding: "3px 0",
          cursor: "pointer",
          textAlign: "left",
          fontSize: "12px",
          fontFamily: "ui-monospace, 'SF Mono', monospace",
          color: "rgba(255, 255, 255, 0.95)",
        }}
      >
        <span style={{ color: "rgba(255, 255, 255, 0.3)", display: "flex", alignItems: "center" }}>
          {expanded ? <ChevronDown size={10} strokeWidth={2} /> : <ChevronRight size={10} strokeWidth={2} />}
        </span>
        <span style={{ color: "#fff" }}>{"<"}{tag}{">"}</span>
        {cls && <span style={{ color: "rgba(255, 255, 255, 0.6)" }}>.{cls}</span>}
        <span style={{ color: "rgba(255, 255, 255, 0.4)", marginLeft: "auto", fontSize: "10px" }}>
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
            style={{ overflow: "hidden" }}
          >
            {changes.map((c, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  gap: "6px",
                  padding: "2px 0 2px 18px",
                  fontSize: "11px",
                  fontFamily: "ui-monospace, 'SF Mono', monospace",
                }}
              >
                <span style={{ color: "rgba(255, 255, 255, 0.6)", minWidth: "100px" }}>{c.prop}</span>
                <span style={{ color: "rgba(255, 255, 255, 0.4)" }}>{c.from}</span>
                <span style={{ color: "rgba(255, 255, 255, 0.3)" }}>→</span>
                <span style={{ color: "#fff" }}>{c.to}</span>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function SmallButton({
  children,
  onClick,
  disabled,
  primary,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  primary?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: "3px 8px",
        fontSize: "10px",
        fontFamily: "system-ui, sans-serif",
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: "6px",
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.35 : 1,
        background: primary ? "rgba(255, 255, 255, 0.15)" : "rgba(255,255,255,0.08)",
        color: primary ? "#fff" : "rgba(255, 255, 255, 0.7)",
      }}
    >
      {children}
    </button>
  );
}
