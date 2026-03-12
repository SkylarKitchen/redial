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
    <div className="__tuner-footer flex flex-col px-3 py-2 border-t border-black/10 gap-1.5">
      <div className="flex items-center justify-between gap-1.5">
        {/* Left: Clipboard dropdown */}
        <div ref={copyRef} className="relative">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCopyOpen((o) => !o)}
            title="Copy, paste, import styles"
            className={cn(
              "h-7 text-[12px] font-normal px-2 rounded-md border border-black/10 bg-black/[0.05] text-black/70 hover:bg-black/[0.08] hover:text-black/70",
              copyOpen && "border-black/20 bg-black/[0.08]",
            )}
          >
            Clipboard <span className="text-[9px] ml-0.5 opacity-60">&#9662;</span>
          </Button>
          {copyOpen && (
            <div className="absolute bottom-[calc(100%+4px)] left-0 bg-[#F5F4ED] border border-black/[0.08] rounded-md py-1 min-w-[160px] shadow-[0_4px_12px_rgba(0,0,0,0.1)] z-[100]">
              <DropdownLabel>Copy as</DropdownLabel>
              <DropdownItem onClick={handleCopyCleanCSS} disabled={count === 0}>CSS</DropdownItem>
              <DropdownItem onClick={handleCopyTailwind} disabled={count === 0}>Tailwind</DropdownItem>
              <DropdownItem onClick={handleCopyVars} disabled={count === 0}>CSS Variables</DropdownItem>
              <DropdownItem onClick={handleCopy} disabled={count === 0}>SCSS (commented)</DropdownItem>
              <div className="my-1 h-px bg-black/[0.06]" />
              <DropdownItem
                onClick={() => { onPasteStyles?.(); setCopyOpen(false); }}
                disabled={!hasClipboard}
                shortcut="⌥⌘V"
              >
                Paste Styles
              </DropdownItem>
              <DropdownItem
                onClick={() => { onCSSImport?.(); setCopyOpen(false); }}
                disabled={!onCSSImport}
                shortcut="⇧⌘V"
              >
                Import CSS
              </DropdownItem>
            </div>
          )}
        </div>

        {/* Right: Reset + Save */}
        <div className="flex gap-1.5 items-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleReset}
            disabled={count === 0}
            title="Reset (R)"
            className="h-7 text-[12px] font-normal px-2 rounded-md border border-red-500/[0.15] bg-black/[0.05] text-red-500/80 hover:bg-black/[0.08] hover:text-red-500/80"
          >
            Reset
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={count === 0 || saving}
            title="Save to source"
            className="h-7 text-[13px] font-semibold px-3 rounded-md border-none bg-[#D97757] text-white shadow-[0_1px_3px_rgba(217,119,87,0.4)] hover:bg-[#D97757]/90 disabled:shadow-none"
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

function DropdownLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-3 pt-1 pb-0.5 text-[9px] font-semibold text-black/30 uppercase tracking-wider select-none">
      {children}
    </div>
  );
}

function DropdownItem({ children, onClick, disabled, shortcut }: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  shortcut?: string;
}) {
  return (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className={cn(
        "flex w-full items-center justify-between px-3 py-1.5 text-[12px] font-sans border-none bg-transparent text-left transition-colors",
        disabled
          ? "text-black/25 cursor-default"
          : "text-black/80 cursor-pointer hover:bg-black/[0.05]",
      )}
    >
      <span>{children}</span>
      {shortcut && (
        <span className="text-[10px] text-black/25 font-mono ml-3">{shortcut}</span>
      )}
    </button>
  );
}
