/**
 * NavigatorPanel.tsx — Floating DOM tree panel for the Navigator feature
 *
 * Renders a filtered DOM tree from <body> with expand/collapse,
 * bidirectional selection sync, keyboard navigation, and live DOM sync.
 */

import {
  useState,
  useCallback,
  useEffect,
  useRef,
  useMemo,
} from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  buildFilteredTree,
  flattenTree,
  countNodes,
  getAncestorsInTree,
  type TreeNode,
} from "./navigatorFilter";
import { NavigatorNode } from "./NavigatorNode";
import {
  color,
  text,
  border,
  surface,
  font,
  shadow,
  blackAlpha,
  primaryAlpha,
  layout,
  zIndex,
} from "./theme";
import { timing, ms, springConfig } from "./timing";

// ─── Props ──────────────────────────────────────────────────────

interface NavigatorPanelProps {
  selectedEl: Element | null;
  onSelectElement: (el: Element) => void;
  onClose: () => void;
}

// ─── Constants ──────────────────────────────────────────────────

const PANEL_WIDTH = 300;
const SNAP_THRESHOLD = 20;
const SNAP_MARGIN = 16;
const DEFAULT_POS = { x: 16, y: 80 };
const PANEL_HEIGHT_ESTIMATE = 500;

// ─── Helpers ────────────────────────────────────────────────────

/** Collect all elements at depth <= maxDepth for initial auto-expand */
function collectExpandable(nodes: TreeNode[], maxDepth: number): Element[] {
  const result: Element[] = [];
  for (const node of nodes) {
    if (node.children.length > 0 && node.depth < maxDepth) {
      result.push(node.el);
      result.push(...collectExpandable(node.children, maxDepth));
    }
  }
  return result;
}

/** Find a node's parent element in the tree */
function findParentEl(
  nodes: TreeNode[],
  target: Element,
): Element | null {
  for (const node of nodes) {
    for (const child of node.children) {
      if (child.el === target) return node.el;
      const found = findParentEl([child], target);
      if (found) return found;
    }
  }
  return null;
}

// ─── Component ──────────────────────────────────────────────────

