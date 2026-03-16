const BASE_WIDTH = 380; // sidebar 170 + icon 14 + name 130 + actions 40 + gaps 26
const PER_MODE = 140;
const MIN_WIDTH = 520; // 1 mode fits comfortably (380+140=520)
const MAX_RATIO = 0.8;

/**
 * Compute variables panel width based on mode column count.
 * Grows exactly to fit: BASE + modes * 140px, min 520px, caps at 80vw.
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
