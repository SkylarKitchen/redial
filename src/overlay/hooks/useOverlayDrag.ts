/**
 * useOverlayDrag.ts — draggable panel position subsystem
 *
 * Owns the panel's screen position, edge anchoring, snap-to-edge behavior,
 * and the mouse-drag interaction started from the header drag handle.
 *
 * Extracted verbatim from Overlay.tsx — behavior is identical. The hook
 * takes the active panel type and the variables mode count (the same inputs
 * Overlay used to derive the panel width) so the clamp / re-anchor effects
 * preserve their exact dependency-array re-run semantics, and returns the
 * position state plus the `handleDragStart` callback for the header.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { getVariablesPanelWidth } from "../variables/panelWidth";

const SNAP_THRESHOLD = 20;
const SNAP_MARGIN = 16;
const PANEL_HEIGHT_ESTIMATE = 500;

export interface OverlayDrag {
  pos: { x: number; y: number };
  setPos: React.Dispatch<React.SetStateAction<{ x: number; y: number }>>;
  anchor: "left" | "right" | null;
  setAnchor: React.Dispatch<React.SetStateAction<"left" | "right" | null>>;
  snapping: boolean;
  panelDragging: boolean;
  /** Current panel width in px (inspector = 300, variables = dynamic). */
  panelWidth: number;
  handleDragStart: (e: React.MouseEvent) => void;
}

/**
 * Manage the draggable tuner panel position.
 *
 * @param activePanelType Discriminant of the active panel ("variables" vs. other).
 * @param variablesModeCount Mode column count used to size the variables panel.
 */
export function useOverlayDrag(
  activePanelType: string,
  variablesModeCount: number,
): OverlayDrag {
  // Panel position (draggable)
  // anchor tracks which horizontal edge the panel is snapped to so resize keeps it pinned
  const [pos, setPos] = useState({ x: window.innerWidth - 300 - 16, y: 16 });
  const [anchor, setAnchor] = useState<"left" | "right" | null>("right");
  const [snapping, setSnapping] = useState(false);
  const [panelDragging, setPanelDragging] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null);
  const snapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The document mousemove/mouseup handlers of the drag in flight, if any.
  // They normally self-remove on mouseup — this ref lets the unmount cleanup
  // detach them when the component unmounts mid-drag (otherwise they'd stay
  // on document until the next mouseup, calling setPos on an unmounted hook).
  const dragListenersRef = useRef<{ move: (e: MouseEvent) => void; up: () => void } | null>(null);

  const PANEL_WIDTH = activePanelType === "variables" ? getVariablesPanelWidth(variablesModeCount) : 300;

  const handleDragStart = useCallback(
    (e: React.MouseEvent) => {
      // Clear any pending snap timer when starting a new drag
      if (snapTimerRef.current) {
        clearTimeout(snapTimerRef.current);
        snapTimerRef.current = null;
      }
      setSnapping(false);
      setPanelDragging(true);

      dragRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        originX: pos.x,
        originY: pos.y,
      };

      const handleMouseMove = (e: MouseEvent) => {
        if (!dragRef.current) return;
        const dx = e.clientX - dragRef.current.startX;
        const dy = e.clientY - dragRef.current.startY;
        // Clamp to viewport so panel can't drift off-screen
        const x = Math.max(0, Math.min(window.innerWidth - PANEL_WIDTH, dragRef.current.originX + dx));
        const y = Math.max(0, Math.min(window.innerHeight - 100, dragRef.current.originY + dy));
        setPos({ x, y });
      };

      const handleMouseUp = () => {
        dragRef.current = null;
        setPanelDragging(false);
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
        dragListenersRef.current = null;

        // Snap to nearest edge if within threshold, and track which edge we're anchored to
        setPos((current) => {
          const vw = window.innerWidth;
          const vh = window.innerHeight;
          let x = current.x;
          let y = current.y;
          let didSnap = false;
          let newAnchor: "left" | "right" | null = null;

          // Horizontal snap
          if (x <= SNAP_THRESHOLD) {
            x = SNAP_MARGIN;
            newAnchor = "left";
            didSnap = true;
          } else if (x >= vw - PANEL_WIDTH - SNAP_THRESHOLD) {
            x = vw - PANEL_WIDTH - SNAP_MARGIN;
            newAnchor = "right";
            didSnap = true;
          }

          // Vertical snap
          if (y <= SNAP_THRESHOLD) {
            y = SNAP_MARGIN;
            didSnap = true;
          } else if (y >= vh - PANEL_HEIGHT_ESTIMATE - SNAP_THRESHOLD) {
            y = vh - PANEL_HEIGHT_ESTIMATE - SNAP_MARGIN;
            didSnap = true;
          }

          setAnchor(newAnchor);

          if (didSnap) {
            setSnapping(true);
            snapTimerRef.current = setTimeout(() => {
              setSnapping(false);
              snapTimerRef.current = null;
            }, 150);
          }

          return { x, y };
        });
      };

      dragListenersRef.current = { move: handleMouseMove, up: handleMouseUp };
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [pos, PANEL_WIDTH]
  );

  // --- Detach mid-drag document listeners on unmount ---
  // Unmounting while a drag is in flight must not orphan the drag handlers.
  useEffect(() => {
    return () => {
      if (dragListenersRef.current) {
        document.removeEventListener("mousemove", dragListenersRef.current.move);
        document.removeEventListener("mouseup", dragListenersRef.current.up);
        dragListenersRef.current = null;
      }
    };
  }, []);

  // --- Re-anchor panel position on window resize ---
  useEffect(() => {
    const handleResize = () => {
      setPos((p) => {
        const MARGIN = 16;
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        // If anchored to an edge, recompute from that edge; otherwise just clamp
        const pw = activePanelType === "variables" ? getVariablesPanelWidth(variablesModeCount) : 300;
        const x = anchor === "right"
          ? vw - pw - MARGIN
          : anchor === "left"
            ? MARGIN
            : Math.max(0, Math.min(vw - pw, p.x));
        const y = Math.max(0, Math.min(vh - 100, p.y));
        return { x, y };
      });
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [anchor, activePanelType, variablesModeCount]);

  // --- Reposition panel when switching between inspector (300px) and variables (dynamic) ---
  useEffect(() => {
    const pw = activePanelType === "variables" ? getVariablesPanelWidth(variablesModeCount) : 300;
    setPos((p) => {
      const vw = window.innerWidth;
      const MARGIN = 16;
      // If panel would overflow right edge, clamp it
      if (p.x + pw > vw - MARGIN) {
        return { x: Math.max(MARGIN, vw - pw - MARGIN), y: p.y };
      }
      // If anchored right, snap to right edge with new width
      if (anchor === "right") {
        return { x: vw - pw - MARGIN, y: p.y };
      }
      return p;
    });
  }, [activePanelType, anchor, variablesModeCount]);

  return { pos, setPos, anchor, setAnchor, snapping, panelDragging, panelWidth: PANEL_WIDTH, handleDragStart };
}
