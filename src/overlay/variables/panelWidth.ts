const BASE_WIDTH = 340; // sidebar 170 + padding 24 + icon 14 + name 100 + gaps 12 + action 20
const PER_MODE = 136; // 132px cell + 4px gap
const MIN_WIDTH = 580; // single-mode minimum width
const MAX_RATIO = 0.8;

/**
 * Compute variables panel width based on mode column count.
 * Grows exactly to fit: BASE + modes * 110px, min 580px, caps at 80vw.
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
