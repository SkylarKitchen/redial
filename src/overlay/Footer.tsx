/**
 * Footer.tsx — Save, Copy, Reset action buttons
 */

import { useCallback, useState, useRef, useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";
import { diff, reset, overrideCount } from "./apply";
import { resolveSource, getModuleClassInfo } from "./sourcemap";
import { resetClassStyles } from "./scope";
import type { Scope } from "./scope";
import { formatCSSDiff, getSelector } from "./util";
import { formatTailwindDiff } from "./tailwind";
import { timing } from "./timing";
import type { DiffEntry } from "./apply";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

// --- Clean CSS format (no "was" comments) ---
function formatCleanCSS(el: Element, changes: DiffEntry[]): string {
  const selector = getSelector(el);
  const lines = changes.map((c) => `  ${c.prop}: ${c.to};`);
  return `${selector} {\n${lines.join("\n")}\n}`;
}

// --- CSS Custom Properties export ---
const SEMANTIC_NAMES: Record<string, string> = {
  "font-size": "--font-size",
  "font-weight": "--font-weight",
  "font-family": "--font-family",
  "line-height": "--line-height",
  "letter-spacing": "--letter-spacing",
  "color": "--text-color",
  "background-color": "--bg-color",
  "border-radius": "--border-radius",
  "border-color": "--border-color",
  "border-width": "--border-width",
  "width": "--width",
  "height": "--height",
  "gap": "--gap",
  "opacity": "--opacity",
};

function toVarName(prop: string): string {
  return SEMANTIC_NAMES[prop] ?? `--${prop}`;
}

function formatCSSVars(changes: DiffEntry[]): string {
  const lines = changes.map((c) => `  ${toVarName(c.prop)}: ${c.to};`);
  return `:root {\n${lines.join("\n")}\n}`;
}

interface SaveResult {
  written?: string[];
  failed?: string[];
}

interface FooterProps {
  element: Element;
  onReset: () => void;
  onSaved?: () => void;
  scope?: Scope;
  activeClassName?: string | null;
  clipboardMessage?: string | null;
  hasClipboard?: boolean;
  onPasteStyles?: () => void;
  onCSSImport?: () => void;
}

const btnGhost = "h-7 text-[12px] font-normal px-2 rounded-md border border-black/[0.08] bg-black/[0.04] text-black/70 hover:bg-black/[0.08] hover:text-black/70";

export function Footer({ element, onReset, onSaved, scope = "element", activeClassName, clipboardMessage, hasClipboard, onPasteStyles, onCSSImport }: FooterProps) {
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [message, setMessage] = useState<string | null>(null);
  const [copyOpen, setCopyOpen] = useState(false);
  const copyRef = useRef<HTMLDivElement>(null);
  const count = overrideCount(element);
  const messageTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const messageCounterRef = useRef(0);

  // Clear timer on unmount to prevent stale setState calls
  useEffect(() => {
    return () => { if (messageTimerRef.current) clearTimeout(messageTimerRef.current); };
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    if (!copyOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (copyRef.current && !copyRef.current.contains(e.target as Node)) {
        setCopyOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick, true);
    return () => document.removeEventListener("mousedown", handleClick, true);
  }, [copyOpen]);

  const showMessage = useCallback((text: string, duration: number) => {
    if (messageTimerRef.current) clearTimeout(messageTimerRef.current);
    messageCounterRef.current += 1;
    setMessage(text);
    messageTimerRef.current = setTimeout(() => setMessage(null), duration);
  }, []);

  const copyAndClose = useCallback((text: string, label: string) => {
    navigator.clipboard.writeText(text)
      .then(() => showMessage(`Copied ${label}!`, 1200))
      .catch(() => showMessage("Copy failed", 1500));
    setCopyOpen(false);
  }, [showMessage]);

  const handleCopy = useCallback(() => {
    const changes = diff(element);
    if (changes.length === 0) return;
    copyAndClose(formatCSSDiff(element, changes), "SCSS");
  }, [element, copyAndClose]);

  const handleCopyCleanCSS = useCallback(() => {
    const changes = diff(element);
    if (changes.length === 0) return;
    copyAndClose(formatCleanCSS(element, changes), "CSS");
  }, [element, copyAndClose]);

  const handleCopyTailwind = useCallback(() => {
    const changes = diff(element);
    if (changes.length === 0) return;
    copyAndClose(formatTailwindDiff(changes), "Tailwind");
  }, [element, copyAndClose]);

  const handleCopyVars = useCallback(() => {
    const changes = diff(element);
    if (changes.length === 0) return;
    copyAndClose(formatCSSVars(changes), "vars");
  }, [element, copyAndClose]);

  const handleSave = useCallback(async () => {
    if (savingRef.current) return;
    savingRef.current = true;

    const changes = diff(element);
    if (changes.length === 0) { savingRef.current = false; return; }

    setSaving(true);
    setMessage(null);

    // Enrich changes with source file + class info for robust server-side search
    const moduleInfo = getModuleClassInfo(element);
    const enriched = changes.map((c) => {
      const source = resolveSource(element, c.prop);
      return {
        ...c,
        sourceFile: source?.file,
        sourceLine: source?.line,
        className: moduleInfo?.className,
        componentName: moduleInfo?.componentName,
      };
    });

    try {
      const res = await fetch("/api/tuner/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ changes: enriched }),
      });

      if (!res.ok) {
        showMessage("Save failed", 2000);
      } else {
        const result: SaveResult = await res.json();
        const written = result.written?.length ?? 0;
        const failed = result.failed?.length ?? 0;
        if (failed > 0) {
          showMessage(`Saved ${written}, ${failed} failed`, 2000);
        } else {
          showMessage(`Saved ${written} change${written === 1 ? "" : "s"}`, 2000);
        }
        onSaved?.();
      }
    } catch {
      showMessage("Save failed \u2014 no route?", 2000);
    } finally {
      setSaving(false);
      savingRef.current = false;
    }
  }, [element, onSaved, showMessage]);

  const handleReset = useCallback(() => {
    reset(element);
    if (scope === "class" && activeClassName) {
      resetClassStyles(activeClassName);
    }
    onReset();
  }, [element, onReset, scope, activeClassName]);

  return (
    <div className="__tuner-footer flex flex-col px-3 py-2 border-t border-black/[0.08] gap-1.5">
      <div className="flex items-center justify-between gap-1.5">
        {/* Left: Copy dropdown + Import/Paste */}
        <div className="flex gap-1.5 items-center">
          <div ref={copyRef} className="relative">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCopyOpen((o) => !o)}
              disabled={count === 0}
              title="Copy styles"
              className={cn(
                btnGhost,
                copyOpen && "border-yellow-600/40 bg-yellow-500/[0.12] text-yellow-700/90 hover:bg-yellow-500/[0.15] hover:text-yellow-700/90",
              )}
            >
              Copy <span className="text-[9px] ml-0.5 opacity-60">&#9662;</span>
            </Button>
            {copyOpen && (
              <div className="absolute bottom-[calc(100%+4px)] left-0 bg-[#eae5df] border border-black/[0.08] rounded-md py-1 min-w-[140px] shadow-[0_4px_12px_rgba(0,0,0,0.1)] z-[100]">
                <DropdownItem onClick={handleCopyCleanCSS}>CSS</DropdownItem>
                <DropdownItem onClick={handleCopyTailwind}>Tailwind</DropdownItem>
                <DropdownItem onClick={handleCopyVars}>CSS Variables</DropdownItem>
                <DropdownItem onClick={handleCopy}>SCSS (commented)</DropdownItem>
              </div>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onPasteStyles ?? (() => {})}
            disabled={!hasClipboard}
            title="Paste styles (Cmd+Alt+V)"
            className={btnGhost}
          >
            Paste
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onCSSImport ?? (() => {})}
            disabled={!onCSSImport}
            title="Import CSS from clipboard"
            className={btnGhost}
          >
            Import
          </Button>
        </div>

        {/* Right: Reset + Save */}
        <div className="flex gap-1.5 items-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleReset}
            disabled={count === 0}
            title="Reset (R)"
            className="h-7 text-[12px] font-normal px-2 rounded-md border border-red-500/[0.15] bg-black/[0.04] text-red-500/80 hover:bg-black/[0.08] hover:text-red-500/80"
          >
            Reset
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={count === 0 || saving}
            title="Save to source"
            className="h-7 text-[13px] font-semibold px-3 rounded-md border-none bg-[#c17a50] text-white shadow-[0_1px_3px_rgba(193,122,80,0.4)] hover:bg-[#c17a50]/90 disabled:shadow-none"
          >
            {saving ? "..." : "Save"}
          </Button>
        </div>
      </div>

      {/* Status message row */}
      {(clipboardMessage || message) && (
        <div role="status" aria-live="polite">
          <AnimatePresence mode="wait">
            <motion.span
              key={`${clipboardMessage || message}-${messageCounterRef.current}`}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: timing.expand / 1000 }}
              className="text-black/40 text-[11px]"
            >
              {clipboardMessage || message}
            </motion.span>
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

// --- Sub-components ---

function DropdownItem({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="block w-full px-3 py-1.5 text-[12px] font-sans border-none bg-transparent text-black/80 cursor-pointer text-left hover:bg-black/[0.05] transition-colors"
    >
      {children}
    </button>
  );
}
