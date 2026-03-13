/**
 * Footer.tsx — Save, Copy, Reset action buttons
 */

import { useCallback, useState, useRef, useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChevronDown } from "lucide-react";
import { diff, reset, overrideCount, resetStateOverrides } from "./apply";
import { diffState, resetStateStyles } from "./statePreview";
import { resetClassStyles } from "./scope";
import { enrichChangesForCommit } from "./commitUtils";
import type { Scope } from "./scope";
import { formatCSSDiff, getSelector } from "./util";
import { formatTailwindDiff } from "./tailwind";
import { timing } from "./timing";
import type { DiffEntry } from "./apply";
import { color, text, border, surface, font, shadow, blackAlpha, primaryAlpha, destructiveAlpha } from "./theme";
import { getConfig } from "./config";

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
  failed?: Array<{ reason: string }>;
}

interface FooterProps {
  element: Element;
  onReset: () => void;
  onSaved?: () => void;
  scope?: Scope;
  activeClassName?: string | null;
  /** Active pseudo-class state ("none" = base, "hover", "focus", etc.) */
  activeState?: string;
  clipboardMessage?: string | null;
  hasClipboard?: boolean;
  onPasteStyles?: () => void;
  onCSSImport?: () => void;
}

export function Footer({ element, onReset, onSaved, scope = "element", activeClassName, activeState = "none", clipboardMessage, hasClipboard, onPasteStyles, onCSSImport }: FooterProps) {
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [saved, setSaved] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [copyOpen, setCopyOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const copyRef = useRef<HTMLDivElement>(null);
  const count = overrideCount(element);
  const messageTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const messageCounterRef = useRef(0);

  // Hover states for buttons
  const [clipboardHovered, setClipboardHovered] = useState(false);
  const [resetHovered, setResetHovered] = useState(false);
  const [saveHovered, setSaveHovered] = useState(false);

  // Reset shake on no-op
  const [shaking, setShaking] = useState(false);
  const shakingTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Clear timers on unmount to prevent stale setState calls
  useEffect(() => {
    return () => {
      if (messageTimerRef.current) clearTimeout(messageTimerRef.current);
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      if (shakingTimerRef.current) clearTimeout(shakingTimerRef.current);
    };
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
      .then(() => {
        showMessage(`Copied ${label}!`, 1200);
        setCopied(true);
        if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
        copiedTimerRef.current = setTimeout(() => setCopied(false), 1500);
      })
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

    // Use state-specific diff when a pseudo-class state is active
    const isStateActive = activeState !== "none";
    const changes = isStateActive ? diffState(element, activeState) : diff(element);
    if (changes.length === 0) { savingRef.current = false; return; }

    setSaving(true);
    setMessage(null);

    const enriched = enrichChangesForCommit(element, changes, { scope, activeClassName, activeState });

    try {
      const res = await fetch(getConfig().commitEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ changes: enriched }),
      });

      if (!res.ok) {
        showMessage("Save failed", 2000);
      } else {
        const result: SaveResult = await res.json();
        const written = result.written?.length ?? 0;
        const failedList = result.failed ?? [];
        const failed = failedList.length;
        if (failed > 0) {
          const detail = failedList[0]?.reason ? `: ${failedList[0].reason}` : "";
          showMessage(`Saved ${written}, ${failed} failed${detail}`, 3000);
        } else {
          showMessage(`Saved ${written} change${written === 1 ? "" : "s"}`, 2000);
          setSaved(true);
          if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
          savedTimerRef.current = setTimeout(() => setSaved(false), 1500);
        }
        onSaved?.();
      }
    } catch {
      showMessage("Save failed \u2014 no route?", 2000);
    } finally {
      setSaving(false);
      savingRef.current = false;
    }
  }, [element, onSaved, showMessage, scope, activeClassName, activeState]);

  const handleReset = useCallback(() => {
    if (activeState !== "none") {
      resetStateStyles(element, activeState);
      resetStateOverrides(element, activeState);  // sync apply.ts
    } else {
      reset(element);
      if (scope === "class" && activeClassName) {
        resetClassStyles(activeClassName);
      }
    }
    onReset();
  }, [element, onReset, scope, activeClassName, activeState]);

  const handleResetClick = useCallback(() => {
    if (count === 0) {
      setShaking(true);
      if (shakingTimerRef.current) clearTimeout(shakingTimerRef.current);
      shakingTimerRef.current = setTimeout(() => setShaking(false), timing.slow);
      return;
    }
    handleReset();
  }, [count, handleReset]);

  return (
    <div
      className="__tuner-footer"
      style={{
        display: "flex",
        flexDirection: "column" as const,
        paddingLeft: 12,
        paddingRight: 12,
        paddingTop: 8,
        paddingBottom: 8,
        borderTop: `1px solid ${border.default}`,
        gap: 6,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
        {/* Left: Clipboard dropdown */}
        <div ref={copyRef} style={{ position: "relative" as const }}>
          <button
            onClick={() => setCopyOpen((o) => !o)}
            onMouseEnter={() => setClipboardHovered(true)}
            onMouseLeave={() => setClipboardHovered(false)}
            title="Copy, paste, import styles"
            style={{
              display: "inline-flex",
              alignItems: "center",
              height: 28,
              fontSize: 12,
              fontWeight: 400,
              fontFamily: font.sans,
              paddingLeft: 8,
              paddingRight: 8,
              borderRadius: 6,
              cursor: "pointer",
              color: copied ? "#16a34a" : (clipboardHovered ? blackAlpha(0.7) : text.label),
              background: copied ? "rgba(22,163,74,0.08)" : (copyOpen ? surface.active : (clipboardHovered ? surface.active : surface.hover)),
              border: `1px solid ${copied ? "rgba(22,163,74,0.25)" : (copyOpen ? border.hover : border.default)}`,
              transition: `color ${timing.normal}ms, background ${timing.normal}ms, border-color ${timing.normal}ms`,
            }}
          >
            {copied ? "\u2713 Copied" : <>Clipboard <ChevronDown size={12} strokeWidth={2} style={{ marginLeft: 4, flexShrink: 0, opacity: 0.6 }} /></>}
          </button>
          {copyOpen && (
            <div style={{
              position: "absolute" as const,
              bottom: "calc(100% + 4px)",
              left: 0,
              border: `1px solid ${surface.active}`,
              borderRadius: 6,
              paddingTop: 4,
              paddingBottom: 4,
              minWidth: 160,
              zIndex: 100,
              background: color.popover,
              boxShadow: shadow.dropdown,
            }}>
              <DropdownLabel>Copy as</DropdownLabel>
              <DropdownItem onClick={handleCopyCleanCSS} disabled={count === 0}>CSS</DropdownItem>
              <DropdownItem onClick={handleCopyTailwind} disabled={count === 0}>Tailwind</DropdownItem>
              <DropdownItem onClick={handleCopyVars} disabled={count === 0}>CSS Variables</DropdownItem>
              <DropdownItem onClick={handleCopy} disabled={count === 0}>SCSS (commented)</DropdownItem>
              <div style={{ marginTop: 4, marginBottom: 4, height: 1, background: border.subtle }} />
              <DropdownItem
                onClick={() => { onPasteStyles?.(); setCopyOpen(false); }}
                disabled={!hasClipboard}
                shortcut={"\u2325\u2318V"}
              >
                Paste Styles
              </DropdownItem>
              <DropdownItem
                onClick={() => { onCSSImport?.(); setCopyOpen(false); }}
                disabled={!onCSSImport}
                shortcut={"\u21E7\u2318V"}
              >
                Import CSS
              </DropdownItem>
            </div>
          )}
        </div>

        {/* Right: Reset + Save */}
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <motion.button
            onClick={handleResetClick}
            onMouseEnter={() => setResetHovered(true)}
            onMouseLeave={() => setResetHovered(false)}
            animate={shaking ? { x: [0, -2, 2, -2, 2, -2, 2, 0] } : { x: 0 }}
            transition={shaking ? { duration: timing.slow / 1000 } : { duration: 0 }}
            title="Reset (R)"
            style={{
              display: "inline-flex",
              alignItems: "center",
              height: 28,
              fontSize: 12,
              fontWeight: 400,
              fontFamily: font.sans,
              paddingLeft: 8,
              paddingRight: 8,
              borderRadius: 6,
              cursor: count === 0 ? "default" : "pointer",
              color: destructiveAlpha(0.8),
              border: `1px solid ${destructiveAlpha(0.15)}`,
              background: resetHovered && count > 0 ? surface.active : surface.hover,
              opacity: count === 0 ? 0.5 : 1,
              transition: `background ${timing.normal}ms`,
            }}
          >
            Reset
          </motion.button>
          <button
            onClick={handleSave}
            onMouseEnter={() => setSaveHovered(true)}
            onMouseLeave={() => setSaveHovered(false)}
            disabled={count === 0 || saving}
            title="Save to source"
            style={{
              display: "inline-flex",
              alignItems: "center",
              height: 28,
              fontSize: 12,
              fontWeight: 600,
              fontFamily: font.sans,
              paddingLeft: 12,
              paddingRight: 12,
              borderRadius: 6,
              border: "none",
              cursor: (count === 0 || saving) ? "default" : "pointer",
              background: saved ? "#22c55e" : color.primary,
              color: color.primaryForeground,
              boxShadow: (count === 0 || saving) ? "none" : saved ? `0 1px 3px rgba(34,197,94,0.4)` : `0 1px 3px ${primaryAlpha(0.4)}`,
              opacity: (count === 0 || saving) ? 0.5 : (saveHovered && !saved ? 0.9 : 1),
              transition: `opacity ${timing.normal}ms, background ${timing.normal}ms, box-shadow ${timing.normal}ms`,
            }}
          >
            {saving ? "..." : saved ? "\u2713 Saved" : "Save"}
          </button>
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
              style={{ fontSize: 11, color: text.disabled }}
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
    <div style={{
      paddingLeft: 12,
      paddingRight: 12,
      paddingTop: 4,
      paddingBottom: 2,
      fontSize: 9,
      fontWeight: 600,
      textTransform: "uppercase" as const,
      letterSpacing: "0.05em",
      userSelect: "none" as const,
      color: text.label,
    }}>
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
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={disabled ? undefined : onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      disabled={disabled}
      style={{
        display: "flex",
        width: "100%",
        alignItems: "center",
        justifyContent: "space-between",
        paddingLeft: 12,
        paddingRight: 12,
        paddingTop: 6,
        paddingBottom: 6,
        fontSize: 12,
        fontFamily: font.sans,
        border: "none",
        background: !disabled && hovered ? surface.hover : "transparent",
        textAlign: "left" as const,
        cursor: disabled ? "default" : "pointer",
        color: disabled ? text.disabled : color.foreground,
        transition: `background ${timing.fast}ms`,
      }}
    >
      <span>{children}</span>
      {shortcut && (
        <span style={{ fontSize: 10, fontFamily: font.mono, marginLeft: 12, color: text.disabled }}>{shortcut}</span>
      )}
    </button>
  );
}
