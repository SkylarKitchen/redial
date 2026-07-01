/**
 * withTuner() — Next.js plugin wrapper
 *
 * Usage in next.config.js:
 *   const withTuner = require('redial/next-plugin');
 *   module.exports = withTuner({ ...yourConfig });
 *
 * Only needed when developing with webpack (`next dev --webpack`), where it
 * nudges the dev devtool toward full source maps. Under Turbopack — the
 * `next dev` default since Next 15 — this webpack hook never runs (Next
 * ignores webpack config there), and no plugin is needed: Turbopack already
 * emits CSS source maps in dev (under .next/dev/static/…), which the commit
 * server reads directly (issue #59).
 *
 * In production builds it is a no-op passthrough either way. Redial's save
 * flow also works without source maps at all — the commit server falls back
 * to searching source files — so skipping the plugin degrades accuracy, not
 * functionality.
 */

/** @param {import('next').NextConfig} nextConfig */
function withTuner(nextConfig = {}) {
  return {
    ...nextConfig,

    webpack(config, options) {
      // Enable CSS source maps in dev for source file resolution
      if (options.dev && !options.isServer) {
        // Ensure devtool includes source maps
        if (!config.devtool || config.devtool === 'eval') {
          config.devtool = 'eval-source-map';
        }
      }

      // Call user's webpack config if provided
      if (typeof nextConfig.webpack === 'function') {
        return nextConfig.webpack(config, options);
      }

      return config;
    },
  };
}

module.exports = withTuner;
module.exports.withTuner = withTuner;
