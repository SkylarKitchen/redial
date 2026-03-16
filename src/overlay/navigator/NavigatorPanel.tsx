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
import { motion } from "motion/react";
import {
  buildFilteredTree,
  flattenTree,
  countNodes,
  getAncestorsInTree,
  type TreeNode,
} from "./navigatorFilter";
import { NavigatorNode, ROW_HEIGHT } from "./NavigatorNode";
import { useVirtualTree } from "../hooks/useVirtualTree";
import {
  canDrag,
  canDrop,
  executeDrop,
  type NavDragState,
  type DropTarget,
} from "./navigatorDrag";
import { pushDomMove } from "../core/apply";
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
} from "../theme";
import { timing, ms, springConfig } from "../timing";

// ─── Props ──────────────────────────────────────────────────────

interface NavigatorPanelProps {
  selectedEl: Element | null;
  onSelectElement: (el: Element) => void;
  onClose: () => void;
}

// ─── Constants ──────────────────────────────────────────────────

const PANEL_WIDTH = 300;
const COLLAPSED_WIDTH = 28;
const COLLAPSED_HEIGHT = 80;
const SNAP_THRESHOLD = 20;
const SNAP_MARGIN = 16;
const DEFAULT_POS = { x: SNAP_MARGIN, y: SNAP_MARGIN };
const PANEL_HEIGHT_ESTIMATE = 500;

