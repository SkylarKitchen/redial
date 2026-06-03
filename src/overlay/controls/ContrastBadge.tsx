/**
 * controls/ContrastBadge.tsx — Live WCAG text-contrast gauge for the Typography
 * "Color" row.
 *
 * A thin renderer over the pure `evaluateContrast()`. It re-runs on every style
 * override (via subscribeOverrides) so the ratio tracks unsaved drags in real
 * time — something static auditors like Lighthouse/axe can't do. Honest about
 * uncertainty: shows a neutral dash, never a confident pass/fail, when the
 * backdrop can't be derived from color alone.
 */
import { useEffect, useReducer } from "react";
import { subscribeOverrides } from "../core/apply";
import { evaluateContrast } from "../core/contrast";
import { contrast as contrastColor, font } from "../theme";
import { hexToRgba } from "../colorUtils";

function formatRatio(r: number): string {
  return (r >= 10 ? Math.round(r).toString() : r.toFixed(1)) + ":1";
}

export function ContrastBadge({
  element,
  value,
}: {
  element: Element;
  value: string;
}) {
  // Force a recompute whenever any override mutates (covers ancestor-background
  // edits, not just this row's own value, which re-renders via props anyway).
  const [, force] = useReducer((x: number) => x + 1, 0);
  useEffect(() => subscribeOverrides(force), [element]);

  const result = evaluateContrast(element, value);

  let tint: string;
  let labelText: string;
  let title: string;

  if (result.kind === "unknown") {
    tint = contrastColor.unknown;
    labelText = "—"; // em dash
    title = `Can't measure contrast — ${result.reason}`;
  } else if (result.kind === "fail") {
    tint = contrastColor.fail;
    labelText = formatRatio(result.ratio);
    const needed = result.largeText ? "3:1 (large text)" : "4.5:1";
    title = `Contrast ${formatRatio(result.ratio)} — below WCAG AA (needs ${needed})`;
  } else {
    tint = contrastColor.pass;
    labelText = `${result.level} ${formatRatio(result.ratio)}`;
    title = `Contrast ${formatRatio(result.ratio)} — passes WCAG ${result.level}${
      result.largeText ? " (large text)" : ""
    }`;
  }

  return (
    <span
      title={title}
      aria-label={title}
      style={{
        flexShrink: 0,
        display: "inline-flex",
        alignItems: "center",
        fontSize: 9,
        fontFamily: font.mono,
        lineHeight: 1,
        padding: "2px 5px",
        borderRadius: 3,
        color: tint,
        background: hexToRgba(tint, 0.12),
        whiteSpace: "nowrap",
      }}
    >
      {labelText}
    </span>
  );
}
