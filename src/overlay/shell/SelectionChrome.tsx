/**
 * SelectionChrome.tsx — the fixed-position visual chrome drawn around the
 * selected element: selection outline, breadcrumb-ancestor hover outline,
 * dimensions badge, tag label, and the hover-preview highlight.
 *
 * Extracted verbatim from Overlay.tsx. These are pure presentational `<div>`s
 * whose positions/contents are written imperatively by useSelectionOutline /
 * usePageInteractions via the refs threaded in here — so this component holds
 * no state and just owns the markup. Overlay still decides when to render it.
 */

import type { RefObject } from "react";
import { ms } from "../timing";
import { color, font, primaryAlpha, zIndex } from "../theme";

export interface SelectionChromeProps {
  selectedOutlineRef: RefObject<HTMLDivElement | null>;
  ancestorOutlineRef: RefObject<HTMLDivElement | null>;
  dimensionsBadgeRef: RefObject<HTMLDivElement | null>;
  tagLabelRef: RefObject<HTMLDivElement | null>;
  hoverHighlightRef: RefObject<HTMLDivElement | null>;
}

export function SelectionChrome({
  selectedOutlineRef,
  ancestorOutlineRef,
  dimensionsBadgeRef,
  tagLabelRef,
  hoverHighlightRef,
}: SelectionChromeProps) {
  return (
    <>
      <div
        ref={selectedOutlineRef}
        className="__tuner-selected-outline"
        // No transition on geometry: useElementTracker writes top/left/width/height
        // synchronously on every scroll frame and live edit, so animating those
        // writes would make the box trail the content (scroll lag) and glide toward
        // each new size instead of snapping. Mirror BoxModelOverlay's transition:"none".
        // The "--pulse" attention cue is a separate @keyframes *animation*
        // (see useInjectedStyles.ts), not a transition, so it is unaffected.
        style={{ display: 'none', position: "fixed", pointerEvents: "none", zIndex: zIndex.overlay, border: `1.5px solid ${color.primary}`, borderRadius: 2, transition: "none" }}
      />
      {/* Breadcrumb ancestor hover outline */}
      <div
        ref={ancestorOutlineRef}
        className="__tuner-overlay"
        style={{ display: 'none', position: "fixed", pointerEvents: "none", zIndex: zIndex.guide, border: `1.5px dashed ${primaryAlpha(0.5)}`, borderRadius: 2, background: primaryAlpha(0.04) }}
      />
      {/* Dimensions badge: W x H below bottom-right */}
      <div
        ref={dimensionsBadgeRef}
        className="__tuner-overlay"
        style={{ display: 'none', position: "fixed", pointerEvents: "none", zIndex: zIndex.overlay, fontSize: 10, fontFamily: font.mono, paddingLeft: 6, paddingRight: 6, paddingTop: 2, paddingBottom: 2, borderRadius: 3, whiteSpace: "nowrap", background: color.primary, color: color.primaryForeground }}
      />
      {/* Tag label: tag.class above top-left */}
      <div
        ref={tagLabelRef}
        className="__tuner-overlay"
        style={{ display: 'none', position: "fixed", pointerEvents: "none", zIndex: zIndex.overlay, fontSize: 10, fontFamily: font.mono, paddingLeft: 6, paddingRight: 6, paddingTop: 2, paddingBottom: 2, borderRadius: 3, whiteSpace: "nowrap", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", background: color.primary, color: color.primaryForeground }}
      />
      {/* Hover highlight: subtle preview when hovering a different element */}
      <div
        ref={hoverHighlightRef}
        className="__tuner-overlay"
        style={{ display: 'none', position: "fixed", pointerEvents: "none", zIndex: zIndex.backdrop, borderRadius: 2, transition: `all ${ms("fast")} ease-out`, background: primaryAlpha(0.06), border: `1px solid ${primaryAlpha(0.2)}` }}
      />
    </>
  );
}
