/**
 * StyleIndicator.tsx — small colored dot showing if a property was edited
 *
 * Binary: "modified" (blue dot) or "none" (invisible).
 * INTENTIONAL SIMPLIFICATION — user requested removing multi-type indicators.
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
