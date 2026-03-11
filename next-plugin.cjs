/**
 * withTuner() — Next.js plugin wrapper
 *
 * Usage in next.config.js:
 *   const withTuner = require('redial/next-plugin');
 *   module.exports = withTuner({ ...yourConfig });
 *
 * What it does:
 * - In dev mode: enables CSS source maps for the commit flow
 * - In production: no-op passthrough
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
