/**
 * Footer.tsx — Save, Copy, Reset action buttons
 */

import { useCallback, useState, useRef, useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChevronDown } from "lucide-react";
import { styleEngine, type ScopeContext } from "../core/engine";
import { save, type SideChannelReport } from "../core/save";
import { formatCSSDiff, getSelector } from "../util";
import { timing, ms } from "../timing";
import type { DiffEntry } from "../core/engine";
import { color, text, border, surface, font, shadow, zIndex, blackAlpha, primaryAlpha, destructiveAlpha, successAlpha, successMutedAlpha, warningAlpha } from "../theme";
import { getConfig } from "../core/config";
import { getModeOverrideCount } from "../core/modeOverrides";
import { composeExportCSS, composeTailwindExport, serializeBreakpointCSS, partitionByBreakpoint } from "../breakpoints";
import { importCSSText } from "../hooks/useOverlayHotkeys";
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

// --- Save-endpoint health check (audit: opaque first-save failures) ---
// One GET per session, cached at module scope so the Footer's per-selection
// remounts never re-ping. Dev-only: the route deliberately 404s outside
// development, so pinging it anywhere else would always cry wolf.
let healthPromise: Promise<boolean> | null = null;
let healthNoticeDismissed = false;

function checkSaveEndpointHealth(endpoint: string): Promise<boolean> {
  if (!healthPromise) {
    healthPromise = fetch(endpoint, { method: "GET" })
      .then(async (res) => {
        if (!res.ok) return false;
        const body: unknown = await res.json().catch(() => null);
        const shape = body as { ok?: unknown; status?: unknown } | null;
        // Shape matters, not just reachability — a 200 from some coincidental
        // route must not count as healthy. Current payload is
        // { ok: true, version }; the legacy { status: "tuner server active" }
        // from older redial/server builds is also accepted.
        return shape != null && (shape.ok === true || shape.status === "tuner server active");
      })
      .catch(() => false);
  }
  return healthPromise;
}

/** Test seam: clear the session-cached health result and notice dismissal. */
export function __resetSaveHealthForTests(): void {
  healthPromise = null;
  healthNoticeDismissed = false;
}

const DEFAULT_SCOPE_CTX: ScopeContext = {
  scope: "element",
  activeClassName: null,
  activeState: "none",
};

interface FooterProps {
  element: Element;
  onReset: () => void;
  onSaved?: () => void;
  /** The panel's active scoping bundle (scope ▸ class ▸ state ▸ breakpoint) —
   *  Overlay's ONE memoized `scopeCtx`, never enumerated per-dimension. */
  scopeCtx?: ScopeContext;
  /** The Footer registers its save pipeline here so Cmd+S and the command
   *  palette trigger the SAME save as the Save button — one pipeline, two
   *  triggers (this is what keeps the breakpoint clipboard side-channel from
   *  diverging again). */
  saveRef?: React.MutableRefObject<(() => void) | null>;
  clipboardMessage?: string | null;
  hasClipboard?: boolean;
  onPasteStyles?: () => void;
  /** @deprecated Ignored (issue #87). The Footer now runs the ONE shared
   *  batched CSS import (`importCSSText`) itself — the legacy host-provided
   *  import applied N properties as N separate undo entries. Retained only so
   *  existing hosts (Overlay) compile unchanged. */
  onCSSImport?: () => void;
}

