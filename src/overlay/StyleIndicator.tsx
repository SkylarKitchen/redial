/**
 * StyleIndicator.tsx — small blue dot showing a property was modified
 *
 * Binary: "modified" shows a blue dot, "none" renders nothing.
 */

export type IndicatorType = "modified" | "none";

export interface StyleIndicatorProps {
  type: IndicatorType;
}

const DOT_COLOR = "#3b82f6";

export function StyleIndicator({ type }: StyleIndicatorProps) {
  if (type === "none") return null;

  return (
    <span
      title="Modified — Option+Click to reset"
      style={{
        display: "inline-block",
        width: "4px",
        height: "4px",
        borderRadius: "50%",
        background: DOT_COLOR,
        boxShadow: `0 0 3px ${DOT_COLOR}`,
        verticalAlign: "middle",
        flexShrink: 0,
      }}
    />
  );
}
