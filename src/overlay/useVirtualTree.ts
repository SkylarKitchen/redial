/**
 * useVirtualTree.ts — Virtualized rendering for flat tree node lists
 *
 * Given a flat list of tree nodes with fixed row height, computes the
 * visible slice based on scroll position, container size, and overscan.
 */

import { useMemo } from "react";
import type { TreeNode } from "./navigator/navigatorFilter";

// ─── Types ──────────────────────────────────────────────────────

export interface UseVirtualTreeOptions {
  flatNodes: { node: TreeNode; depth: number }[];
  rowHeight: number;
  containerHeight: number;
  scrollTop: number;
  overscan?: number; // default 5
}

export interface UseVirtualTreeResult {
  visibleNodes: { node: TreeNode; depth: number; index: number }[];
  totalHeight: number;
  offsetY: number;
}

// ─── Hook ───────────────────────────────────────────────────────

export function useVirtualTree(
  options: UseVirtualTreeOptions,
): UseVirtualTreeResult {
  const {
    flatNodes,
    rowHeight,
    containerHeight,
    scrollTop,
    overscan = 5,
  } = options;

  return useMemo(() => {
    const totalHeight = flatNodes.length * rowHeight;

    if (flatNodes.length === 0) {
      return { visibleNodes: [], totalHeight: 0, offsetY: 0 };
    }

    const startIndex = Math.max(
      0,
      Math.floor(scrollTop / rowHeight) - overscan,
    );
    const endIndex = Math.min(
      flatNodes.length,
      Math.ceil((scrollTop + containerHeight) / rowHeight) + overscan,
    );

    const visibleNodes = flatNodes
      .slice(startIndex, endIndex)
      .map((flat, i) => ({
        ...flat,
        index: startIndex + i,
      }));

    const offsetY = startIndex * rowHeight;

    return { visibleNodes, totalHeight, offsetY };
  }, [flatNodes, scrollTop, containerHeight, rowHeight, overscan]);
}