/** Stable key generator for Element references (avoids index-based keys) */
let _nextKeyId = 0;
const _keyMap = new WeakMap<Element, string>();
function getStableKey(el: Element): string {
  let key = _keyMap.get(el);
  if (!key) {
    key = `nav-${_nextKeyId++}`;
    _keyMap.set(el, key);
  }
  return key;
}

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
  const [focusedEl, setFocusedEl] = useState<Element | null>(null);

  // ── Node drag-to-reorder state ──
  const [nodeDragState, setNodeDragState] = useState<NavDragState | null>(null);
  const isDraggingNodeRef = useRef(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(400);

  // ── Measure scroll container height ──
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setContainerHeight(entry.contentRect.height);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

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

  // ── Virtualized rendering ──
  const { visibleNodes, totalHeight, offsetY } = useVirtualTree({
    flatNodes,
    rowHeight: ROW_HEIGHT,
    containerHeight,
    scrollTop,
  });

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

  // ── Bidirectional selection sync: expand ancestors ──
  useEffect(() => {
    if (!selectedEl) return;
    const ancestors = getAncestorsInTree(tree, selectedEl);
    if (ancestors.length > 0) {
      setExpandedNodes((prev) => {
        const next = new Set(prev);
        for (const el of ancestors) next.add(el);
        return next;
      });
    }
  }, [selectedEl, tree]);

  // ── Bidirectional selection sync: scroll into view ──
  // Separate effect so it runs *after* flatNodes recomputes from ancestor expansion
  const pendingScrollRef = useRef<Element | null>(null);
  useEffect(() => {
    if (selectedEl) pendingScrollRef.current = selectedEl;
  }, [selectedEl]);

  useEffect(() => {
    const target = pendingScrollRef.current;
    if (!target) return;
    const idx = flatNodes.findIndex((fn) => fn.node.el === target);
    if (idx >= 0 && scrollRef.current) {
      const targetScroll = idx * ROW_HEIGHT;
      const container = scrollRef.current;
      if (
        targetScroll < container.scrollTop ||
        targetScroll > container.scrollTop + containerHeight - ROW_HEIGHT
      ) {
        container.scrollTop = targetScroll - containerHeight / 2;
      }
      pendingScrollRef.current = null;
    }
  }, [flatNodes, containerHeight]);

  // ── Keyboard navigation ──
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const handled = ["ArrowDown", "ArrowUp", "ArrowLeft", "ArrowRight", "Enter"];
      if (!handled.includes(e.key)) return;
      e.preventDefault();

      // Derive current index from focusedEl (survives tree rebuilds)
      const curIdx = focusedEl
        ? flatNodes.findIndex((f) => f.node.el === focusedEl)
        : -1;

      if (e.key === "ArrowDown") {
        const next = Math.min(curIdx + 1, flatNodes.length - 1);
        if (next >= 0) setFocusedEl(flatNodes[next].node.el);
      } else if (e.key === "ArrowUp") {
        const next = Math.max(curIdx - 1, 0);
        if (flatNodes.length > 0) setFocusedEl(flatNodes[next].node.el);
      } else if (e.key === "ArrowRight") {
        if (curIdx >= 0 && curIdx < flatNodes.length) {
          const { node } = flatNodes[curIdx];
          if (node.children.length > 0 && !expandedNodes.has(node.el)) {
            handleToggle(node.el);
          } else if (node.children.length > 0) {
            // Move to first child
            const next = Math.min(curIdx + 1, flatNodes.length - 1);
            setFocusedEl(flatNodes[next].node.el);
          }
        }
      } else if (e.key === "ArrowLeft") {
        if (curIdx >= 0 && curIdx < flatNodes.length) {
          const { node } = flatNodes[curIdx];
          if (node.children.length > 0 && expandedNodes.has(node.el)) {
            handleToggle(node.el);
          } else {
            const ancestors = getAncestorsInTree(tree, node.el);
            const parentEl = ancestors.length > 0 ? ancestors[ancestors.length - 1] : null;
            if (parentEl) setFocusedEl(parentEl);
          }
        }
      } else if (e.key === "Enter") {
        if (curIdx >= 0 && curIdx < flatNodes.length) {
          onSelectElement(flatNodes[curIdx].node.el);
        }
      }
    },
    [flatNodes, focusedEl, expandedNodes, handleToggle, tree, onSelectElement],
  );

  // ── Node drag-to-reorder handler ──
  // Use a ref to track the latest drop target for the pointerup handler,
  // since the closure captures the initial state.
  const nodeDragDropRef = useRef<DropTarget | null>(null);

  const handleNodeDragStart = useCallback(
    (node: TreeNode, e: React.PointerEvent) => {
      if (!canDrag(node.el)) return;
      const target = e.currentTarget as HTMLElement;
      target.setPointerCapture(e.pointerId);

      const startY = e.clientY;
      let hasMoved = false;
      isDraggingNodeRef.current = true;
      nodeDragDropRef.current = null;
      document.body.style.userSelect = "none";

      const onMove = (ev: PointerEvent) => {
        const dy = ev.clientY - startY;
        if (!hasMoved && Math.abs(dy) < 3) return; // dead zone
        hasMoved = true;

        // Compute drop target from cursor position relative to tree rows
        const container = scrollRef.current;
        if (!container) return;
        const rows = container.querySelectorAll("[data-nav-el]");
        let dropTarget: DropTarget | null = null;

        for (let ri = 0; ri < rows.length; ri++) {
          const rect = rows[ri].getBoundingClientRect();
          if (ev.clientY >= rect.top && ev.clientY <= rect.bottom) {
            // Find the matching flatNode by looking at the visible slice
            const visIdx = ri;
            if (visIdx >= visibleNodes.length) break;
            const rowNode = visibleNodes[visIdx].node;

            // Skip self
            if (rowNode.el === node.el) break;

            const third = rect.height / 3;
            if (ev.clientY < rect.top + third) {
              // Top third: insert before this element
              dropTarget = {
                type: "between",
                parent: rowNode.el.parentElement!,
                before: rowNode.el,
              };
            } else if (
              ev.clientY > rect.bottom - third &&
              rowNode.children.length > 0
            ) {
              // Bottom third of a container: insert into
              dropTarget = { type: "into", container: rowNode.el };
            } else {
              // Middle or bottom of leaf: insert after
              dropTarget = {
                type: "between",
                parent: rowNode.el.parentElement!,
                before: rowNode.el.nextElementSibling,
              };
            }
            break;
          }
        }

        if (dropTarget && !canDrop(node.el, dropTarget)) dropTarget = null;

        nodeDragDropRef.current = dropTarget;
        setNodeDragState({
          draggedEl: node.el,
          draggedNode: node,
          dropTarget,
          offsetY: dy,
        });
      };

      const onUp = () => {
        target.removeEventListener("pointermove", onMove);
        target.removeEventListener("pointerup", onUp);
        target.removeEventListener("lostpointercapture", onUp);
        document.body.style.userSelect = "";

        if (hasMoved && nodeDragDropRef.current) {
          const result = executeDrop(node.el, nodeDragDropRef.current);
          pushDomMove(result);
          // Rebuild tree after the move
          setRebuildKey((k) => k + 1);
        }

        isDraggingNodeRef.current = false;
        nodeDragDropRef.current = null;
        setNodeDragState(null);
      };

      target.addEventListener("pointermove", onMove);
      target.addEventListener("pointerup", onUp);
      target.addEventListener("lostpointercapture", onUp);
    },
    [visibleNodes],
  );

  // ── MutationObserver for live DOM sync ──
  useEffect(() => {
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    const observer = new MutationObserver(() => {
      if (isDraggingNodeRef.current) return;
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
        setFocusedEl(null);
        setRebuildKey((k) => k + 1);
      }, timing.layout);
    });

    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      if (debounceTimer) clearTimeout(debounceTimer);
    };
  }, []);

  // ── Collapse state ──
  const [collapsed, setCollapsed] = useState(false);
  const [collapseHovered, setCollapseHovered] = useState(false);
  const preCollapsePos = useRef(pos);

  // ── Close button hover ──
  const [closeHovered, setCloseHovered] = useState(false);

  return (
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

        {/* ── Tree body (virtualized) ── */}
        <div
          ref={scrollRef}
          role="tree"
          tabIndex={0}
          onKeyDown={handleKeyDown}
          onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: "auto",
            overflowX: "hidden",
            outline: "none",
          }}
        >
          {/* Spacer div for total scroll height */}
          <div style={{ height: totalHeight, position: "relative" }}>
            {/* Positioned visible slice */}
            <div style={{ transform: `translateY(${offsetY}px)` }}>
              {visibleNodes.map((flat, vi) => {
                const isDropBefore =
                  nodeDragState?.dropTarget?.type === "between" &&
                  nodeDragState.dropTarget.before === flat.node.el;
                const isDropInto =
                  nodeDragState?.dropTarget?.type === "into" &&
                  nodeDragState.dropTarget.container === flat.node.el;

                return (
                  <div
                    key={getStableKey(flat.node.el)}
                    data-nav-el="true"
                    style={{ position: "relative" }}
                  >
                    {/* Drop indicator line — before this row */}
                    {isDropBefore && (
                      <div
                        style={{
                          position: "absolute",
                          left: 0,
                          right: 0,
                          top: 0,
                          height: 2,
                          background: color.primary,
                          zIndex: zIndex.above,
                          pointerEvents: "none",
                        }}
                      />
                    )}
                    <NavigatorNode
                      node={flat.node}
                      depth={flat.node.depth}
                      isExpanded={expandedNodes.has(flat.node.el)}
                      isSelected={flat.node.el === selectedEl}
                      isFocused={flat.node.el === focusedEl}
                      isDragging={nodeDragState?.draggedEl === flat.node.el}
                      isDraggedOver={isDropInto}
                      onToggle={() => handleToggle(flat.node.el)}
                      onSelect={() => {
                        onSelectElement(flat.node.el);
                        setFocusedEl(flat.node.el);
                        // Refocus tree container so onKeyDown keeps working
                        scrollRef.current?.focus();
                      }}
                      onDragStart={(e) => handleNodeDragStart(flat.node, e)}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>

      </motion.div>
  );
}
