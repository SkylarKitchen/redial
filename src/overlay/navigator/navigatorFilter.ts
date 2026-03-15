/**
 * navigatorFilter.ts — Smart DOM tree filtering for the Navigator panel
 *
 * Pure filtering logic: walks the DOM from <body>, decides which nodes to
 * show/hide based on the PRD's smart filter rules, and returns a nested
 * tree structure suitable for rendering.
 */

import { getDisplayClass, isNavigableElement } from "./util";

// ─── Types ────────────────────────────────────────────────────────

export interface TreeNode {
  el: Element;
  tag: string;
  displayClass: string | null;
  children: TreeNode[];
  depth: number;
}

// ─── Semantic Elements ────────────────────────────────────────────

const SEMANTIC_TAGS = new Set([
  "main", "section", "article", "nav", "header", "footer", "aside",
  "h1", "h2", "h3", "h4", "h5", "h6", "p",
  "ul", "ol", "li", "a", "button", "img", "video", "audio",
  "form", "input", "textarea", "select", "table", "thead", "tbody", "tr", "td", "th",
  "figure", "figcaption", "details", "summary", "dialog",
  "label", "fieldset", "legend",
]);

// ─── Skip Rules ───────────────────────────────────────────────────

const SKIP_TAGS = new Set([
  "script", "style", "link", "meta", "noscript", "template",
  "base", "title", "head",
]);

/**
 * Should this element be entirely excluded from the tree?
 * These are never shown — not even as potential gap-bridgers.
 */
export function shouldSkipEntirely(el: Element): boolean {
  const tag = el.tagName.toLowerCase();
  if (SKIP_TAGS.has(tag)) return true;

  // Skip Redial's own UI
  if ((el as HTMLElement).closest?.(".__tuner-root")) return true;
  if ((el as HTMLElement).closest?.("[data-agentation-root]")) return true;
  if ((el as HTMLElement).closest?.("[data-tuner-portal]")) return true;

  // Skip invisible elements (display: none or visibility: hidden)
  if (el instanceof HTMLElement) {
    try {
      const style = getComputedStyle(el);
      if (style.display === "none") return true;
      if (style.visibility === "hidden") return true;
    } catch {
      // getComputedStyle can throw for disconnected elements
    }
  }

  return false;
}

/**
 * Should this element be shown in the tree?
 * PRD rules: show if semantic, has class/id, has text, has >1 child, or has inline styles.
 */
export function shouldShowNode(el: Element): boolean {
  const tag = el.tagName.toLowerCase();

  // 1. Semantic element
  if (SEMANTIC_TAGS.has(tag)) return true;

  // 2. Has class name or id
  if (el.id) return true;
  // SVGElement.className is SVGAnimatedString, not string — use getAttribute
  const cls = el.getAttribute("class");
  if (cls && cls.trim()) return true;

  // 3. Has direct text content (not just whitespace)
  for (const child of el.childNodes) {
    if (child.nodeType === Node.TEXT_NODE && child.textContent?.trim()) return true;
  }

  // 4. Has more than one child element
  if (el.children.length > 1) return true;

  // 5. Has explicit inline styles
  if (el instanceof HTMLElement && el.style.cssText.trim()) return true;

  // SVG root elements are always interesting
  if (tag === "svg") return true;

  return false;
}

// ─── Tree Building ────────────────────────────────────────────────

/**
 * Build a filtered tree from a root element.
 * Walks the DOM recursively, applying smart filter rules.
 * Gap prevention: if a hidden node sits between a visible parent and visible child,
 * promote it to visible so the tree stays connected.
 */
export function buildFilteredTree(root: Element, startDepth = 0): TreeNode[] {
  const results: TreeNode[] = [];

  for (const child of root.children) {
    const nodes = buildNodeRecursive(child, startDepth);
    results.push(...nodes);
  }

  return results;
}

function buildNodeRecursive(el: Element, depth: number): TreeNode[] {
  // Hard skip: never show this element or any descendants
  if (shouldSkipEntirely(el)) return [];

  // Also skip if not navigable (body, html, etc.)
  if (!isNavigableElement(el)) return [];

  // Recursively process children first
  const childNodes: TreeNode[] = [];
  for (const child of el.children) {
    childNodes.push(...buildNodeRecursive(child, depth + 1));
  }

  const show = shouldShowNode(el);

  if (show) {
    // This node is visible — wrap its children under it
    return [{
      el,
      tag: el.tagName.toLowerCase(),
      displayClass: getDisplayClass(el),
      children: childNodes,
      depth,
    }];
  }

  // Node is hidden — but if it has visible children, we need gap prevention:
  // Promote children up to maintain tree connectivity
  if (childNodes.length > 0) {
    // If there's exactly one child, just promote it (transparent wrapper)
    // If there are multiple children, promote the hidden node to keep them grouped
    if (childNodes.length > 1) {
      // Gap prevention: show this node anyway to group its children
      return [{
        el,
        tag: el.tagName.toLowerCase(),
        displayClass: getDisplayClass(el),
        children: childNodes,
        depth,
      }];
    }
    // Single visible child — just promote it, adjusting depth
    return childNodes.map(c => adjustDepth(c, depth - c.depth));
  }

  return [];
}

/** Adjust depth of a node and all its descendants by a delta */
function adjustDepth(node: TreeNode, delta: number): TreeNode {
  if (delta === 0) return node;
  return {
    ...node,
    depth: node.depth + delta,
    children: node.children.map(c => adjustDepth(c, delta)),
  };
}

// ─── Flattening (for keyboard nav) ───────────────────────────────

export interface FlatNode {
  node: TreeNode;
  depth: number;
}

/**
 * Flatten the visible (expanded) portion of a tree into a list.
 * Only includes nodes whose ancestors are all expanded.
 */
export function flattenTree(
  nodes: TreeNode[],
  expandedNodes: Set<Element>,
): FlatNode[] {
  const result: FlatNode[] = [];

  function walk(list: TreeNode[]) {
    for (const node of list) {
      result.push({ node, depth: node.depth });
      if (node.children.length > 0 && expandedNodes.has(node.el)) {
        walk(node.children);
      }
    }
  }

  walk(nodes);
  return result;
}

/**
 * Count total visible elements in a tree (recursive).
 */
export function countNodes(nodes: TreeNode[]): number {
  let count = 0;
  for (const node of nodes) {
    count += 1 + countNodes(node.children);
  }
  return count;
}

/**
 * Get all ancestor elements of a target within a tree.
 * Returns elements from root towards target (for auto-expanding).
 */
export function getAncestorsInTree(
  nodes: TreeNode[],
  target: Element,
): Element[] {
  const ancestors: Element[] = [];

  function find(list: TreeNode[], path: Element[]): boolean {
    for (const node of list) {
      if (node.el === target) {
        ancestors.push(...path);
        return true;
      }
      if (node.children.length > 0) {
        if (find(node.children, [...path, node.el])) return true;
      }
    }
    return false;
  }

  find(nodes, []);
  return ancestors;
}
