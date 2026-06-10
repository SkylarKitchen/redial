/**
 * Footer.tsx — Save, Copy, Reset action buttons
 */

import { useCallback, useState, useRef, useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChevronDown } from "lucide-react";
import { styleEngine } from "../core/engine";
import { enrichChangesForCommit } from "../core/commitUtils";
import { REDIAL_MARKER_HEADER } from "../../lib/protocol";
import type { Scope } from "../core/scope";
import { formatCSSDiff, getSelector } from "../util";
import { formatTailwindDiff } from "../tailwind";
import { timing, ms } from "../timing";
import type { DiffEntry } from "../core/engine";
import { color, text, border, surface, font, shadow, zIndex, blackAlpha, primaryAlpha, destructiveAlpha, successAlpha, successMutedAlpha } from "../theme";
import { getConfig } from "../core/config";
import { serializeModeOverrides, getModeOverrideCount } from "../core/modeOverrides";
import { serializeBreakpointCSS } from "../breakpoints";
import { usePressScale } from "../controls/helpers";

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
  /** Active responsive breakpoint ("base" = un-mediated; "768" = ≥768px, …) */
  activeBreakpoint?: string;
  clipboardMessage?: string | null;
  hasClipboard?: boolean;
  onPasteStyles?: () => void;
  onCSSImport?: () => void;
}

