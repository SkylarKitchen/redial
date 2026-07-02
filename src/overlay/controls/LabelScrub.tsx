/**
 * LabelScrub.tsx — Draggable label for scrubbing numeric values
 *
 * Webflow-style interaction: click and drag horizontally on a label
 * to adjust a numeric value. Shift = 10x, Alt = 0.1x.
 *
 * Uses PointerEvent + setPointerCapture for reliable cross-platform drag.
 * Listeners are attached synchronously in pointerdown (no useEffect gap).
 * A 3px dead zone distinguishes clicks from drags.
 */

import { useRef, useCallback, useEffect, useState } from "react";
import { ms } from "../timing";
import { setScrubActive } from "../core/scrubState";
import { beginBatch, endBatch } from "../core/apply";
import { color, text, font } from "../theme";

export interface LabelScrubProps {
  children: React.ReactNode;
  value: number;
  onChange: (value: number) => void;
  onScrubStart?: () => void;
  onScrubEnd?: () => void;
  /** Called on a plain click (pointer up without exceeding dead zone) */
  onClick?: () => void;
  /** Called when alt+click is detected (for reset-to-default) */
  onAltClick?: () => void;
  step?: number;
  min?: number;
  max?: number;
  deadZone?: number;
}

export function LabelScrub({
  children,
  value,
  onChange,
  onScrubStart,
  onScrubEnd,
  onClick,
  onAltClick,
  step = 1,
  min,
  max,
  deadZone = 3,
}: LabelScrubProps) {
  const [scrubbing, setScrubbing] = useState(false);

  const startXRef = useRef(0);
  const startValueRef = useRef(0);
  const latestRef = useRef(value);
  latestRef.current = value;

  // Keep onChange in a ref so move handler never captures a stale closure
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const onScrubStartRef = useRef(onScrubStart);
  onScrubStartRef.current = onScrubStart;

  const onScrubEndRef = useRef(onScrubEnd);
  onScrubEndRef.current = onScrubEnd;

  const onClickRef = useRef(onClick);
  onClickRef.current = onClick;

  const onAltClickRef = useRef(onAltClick);
  onAltClickRef.current = onAltClick;

  const isDraggingRef = useRef(false);
  const altKeyRef = useRef(false);

  // Ghost-drag protection (same family as issue #73): the active drag's
  // idempotent cleanup, reachable from outside the pointerdown closure so a
  // mid-drag unmount (Cmd+Z remounts the panel) can still close the batch —
  // the pointerup/lostpointercapture listeners live on the removed element
  // and can never fire again.
  const cleanupRef = useRef<(() => void) | null>(null);

  // Close any in-flight scrub on unmount.
  useEffect(() => {
    return () => {
      cleanupRef.current?.();
    };
  }, []);

  const clamp = useCallback(
    (v: number) => {
      let clamped = v;
      if (min !== undefined) clamped = Math.max(min, clamped);
      if (max !== undefined) clamped = Math.min(max, clamped);
      return clamped;
    },
    [min, max],
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLSpanElement>) => {
      // Only primary button
      if (e.button !== 0) return;
      // Let child inputs handle their own pointer events
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      e.preventDefault();

      // Defensive: if a previous drag somehow never closed, close it before
      // starting a new one so beginBatch/endBatch stay balanced.
      cleanupRef.current?.();

      const el = e.currentTarget;
      el.setPointerCapture(e.pointerId);

      startXRef.current = e.clientX;
      startValueRef.current = latestRef.current;
      isDraggingRef.current = false;
      altKeyRef.current = e.altKey;

      // Save body styles to restore later
      const prevSelect = document.body.style.userSelect;
      const prevCursor = document.body.style.cursor;

      // Leading-edge + trailing-edge throttling for pointermove. High-Hz
      // pointers (120/240 Hz) fire many events per frame; without throttling
      // each one triggers applyInlineStyle → notifyListeners → React
      // re-render of the entire control stack. We emit immediately on the
      // first event after a frame boundary (zero lag), then drop intermediate
      // events until rAF fires, at which point a trailing emit catches the
      // latest state.
      let pendingDx = 0;
      let pendingShift = false;
      let pendingAlt = false;
      let trailingPending = false;
      let rafId = 0;

      function emit() {
        let multiplier = 1;
        if (pendingShift) multiplier = 10;
        else if (pendingAlt) multiplier = 0.1;

        const delta = pendingDx * step * multiplier;
        const raw = startValueRef.current + delta;
        // Round to avoid floating-point noise
        const precision = multiplier < 1 ? 2 : 0;
        const rounded = parseFloat(raw.toFixed(precision));
        onChangeRef.current(clamp(rounded));
      }

      function handleMove(ev: PointerEvent) {
        const dx = ev.clientX - startXRef.current;

        // Dead zone: ignore small movements
        if (!isDraggingRef.current) {
          if (Math.abs(dx) < deadZone) return;
          // First time exceeding dead zone — start the scrub
          isDraggingRef.current = true;
          setScrubbing(true);
          setScrubActive(true);
          beginBatch();
          document.body.style.userSelect = "none";
          document.body.style.cursor = "ew-resize";
          onScrubStartRef.current?.();
        }

        pendingDx = dx;
        pendingShift = ev.shiftKey;
        pendingAlt = ev.altKey;

        if (rafId === 0) {
          // No frame pending — emit immediately for zero-lag response, then
          // schedule a trailing frame in case more events arrive.
          emit();
          rafId = requestAnimationFrame(() => {
            rafId = 0;
            if (trailingPending) {
              trailingPending = false;
              emit();
            }
          });
        } else {
          // Frame already pending — coalesce this event into the trailing emit.
          trailingPending = true;
        }
      }

      let cleaned = false;
      function cleanup() {
        if (cleaned) return;
        cleaned = true;
        el.removeEventListener("pointermove", handleMove);
        el.removeEventListener("pointerup", handleUp);
        el.removeEventListener("lostpointercapture", handleUp);
        window.removeEventListener("blur", handleUp);
        window.removeEventListener("keydown", handleEscape);
        cleanupRef.current = null;

        if (isDraggingRef.current) {
          // Flush any pending trailing emit so the final value isn't dropped.
          if (rafId !== 0) {
            cancelAnimationFrame(rafId);
            rafId = 0;
            if (trailingPending) {
              trailingPending = false;
              emit();
            }
          }
          document.body.style.userSelect = prevSelect;
          document.body.style.cursor = prevCursor;
          endBatch();
          setScrubbing(false);
          setScrubActive(false);
          onScrubEndRef.current?.();
        } else if (rafId !== 0) {
          cancelAnimationFrame(rafId);
          rafId = 0;
        }
      }

      function handleUp() {
        const wasDragging = isDraggingRef.current;
        cleanup();
        if (!wasDragging) {
          if (altKeyRef.current && onAltClickRef.current) {
            onAltClickRef.current();
          } else {
            onClickRef.current?.();
          }
        }
      }

      // Escape cancels the interaction: close the batch (if scrubbing) and
      // drop the listeners without firing the click callbacks.
      function handleEscape(ev: KeyboardEvent) {
        if (ev.key === "Escape") cleanup();
      }

      // Attach listeners synchronously — no useEffect gap
      el.addEventListener("pointermove", handleMove);
      el.addEventListener("pointerup", handleUp);
      el.addEventListener("lostpointercapture", handleUp);
      // Ghost drag safety: clean up if window loses focus
      window.addEventListener("blur", handleUp);
      // Ghost drag safety: Escape mid-drag must also close the batch
      window.addEventListener("keydown", handleEscape);
      cleanupRef.current = cleanup;
    },
    [step, clamp, deadZone],
  );

  return (
    <span
      onPointerDown={handlePointerDown}
      style={{
        cursor: "ew-resize",
        userSelect: "none",
        flexShrink: 0,
        display: "inline-flex",
        alignItems: "center",
        color: scrubbing ? color.primary : text.label,
        fontSize: "11px",
        fontFamily: font.sans,
        lineHeight: "20px",
        transition: scrubbing ? "none" : `color ${ms("normal")}`,
        touchAction: "none",
      }}
    >
      {children}
    </span>
  );
}
