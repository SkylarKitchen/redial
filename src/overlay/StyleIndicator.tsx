/**
 * StyleIndicator.tsx — small colored dot indicating the source of a style property
 *
 * Colors come from theme.indicatorColor — see theme.ts for the palette.
 */

import { indicatorColor } from "./theme";

export type IndicatorType = "direct" | "inherited" | "state" | "element" | "variable" | "none";

export interface StyleIndicatorProps {
  type: IndicatorType;
}

const INDICATOR_CONFIG: Record<
  Exclude<IndicatorType, "none">,
  { color: string; title: string }
> = {
  direct: { color: indicatorColor.direct, title: "Direct: style set on current class" },
  inherited: { color: indicatorColor.inherited, title: "Inherited: from parent or base class" },
  state: { color: indicatorColor.state, title: "State: state-specific style" },
  element: { color: indicatorColor.element, title: "Element: element-level override" },
  variable: { color: indicatorColor.variable, title: "Variable: uses CSS var()" },
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
