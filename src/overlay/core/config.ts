/**
 * config.ts — runtime configuration for the tuner overlay
 *
 * Module-level config avoids threading props through every component.
 * Set via <Tuner commitEndpoint="/custom/path" /> or configure() directly.
 */

export interface TunerConfig {
  /** API route for saving CSS changes to source files. Default: "/api/tuner/commit" */
  commitEndpoint: string;
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