export function NavigatorPanel({
  selectedEl,
  onSelectElement,
  onClose,
}: NavigatorPanelProps) {
  // ── Position / drag state ──
  const [pos, setPos] = useState(DEFAULT_POS);
  const [dragging, setDragging] = useState(false);
  const [snapping, setSnapping] = useState(false);
  const dragRef = useRef<{
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);
  const snapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Tree state ──
  const [rebuildKey, setRebuildKey] = useState(0);
  const [expandedNodes, setExpandedNodes] = useState<Set<Element>>(
    () => new Set(),
  );
  const [focusedIndex, setFocusedIndex] = useState(-1);

  const scrollRef = useRef<HTMLDivElement>(null);

  // ── Build filtered tree ──
  const tree = useMemo(
    () => buildFilteredTree(document.body),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rebuildKey],
  );

  // Auto-expand first 2 levels on initial build
  const initialExpandDone = useRef(false);
  useEffect(() => {
    if (!initialExpandDone.current && tree.length > 0) {
      initialExpandDone.current = true;
      setExpandedNodes(new Set(collectExpandable(tree, 2)));
    }
  }, [tree]);

  // ── Flatten visible portion ──
  const flatNodes = useMemo(
    () => flattenTree(tree, expandedNodes),
    [tree, expandedNodes],
  );

  const totalCount = useMemo(() => countNodes(tree), [tree]);

  // ── Toggle expand/collapse ──
  const handleToggle = useCallback((el: Element) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(el)) {
        next.delete(el);
      } else {
        next.add(el);
      }
      return next;
    });
  }, []);

  // ── Drag handling (mirrors Overlay.tsx pattern) ──
  const handleDragStart = useCallback(
    (e: React.MouseEvent) => {
      if (snapTimerRef.current) {
        clearTimeout(snapTimerRef.current);
        snapTimerRef.current = null;
      }
      setSnapping(false);
      setDragging(true);

      dragRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        originX: pos.x,
        originY: pos.y,
      };

      const handleMouseMove = (ev: MouseEvent) => {
        if (!dragRef.current) return;
        const dx = ev.clientX - dragRef.current.startX;
        const dy = ev.clientY - dragRef.current.startY;
        const x = Math.max(
          0,
          Math.min(
            window.innerWidth - PANEL_WIDTH,
            dragRef.current.originX + dx,
          ),
        );
        const y = Math.max(
          0,
          Math.min(window.innerHeight - 100, dragRef.current.originY + dy),
        );
        setPos({ x, y });
      };

      const handleMouseUp = () => {
        dragRef.current = null;
        setDragging(false);
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);

        // Snap to nearest edge
        setPos((current) => {
          const vw = window.innerWidth;
          const vh = window.innerHeight;
          let x = current.x;
          let y = current.y;
          let didSnap = false;

          if (x <= SNAP_THRESHOLD) {
            x = SNAP_MARGIN;
            didSnap = true;
          } else if (x >= vw - PANEL_WIDTH - SNAP_THRESHOLD) {
            x = vw - PANEL_WIDTH - SNAP_MARGIN;
            didSnap = true;
          }

          if (y <= SNAP_THRESHOLD) {
            y = SNAP_MARGIN;
            didSnap = true;
          } else if (y >= vh - PANEL_HEIGHT_ESTIMATE - SNAP_THRESHOLD) {
            y = vh - PANEL_HEIGHT_ESTIMATE - SNAP_MARGIN;
            didSnap = true;
          }

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

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [pos],
  );

  // ── Bidirectional selection sync ──
  useEffect(() => {
    if (!selectedEl) return;

    // Expand all ancestors so the selected node is visible
    const ancestors = getAncestorsInTree(tree, selectedEl);
    if (ancestors.length > 0) {
      setExpandedNodes((prev) => {
        const next = new Set(prev);
        for (const el of ancestors) next.add(el);
        return next;
      });
    }

    // Scroll the selected row into view after React renders
    requestAnimationFrame(() => {
      const container = scrollRef.current;
      if (!container) return;
      const row = container.querySelector(
        `[data-nav-el="true"][aria-selected="true"]`,
      );
      if (row) {
        row.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
    });
  }, [selectedEl, tree]);

  // ── Keyboard navigation ──
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const handled = ["ArrowDown", "ArrowUp", "ArrowLeft", "ArrowRight", "Enter"];
      if (!handled.includes(e.key)) return;
      e.preventDefault();

      if (e.key === "ArrowDown") {
        setFocusedIndex((i) => Math.min(i + 1, flatNodes.length - 1));
      } else if (e.key === "ArrowUp") {
        setFocusedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "ArrowRight") {
        if (focusedIndex >= 0 && focusedIndex < flatNodes.length) {
          const { node } = flatNodes[focusedIndex];
          if (node.children.length > 0 && !expandedNodes.has(node.el)) {
            handleToggle(node.el);
          } else if (node.children.length > 0) {
            // Move to first child
            setFocusedIndex((i) => Math.min(i + 1, flatNodes.length - 1));
          }
        }
      } else if (e.key === "ArrowLeft") {
        if (focusedIndex >= 0 && focusedIndex < flatNodes.length) {
          const { node } = flatNodes[focusedIndex];
          if (node.children.length > 0 && expandedNodes.has(node.el)) {
            handleToggle(node.el);
          } else {
            // Move to parent
            const parentEl = findParentEl(tree, node.el);
            if (parentEl) {
              const parentIdx = flatNodes.findIndex(
                (f) => f.node.el === parentEl,
              );
              if (parentIdx >= 0) setFocusedIndex(parentIdx);
            }
          }
        }
      } else if (e.key === "Enter") {
        if (focusedIndex >= 0 && focusedIndex < flatNodes.length) {
          onSelectElement(flatNodes[focusedIndex].node.el);
        }
      }
    },
    [flatNodes, focusedIndex, expandedNodes, handleToggle, tree, onSelectElement],
  );

  // Reset focus index on tree rebuild
  useEffect(() => {
    setFocusedIndex(-1);
  }, [rebuildKey]);

  // ── MutationObserver for live DOM sync ──
  useEffect(() => {
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    const observer = new MutationObserver(() => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        // Clean disconnected elements from expandedNodes
        setExpandedNodes((prev) => {
          const next = new Set<Element>();
          for (const el of prev) {
            if (el.isConnected) next.add(el);
          }
          return next;
        });
        setRebuildKey((k) => k + 1);
      }, timing.layout);
    });

    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      if (debounceTimer) clearTimeout(debounceTimer);
    };
  }, []);

  // ── Close button hover ──
  const [closeHovered, setCloseHovered] = useState(false);

  return (
    <AnimatePresence>
      <motion.div
        className="__tuner-root"
        style={{
          position: "fixed",
          zIndex: zIndex.max,
          width: PANEL_WIDTH,
          height: "80vh",
          maxHeight: "80vh",
          background: color.background,
          borderRadius: layout.panelRadius,
          boxShadow: dragging ? shadow.panelDrag : shadow.panel,
          backdropFilter: "blur(20px)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          border: `1px solid ${blackAlpha(0.07)}`,
          top: pos.y,
          left: pos.x,
          transformOrigin: "top left",
          transition: snapping
            ? `top ${ms("expand")} ease, left ${ms("expand")} ease, box-shadow ${ms("expand")}`
            : `box-shadow ${ms("expand")}`,
          fontFamily: font.sans,
        }}
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{
          opacity: 1,
          scale: 1,
          y: 0,
          transition: springConfig("panelOpen"),
        }}
        exit={{
          opacity: 0,
          scale: 0.97,
          y: 4,
          transition: springConfig("panelClose"),
        }}
      >
        {/* ── Header ── */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            height: 36,
            padding: "0 8px",
            borderBottom: `1px solid ${border.subtle}`,
            flexShrink: 0,
            userSelect: "none",
          }}
        >
          {/* Drag handle — 2x3 grip dots */}
          <div
            onMouseDown={handleDragStart}
            style={{
              width: 16,
              height: 20,
              display: "grid",
              gridTemplateColumns: "4px 4px",
              gridTemplateRows: "4px 4px 4px",
              gap: 2,
              alignContent: "center",
              justifyContent: "center",
              cursor: dragging ? "grabbing" : "grab",
              marginRight: 4,
              flexShrink: 0,
            }}
          >
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                style={{
                  width: 2.5,
                  height: 2.5,
                  borderRadius: "50%",
                  background: blackAlpha(0.2),
                }}
              />
            ))}
          </div>

          {/* Title */}
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: text.primary,
              marginRight: 6,
            }}
          >
            Navigator
          </span>

          {/* Element count badge */}
          <span
            style={{
              fontSize: 10,
              color: text.hint,
            }}
          >
            {totalCount} elements
          </span>

          {/* Spacer */}
          <div style={{ flex: 1 }} />

          {/* Close button */}
          <button
            onClick={onClose}
            onMouseEnter={() => setCloseHovered(true)}
            onMouseLeave={() => setCloseHovered(false)}
            style={{
              width: 24,
              height: 24,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 14,
              color: text.label,
              background: closeHovered ? surface.hover : "transparent",
              border: "none",
              borderRadius: 4,
              cursor: "pointer",
              padding: 0,
              lineHeight: 1,
              transition: `background ${ms("fast")}`,
            }}
          >
            ×
          </button>
        </div>

        {/* ── Tree body ── */}
        <div
          ref={scrollRef}
          role="tree"
          tabIndex={0}
          onKeyDown={handleKeyDown}
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: "auto",
            overflowX: "hidden",
            outline: "none",
          }}
        >
          {flatNodes.map((flat, i) => (
            <div key={`${flat.node.tag}-${flat.depth}-${i}`} data-nav-el="true">
              <NavigatorNode
                node={flat.node}
                depth={flat.depth}
                isExpanded={expandedNodes.has(flat.node.el)}
                isSelected={flat.node.el === selectedEl}
                isFocused={i === focusedIndex}
                onToggle={() => handleToggle(flat.node.el)}
                onSelect={() => onSelectElement(flat.node.el)}
              />
            </div>
          ))}
        </div>

        {/* ── Footer ── */}
        <div
          style={{
            height: 28,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderTop: `1px solid ${border.subtle}`,
            flexShrink: 0,
          }}
        >
          <span
            style={{
              fontSize: 10,
              color: text.hint,
            }}
          >
            {totalCount} elements
          </span>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
