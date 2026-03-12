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
import { Button } from "@/components/ui/button";
import { text, border, surface, color, destructiveAlpha } from "./theme";

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
          className="overflow-hidden border-t"
          style={{ borderColor: border.default }}
        >
          <div className="px-3 py-2">
            <div className="text-[11px] uppercase tracking-wider mb-1.5" style={{ color: text.label }}>
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
              <div className="text-[11px] py-1" style={{ color: text.label }}>
                No changes yet
              </div>
            )}

            {/* Action bar */}
            <div className="flex items-center justify-between mt-2 pt-1.5 border-t" style={{ borderColor: border.default }}>
              <div className="flex gap-1.5">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCopyAll}
                  disabled={allDiffs.length === 0}
                  className="h-7 px-2 text-[12px]"
                  style={{ color: text.label }}
                >
                  Copy All
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSaveAll}
                  disabled={allDiffs.length === 0 || saving}
                  className="h-7 px-2 text-[12px]"
                  style={{ color: text.label }}
                >
                  {saving ? "..." : "Save All"}
                </Button>
              </div>
              <div className="flex items-center gap-1.5">
                <div role="status" aria-live="polite" className="min-h-[14px]">
                  <AnimatePresence mode="wait">
                    {message && (
                      <motion.span
                        key={message}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        className="text-[10px]"
                        style={{ color: text.label }}
                      >
                        {message}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleResetAll}
                  disabled={allDiffs.length === 0}
                  className="h-7 px-2 text-[12px]"
                  style={{ color: destructiveAlpha(0.8) }}
                >
                  Reset All
                </Button>
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
