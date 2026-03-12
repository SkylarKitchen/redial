/**
 * PromptPanel.tsx — Text-based AI prompt with rich element context
 *
 * Gathers element location, source file, component hierarchy, and HTML
 * structure, then bundles it with the user's prompt for clipboard copy.
 * Designed for pasting into Claude or other AI tools.
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { AnimatePresence, motion } from "motion/react";
import { buildPromptContext } from "./elementContext";
import { getDisplayClass } from "./util";
import { getReactSource } from "./sourcemap";
import { timing } from "./timing";
import { cn } from "@/lib/utils";
import { Copy, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { text, border, color, blackAlpha, primaryAlpha } from "./theme";

interface PromptPanelProps {
  element: Element;
}

export function PromptPanel({ element }: PromptPanelProps) {
  const [feedback, setFeedback] = useState("");
  const [message, setMessage] = useState<string | null>(null);
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

  return (
    <div className="flex flex-col gap-2 px-3 py-3">
      {/* Context preview */}
      <div className="flex items-center gap-1.5 text-[10px]" style={{ color: text.disabled }}>
        <Sparkles size={11} strokeWidth={2} className="shrink-0" style={{ color: primaryAlpha(0.6) }} />
        <span className="font-mono">
          {"<"}{tag}{">"}
          {displayClass && <span style={{ color: text.label }}>.{displayClass}</span>}
        </span>
        {reactSource && (
          <>
            <span style={{ color: text.hint }}>|</span>
            <span className="font-mono truncate">{reactSource.displayPath}</span>
          </>
        )}
      </div>

      {/* Feedback textarea */}
      <textarea
        ref={textareaRef}
        value={feedback}
        onChange={(e) => setFeedback(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Describe what you want to change..."
        rows={3}
        className={cn(
          "w-full resize-none rounded-md border px-2.5 py-2",
          "text-[12px] font-sans placeholder:text-[rgba(0,0,0,0.25)]",
          "outline-none focus:border-[#3B82F6]/30 focus:bg-white/50",
          "transition-colors duration-100",
        )}
        style={{ borderColor: border.default, background: blackAlpha(0.03), color: blackAlpha(0.8) }}
      />

      {/* Copy button + shortcut hint */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-mono" style={{ color: text.disabled }}>
          {"\u2318"}+Enter to copy
        </span>
        <Button
          size="sm"
          onClick={handleCopy}
          disabled={!feedback.trim()}
          className="h-7 text-[12px] font-semibold px-3 rounded-md border-none hover:opacity-90 disabled:shadow-none gap-1.5"
          style={{ background: color.primary, color: color.primaryForeground, boxShadow: '0 1px 3px ' + primaryAlpha(0.4) }}
        >
          <Copy size={11} strokeWidth={2.5} />
          Copy Context
        </Button>
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
            className="text-[11px] text-center"
            style={{ color: text.disabled }}
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
