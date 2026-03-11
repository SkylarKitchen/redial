/**
 * Footer.tsx — Save, Copy, Reset action buttons
 */

import { useCallback, useState } from "react";
import { diff, reset, overrideCount } from "./apply";
import { resolveSource, getModuleClassInfo } from "./sourcemap";
import { resetClassStyles } from "./scope";
import type { Scope } from "./scope";
import { getSelector } from "./util";

interface FooterProps {
  element: Element;
  onReset: () => void;
  onSaved?: () => void;
  diffMode?: boolean;
  onToggleDiff?: () => void;
  scope?: Scope;
  activeClassName?: string | null;
}

export function Footer({ element, onReset, onSaved, diffMode, onToggleDiff, scope = "element", activeClassName }: FooterProps) {
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const count = overrideCount(element);

  const handleCopy = useCallback(() => {
    const changes = diff(element);
    if (changes.length === 0) return;

    const className = getSelector(element);
    const lines = changes.map(
      (c) => `  ${c.prop}: ${c.to}; // was ${c.from}`
    );
    const scss = `${className} {\n${lines.join("\n")}\n}`;

    navigator.clipboard.writeText(scss);
    setMessage("Copied!");
    setTimeout(() => setMessage(null), 1500);
  }, [element]);

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
        setMessage("Save failed");
      } else {
        const result = await res.json();
        const written = result.written?.length ?? 0;
        const failed = result.failed?.length ?? 0;
        if (failed > 0) {
          setMessage(`Saved ${written}, ${failed} failed`);
        } else {
          setMessage(`Saved ${written} change${written === 1 ? "" : "s"}`);
        }
        onSaved?.();
      }
    } catch {
      setMessage("Save failed — no route?");
    }

    setSaving(false);
    setTimeout(() => setMessage(null), 2000);
  }, [element, onSaved]);

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
          onClick={onToggleDiff ?? (() => {})}
          disabled={count === 0}
          title="Toggle diff (D)"
          active={diffMode}
        >
          Diff
        </ActionButton>
        <ActionButton
          onClick={handleCopy}
          disabled={count === 0}
          title="Copy SCSS"
        >
          Copy
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
        {message && (
          <span style={{ color: "rgba(255, 255, 255, 0.4)", fontSize: "11px" }}>{message}</span>
        )}
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
        padding: "4px 10px",
        fontSize: "12px",
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
            ? "rgba(255, 255, 255, 0.15)"
            : "rgba(255,255,255,0.08)",
        color: active
          ? "rgba(250, 204, 21, 0.9)"
          : primary
            ? "#fff"
            : "rgba(255, 255, 255, 0.7)",
        transition: "opacity 100ms",
      }}
    >
      {children}
    </button>
  );
}

