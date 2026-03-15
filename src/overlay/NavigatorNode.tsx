/**
 * NavigatorNode.tsx — Single tree row in the Navigator panel
 *
 * Renders one element in the DOM tree: indentation, expand chevron,
 * tag name, class name, and selection/focus highlights.
 */

import { useState } from "react";
import type { TreeNode } from "./navigatorFilter";
import { text, surface, font, border, color, primaryAlpha } from "./theme";
import { ms } from "./timing";

interface NavigatorNodeProps {
  node: TreeNode;
  depth: number;
  isExpanded: boolean;
  isSelected: boolean;
  isFocused: boolean;
  isDraggedOver?: boolean;
  isDragging?: boolean;
  onToggle: () => void;
  onSelect: () => void;
  onDragStart?: (e: React.PointerEvent) => void;
}

const INDENT_PX = 16;
export const ROW_HEIGHT = 26;

export function NavigatorNode({
  node,
  depth,
  isExpanded,
  isSelected,
  isFocused,
  isDraggedOver,
  isDragging,
  onToggle,
  onSelect,
  onDragStart,
}: NavigatorNodeProps) {
  const [hovered, setHovered] = useState(false);
  const hasChildren = node.children.length > 0;

  return (
    <div
      role="treeitem"
      aria-expanded={hasChildren ? isExpanded : undefined}
      aria-selected={isSelected}
      tabIndex={isFocused ? 0 : -1}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={node.displayClass ? `${node.tag}.${node.displayClass}` : node.tag}
      style={{
        display: "flex",
        alignItems: "center",
        height: ROW_HEIGHT,
        paddingLeft: depth * INDENT_PX + 4,
        paddingRight: 8,
        cursor: "pointer",
        userSelect: "none",
        fontSize: 11,
        fontFamily: font.mono,
        color: isSelected ? color.primary : text.primary,
        background: isSelected
          ? primaryAlpha(0.08)
          : hovered
          ? surface.hover
          : "transparent",
        borderLeft: isSelected
          ? `2px solid ${color.primary}`
          : "2px solid transparent",
        transition: `background ${ms("fast")}, color ${ms("fast")}`,
        outline: isFocused ? `1px solid ${primaryAlpha(0.4)}` : "none",
        outlineOffset: -1,
      }}
    >
      {/* Chevron */}
      <span
        onClick={(e) => {
          e.stopPropagation();
          if (hasChildren) onToggle();
        }}
        style={{
          width: 16,
          height: 16,
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 9,
          color: hasChildren ? text.label : "transparent",
          cursor: hasChildren ? "pointer" : "default",
          transition: `transform ${ms("expand")}`,
          transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)",
        }}
      >
        {hasChildren ? "▶" : ""}
      </span>

      {/* Tag name */}
      <span style={{ color: isSelected ? color.primary : text.secondary, flexShrink: 0 }}>
        {node.tag}
      </span>

      {/* Class name */}
      {node.displayClass && (
        <span
          style={{
            color: isSelected ? primaryAlpha(0.7) : text.hint,
            marginLeft: 1,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          .{node.displayClass}
        </span>
      )}
    </div>
  );
}
