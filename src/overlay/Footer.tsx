/**
 * Footer.tsx — Save, Copy, Reset action buttons
 */

import { useCallback, useState, useRef, useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";
import { diff, reset, overrideCount } from "./apply";
import { resolveSource, getModuleClassInfo } from "./sourcemap";
import { resetClassStyles } from "./scope";
import type { Scope } from "./scope";
import { formatCSSDiff } from "./util";
import { ms, timing } from "./timing";

interface FooterProps {
  element: Element;
  onReset: () => void;
  onSaved?: () => void;
  scope?: Scope;
  activeClassName?: string | null;
  clipboardMessage?: string | null;
  hasClipboard?: boolean;
  onPasteStyles?: () => void;
}

export function Footer({ element, onReset, onSaved, scope = "element", activeClassName, clipboardMessage, hasClipboard, onPasteStyles }: FooterProps) {
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const count = overrideCount(element);
  const messageTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Clear timer on unmount to prevent stale setState calls
  useEffect(() => {
    return () => { if (messageTimerRef.current) clearTimeout(messageTimerRef.current); };
  }, []);

  const showMessage = useCallback((text: string, duration: number) => {
    if (messageTimerRef.current) clearTimeout(messageTimerRef.current);
    setMessage(text);
    messageTimerRef.current = setTimeout(() => setMessage(null), duration);
  }, []);

  const handleCopy = useCallback(() => {
    const changes = diff(element);
    if (changes.length === 0) return;
    navigator.clipboard.writeText(formatCSSDiff(element, changes));
    showMessage("Copied!", 1200);
  }, [element, showMessage]);

  const handleSave = useCallback(async () => {
    const changes = diff(element);
    if (changes.length === 0) return;

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
        const result = await res.json();
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
    }

    setSaving(false);
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
        alignItems: "center",
        justifyContent: "space-between",
        padding: "8px 12px",
        borderTop: "1px solid rgba(255,255,255,0.1)",
        gap: "6px",
      }}
    >
      <div style={{ display: "flex", gap: "6px" }}>
        <ActionButton
          onClick={handleCopy}
          disabled={count === 0}
          title="Copy SCSS"
        >
          Copy
        </ActionButton>
        <ActionButton
          onClick={onPasteStyles ?? (() => {})}
          disabled={!hasClipboard}
          title="Paste styles (Cmd+Alt+V)"
        >
          Paste
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
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <div role="status" aria-live="polite" style={{ minHeight: "16px" }}>
          <AnimatePresence mode="wait">
            {(clipboardMessage || message) && (
              <motion.span
                key={clipboardMessage || message}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: timing.expand / 1000 }}
                style={{ color: "rgba(255, 255, 255, 0.4)", fontSize: "11px" }}
              >
                {clipboardMessage || message}
              </motion.span>
            )}
          </AnimatePresence>
        </div>
        <ActionButton
          onClick={handleReset}
          disabled={count === 0}
          title="Reset (R)"
        >
          Reset
        </ActionButton>
      </div>
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
        padding: primary ? "5px 16px" : "4px 10px",
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

