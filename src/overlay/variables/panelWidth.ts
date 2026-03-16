const BASE_WIDTH = 340; // sidebar 170 + padding 24 + icon 14 + name 100 + gaps 12 + action 20
const PER_MODE = 136; // ~136px per flex column (min 120px + gap)
const MIN_WIDTH = 580; // single-mode minimum width
const MAX_RATIO = 0.8;

/**
 * Compute variables panel width based on mode column count.
 * Grows to fit: BASE + modes * PER_MODE, min 580px, caps at 80vw.
 * Columns flex to fill — this sets the panel's total width, not column width.
 */
export function getVariablesPanelWidth(
  modeCount: number,
  viewportWidth?: number,
): number {
  const vw =
    viewportWidth ??
    (typeof window !== "undefined" ? window.innerWidth : 1440);
  const computed = BASE_WIDTH + modeCount * PER_MODE;
  return Math.max(MIN_WIDTH, Math.min(computed, Math.floor(vw * MAX_RATIO)));
}
