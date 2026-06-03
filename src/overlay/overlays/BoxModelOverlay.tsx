/**
 * BoxModelOverlay.tsx — Chrome DevTools-style box model visualization
 *
 * Renders colored overlays directly on the selected page element:
 * - Margin (orange): extends outward from border-box
 * - Padding (green): extends inward from border-box
 * - Content (blue): innermost content area
 *
 * Positions the three boxes via the shared `useElementTracker` hook (the same
 * event-driven tracker the selection outline uses): scroll is synchronous,
 * size/style/class changes are rAF-coalesced via ResizeObserver + a
 * MutationObserver, and `subscribeOverrides` re-syncs after engine edits that
 * don't mutate the element's own attributes (CSS vars on :root, undo/redo). The
 * three rectangles are computed by the shared `boxRects(parseBoxModel(el), rect)`
 * geometry util; the DOM nodes themselves are still created and positioned
 * imperatively.
 */

import { useCallback, useEffect, useRef } from "react";
import { marginWarmAlpha, greenAlpha, primaryAlpha, zIndex } from "../theme";
import { useElementTracker } from "../hooks/useElementTracker";
import { subscribeOverrides } from "../core/apply";
import { parseBoxModel, boxRects } from "../util/boxGeometry";

const MARGIN_COLOR = marginWarmAlpha(0.15);
const PADDING_COLOR = greenAlpha(0.15);
const CONTENT_COLOR = primaryAlpha(0.15);

interface BoxModelOverlayProps {
  element: Element;
}

export function BoxModelOverlay({ element }: BoxModelOverlayProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const marginRef = useRef<HTMLDivElement | null>(null);
  const paddingRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);

  // Create the three colored boxes once into the container; tear them down on
  // unmount. Positioning happens in the tracker's onUpdate below.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const marginDiv = document.createElement("div");
    const paddingDiv = document.createElement("div");
    const contentDiv = document.createElement("div");

    const baseStyle: Partial<CSSStyleDeclaration> = {
      position: "fixed",
      pointerEvents: "none",
      zIndex: String(zIndex.guide),
      transition: "none",
    };

    for (const div of [marginDiv, paddingDiv, contentDiv]) {
      Object.assign(div.style, baseStyle);
      container.appendChild(div);
    }

    marginDiv.style.background = MARGIN_COLOR;
    paddingDiv.style.background = PADDING_COLOR;
    contentDiv.style.background = CONTENT_COLOR;

    marginRef.current = marginDiv;
    paddingRef.current = paddingDiv;
    contentRef.current = contentDiv;

    return () => {
      while (container.firstChild) container.removeChild(container.firstChild);
      marginRef.current = null;
      paddingRef.current = null;
      contentRef.current = null;
    };
  }, []);

  useElementTracker(
    element,
    true,
    useCallback(
      (rect: DOMRect) => {
        const marginDiv = marginRef.current;
        const paddingDiv = paddingRef.current;
        const contentDiv = contentRef.current;
        if (!marginDiv || !paddingDiv || !contentDiv) return;

        const { margin, padding, content } = boxRects(parseBoxModel(element), rect);

        // Margin box: border-box expanded outward by margin
        marginDiv.style.top = `${margin.top}px`;
        marginDiv.style.left = `${margin.left}px`;
        marginDiv.style.width = `${margin.width}px`;
        marginDiv.style.height = `${margin.height}px`;

        // Padding box: inside the border (border-box minus border widths)
        paddingDiv.style.top = `${padding.top}px`;
        paddingDiv.style.left = `${padding.left}px`;
        paddingDiv.style.width = `${padding.width}px`;
        paddingDiv.style.height = `${padding.height}px`;

        // Content box: inside padding
        contentDiv.style.top = `${content.top}px`;
        contentDiv.style.left = `${content.left}px`;
        contentDiv.style.width = `${content.width}px`;
        contentDiv.style.height = `${content.height}px`;

        const container = containerRef.current;
        if (container) container.style.display = "block";
      },
      [element],
    ),
    useCallback(() => {
      // Element disconnected (HMR, navigation) — hide the whole group.
      const container = containerRef.current;
      if (container) container.style.display = "none";
    }, []),
    // Re-sync after engine edits that don't mutate the element's own style/class
    // attribute — e.g. a CSS variable on :root, a stylesheet-rule/class edit, or
    // undo/redo. Mirrors useSelectionOutline.
    subscribeOverrides,
  );

  return (
    <div
      ref={containerRef}
      className="__tuner-overlay"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        pointerEvents: "none",
        zIndex: zIndex.guide,
      }}
    />
  );
}
