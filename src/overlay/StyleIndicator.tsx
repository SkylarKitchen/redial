/**
 * StyleIndicator.tsx — small colored dot indicating the source of a style property
 *
 * Colors:
 *   direct    → blue (#3b82f6)   — set on current class
 *   inherited → orange (#f59e0b) — inherited from parent/base
 *   state     → green (#22c55e)  — state-specific style
 *   element   → pink (#ec4899)   — element-level only
 *   none      → not rendered
 */

export type IndicatorType = "direct" | "inherited" | "state" | "element" | "none";

export interface StyleIndicatorProps {
  type: IndicatorType;
}

const INDICATOR_CONFIG: Record<
  Exclude<IndicatorType, "none">,
  { color: string; title: string }
> = {
  direct: { color: "#3b82f6", title: "Direct: style set on current class" },
  inherited: { color: "#f59e0b", title: "Inherited: from parent or base class" },
  state: { color: "#22c55e", title: "State: state-specific style" },
  element: { color: "#ec4899", title: "Element: element-level override" },
};

export function StyleIndicator({ type }: StyleIndicatorProps) {
  if (type === "none") return null;

  const { color, title } = INDICATOR_CONFIG[type];

  return (
    <span
      title={title}
      style={{
        display: "inline-block",
        width: "4px",
        height: "4px",
        borderRadius: "50%",
        background: color,
        boxShadow: `0 0 3px ${color}`,
        verticalAlign: "middle",
        flexShrink: 0,
      }}
    />
  );
}
