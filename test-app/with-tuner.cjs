/**
 * Local CJS wrapper for the parent next-plugin.
 * The parent package uses "type": "module", so next-plugin.js can't be
 * required directly. This .cjs file is always treated as CommonJS.
 */

/** @param {import('next').NextConfig} nextConfig */
function withTuner(nextConfig = {}) {
  return {
    ...nextConfig,

    webpack(config, options) {
      // Enable CSS source maps in dev for source file resolution
      if (options.dev && !options.isServer) {
        if (!config.devtool || config.devtool === "eval") {
          config.devtool = "eval-source-map";
        }
      }

      // Call user's webpack config if provided
      if (typeof nextConfig.webpack === "function") {
        return nextConfig.webpack(config, options);
      }

      return config;
    },
  };
}

module.exports = withTuner;
module.exports.withTuner = withTuner;