export function Footer({ element, onReset, onSaved, scope = "element", activeClassName, activeState = "none", activeBreakpoint = "base", clipboardMessage, hasClipboard, onPasteStyles, onCSSImport }: FooterProps) {
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [saved, setSaved] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [copyOpen, setCopyOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const copyRef = useRef<HTMLDivElement>(null);
  const copyTriggerRef = useRef<HTMLButtonElement>(null);
  const count = styleEngine.overrideCount(element);
  const modeCount = getModeOverrideCount();
  const totalCount = count + modeCount;
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

  const { pressHandlers: clipPress, pressStyle: clipPressStyle } = usePressScale(0.97);
  const { pressHandlers: savePress, pressStyle: savePressStyle } = usePressScale(0.97);

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

  // Close dropdown on Escape, returning focus to the trigger
  useEffect(() => {
    if (!copyOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setCopyOpen(false);
        copyTriggerRef.current?.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown, true);
    return () => document.removeEventListener("keydown", handleKeyDown, true);
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

  // Compose export CSS: base changes via the chosen formatter, PLUS breakpoint
  // edits as real @media blocks (#35) against the element's real selector — so
  // responsive edits aren't flattened into the base rule. The base rule is
  // omitted entirely when there are no base changes (no empty `sel {}` noise).
  const composeExportCSS = useCallback(
    (changes: DiffEntry[], formatBase: (el: Element, c: DiffEntry[]) => string): string => {
      const base = changes.filter((c) => !c.breakpoint);
      const baseCSS = base.length ? formatBase(element, base) : "";
      const bpCSS = serializeBreakpointCSS([{ selector: getSelector(element), changes }]);
      return [baseCSS, bpCSS].filter(Boolean).join("\n\n");
    },
    [element],
  );

  const handleCopy = useCallback(() => {
    const changes = styleEngine.diffElement(element);
    if (changes.length === 0) return;
    copyAndClose(composeExportCSS(changes, formatCSSDiff), "SCSS");
  }, [element, copyAndClose, composeExportCSS]);

  const handleCopyCleanCSS = useCallback(() => {
    const changes = styleEngine.diffElement(element);
    if (changes.length === 0) return;
    copyAndClose(composeExportCSS(changes, formatCleanCSS), "CSS");
  }, [element, copyAndClose, composeExportCSS]);

  const handleCopyTailwind = useCallback(() => {
    const changes = styleEngine.diffElement(element);
    if (changes.length === 0) return;
    copyAndClose(formatTailwindDiff(changes), "Tailwind");
  }, [element, copyAndClose]);

  const handleCopyVars = useCallback(() => {
    const changes = styleEngine.diffElement(element);
    if (changes.length === 0) return;
    copyAndClose(formatCSSVars(changes), "vars");
  }, [element, copyAndClose]);

  const handleSave = useCallback(async () => {
    if (savingRef.current) return;
    savingRef.current = true;

    // Use state-specific diff when a pseudo-class state is active
    const isStateActive = activeState !== "none";
    const changes = isStateActive ? styleEngine.diffState(element, activeState) : styleEngine.diffElement(element);
    if (changes.length === 0 && getModeOverrideCount() === 0) { savingRef.current = false; return; }

    setSaving(true);
    setMessage(null);

    const enriched = enrichChangesForCommit(element, changes, { scope, activeClassName, activeState });

    // Clipboard fallback when no commit endpoint is configured
    const endpoint = getConfig().commitEndpoint;
    if (!endpoint) {
      // Breakpoint edits export as @media blocks (#35); keep them out of the
      // base rule so they aren't flattened to un-mediated styles.
      const css = composeExportCSS(changes, formatCleanCSS);
      const modeCSS = serializeModeOverrides();
      const fullCSS = modeCSS ? (css ? css + "\n\n/* Mode overrides */\n" + modeCSS : modeCSS) : css;
      const modeCount = getModeOverrideCount();
      const modeSuffix = modeCount > 0 ? ` + ${modeCount} mode override${modeCount === 1 ? "" : "s"}` : "";
      navigator.clipboard.writeText(fullCSS).then(() => {
        showMessage(`Copied ${changes.length} propert${changes.length === 1 ? "y" : "ies"}${modeSuffix} to clipboard`, 3000);
      }).catch(() => {
        showMessage("Clipboard access denied", 2000);
      });
      setSaving(false);
      savingRef.current = false;
      return;
    }

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", [REDIAL_MARKER_HEADER]: "1" },
        body: JSON.stringify({
          ...(enriched[0]?.mode ? { mode: enriched[0].mode } : {}),
          changes: enriched,
        }),
      });

      if (!res.ok) {
        showMessage("Save failed", 2000);
      } else {
        const result: SaveResult = await res.json();
        const writtenFiles = result.written ?? [];
        const failedList = result.failed ?? [];
        const failed = failedList.length;
        if (failed > 0) {
          const detail = failedList[0]?.reason ? `: ${failedList[0].reason}` : "";
          showMessage(`Saved ${writtenFiles.length}, ${failed} failed${detail}`, 3000);
        } else {
          // Show file path in toast for context
          const filePath = writtenFiles[0]?.split("/").pop() ?? "";
          const fileHint = filePath ? ` \u2192 ${filePath}` : "";
          showMessage(`Saved ${changes.length} propert${changes.length === 1 ? "y" : "ies"}${fileHint}`, 3000);
          setSaved(true);
          if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
          savedTimerRef.current = setTimeout(() => setSaved(false), 1500);
        }
        onSaved?.();
        // Media-gated edits aren't written to source files yet (tracked as a
        // #35 follow-up): breakpoint @media blocks + CSS-variable mode overrides
        // go to the clipboard so they aren't silently lost.
        const bpCSS = serializeBreakpointCSS([{ selector: getSelector(element), changes }]);
        const modeCSS = serializeModeOverrides();
        const extra = [bpCSS, modeCSS].filter(Boolean).join("\n\n");
        if (extra) {
          navigator.clipboard.writeText(extra).then(() => {
            const bpCount = changes.filter((c) => c.breakpoint).length;
            const mc = getModeOverrideCount();
            const parts: string[] = [];
            if (bpCount) parts.push(`${bpCount} breakpoint edit${bpCount === 1 ? "" : "s"}`);
            if (mc) parts.push(`${mc} mode override${mc === 1 ? "" : "s"}`);
            showMessage(`${parts.join(" + ")} copied to clipboard (not saved to file)`, 4000);
          }).catch(() => {});
        }
      }
    } catch {
      // Network error — fall back to clipboard
      const css = composeExportCSS(changes, formatCleanCSS);
      const modeCSS = serializeModeOverrides();
      const fullCSS = modeCSS ? (css ? css + "\n\n/* Mode overrides */\n" + modeCSS : modeCSS) : css;
      navigator.clipboard.writeText(fullCSS).then(() => {
        showMessage("No commit endpoint \u2014 copied CSS to clipboard", 3000);
      }).catch(() => {
        showMessage("Save failed", 2000);
      });
    } finally {
      setSaving(false);
      savingRef.current = false;
    }
  }, [element, onSaved, showMessage, scope, activeClassName, activeState, composeExportCSS]);

  const handleReset = useCallback(() => {
    // Reset only the selected element's overrides for the active scope/state, and
    // SURGICALLY for the active breakpoint (ADR-0005): resetting at ≥768px clears
    // only that breakpoint's cell, leaving base and other breakpoints intact.
    // Global mode overrides are a separate dimension and are intentionally NOT
    // cleared here (they were over-cleared before — see resetScope / issue #14);
    // they stay clearable via undo and the Variables panel.
    styleEngine.resetScope(element, { scope, activeClassName: activeClassName ?? null, activeState, activeBreakpoint });
    onReset();
  }, [element, onReset, scope, activeClassName, activeState, activeBreakpoint]);

  const handleResetClick = useCallback(() => {
    // Reset reflects the element's own overrides only (it no longer clears modes).
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
            ref={copyTriggerRef}
            onClick={() => setCopyOpen((o) => !o)}
            onMouseEnter={() => setClipboardHovered(true)}
            onMouseDown={clipPress.onMouseDown}
            onMouseUp={clipPress.onMouseUp}
            onMouseLeave={() => { clipPress.onMouseLeave(); setClipboardHovered(false); }}
            title="Copy CSS (⌘C)"
            aria-haspopup="menu"
            aria-expanded={copyOpen}
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
              color: copied ? color.successMuted : (clipboardHovered ? blackAlpha(0.7) : text.label),
              background: copied ? successMutedAlpha(0.08) : (copyOpen ? surface.active : (clipboardHovered ? surface.active : surface.hover)),
              border: `1px solid ${copied ? successMutedAlpha(0.25) : (copyOpen ? border.hover : border.default)}`,
              transition: `color ${ms("normal")}, background ${ms("normal")}, border-color ${ms("normal")}`,
              ...clipPressStyle,
            }}
          >
            {copied ? "\u2713 Copied" : <>Clipboard <ChevronDown size={12} strokeWidth={2} style={{ marginLeft: 4, flexShrink: 0, color: text.disabled }} /></>}
          </button>
          {copyOpen && (
            <div role="menu" style={{
              position: "absolute" as const,
              bottom: "calc(100% + 4px)",
              left: 0,
              border: `1px solid ${surface.active}`,
              borderRadius: 6,
              paddingTop: 4,
              paddingBottom: 4,
              minWidth: 160,
              zIndex: zIndex.dropdown,
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
            title="Reset element (R)"
            aria-disabled={count === 0}
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
              background: resetHovered && count > 0 ? surface.hover : surface.subtle,
              opacity: count === 0 ? 0.5 : 1,
              transition: `background ${ms("normal")}`,
            }}
          >
            Reset
          </motion.button>
          <button
            onClick={handleSave}
            onMouseEnter={() => setSaveHovered(true)}
            onMouseDown={savePress.onMouseDown}
            onMouseUp={savePress.onMouseUp}
            onMouseLeave={() => { savePress.onMouseLeave(); setSaveHovered(false); }}
            disabled={count === 0 || saving}
            title="Save to source (⌘S)"
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
              background: saved ? color.success : color.primary,
              color: color.primaryForeground,
              boxShadow: (count === 0 || saving) ? "none" : saved ? `0 1px 3px ${successAlpha(0.4)}` : `0 1px 3px ${primaryAlpha(0.4)}`,
              opacity: (count === 0 || saving) ? 0.5 : (saveHovered && !saved ? 0.9 : 1),
              transition: `opacity ${ms("normal")}, background ${ms("normal")}, box-shadow ${ms("normal")}`,
              ...savePressStyle,
            }}
          >
            {saving ? "..." : saved ? "\u2713 Saved" : totalCount > 0 ? `Save (${totalCount})` : "Save"}
          </button>
        </div>
      </div>

      {/* Status message row — wrapper is always mounted so the live region
          is present before the first message, ensuring it gets announced. */}
      <div role="status" aria-live="polite">
        <AnimatePresence mode="wait">
          {(clipboardMessage || message) && (
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
          )}
        </AnimatePresence>
      </div>
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
      role="menuitem"
      onClick={disabled ? undefined : onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseDown={(e) => { if (!disabled) (e.currentTarget as HTMLElement).style.transform = "scale(0.98)"; }}
      onMouseUp={(e) => { (e.currentTarget as HTMLElement).style.transform = ""; }}
      onMouseLeave={(e) => { setHovered(false); (e.currentTarget as HTMLElement).style.transform = ""; }}
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
        transition: `transform 80ms cubic-bezier(0.34, 1.56, 0.64, 1), background ${ms("fast")}`,
      }}
    >
      <span>{children}</span>
      {shortcut && (
        <span style={{ fontSize: 10, fontFamily: font.mono, marginLeft: 12, color: text.disabled }}>{shortcut}</span>
      )}
    </button>
  );
}
