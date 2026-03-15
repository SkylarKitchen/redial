/**
 * PromptPanel.tsx — Text-based AI prompt with rich element context
 *
 * Gathers element location, source file, component hierarchy, and HTML
 * structure, then bundles it with the user's prompt for clipboard copy.
 * Designed for pasting into Claude or other AI tools.
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { AnimatePresence, motion } from "motion/react";
import { buildPromptContext } from "./core/elementContext";
import { getDisplayClass } from "./util";
import { getReactSource } from "./core/sourcemap";
import { timing } from "./timing";
import { Copy, Sparkles } from "lucide-react";
import { text, border, color, blackAlpha, primaryAlpha, bgAlpha, shadow, font } from "./theme";
import { ms } from "./timing";

interface PromptPanelProps {
  element: Element;
}

export function PromptPanel({ element }: PromptPanelProps) {
  const [feedback, setFeedback] = useState("");
  const [focused, setFocused] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [copyHovered, setCopyHovered] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messageTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Auto-focus the textarea on mount
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  // Clear timer on unmount
  useEffect(() => {
    return () => {
      if (messageTimerRef.current) clearTimeout(messageTimerRef.current);
    };
  }, []);

  const showMessage = useCallback((text: string, duration: number) => {
    if (messageTimerRef.current) clearTimeout(messageTimerRef.current);
    setMessage(text);
    messageTimerRef.current = setTimeout(() => setMessage(null), duration);
  }, []);

  const handleCopy = useCallback(() => {
    if (!feedback.trim()) return;

    const context = buildPromptContext(element, feedback.trim());
    navigator.clipboard
      .writeText(context)
      .then(() => showMessage("Copied to clipboard!", 1500))
      .catch(() => showMessage("Copy failed", 1500));
  }, [element, feedback, showMessage]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Cmd+Enter or Ctrl+Enter to copy
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleCopy();
      }
      // Escape to clear
      if (e.key === "Escape") {
        e.preventDefault();
        setFeedback("");
      }
    },
    [handleCopy],
  );

  // Element preview info
  const tag = element.tagName.toLowerCase();
  const displayClass = getDisplayClass(element);
  const reactSource = getReactSource(element);

  const disabled = !feedback.trim();

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      gap: 8,
      padding: "12px 12px",
    }}>
      {/* Context preview */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        fontSize: 10,
        color: text.disabled,
      }}>
        <Sparkles size={11} strokeWidth={2} style={{ flexShrink: 0, color: primaryAlpha(0.6) }} />
        <span style={{ fontFamily: font.mono }}>
          {"<"}{tag}{">"}
          {displayClass && <span style={{ color: text.label }}>.{displayClass}</span>}
        </span>
        {reactSource && (
          <>
            <span style={{ color: text.hint }}>|</span>
            <span style={{
              fontFamily: font.mono,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}>{reactSource.displayPath}</span>
          </>
        )}
      </div>

      {/* Feedback textarea */}
      <textarea
        ref={textareaRef}
        value={feedback}
        onChange={(e) => setFeedback(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder="Describe what you want to change..."
        rows={3}
        style={{
          width: "100%",
          resize: "none",
          borderRadius: 6,
          border: `1px solid ${focused ? primaryAlpha(0.3) : border.default}`,
          padding: "8px 10px",
          fontSize: 12,
          fontFamily: font.sans,
          outline: "none",
          transition: `border-color ${ms("normal")}, background ${ms("normal")}`,
          background: focused ? bgAlpha(0.5) : blackAlpha(0.03),
          color: blackAlpha(0.8),
        }}
      />

      {/* Copy button + shortcut hint */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}>
        <span style={{
          fontSize: 10,
          fontFamily: font.mono,
          color: text.disabled,
        }}>
          {"\u2318"}+Enter to copy
        </span>
        <button
          onClick={handleCopy}
          disabled={disabled}
          onMouseEnter={() => setCopyHovered(true)}
          onMouseLeave={() => setCopyHovered(false)}
          style={{
            height: 28,
            fontSize: 12,
            fontWeight: 600,
            padding: "0 12px",
            borderRadius: 6,
            border: "none",
            cursor: disabled ? "default" : "pointer",
            display: "flex",
            alignItems: "center",
            gap: 6,
            background: disabled ? color.primary : (copyHovered ? color.primaryHover : color.primary),
            color: color.primaryForeground,
            boxShadow: disabled ? "none" : `0 1px 3px ${primaryAlpha(0.4)}`,
            opacity: disabled ? 0.5 : (copyHovered ? 0.9 : 1),
            transition: `opacity ${ms("fast")}, background ${ms("fast")}`,
          }}
        >
          <Copy size={11} strokeWidth={2.5} />
          Copy Context
        </button>
      </div>

      {/* Status message */}
      <AnimatePresence mode="wait">
        {message && (
          <motion.div
            key={message}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: timing.expand / 1000 }}
            style={{
              fontSize: 11,
              textAlign: "center",
              color: text.disabled,
            }}
            role="status"
            aria-live="polite"
          >
            {message}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