export function Footer({ element, onReset, onSaved, scopeCtx = DEFAULT_SCOPE_CTX, saveRef, clipboardMessage, hasClipboard, onPasteStyles }: FooterProps) {
  const { activeState } = scopeCtx;
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

  // Save-endpoint health notice (persistent until dismissed). Checked once
  // per session on first Footer mount, so a missing route mount surfaces
  // BEFORE the user invests edits and hits Save.
  const [healthNotice, setHealthNotice] = useState<string | null>(null);
  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    const endpoint = getConfig().commitEndpoint;
    if (!endpoint || healthNoticeDismissed) return;
    let cancelled = false;
    void checkSaveEndpointHealth(endpoint).then((ok) => {
      if (cancelled || ok || healthNoticeDismissed) return;
      setHealthNotice(`Save endpoint not reachable at ${endpoint} — check the route handler mount`);
    });
    return () => { cancelled = true; };
  }, []);

  const dismissHealthNotice = useCallback(() => {
    healthNoticeDismissed = true;
    setHealthNotice(null);
  }, []);

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

  // All copy/export surfaces route through the SHARED base-vs-@media partition
  // (breakpoints.composeExportCSS) so responsive edits are never flattened into
  // the un-mediated base rule.
  const handleCopy = useCallback(() => {
    const changes = styleEngine.diffElement(element);
    if (changes.length === 0) return;
    copyAndClose(composeExportCSS([{ el: element, changes }], formatCSSDiff), "SCSS");
  }, [element, copyAndClose]);

  const handleCopyCleanCSS = useCallback(() => {
    const changes = styleEngine.diffElement(element);
    if (changes.length === 0) return;
    copyAndClose(composeExportCSS([{ el: element, changes }], formatCleanCSS), "CSS");
  }, [element, copyAndClose]);

  const handleCopyTailwind = useCallback(() => {
    const changes = styleEngine.diffElement(element);
    if (changes.length === 0) return;
    // Responsive edits get their sm:/md:/lg:/xl: variant prefix (1:1 with
    // Redial's 640/768/1024/1280 set) instead of flattening to base.
    copyAndClose(composeTailwindExport(changes), "Tailwind");
  }, [element, copyAndClose]);

  const handleCopyVars = useCallback(() => {
    const changes = styleEngine.diffElement(element);
    if (changes.length === 0) return;
    // Same base-vs-@media partition as the other copy surfaces, but the vars
    // export targets :root (with var-name props) instead of the element's own
    // selector, so the shared serializer is fed `:root` directly.
    const blocks: string[] = [];
    const { base, breakpoint: bpChanges } = partitionByBreakpoint(changes);
    if (base.length > 0) blocks.push(formatCSSVars(base));
    const bpCSS = serializeBreakpointCSS([{
      selector: ":root",
      changes: bpChanges.map((c) => ({ ...c, prop: toVarName(c.prop) })),
    }]);
    if (bpCSS) blocks.push(bpCSS);
    copyAndClose(blocks.join("\n\n"), "vars");
  }, [element, copyAndClose]);

  // Phrase the side-channel notice from what save() copied: edits that can't
  // be file-written (mode overrides are clipboard-only; breakpoint edits the
  // enrichment could not bind to a file).
  const showExtrasMessage = useCallback((extras: SideChannelReport) => {
    if (!extras.clipboardWritten) return;
    const parts: string[] = [];
    if (extras.breakpointCount) parts.push(`${extras.breakpointCount} breakpoint edit${extras.breakpointCount === 1 ? "" : "s"}`);
    if (extras.modeCount) parts.push(`${extras.modeCount} mode override${extras.modeCount === 1 ? "" : "s"}`);
    if (parts.length === 0) return;
    showMessage(`${parts.join(" + ")} copied to clipboard (not saved to file)`, 4000);
  }, [showMessage]);

  // THE save trigger. The Save button, Cmd+S, and the command palette all end
  // up here (via `saveRef`). SELECTION is the panel's concern — a pseudo-state
  // view saves that state's diff, otherwise the whole element — while
  // TARGETING rides each entry's recorded provenance inside core/save.ts
  // (ADR-0011), which owns enrichment, partition, transport, fallbacks, and
  // reconciliation for every save surface.
  const handleSave = useCallback(async () => {
    if (savingRef.current) return;
    savingRef.current = true;

    // Use state-specific diff when a pseudo-class state is active
    const isStateActive = activeState !== "none";
    const changes = isStateActive ? styleEngine.diffState(element, activeState) : styleEngine.diffElement(element);
    if (changes.length === 0 && getModeOverrideCount() === 0) { savingRef.current = false; return; }

    setSaving(true);
    setMessage(null);

    const outcome = await save([{ el: element, changes }]);

    switch (outcome.kind) {
      case "nothing-to-save":
        break;
      case "clipboard": {
        if (outcome.clipboardWritten) {
          const modeSuffix = outcome.modeCount > 0 ? ` + ${outcome.modeCount} mode override${outcome.modeCount === 1 ? "" : "s"}` : "";
          showMessage(`Copied ${outcome.propertyCount} propert${outcome.propertyCount === 1 ? "y" : "ies"}${modeSuffix} to clipboard`, 3000);
        } else {
          showMessage("Clipboard access denied", 2000);
        }
        break;
      }
      case "extras-only":
        void outcome.extras.then(showExtrasMessage);
        break;
      case "http-error":
        showMessage(`Save failed (${outcome.status})${outcome.detail ? ` — ${outcome.detail}` : ""}`, 4000);
        break;
      case "unreachable":
        showMessage("Can't reach the dev server route — is app/api/tuner/[...path]/route.ts mounted?", 5000);
        break;
      case "saved": {
        if (outcome.failed.length > 0) {
          // Partial success — surface written[]/failed[] truthfully instead
          // of a success-ish toast.
          const reason = outcome.failed[0]?.reason || "unknown reason";
          showMessage(`Saved ${outcome.written.length}, failed ${outcome.failed.length} — first failure: ${reason}`, 4000);
        } else {
          const filePath = outcome.written[0]?.split("/").pop() ?? "";
          const fileHint = filePath ? ` → ${filePath}` : "";
          showMessage(`Saved ${outcome.savedCount} propert${outcome.savedCount === 1 ? "y" : "ies"}${fileHint}`, 3000);
          setSaved(true);
          if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
          savedTimerRef.current = setTimeout(() => setSaved(false), 1500);
        }
        onSaved?.();
        // The side-channel copy lands later — the saved toast stays visible
        // until the clipboard write resolves (matching the legacy sequencing).
        void outcome.extras.then(showExtrasMessage);
        break;
      }
    }

    setSaving(false);
    savingRef.current = false;
  }, [element, onSaved, showMessage, activeState, showExtrasMessage]);

  // One pipeline, two triggers: expose the save to Overlay (Cmd+S / palette).
  useEffect(() => {
    if (!saveRef) return;
    saveRef.current = handleSave;
    return () => { saveRef.current = null; };
  }, [saveRef, handleSave]);

  // Clipboard ▸ Import CSS — routes through the ONE shared batched import
  // (issue #87): `importCSSText` wraps the whole blob in beginBatch/endBatch,
  // so a multi-property paste is a single undo step, exactly like the
  // Cmd+Shift+V hotkey. The legacy `onCSSImport` prop (Overlay's unbatched
  // copy) is deliberately NOT invoked.
  const handleImportCSS = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      const count = importCSSText(element, scopeCtx, text);
      if (count === 0) return;
      // `onReset` is the host's "engine state changed → re-infer + remount the
      // panel" callback (Overlay wires it to refreshPanel); the import needs
      // the same refresh so section controls show the imported values.
      onReset();
      showMessage(`Imported ${count} propert${count === 1 ? "y" : "ies"}`, 3000);
    } catch {
      showMessage("Clipboard access denied", 2000);
    }
  }, [element, scopeCtx, onReset, showMessage]);

  const handleReset = useCallback(() => {
    // Reset only the selected element's overrides for the active scope/state, and
    // SURGICALLY for the active breakpoint (ADR-0005): resetting at ≥768px clears
    // only that breakpoint's cell, leaving base and other breakpoints intact.
    // Global mode overrides are a separate dimension and are intentionally NOT
    // cleared here (they were over-cleared before — see resetScope / issue #14);
    // they stay clearable via undo and the Variables panel.
    styleEngine.resetScope(element, scopeCtx);
    onReset();
  }, [element, onReset, scopeCtx]);

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
      {/* Save-endpoint health notice — persistent (no auto-timeout) and
          dismissible; the dismissal is remembered for the session so the
          Footer's per-selection remounts don't nag. */}
      {healthNotice && (
        <div
          role="alert"
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 6,
            paddingTop: 4,
            paddingBottom: 4,
            paddingLeft: 8,
            paddingRight: 8,
            borderRadius: 6,
            border: `1px solid ${warningAlpha(0.45)}`,
            background: warningAlpha(0.12),
            fontSize: 11,
            lineHeight: 1.4,
            fontFamily: font.sans,
            color: color.foregroundSecondary,
          }}
        >
          <span>{healthNotice}</span>
          <button
            onClick={dismissHealthNotice}
            aria-label="Dismiss save endpoint notice"
            title="Dismiss"
            style={{
              border: "none",
              background: "transparent",
              padding: 0,
              cursor: "pointer",
              color: text.disabled,
              fontSize: 12,
              lineHeight: 1,
              flexShrink: 0,
            }}
          >
            {"×"}
          </button>
        </div>
      )}
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
                onClick={() => { void handleImportCSS(); setCopyOpen(false); }}
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
            // Gate on totalCount, matching the label: mode-override-only edits
            // are saveable (handleSave routes them to the clipboard side-channel).
            disabled={totalCount === 0 || saving}
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
              cursor: (totalCount === 0 || saving) ? "default" : "pointer",
              background: saved ? color.success : color.primary,
              color: color.primaryForeground,
              boxShadow: (totalCount === 0 || saving) ? "none" : saved ? `0 1px 3px ${successAlpha(0.4)}` : `0 1px 3px ${primaryAlpha(0.4)}`,
              opacity: (totalCount === 0 || saving) ? 0.5 : (saveHovered && !saved ? 0.9 : 1),
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
