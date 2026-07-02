/**
 * BreakpointSelector.tsx — Dropdown for choosing the target responsive breakpoint
 *
 * The "which breakpoint am I editing" indicator + selector for issue #35. While
 * a non-base breakpoint is active, every style edit is keyed to that breakpoint
 * (ADR-0005) and previewed media-gated (breakpointPreview.ts).
 *
 * Thin declaration over PortalListboxSelect — portal/keyboard/trigger/listbox
 * wiring lives there; this file owns only the options list and the prop contract.
 *
 * Also owns the viewport-mismatch warning (audit gap #12): the preview is
 * genuinely media-gated, so a non-base breakpoint's edits are only VISIBLE
 * when the viewport actually matches its media query. When it doesn't (e.g.
 * "≥ 1280" active in a 1000px window) every drag changes nothing on the page —
 * a compact amber line under the selector explains why and how to fix it,
 * kept live via matchMedia + window resize listeners.
 */

import { useEffect, useMemo, useState } from "react";
import { Monitor, TriangleAlert } from "lucide-react";
import { PortalListboxSelect } from "../controls/PortalListboxSelect";
import { getBreakpoints, BASE_BREAKPOINT_ID, mediaConditionFor } from "../breakpoints";
import { color, font, warningAlpha } from "../theme";

export interface BreakpointSelectorProps {
  value: string;
  onChange: (breakpoint: string) => void;
}

/** Extract the numeric min-width from a `(min-width: Npx)` media condition. */
function minWidthOf(cond: string): number | null {
  const m = /\(min-width:\s*([\d.]+)px\)/.exec(cond);
  return m ? parseFloat(m[1]) : null;
}

/**
 * Does the current viewport satisfy this breakpoint's media condition?
 * Base (no condition) always matches. Prefers matchMedia; falls back to a
 * plain innerWidth comparison so the check degrades safely.
 */
export function viewportMatchesBreakpoint(id: string): boolean {
  const cond = mediaConditionFor(id);
  if (!cond || typeof window === "undefined") return true;
  try {
    if (typeof window.matchMedia === "function") return window.matchMedia(cond).matches;
  } catch {
    /* fall through to the innerWidth check */
  }
  const min = minWidthOf(cond);
  return min == null || window.innerWidth >= min;
}

/** Live "does the viewport match the active breakpoint?" — re-evaluated on
 *  breakpoint change, matchMedia change events, and window resize. */
function useViewportMismatch(value: string): { mismatch: boolean; viewportWidth: number } {
  const [snap, setSnap] = useState(() => ({
    matches: viewportMatchesBreakpoint(value),
    width: typeof window === "undefined" ? 0 : window.innerWidth,
  }));

  useEffect(() => {
    const update = () =>
      setSnap({ matches: viewportMatchesBreakpoint(value), width: window.innerWidth });
    update(); // re-evaluate immediately when the active breakpoint changes

    const cond = mediaConditionFor(value);
    let mql: MediaQueryList | null = null;
    if (cond && typeof window.matchMedia === "function") {
      try {
        mql = window.matchMedia(cond);
      } catch {
        mql = null;
      }
    }
    mql?.addEventListener?.("change", update);
    // Belt-and-braces: resize also re-runs the check (and refreshes the px
    // readout in the message while still mismatched).
    window.addEventListener("resize", update);
    return () => {
      mql?.removeEventListener?.("change", update);
      window.removeEventListener("resize", update);
    };
  }, [value]);

  return { mismatch: !snap.matches, viewportWidth: snap.width };
}

export function BreakpointSelector({ value, onChange }: BreakpointSelectorProps) {
  // Resolved at mount (≈ panel open): configured project breakpoints →
  // stylesheet-detected set → the conventional defaults (breakpoints.ts).
  const options = useMemo(
    () => getBreakpoints().map((b) => ({ id: b.id, label: b.label })),
    [],
  );

  const { mismatch, viewportWidth } = useViewportMismatch(value);
  const cond = mediaConditionFor(value);
  const min = cond ? minWidthOf(cond) : null;

  return (
    <>
      <PortalListboxSelect
        value={value}
        onChange={onChange}
        options={options}
        baseId={BASE_BREAKPOINT_ID}
        leadingIcon={(isBase) => (
          <Monitor size={12} style={{ flexShrink: 0, opacity: isBase ? 0.6 : 0.9 }} />
        )}
        estimatedWidth={160}
        triggerTitle="Target breakpoint"
      />
      {mismatch && (
        <div
          role="status"
          data-breakpoint-mismatch
          style={{
            // The header toolbar row is flex-wrap — a 100% basis pushes the
            // warning onto its own line directly under the selectors.
            flexBasis: "100%",
            minWidth: 0,
            display: "flex",
            alignItems: "center",
            gap: 5,
            marginTop: 2,
            padding: "3px 6px",
            borderRadius: 4,
            background: warningAlpha(0.15),
            color: color.foreground,
            fontSize: 10,
            fontFamily: font.sans,
            lineHeight: "13px",
          }}
        >
          <TriangleAlert size={10} style={{ color: color.badgeAmber, flexShrink: 0 }} />
          <span>
            {min != null
              ? `Viewport is ${viewportWidth}px — widen to ≥ ${min}px to see these edits.`
              : "This breakpoint's edits aren't visible at the current viewport."}
          </span>
        </div>
      )}
    </>
  );
}
