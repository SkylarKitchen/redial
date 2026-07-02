/**
 * config.ts — runtime configuration for the tuner overlay
 *
 * Module-level config avoids threading props through every component.
 * Set via <Tuner commitEndpoint="/custom/path" /> or configure() directly.
 */

/** One project breakpoint: a mobile-first min-width tier (px). */
export interface TunerBreakpoint {
  /** Selector label, e.g. "Tablet". Defaults to "≥ {minWidth}". */
  label?: string;
  /** min-width in px. Must be a positive finite number. */
  minWidth: number;
}

export interface TunerConfig {
  /** API route for saving CSS changes to source files. Default: "/api/tuner/commit" */
  commitEndpoint: string;
  /**
   * The project's responsive breakpoints (mobile-first min-widths). When set,
   * this replaces the default 640/768/1024/1280 set everywhere — selector UI,
   * live-preview media queries, and export serialization. When omitted, the
   * set is auto-detected from the project's stylesheets' `@media (min-width)`
   * rules, falling back to the defaults (see breakpoints.ts).
   */
  breakpoints?: TunerBreakpoint[];
}

const defaults: TunerConfig = {
  commitEndpoint: "/api/tuner/commit",
};

let current: TunerConfig = { ...defaults };

/** Read the current config. */
export function getConfig(): Readonly<TunerConfig> {
  return current;
}

/** Merge partial overrides into the config. */
export function configure(overrides: Partial<TunerConfig>): void {
  current = { ...current, ...overrides };
}
