/**
 * BoxModelOverlay.tsx — Chrome DevTools-style box model visualization
 *
 * Renders colored overlays directly on the selected page element:
 * - Margin (orange): extends outward from border-box
 * - Padding (green): extends inward from border-box
 * - Content (blue): innermost content area
 *
 * Uses a RAF loop + ResizeObserver for live position tracking.
 */

import { useEffect, useRef } from "react";
import { zIndex } from "./theme";

const MARGIN_COLOR = "rgba(255, 155, 0, 0.15)";
const PADDING_COLOR = "rgba(99, 196, 99, 0.15)";
const CONTENT_COLOR = "rgba(99, 148, 237, 0.15)";

interface BoxModelOverlayProps {
  element: Element;
  refreshKey?: number;
}

export function BoxModelOverlay({ element, refreshKey }: BoxModelOverlayProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !element.isConnected) return;

    let rafId: number;
    let cancelled = false;

    // Create overlay elements
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

    function update() {
      if (cancelled || !element.isConnected) {
        container!.style.display = "none";
        return;
      }

      const cs = getComputedStyle(element);
      const rect = element.getBoundingClientRect();

      // Parse all box model values
      const mt = parseFloat(cs.marginTop) || 0;
      const mr = parseFloat(cs.marginRight) || 0;
      const mb = parseFloat(cs.marginBottom) || 0;
      const ml = parseFloat(cs.marginLeft) || 0;

      const pt = parseFloat(cs.paddingTop) || 0;
      const pr = parseFloat(cs.paddingRight) || 0;
      const pb = parseFloat(cs.paddingBottom) || 0;
      const pl = parseFloat(cs.paddingLeft) || 0;

      const bt = parseFloat(cs.borderTopWidth) || 0;
      const br = parseFloat(cs.borderRightWidth) || 0;
      const bb = parseFloat(cs.borderBottomWidth) || 0;
      const bl = parseFloat(cs.borderLeftWidth) || 0;

      // Margin box: border-box expanded outward by margin
      marginDiv.style.top = `${rect.top - mt}px`;
      marginDiv.style.left = `${rect.left - ml}px`;
      marginDiv.style.width = `${rect.width + ml + mr}px`;
      marginDiv.style.height = `${rect.height + mt + mb}px`;

      // Padding box: inside the border (border-box minus border widths)
      paddingDiv.style.top = `${rect.top + bt}px`;
      paddingDiv.style.left = `${rect.left + bl}px`;
      paddingDiv.style.width = `${rect.width - bl - br}px`;
      paddingDiv.style.height = `${rect.height - bt - bb}px`;

      // Content box: inside padding
      contentDiv.style.top = `${rect.top + bt + pt}px`;
      contentDiv.style.left = `${rect.left + bl + pl}px`;
      contentDiv.style.width = `${rect.width - bl - br - pl - pr}px`;
      contentDiv.style.height = `${rect.height - bt - bb - pt - pb}px`;

      container!.style.display = "block";
    }

    // Event-driven updates instead of perpetual RAF loop
    function scheduleUpdate() {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(update);
    }

    // Initial paint
    scheduleUpdate();

    // Re-sync on scroll, window resize, and element layout changes
    window.addEventListener("scroll", scheduleUpdate, true);
    window.addEventListener("resize", scheduleUpdate);
    let ro: ResizeObserver | undefined;
    try {
      ro = new ResizeObserver(scheduleUpdate);
      ro.observe(element);
    } catch {
      // ResizeObserver not available
    }

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
      window.removeEventListener("scroll", scheduleUpdate, true);
      window.removeEventListener("resize", scheduleUpdate);
      ro?.disconnect();
      // Clean up child nodes
      while (container.firstChild) container.removeChild(container.firstChild);
    };
  }, [element, refreshKey]);

  return (
    <div
      ref={containerRef}
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
