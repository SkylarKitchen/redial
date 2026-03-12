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
import { ms, timing } from "./timing";
import type { DiffEntry } from "./apply";

// ─── Clean CSS format (no "was" comments) ───────────────────────
function formatCleanCSS(el: Element, changes: DiffEntry[]): string {
  const selector = getSelector(el);
  const lines = changes.map((c) => `  ${c.prop}: ${c.to};`);
  return `${selector} {\n${lines.join("\n")}\n}`;
}

// ─── CSS Custom Properties export ────────────────────────────────
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
      showMessage("Save failed — no route?", 2000);
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
    <div
      className="__tuner-footer"
      style={{
        display: "flex",
        flexDirection: "column",
        padding: "8px 12px",
        borderTop: "1px solid rgba(255,255,255,0.1)",
        gap: "6px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "6px" }}>
        {/* Left: Copy dropdown + Import/Paste */}
        <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
          <div ref={copyRef} style={{ position: "relative" }}>
            <ActionButton
              onClick={() => setCopyOpen((o) => !o)}
              disabled={count === 0}
              title="Copy styles"
              active={copyOpen}
            >
              Copy <span style={{ fontSize: "9px", marginLeft: "2px", opacity: 0.6 }}>&#9662;</span>
            </ActionButton>
            {copyOpen && (
              <div
                style={{
                  position: "absolute",
                  bottom: "calc(100% + 4px)",
                  left: 0,
                  background: "#2a2a2a",
                  border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: "6px",
                  padding: "4px 0",
                  minWidth: "140px",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
                  zIndex: 100,
                }}
              >
                <DropdownItem onClick={handleCopyCleanCSS}>CSS</DropdownItem>
                <DropdownItem onClick={handleCopyTailwind}>Tailwind</DropdownItem>
                <DropdownItem onClick={handleCopyVars}>CSS Variables</DropdownItem>
                <DropdownItem onClick={handleCopy}>SCSS (commented)</DropdownItem>
              </div>
            )}
          </div>
          <ActionButton
            onClick={onPasteStyles ?? (() => {})}
            disabled={!hasClipboard}
            title="Paste styles (Cmd+Alt+V)"
          >
            Paste
          </ActionButton>
          <ActionButton
            onClick={onCSSImport ?? (() => {})}
            disabled={!onCSSImport}
            title="Import CSS from clipboard"
          >
            Import
          </ActionButton>
        </div>

        {/* Right: Reset + Save */}
        <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
          <ActionButton
            onClick={handleReset}
            disabled={count === 0}
            title="Reset (R)"
          >
            Reset
          </ActionButton>
          <ActionButton
            onClick={handleSave}
            disabled={count === 0 || saving}
            title="Save to source"
            primary
          >
            {saving ? "..." : "Save"}
          </ActionButton>
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
              style={{ color: "rgba(255, 255, 255, 0.4)", fontSize: "11px" }}
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

function ActionButton({
  children,
  onClick,
  disabled,
  title,
  primary,
  active,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
  primary?: boolean;
  active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        padding: primary ? "5px 12px" : "4px 8px",
        fontSize: primary ? "13px" : "12px",
        fontWeight: primary ? 600 : 400,
        fontFamily: "system-ui, -apple-system, 'SF Pro Display', sans-serif",
        border: active
          ? "1px solid rgba(250, 204, 21, 0.4)"
          : primary
            ? "none"
            : "1px solid rgba(255,255,255,0.1)",
        borderRadius: "6px",
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.35 : 1,
        background: active
          ? "rgba(250, 204, 21, 0.12)"
          : primary
            ? "#2680EB"
            : "rgba(255,255,255,0.08)",
        color: active
          ? "rgba(250, 204, 21, 0.9)"
          : primary
            ? "#fff"
            : "rgba(255, 255, 255, 0.7)",
        transition: `opacity ${ms("normal")}, background ${ms("normal")}`,
        boxShadow: primary && !disabled ? "0 1px 3px rgba(38, 128, 235, 0.4)" : "none",
      }}
    >
      {children}
    </button>
  );
}

function DropdownItem({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "block",
        width: "100%",
        padding: "6px 12px",
        fontSize: "12px",
        fontFamily: "system-ui, -apple-system, 'SF Pro Display', sans-serif",
        border: "none",
        background: hovered ? "rgba(255,255,255,0.08)" : "transparent",
        color: "rgba(255,255,255,0.8)",
        cursor: "pointer",
        textAlign: "left",
      }}
    >
      {children}
    </button>
  );
}
