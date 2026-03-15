/**
 * navigatorDrag.ts — Pure logic for drag-to-reorder DOM elements via the Navigator tree
 *
 * Handles:
 * - Draggability checks (body/html/head are immovable)
 * - Drop target validation (void elements, self-drops, descendant-drops)
 * - DOM move execution with undo/redo support
 */

import type { TreeNode } from "./navigatorFilter";

// ─── Types ────────────────────────────────────────────────────────

export interface NavDragState {
  draggedEl: Element;
  draggedNode: TreeNode;
  dropTarget: DropTarget | null;
  offsetY: number;
}

export type DropTarget =
  | { type: "between"; parent: Element; before: Element | null }
  | { type: "into"; container: Element };

// ─── Constants ────────────────────────────────────────────────────

const VOID_ELEMENTS = new Set([
  "img", "input", "br", "hr", "area", "col", "embed", "source", "track", "wbr",
]);

const UNDRAGGABLE = new Set(["body", "html", "head"]);

// ─── Validation ───────────────────────────────────────────────────

/** Check if an element can be dragged (body/html/head cannot). */
export function canDrag(el: Element): boolean {
  return !UNDRAGGABLE.has(el.tagName.toLowerCase());
}

/** Check if a dragged element can be dropped at the given target. */
export function canDrop(dragged: Element, target: DropTarget): boolean {
  if (target.type === "into") {
    const tag = target.container.tagName.toLowerCase();
    if (VOID_ELEMENTS.has(tag)) return false;
    if ((target.container as HTMLElement).closest?.(".__tuner-root")) return false;
    if (target.container === dragged || dragged.contains(target.container)) return false;
  }
  if (target.type === "between") {
    if (target.parent === dragged || dragged.contains(target.parent)) return false;
    if ((target.parent as HTMLElement).closest?.(".__tuner-root")) return false;
  }
  return true;
}

// ─── Execution ────────────────────────────────────────────────────

export interface DomMoveResult {
  undo: () => void;
  redo: () => void;
}

/**
 * Execute a drop: move `dragged` to the position described by `target`.
 * Returns undo/redo callbacks for the undo stack.
 */
export function executeDrop(dragged: Element, target: DropTarget): DomMoveResult {
  // Save original position for undo
  const oldParent = dragged.parentElement!;
  const oldNextSibling = dragged.nextElementSibling;

  const doMove = () => {
    if (target.type === "between") {
      target.parent.insertBefore(dragged, target.before);
    } else {
      target.container.appendChild(dragged);
    }
  };

  const undoMove = () => {
    if (oldNextSibling) {
      oldParent.insertBefore(dragged, oldNextSibling);
    } else {
      oldParent.appendChild(dragged);
    }
  };

  doMove();

  return { undo: undoMove, redo: doMove };
}
